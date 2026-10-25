#!/usr/bin/env node
/**
 * dump-tier-contract — the fixture↔DB witness leg (sprint plan 0.2 / 3.3 / 3.6).
 *
 * Dumps the DB's half of the tier/capability contract to a committed JSON
 * artifact so the contract suite faces the authoritative data instead of
 * restating it. Read-only; plain node-postgres like db-rescue (pgbouncer-safe,
 * no build step).
 *
 *   doppler run --config local -- node scripts/dump-tier-contract.cjs
 *   doppler run --config prd   -- node scripts/dump-tier-contract.cjs --env prd
 *
 * Writes shared/tier-contract-db-witness.json. The vitest suite
 * (tier-db-witness.test.ts) compares this artifact against
 * shared/tier-contract.json — commit the refreshed dump when the DB contract
 * legitimately changes.
 */
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
function flag(name, dflt) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DIRECT_URL/DATABASE_URL not set — run via doppler.');
  process.exit(1);
}

// pg-connection-string parses ssl* URL params into ssl settings that
// OVERRIDE the `ssl` option below (sslmode=require → verify-full semantics
// → rejectUnauthorized:true → "self-signed certificate in certificate
// chain"). Strip them so the explicit option is authoritative. Same fix as
// scripts/apply-sql-file.cjs.
const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const [base, ...qs] = dbUrl.split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;

const outPath = path.resolve(
  process.cwd(),
  flag('out', '../../shared/tier-contract-db-witness.json'),
);

async function main() {
  const client = new Client({
    connectionString: cleanUrl,
    ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const q = async (sql) => (await client.query(sql)).rows;

  const tiers = await q(`
    SELECT tier_key, display_name, name, price_monthly::float8 AS price_monthly,
           is_active, sort_order, tier_type
    FROM subscription_tiers_list
    ORDER BY sort_order, tier_key
  `);

  const tierFeatureRows = await q(`
    SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
    FROM tier_features_list tfl
    JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
    ORDER BY stl.tier_key, tfl.feature_key
  `);
  const tierFeatures = {};
  for (const r of tierFeatureRows) {
    (tierFeatures[r.tier_key] ??= []).push({ feature_key: r.feature_key, is_enabled: r.is_enabled });
  }

  const capRows = await q(`
    SELECT ctl.key AS capability_key, fl.key AS feature_key
    FROM capability_features_list cfl
    JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
    JOIN features_list fl ON fl.id = cfl.feature_id
    WHERE cfl.is_active = true AND fl.is_active = true AND ctl.is_active = true
    ORDER BY ctl.key, fl.key
  `);
  const capabilityFeatures = {};
  for (const r of capRows) {
    (capabilityFeatures[r.capability_key] ??= []).push(r.feature_key);
  }

  const witness = {
    generated_at: new Date().toISOString(),
    env: flag('env', process.env.DOPPLER_CONFIG || 'unknown'),
    tiers,
    tier_features: tierFeatures,
    capability_features: capabilityFeatures,
  };
  fs.writeFileSync(outPath, JSON.stringify(witness, null, 2) + '\n');
  console.log(`wrote ${outPath}`);
  console.log(`  tiers: ${tiers.length}, tier_features tiers: ${Object.keys(tierFeatures).length}, capability types: ${Object.keys(capabilityFeatures).length}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
