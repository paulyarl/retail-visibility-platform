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
// pg-connection-string parses ssl* URL params into ssl settings that
// OVERRIDE the `ssl` option below (sslmode=require → verify-full semantics
// → rejectUnauthorized:true → "self-signed certificate in certificate
// chain"). Strip them so the explicit option is authoritative.
const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const [base, ...qs] = (dbUrl || '').split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;
const client = new Client({
  connectionString: cleanUrl,
  ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
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
