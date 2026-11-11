#!/usr/bin/env node
/**
 * clover-token-check — diagnose Clover 401s without a deploy.
 *
 * For every production-mode row in clover_integrations_list:
 *   1. Inspect stored access_token format (iv:ct ciphertext / demo_ / plaintext)
 *   2. Decrypt it with the same scheme as services/clover-oauth.ts
 *      (scryptSync(CLOVER_TOKEN_ENCRYPTION_KEY,'salt',32) + aes-256-cbc)
 *      — catches wrong-key and non-ciphertext failures explicitly
 *   3. Probe GET /v3/merchants/{mid} on BOTH api.clover.com and
 *      apisandbox.dev.clover.com with the decrypted token — a 200 on
 *      apisandbox + 401 on api = legacy-sandbox token (host fix); 401 on
 *      both = dead/revoked/mismatched token.
 *   4. Show recent clover_sync_logs_list rows so job-side failures are visible.
 *
 * Never prints the token itself — sha256 fingerprint + length only.
 *
 * Run (same env the failing deploy reads):
 *   cd apps/api
 *   doppler run --config stg -- node scripts/clover-token-check.cjs
 *   doppler run --config prd -- node scripts/clover-token-check.cjs
 */

const { Client } = require('pg');
const crypto = require('crypto');

const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DIRECT_URL/DATABASE_URL not set — run via doppler');
  process.exit(1);
}
const [base, ...qs] = dbUrl.split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;

const CLOVER_HOSTS = ['https://api.clover.com', 'https://apisandbox.dev.clover.com'];

function decryptToken(encryptedToken) {
  const secret = process.env.CLOVER_TOKEN_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  const key = crypto.scryptSync(secret, 'salt', 32);
  const [ivHex, encrypted] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function tokenFormat(t) {
  if (!t) return 'null';
  if (t.startsWith('demo_')) return 'demo_ token';
  const parts = t.split(':');
  if (parts.length === 2 && /^[0-9a-f]{32}$/i.test(parts[0]) && /^[0-9a-f]+$/i.test(parts[1])) {
    return `iv:ct ciphertext (ct ${parts[1].length / 2} bytes)`;
  }
  return `NOT iv:ct format (${t.length} chars, ${parts.length} segments) — decrypt will fail or return garbage`;
}

async function probe(host, merchantId, token) {
  try {
    const res = await fetch(`${host}/v3/merchants/${merchantId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.text()).slice(0, 200);
    return `${res.status} ${body}`;
  } catch (e) {
    return `fetch error: ${e.message}`;
  }
}

(async () => {
  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const integ = await client.query(
    `SELECT id, tenant_id, mode, status, merchant_id, access_token,
            token_expires_at, last_sync_at, last_sync_status
       FROM clover_integrations_list
      WHERE mode = 'production' OR access_token IS NOT NULL
      ORDER BY last_sync_at DESC NULLS LAST`,
  );

  if (integ.rows.length === 0) {
    console.log('No clover_integrations_list rows with a token found.');
    await client.end();
    return;
  }

  console.log(`encryption key: ${process.env.CLOVER_TOKEN_ENCRYPTION_KEY ? 'CLOVER_TOKEN_ENCRYPTION_KEY set' : 'DEFAULT fallback key'}  |  CLOVER_API_BASE_URL=${process.env.CLOVER_API_BASE_URL || '(unset)'}  CLOVER_ENVIRONMENT=${process.env.CLOVER_ENVIRONMENT || '(unset→sandbox)'}\n`);

  for (const row of integ.rows) {
    console.log(`== integration ${row.id}  tenant=${row.tenant_id}  mode=${row.mode}  status=${row.status}`);
    console.log(`   merchant_id=${row.merchant_id}  token_expires_at=${row.token_expires_at}  last_sync=${row.last_sync_at} [${row.last_sync_status}]`);
    console.log(`   stored access_token: ${tokenFormat(row.access_token)}`);

    let token = null;
    if (row.access_token && !row.access_token.startsWith('demo_')) {
      try {
        token = decryptToken(row.access_token);
        const fp = crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
        console.log(`   decrypt: OK  fingerprint=sha256:${fp}  len=${token.length}`);
      } catch (e) {
        console.log(`   decrypt: FAILED (${e.message}) — wrong key or stored value isn't ciphertext`);
      }
    }

    if (token && row.merchant_id) {
      for (const host of CLOVER_HOSTS) {
        console.log(`   probe ${host}/v3/merchants/${row.merchant_id} -> ${await probe(host, row.merchant_id, token)}`);
      }
    }
    console.log('');
  }

  try {
    const logs = await client.query(
      `SELECT operation, status, error_message, items_processed, items_succeeded, items_failed, started_at
         FROM clover_sync_logs_list ORDER BY started_at DESC LIMIT 5`,
    );
    console.log('recent sync logs:');
    for (const l of logs.rows) {
      const ts = l.started_at?.toISOString?.() || l.started_at;
      console.log(`   ${ts}  ${l.operation}  ${l.status}  ${l.items_succeeded}/${l.items_processed} ok, ${l.items_failed} failed  ${l.error_message || ''}`);
    }
  } catch (e) {
    console.log(`(clover_sync_logs_list read skipped: ${e.message})`);
  }

  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
