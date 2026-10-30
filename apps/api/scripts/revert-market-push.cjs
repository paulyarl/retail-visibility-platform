#!/usr/bin/env node
/**
 * revert-market-push — hard-delete a PG market push's seeds and everything
 * that hangs off them (listings, settings, claim tokens, provenance,
 * touches, intelligence reports, presence events, queue back-refs), plus the
 * stub tenants the seeds created.
 *
 * Plain Node + node-postgres (same rationale as db-rescue.cjs: pgbouncer
 * simple-protocol safe, no build step). Run through doppler:
 *
 *   doppler run --config prd -- node scripts/revert-market-push.cjs            # dry-run
 *   doppler run --config prd -- node scripts/revert-market-push.cjs --apply
 *   ... --like 'pg-mcamp-xxxx%' --like 'other%'                               # override batches
 *
 * Before deleting, writes a full-row backup of every seed / listing /
 * settings / claim-token row to <repo>/audits/market-revert-<ts>.json
 * (audits/ is gitignored).
 *
 * Created 2026-10-30 for the 3-market revert (kept Indianapolis).
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const likeArgs = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--like') likeArgs.push(args[++i]);
// Default scope: the three non-Indianapolis pushes from the 2026-10-23→28
// market push (Fort Wayne, Kansas City metro, Milwaukee).
const LIKES = likeArgs.length
  ? likeArgs
  : ['pg-mcamp-qemsvv6t%', 'pg-mcamp-z6ak0tq1%', 'pg-mcamp-fv4svcsx%'];

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const [base, ...qs] = (dbUrl || '').split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;
const client = new Client({
  connectionString: cleanUrl,
  ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
});
const q = async (sql) => (await client.query(sql)).rows;
const e = async (sql) => (await client.query(sql)).rowCount;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

(async () => {
  await client.connect();

  const where = LIKES.map((l) => `seed_batch LIKE ${lit(l)}`).join(' OR ');
  const seeds = await q(`SELECT * FROM directory_presence_seeds WHERE ${where} ORDER BY seed_batch, city`);
  if (!seeds.length) {
    console.log('No seeds matched.', LIKES);
    process.exit(0);
  }
  const ids = seeds.map((s) => s.id);
  const idList = `(${ids.map(lit).join(',')})`;
  const listingIds = [...new Set(seeds.map((s) => s.listing_id).filter(Boolean))];
  const tenantIds = [...new Set(seeds.map((s) => s.tenant_id).filter(Boolean))];
  const listingList = `(${listingIds.map(lit).join(',')})`;
  const tenantList = `(${tenantIds.map(lit).join(',')})`;

  // Scope recap — eyeball check before anything is deleted.
  const recap = {};
  for (const s of seeds) {
    const k = `${s.seed_batch} [${s.city}, ${s.state}]`;
    recap[k] = recap[k] || { total: 0 };
    recap[k].total++;
    recap[k][s.status] = (recap[k][s.status] || 0) + 1;
  }
  console.log(`Seeds in scope: ${seeds.length}`);
  for (const [k, v] of Object.entries(recap)) console.log(' ', k, JSON.stringify(v));

  // Safety: nothing in scope may be an Indianapolis-market seed — the keep
  // market is Indianapolis city + the mcamp-mdjvk2bu campaign batches.
  const bad = seeds.filter(
    (s) =>
      (s.city || '').toLowerCase() === 'indianapolis' ||
      /mdjvk2bu/.test(s.seed_batch || ''),
  );
  if (bad.length) {
    console.error('ABORT — Indianapolis-market seeds matched the scope:', bad.map((b) => `${b.seed_batch} ${b.city}`));
    process.exit(1);
  }

  const listings = listingIds.length
    ? await q(`SELECT * FROM directory_listings_list WHERE id IN ${listingList}`)
    : [];
  const settings = tenantIds.length
    ? await q(`SELECT * FROM directory_settings_list WHERE tenant_id IN ${tenantList}`)
    : [];
  const tokens = await q(`SELECT * FROM directory_claim_tokens WHERE seed_id IN ${idList}`);

  // Dependent-row census (no-FK and NO ACTION children — CASCADE children
  // ride the seed delete).
  const census = [
    ['mkt_prospect_queue.seed_id', `SELECT count(*) n FROM mkt_prospect_queue WHERE seed_id IN ${idList}`],
    ['mkt_prospect_dedup_verdicts.merge_into', `SELECT count(*) n FROM mkt_prospect_dedup_verdicts WHERE merge_into IN ${idList}`],
    ['directory_chain_group_members.seed_id', `SELECT count(*) n FROM directory_chain_group_members WHERE seed_id IN ${idList}`],
    ['directory_claim_request_verifications.seed_id', `SELECT count(*) n FROM directory_claim_request_verifications WHERE seed_id IN ${idList}`],
    ['mkt_seed_intelligence_reports.seed_id', `SELECT count(*) n FROM mkt_seed_intelligence_reports WHERE seed_id IN ${idList}`],
    ['mkt_outreach_anchors.seed_id', `SELECT count(*) n FROM mkt_outreach_anchors WHERE seed_id IN ${idList}`],
    ['seo_query_signals.seed_id', `SELECT count(*) n FROM seo_query_signals WHERE seed_id IN ${idList}`],
    ['directory_presence_events.listing_id', `SELECT count(*) n FROM directory_presence_events WHERE listing_id IN ${listingList}`],
    ['directory_listing_categories.listing_id', `SELECT count(*) n FROM directory_listing_categories WHERE listing_id IN ${listingList}`],
    ['directory_listing_enrichment_log.listing_id', `SELECT count(*) n FROM directory_listing_enrichment_log WHERE listing_id IN ${listingList}`],
    ['gbp_listing_categories.listing_id', `SELECT count(*) n FROM gbp_listing_categories WHERE listing_id IN ${listingList}`],
  ];
  console.log('\nDependent rows (handled explicitly):');
  for (const [name, sql] of census) {
    const n = (await q(sql))[0].n;
    console.log(`  ${name.padEnd(55)} ${n}`);
  }
  console.log(`\nlistings: ${listings.length}   settings: ${settings.length}   claim tokens: ${tokens.length}   tenants: ${tenantIds.length}`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to delete. A backup JSON is written first.');
  }

  // Backup always written (dry-run too — free insurance, audits/ is gitignored).
  const backupDir = path.join(__dirname, '..', '..', '..', 'audits');
  const backupFile = path.join(backupDir, `market-revert-${Date.now()}.json`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupFile, JSON.stringify({ seeds, listings, settings, tokens }, null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  if (APPLY) {
    await client.query('BEGIN');
    try {
      const steps = [
        ['mkt_prospect_queue: null seed back-ref', `UPDATE mkt_prospect_queue SET seed_id = NULL, updated_at = now() WHERE seed_id IN ${idList}`],
        ['mkt_prospect_dedup_verdicts', `DELETE FROM mkt_prospect_dedup_verdicts WHERE merge_into IN ${idList}`],
        ['directory_chain_group_members', `DELETE FROM directory_chain_group_members WHERE seed_id IN ${idList}`],
        ['directory_claim_request_verifications', `DELETE FROM directory_claim_request_verifications WHERE seed_id IN ${idList}`],
        ['mkt_seed_intelligence_reports', `DELETE FROM mkt_seed_intelligence_reports WHERE seed_id IN ${idList}`],
        ['mkt_outreach_anchors', `DELETE FROM mkt_outreach_anchors WHERE seed_id IN ${idList}`],
        ['seo_query_signals', `DELETE FROM seo_query_signals WHERE seed_id IN ${idList}`],
        ['directory_presence_events', `DELETE FROM directory_presence_events WHERE listing_id IN ${listingList}`],
        ['directory_listing_categories', `DELETE FROM directory_listing_categories WHERE listing_id IN ${listingList}`],
        ['directory_listing_enrichment_log', `DELETE FROM directory_listing_enrichment_log WHERE listing_id IN ${listingList}`],
        ['gbp_listing_categories', `DELETE FROM gbp_listing_categories WHERE listing_id IN ${listingList}`],
        ['directory_presence_seeds (+CASCADE children)', `DELETE FROM directory_presence_seeds WHERE id IN ${idList}`],
        ['directory_settings_list', `DELETE FROM directory_settings_list WHERE tenant_id IN ${tenantList}`],
        ['directory_listings_list', `DELETE FROM directory_listings_list WHERE id IN ${listingList}`],
      ];
      for (const [name, sql] of steps) {
        const n = await e(sql);
        console.log(`  deleted ${String(n).padStart(4)}  ${name}`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Stub tenants: delete per-tenant so an unexpected FK just skips that
    // tenant instead of aborting the batch.
    let tenantsDeleted = 0;
    const skipped = [];
    for (const tid of tenantIds) {
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM tenants WHERE id = ${lit(tid)}`);
        await client.query('COMMIT');
        tenantsDeleted++;
      } catch (err) {
        await client.query('ROLLBACK');
        skipped.push({ tenant_id: tid, reason: err.message.split('\n')[0] });
      }
    }
    console.log(`  deleted ${tenantsDeleted}  tenants`);
    if (skipped.length) console.log('  tenants kept (FK references remain):', skipped);
  }

  // Post-state: what's left per market.
  const left = await q(
    `SELECT seed_batch, status, count(*) n FROM directory_presence_seeds WHERE ${where} GROUP BY 1,2`,
  );
  console.log('\nRemaining in scope:', left.length ? left : 'none');
  await client.end();
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
