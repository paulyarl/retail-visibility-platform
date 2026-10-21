#!/usr/bin/env node
/**
 * Apply a raw .sql migration file against a doppler-configured database.
 *
 * Same transport as db-rescue.cjs: plain node-postgres, simple query
 * protocol (pgbouncer-safe), no implicit transaction wrapper — the SQL
 * file controls its own transaction semantics. DIRECT_URL first so it
 * bypasses the Supabase transaction-mode pooler.
 *
 * Usage:
 *   doppler run --config <local|prd> -- node scripts/apply-sql-file.cjs ../../database/migrations/350_storefront_qr_bsaas_pricing.sql
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/apply-sql-file.cjs <path-to-sql>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), 'utf8');

const { Client } = require('pg');
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new Client({
  connectionString: dbUrl,
  ssl: /localhost|127\.0\.0\.1/.test(dbUrl || '') ? false : { rejectUnauthorized: false },
});

(async () => {
  await client.connect();
  const target = dbUrl.replace(/:[^:@]+@/, ':***@').split('?')[0];
  console.log(`applying ${path.basename(file)} -> ${target}`);
  await client.query(sql);
  console.log('done');
})()
  .catch((err) => {
    console.error('apply failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
