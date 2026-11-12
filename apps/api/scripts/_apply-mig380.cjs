const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const [base, ...qs] = (dbUrl || '').split('?');
const cleanUrl = qs.length ? `${base}?${qs.join('?').split('&').filter(p => p && !/^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/.test(p)).join('&')}`.replace(/\?$/, '') : base;
const c = new Client({ connectionString: cleanUrl, ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../../../database/migrations/380_integration_limit_columns.sql'), 'utf8');
  await c.query(sql);
  const r = await c.query("select tier_key, max_skus, pos_ingress_max_skus, gmc_egress_max_skus from subscription_tiers_list where tier_key in ('presence','discovery','storefront','commitment') order by price_monthly");
  console.log(JSON.stringify(r.rows, null, 1));
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
