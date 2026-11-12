#!/usr/bin/env node
/**
 * tier-integration-grants — applies the ingress/egress integration split to
 * the Entry Presence triad tiers (presence=Storefront, discovery=Nearby,
 * storefront=Storefront+).
 *
 * Design (decided 2026-11-12): the integration_options module carries two
 * economic objects under one namespace —
 *   INGRESS (data acquisition, activation infra): enabled + clover + square +
 *     pos group flags. Granted to all three triad tiers.
 *   EGRESS (distribution): each tier gets the outbound keys feeding its
 *     display surface —
 *       presence   → POS only (hosted storefront IS the surface)
 *       discovery  → FULL Google egress (gbp + shopping/gmc/gmc_sync) — its
 *                    display IS Google: products on Maps/SWIS + Shopping.
 *                    GBP included: Google's local-inventory path requires a
 *                    Business Profile linked to the GMC feed.
 *       storefront → identical integration bag to discovery. The "+" is NOT
 *                    an integration difference — it's the platform storefront
 *                    display surface, gated by the storefront modules.
 *                    Integrations feed surfaces; they don't gate them.
 *   integration_flexible stays the enterprise/top-tier convenience key and is
 *   explicitly OFF on the trio — it expands to every current AND future key
 *   and erases the ingress/egress boundary.
 *
 * Writes the FULL 14-key row set per tier with explicit is_enabled flags —
 * the same shape the admin CapabilityManagement UI writes. Also stamps
 * capability_type_id on every row (required: IntegrationOptionsService's
 * primary query path filters by capability_type_id and cannot see rows where
 * it is NULL — that bug left prd presence with zero resolvable integrations).
 *
 * Plain Node + node-postgres (pgbouncer-safe simple protocol), reads
 * DIRECT_URL/DATABASE_URL — run through doppler:
 *
 *   doppler run --config stg -- node scripts/tier-integration-grants.cjs        # dry-run diff
 *   doppler run --config stg -- node scripts/tier-integration-grants.cjs --apply
 *   doppler run --config prd -- node scripts/tier-integration-grants.cjs --apply
 */

const { Client } = require('pg');
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

const APPLY = process.argv.includes('--apply');
const TIERS = ['presence', 'discovery', 'storefront'];

// Every key in the integration_options capability module — the script writes
// all of them per tier, ON or OFF, so the bag is fully explicit.
const ALL_KEYS = [
  'integration_clover',
  'integration_disabled',
  'integration_enabled',
  'integration_flexible',
  'integration_gbp',
  'integration_gmc_sync',
  'integration_google_enabled',
  'integration_google_merchant_center',
  'integration_google_on',
  'integration_google_shopping',
  'integration_pos_enabled',
  'integration_pos_on',
  'integration_propagation_gbp',
  'integration_square',
];

const POS_INGRESS = [
  'integration_enabled',
  'integration_clover',
  'integration_square',
  'integration_pos_on',
  'integration_pos_enabled',
];
const GBP_EGRESS = ['integration_google_on', 'integration_google_enabled', 'integration_gbp'];
const GOOGLE_SUITE = [
  'integration_google_shopping',
  'integration_google_merchant_center',
  'integration_gmc_sync',
];

const TARGET = {
  presence: [...POS_INGRESS],
  discovery: [...POS_INGRESS, ...GBP_EGRESS, ...GOOGLE_SUITE],
  storefront: [...POS_INGRESS, ...GBP_EGRESS, ...GOOGLE_SUITE],
};

const humanize = (k) =>
  k.replace(/^integration_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

(async () => {
  await client.connect();

  const capRow = (await client.query(
    `select id from capability_type_list where key = 'integration_options'`,
  )).rows[0];
  if (!capRow) throw new Error("capability_type_list row 'integration_options' not found");
  const capId = capRow.id;

  const nameRows = (await client.query(
    `select key, name from features_list where key = any($1)`,
    [ALL_KEYS],
  )).rows;
  const nameByKey = new Map(nameRows.map((r) => [r.key, r.name]));

  for (const tierKey of TIERS) {
    const tierRow = (await client.query(
      `select id from subscription_tiers_list where tier_key = $1`,
      [tierKey],
    )).rows[0];
    if (!tierRow) throw new Error(`subscription_tiers_list row '${tierKey}' not found`);
    const tierId = tierRow.id;
    const on = new Set(TARGET[tierKey]);

    const current = (await client.query(
      `select feature_key, is_enabled, capability_type_id from tier_features_list
        where tier_id = $1 and feature_key = any($2)`,
      [tierId, ALL_KEYS],
    )).rows;
    const curByKey = new Map(current.map((r) => [r.feature_key, r]));

    console.log(`\n=== ${tierKey} ===`);
    const writes = [];
    for (const key of ALL_KEYS) {
      const want = on.has(key);
      const cur = curByKey.get(key);
      const curEnabled = cur ? cur.is_enabled : null;
      const capMissing = !!cur && cur.capability_type_id !== capId;
      const changed = curEnabled !== want || capMissing;
      const tag = !cur ? 'ADD' : curEnabled !== want ? 'FLIP' : capMissing ? 'CAPID' : '    ';
      console.log(` ${tag} ${key.padEnd(38)} ${curEnabled === null ? '(absent)' : curEnabled} -> ${want}`);
      if (changed) writes.push({ key, want });
    }

    if (!writes.length) { console.log(' (already at target)'); continue; }
    if (!APPLY) continue;

    await client.query('begin');
    try {
      for (const w of writes) {
        await client.query(
          `insert into tier_features_list
             (id, tier_id, feature_key, feature_name, is_enabled, capability_type_id)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (tier_id, feature_key)
           do update set is_enabled = excluded.is_enabled,
                         capability_type_id = excluded.capability_type_id`,
          [crypto.randomUUID(), tierId, w.key, nameByKey.get(w.key) || humanize(w.key), w.want, capId],
        );
      }
      await client.query('commit');
      console.log(` applied ${writes.length} row change(s)`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }

  console.log(APPLY ? '\nDone.' : '\nDry run — re-run with --apply to write.');
  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
