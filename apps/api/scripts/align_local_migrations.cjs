const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const REPO = path.resolve(__dirname, '..', '..', '..');

function clientFor(connectionString) {
  const u = new URL(connectionString);
  u.searchParams.delete('sslmode');
  return new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
}

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const c = clientFor(process.env.DATABASE_URL);
  await c.connect();

  for (const rel of [
    'database/migrations/363_bronze_reasons_address_and_relocation.sql',
    'database/migrations/364_signal_ds_category_mismatch.sql',
  ]) {
    const sql = fs.readFileSync(path.join(REPO, rel), 'utf8');
    await c.query(sql);
    console.log('applied', rel);
  }

  await c.end();
})().catch((e) => {
  console.error('migrations failed:', e.message);
  process.exit(1);
});
