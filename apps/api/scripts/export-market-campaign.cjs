#!/usr/bin/env node
/**
 * export-market-campaign — dump a dressed market's push payload to JSON so
 * it can be imported on another environment (staging → production).
 *
 * Exports:
 *   - the market campaign row (scope='city' label: category + city)
 *   - every mkt_prospect_queue row in that market (city + state, optional
 *     --category / --status / --ids filters) — business_snapshot JSONB and
 *     triage fields ride along
 *   - the mkt_audits_list rows those prospects cite (source_audit_id) plus
 *     audits owned by the market campaign itself
 *   - the source mkt_campaigns_list rows those audits/queue rows reference
 *     (needed to satisfy audit.campaign_id FK on import)
 *
 * Plain Node + node-postgres (pgbouncer simple-protocol safe — no prepared
 * statements, no parameterized queries). Run through doppler:
 *
 *   doppler run --config stg -- node scripts/export-market-campaign.cjs \
 *     --campaign mcamp-xxxx [--state IN] [--status queued,verify_then_outreach] \
 *     [--category "African Grocery Store"] [--out audits/x.json]
 *
 * Output defaults to <repo>/audits/market-export-<campaign>-<ts>.json
 * (audits/ is gitignored). The JSON size is also the rough egress footprint
 * of the payload — the number that used to cost ~1GB per market push.
 *
 * Pair: import-market-campaign.cjs. Created 2026-10-30.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const CAMPAIGN_ID = opt('--campaign');
const MARKET = opt('--market'); // "City,ST"
const CATEGORY = opt('--category');
const STATUS = opt('--status'); // csv; default all
const IDS = opt('--ids'); // csv of explicit queue ids
const OUT = opt('--out');

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

(async () => {
  if (!CAMPAIGN_ID && !MARKET && !IDS) {
    console.error('Need --campaign mcamp-xxx, --market "City,ST", or --ids id1,id2');
    process.exit(1);
  }
  await client.connect();

  // ── market campaign row (optional when --ids/--market given directly) ──
  let campaign = null;
  if (CAMPAIGN_ID) {
    const rows = await q(`SELECT * FROM mkt_campaigns_list WHERE id = ${lit(CAMPAIGN_ID)}`);
    if (!rows[0]) {
      console.error(`campaign ${CAMPAIGN_ID} not found`);
      process.exit(1);
    }
    campaign = rows[0];
    console.log(`campaign: ${campaign.id}  "${campaign.category}" @ ${campaign.city}  scope=${campaign.scope} stage=${campaign.stage}`);
  }

  // ── queue rows ──────────────────────────────────────────────────────────
  const where = [];
  let city = null;
  let state = null;
  if (IDS) {
    where.push(`id IN (${IDS.split(',').map((s) => lit(s.trim())).join(',')})`);
  } else {
    city = MARKET ? MARKET.split(',')[0].trim() : campaign.city;
    state = opt('--state') || (MARKET ? MARKET.split(',')[1]?.trim() : null);
    where.push(`city = ${lit(city)}`);
    if (!state) {
      // City names collide across states — force an explicit choice.
      const states = (await q(`SELECT DISTINCT state FROM mkt_prospect_queue WHERE city = ${lit(city)}`)).map((r) => r.state);
      if (states.length > 1) {
        console.error(`"${city}" exists in multiple states: ${states.join(', ')} — pass --state XX`);
        process.exit(1);
      }
      state = states[0];
    }
    if (state) where.push(`state = ${lit(state)}`);
    const cat = CATEGORY || campaign?.category;
    if (cat) where.push(`category = ${lit(cat)}`);
  }
  if (STATUS) {
    where.push(`status IN (${STATUS.split(',').map((s) => lit(s.trim())).join(',')})`);
  }
  const queue = await q(`SELECT * FROM mkt_prospect_queue WHERE ${where.join(' AND ')} ORDER BY created_at`);
  const byStatus = {};
  for (const r of queue) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log(`queue rows: ${queue.length}  ${JSON.stringify(byStatus)}`);
  if (!queue.length) {
    console.error('nothing to export');
    process.exit(1);
  }

  // ── audits cited by the queue + audits owned by the market campaign ────
  const auditIds = [...new Set(queue.map((r) => r.source_audit_id).filter(Boolean))];
  const auditWhere = [];
  if (auditIds.length) auditWhere.push(`id IN (${auditIds.map(lit).join(',')})`);
  if (campaign) auditWhere.push(`campaign_id = ${lit(campaign.id)}`);
  const audits = auditWhere.length
    ? await q(`SELECT * FROM mkt_audits_list WHERE ${auditWhere.join(' OR ')}`)
    : [];
  console.log(`audits: ${audits.length} (${auditIds.length} cited by queue)`);

  // ── campaigns referenced by audits/queue (FK satisfaction + lineage) ────
  const refCampaignIds = new Set();
  for (const a of audits) if (a.campaign_id) refCampaignIds.add(a.campaign_id);
  for (const r of queue)
    for (const k of ['source_campaign_id', 'processed_campaign_id', 'proving_ground_id'])
      if (r[k]) refCampaignIds.add(r[k]);
  if (campaign) refCampaignIds.delete(campaign.id);
  const campaigns = refCampaignIds.size
    ? await q(`SELECT * FROM mkt_campaigns_list WHERE id IN (${[...refCampaignIds].map(lit).join(',')})`)
    : [];
  const missing = [...refCampaignIds].filter((id) => !campaigns.find((c) => c.id === id));
  if (missing.length) console.log(`referenced campaigns not found locally (will NULL on import): ${missing.join(', ')}`);
  console.log(`referenced campaigns: ${campaigns.length}`);

  // ── write ──────────────────────────────────────────────────────────────
  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      market: city ? `${city},${state}` : null,
      campaignId: campaign?.id ?? null,
      category: CATEGORY || campaign?.category || null,
      statusFilter: STATUS || null,
      counts: {
        campaign: campaign ? 1 : 0,
        refCampaigns: campaigns.length,
        audits: audits.length,
        queue: queue.length,
      },
    },
    campaign,
    refCampaigns: campaigns,
    audits,
    queue,
  };
  const json = JSON.stringify(payload, null, 2);
  const outFile =
    OUT || path.join(__dirname, '..', '..', '..', 'audits', `market-export-${campaign?.id || city || 'ids'}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, json);
  console.log(`\nwrote ${outFile}`);
  console.log(`payload: ${(json.length / 1024 / 1024).toFixed(2)} MB (approx read-volume this push skips re-scanning)`);
  await client.end();
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
