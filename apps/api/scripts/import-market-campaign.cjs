#!/usr/bin/env node
/**
 * import-market-campaign — load a market-export JSON (see
 * export-market-campaign.cjs) into this environment's database.
 *
 * Inserts, in FK order: market campaign → referenced campaigns → audits →
 * prospect queue rows. All inserts are `ON CONFLICT (id) DO NOTHING`, so
 * re-running is idempotent — already-present rows are reported as skips.
 *
 * Sanitization on queue rows (staging artifacts that must not cross):
 *   seed_id, seek_batch_id, processed_at            → NULL
 *   source/processed/proving_ground campaign ids    → kept only if that
 *     campaign exists on the target after import, else NULL
 *   campaign.parent_campaign_id                     → kept only if the
 *     parent exists on the target, else NULL
 *   audits whose campaign_id resolves to nothing    → skipped (warned)
 *
 * Dry-run by default — prints the insert plan + ref resolutions.
 *   doppler run --config prd -- node scripts/import-market-campaign.cjs --file audits/x.json
 *   doppler run --config prd -- node scripts/import-market-campaign.cjs --file audits/x.json --apply
 *
 * Plain Node + pg, literal-inlined INSERTs (pgbouncer simple-protocol safe).
 * Created 2026-10-30 alongside export-market-campaign.cjs.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const FILE = opt('--file');

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
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Serialize a JS value from SELECT * back into an inline SQL literal.
// Strings are always quoted — Postgres assignment-casts them into
// numeric/date/json/array columns on INSERT. Column type needed to split
// text[] (Postgres array literal) from Json arrays (JSON literal).
const colTypes = {};
const loadColTypes = async (table) => {
  if (!colTypes[table]) {
    const rows = await q(
      `SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = ${lit(table)}`,
    );
    colTypes[table] = Object.fromEntries(rows.map((r) => [r.column_name, r.udt_name]));
  }
  return colTypes[table];
};
const val = (v, udt) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return lit(v.toISOString());
  if (Array.isArray(v)) {
    if (udt && udt.startsWith('_'))
      return lit(`{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}`);
    return lit(JSON.stringify(v)); // json/jsonb array
  }
  if (typeof v === 'object') return lit(JSON.stringify(v)); // json/jsonb
  return lit(v);
};

const insertSql = (table, row) => {
  const cols = Object.keys(row);
  const types = colTypes[table] || {};
  return `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => val(row[c], types[c])).join(',')}) ON CONFLICT (id) DO NOTHING`;
};

(async () => {
  if (!FILE) {
    console.error('Need --file <market-export.json>');
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(path.resolve(FILE), 'utf8'));
  const { campaign, refCampaigns = [], audits = [], queue = [], meta = {} } = payload;
  console.log(`import file: ${FILE}`);
  console.log(`meta:`, JSON.stringify(meta.counts || {}), meta.exportedAt || '');

  await client.connect();

  const allCampaigns = [...(campaign ? [campaign] : []), ...refCampaigns];
  const campIds = allCampaigns.map((c) => c.id);
  const campIdList = campIds.length ? `(${campIds.map(lit).join(',')})` : '(NULL)';

  // Which referenced campaign ids already exist on the target?
  const refIds = new Set(campIds);
  for (const r of queue)
    for (const k of ['source_campaign_id', 'processed_campaign_id', 'proving_ground_id'])
      if (r[k]) refIds.add(r[k]);
  for (const a of audits) if (a.campaign_id) refIds.add(a.campaign_id);
  const existing = refIds.size
    ? new Set(
        (
          await q(
            `SELECT id FROM mkt_campaigns_list WHERE id IN (${[...refIds].map(lit).join(',')})`,
          )
        ).map((r) => r.id),
      )
    : new Set();
  const willExist = (id) => id && (existing.has(id) || campIds.includes(id));

  // Pre-compute sanitized rows so the dry-run shows exactly what --apply does.
  const cleanCampaigns = allCampaigns.map((c) => ({
    ...c,
    parent_campaign_id: willExist(c.parent_campaign_id) ? c.parent_campaign_id : null,
    tenant_id: null, // tenants are environment-local stubs — never cross
    demo_tenant_id: null,
  }));
  const cleanAudits = [];
  const skippedAudits = [];
  for (const a of audits) {
    if (willExist(a.campaign_id)) cleanAudits.push(a);
    else skippedAudits.push(a.id);
  }
  const cleanQueue = queue.map((r) => ({
    ...r,
    seed_id: null,
    seek_batch_id: null,
    processed_at: null,
    source_campaign_id: willExist(r.source_campaign_id) ? r.source_campaign_id : null,
    processed_campaign_id: willExist(r.processed_campaign_id) ? r.processed_campaign_id : null,
    proving_ground_id: willExist(r.proving_ground_id) ? r.proving_ground_id : null,
  }));

  // Idempotency preview: which target-side ids already exist?
  const queueIds = queue.map((r) => r.id);
  const auditIds = audits.map((r) => r.id);
  const preQ = queueIds.length
    ? (await q(`SELECT id FROM mkt_prospect_queue WHERE id IN (${queueIds.map(lit).join(',')})`)).length
    : 0;
  const preA = auditIds.length
    ? (await q(`SELECT id FROM mkt_audits_list WHERE id IN (${auditIds.map(lit).join(',')})`)).length
    : 0;
  const preC = campIds.length
    ? (await q(`SELECT id FROM mkt_campaigns_list WHERE id IN ${campIdList}`)).length
    : 0;

  // uq_mkt_prospect_queue_active_business: unique on
  // (lower trim business_name, lower trim city, lower trim coalesce(category,''))
  // WHERE status='queued' — a queued prospect can't collide with an
  // already-queued same business on the target. Pre-filter and report.
  const queuedRows = cleanQueue.filter((r) => r.status === 'queued' && r.business_name && r.city);
  const dupKeys = new Set();
  if (queuedRows.length) {
    const existingQueued = await q(
      `SELECT lower(trim(business_name)) bn, lower(trim(city)) ci, lower(trim(coalesce(category,''))) cat
       FROM mkt_prospect_queue WHERE status='queued'`,
    );
    for (const k of existingQueued) dupKeys.add(`${k.bn}|${k.ci}|${k.cat}`);
  }
  const dupKey = (r) =>
    `${(r.business_name || '').trim().toLowerCase()}|${(r.city || '').trim().toLowerCase()}|${(r.category || '').trim().toLowerCase()}`;
  const dupQueue = queuedRows.filter((r) => dupKeys.has(dupKey(r))).map((r) => r.id);
  const insertQueue = cleanQueue.filter(
    (r) => !(r.status === 'queued' && r.business_name && r.city && dupKeys.has(dupKey(r))),
  );

  console.log('\nplan:');
  console.log(`  campaigns:  ${cleanCampaigns.length} to insert, ${preC} already exist`);
  console.log(`  audits:     ${cleanAudits.length} to insert, ${preA} already exist, ${skippedAudits.length} skipped (dangling campaign_id)`);
  console.log(`  queue:      ${insertQueue.length} to insert, ${preQ} already exist, ${dupQueue.length} dup-active (skipped)`);
  const nulled = cleanQueue.filter((r, i) => r.source_campaign_id !== queue[i].source_campaign_id || r.processed_campaign_id !== queue[i].processed_campaign_id);
  if (nulled.length) console.log(`  queue rows with campaign refs NULLed (not on target): ${nulled.length}`);
  if (skippedAudits.length) console.log(`  skipped audit ids: ${skippedAudits.join(', ')}`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to insert.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    await loadColTypes('mkt_campaigns_list');
    await loadColTypes('mkt_audits_list');
    await loadColTypes('mkt_prospect_queue');
    let n = 0;
    // Parents before children: a refCampaign's parent_campaign_id may point
    // at another exported campaign that hasn't landed yet.
    const pending = [...cleanCampaigns];
    const landed = new Set();
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const c = pending[i];
        if (!c.parent_campaign_id || existing.has(c.parent_campaign_id) || landed.has(c.parent_campaign_id)) {
          n += (await client.query(insertSql('mkt_campaigns_list', c))).rowCount;
          landed.add(c.id);
          pending.splice(i, 1);
          progress = true;
        }
      }
    }
    for (const c of pending) { // cycle or missing parent — insert with NULL
      c.parent_campaign_id = null;
      n += (await client.query(insertSql('mkt_campaigns_list', c))).rowCount;
    }
    console.log(`  inserted ${n} campaigns`);
    n = 0;
    for (const a of cleanAudits) n += (await client.query(insertSql('mkt_audits_list', a))).rowCount;
    console.log(`  inserted ${n} audits`);
    n = 0;
    for (const r of insertQueue) n += (await client.query(insertSql('mkt_prospect_queue', r))).rowCount;
    console.log(`  inserted ${n} queue rows`);
    if (dupQueue.length)
      console.log(`  skipped ${dupQueue.length} queued rows already active on target: ${dupQueue.join(', ')}`);
    await client.query('COMMIT');
    console.log('\nCOMMIT — market payload is on this environment. Next: promote queue ids via the usual push path.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  await client.end();
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
