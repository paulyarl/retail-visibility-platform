#!/usr/bin/env node
/**
 * BSaaS catalog pricing automation.
 *
 * Derives `bsaas_catalog.price_cents` from the capability value anchors
 * (docs/CAPABILITY_VALUE_ANCHOR_SPEC.md) instead of leaving hand-set round numbers.
 *
 *   node apps/api/scripts/price-bsaas-catalog.cjs                 # dry run (reads prd, prints diff)
 *   node apps/api/scripts/price-bsaas-catalog.cjs --k 3.02        # pin the anchor rate
 *   node apps/api/scripts/price-bsaas-catalog.cjs --sql out.sql   # emit an UPDATE migration
 *   node apps/api/scripts/price-bsaas-catalog.cjs --apply --yes   # write to the DB (guarded)
 *
 * Rules:
 *   *_flexible  → k × module value            (the module's unlimited price)
 *   option SKUs → flexible price × family share (anchors allocate downward)
 *   *_enabled   → untouched and listed: "module on" is a tier grant, not a SKU
 *   *_disabled  → untouched (a veto is never a price)
 *
 * Options that match no anchor family are left alone and reported, never guessed.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../../');
const SPEC = path.join(ROOT, 'docs/CAPABILITY_VALUE_ANCHOR_SPEC.md');
const WITNESS = path.join(ROOT, 'shared/tier-contract-db-witness.json');

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(`--${n}`);

const spec = fs.readFileSync(SPEC, 'utf8');
const witness = JSON.parse(fs.readFileSync(WITNESS, 'utf8'));

// module -> Σ anchors, module -> {family: anchor}
const moduleValue = {};
const moduleFamilies = {};
for (const line of spec.split('\n')) {
  const m = line.match(/^\| `([a-z_]+)` \| (.+?) \| \*\*([\d.]+)\*\* \|/);
  if (!m) continue;
  moduleValue[m[1]] = parseFloat(m[3]);
  const fams = {};
  for (const part of m[2].split('·')) {
    const f = part.match(/^(.*?)\s*(\d\.\d)\s*$/);
    if (f) fams[f[1].trim()] = parseFloat(f[2]);
  }
  moduleFamilies[m[1]] = fams;
}

const caps = witness.capability_features || {};
const keyToModule = {};
for (const [mod, keys] of Object.entries(caps)) for (const k of keys) keyToModule[k] = mod;

const k = Number(flag('k') ?? 3.02);

/** match a catalog key to one of its module's anchor families */
function matchFamily(key, module) {
  const fams = moduleFamilies[module];
  if (!fams) return null;
  const rest = key.startsWith(`${module}_`) ? key.slice(module.length + 1) : key;
  const tokens = rest
    .replace(/(builder|options|types|level|display|management|creation|sections)_/g, '')
    .split('_')
    .filter(Boolean);
  for (const fam of Object.keys(fams)) {
    const famTokens = fam.toLowerCase().replace(/[^a-z0-9]+/g, '_').split('_').filter(Boolean);
    if (famTokens.length && famTokens.every((t) => tokens.includes(t))) return fam;
  }
  return null;
}

function target(key) {
  const module = keyToModule[key];
  if (!module || !moduleValue[module]) return { skip: 'no module anchor' };

  if (key.endsWith('_flexible')) {
    return { cents: Math.round(k * moduleValue[module] * 100), how: `module ${module}` };
  }
  if (key.endsWith('_enabled')) return { skip: 'module-on is a tier grant' };
  if (key.endsWith('_disabled')) return { skip: 'veto is never a price' };

  const fam = matchFamily(key, module);
  if (!fam) return { skip: 'no anchor family match' };
  const fams = moduleFamilies[module];
  const total = Object.values(fams).reduce((a, b) => a + b, 0);
  const share = fams[fam] / total;
  return { cents: Math.round(k * moduleValue[module] * share * 100), how: `${module} · ${fam} ${share.toFixed(2)}` };
}

const SSL_PARAMS = /^(sslmode|sslcert|sslkey|sslrootcert|sslcrl|sslcompression|uselibpqcompat)=/;
const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const [base, ...qs] = (rawUrl || '').split('?');
const cleanUrl = qs.length
  ? `${base}?${qs.join('?').split('&').filter((p) => p && !SSL_PARAMS.test(p)).join('&')}`.replace(/\?$/, '')
  : base;

(async () => {
  if (!cleanUrl) {
    console.error('DIRECT_URL/DATABASE_URL not set — run via doppler.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: cleanUrl,
    ssl: /localhost|127\.0\.0\.1/.test(cleanUrl) ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT feature_key, price_cents, is_active FROM bsaas_catalog ORDER BY feature_key`,
  );

  const changes = [];
  const skipped = [];
  for (const row of rows) {
    if (!row.is_active) continue;
    const t = target(row.feature_key);
    if (t.skip) { skipped.push({ key: row.feature_key, why: t.skip }); continue; }
    if (t.cents !== row.price_cents) {
      changes.push({ key: row.feature_key, from: row.price_cents / 100, to: t.cents / 100, how: t.how });
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  const money = (v, n = 8) => `$${v.toFixed(2)}`.padStart(n);

  console.log(`\n=== BSAAS PRICE ALIGNMENT (k = $${k.toFixed(2)}/anchor) ===\n`);
  console.log(`${pad('sku', 42)}${pad('now', 9)}${pad('target', 9)}${pad('basis', 34)}`);
  for (const c of changes) {
    console.log(`${pad(c.key, 42)}${money(c.from)}${money(c.to)}  ${pad(c.how, 34)}`);
  }
  console.log(`\nchanges: ${changes.length}   skipped: ${skipped.length}   unchanged: ${rows.length - changes.length - skipped.length}`);

  if (skipped.length) {
    console.log('\nskipped (left untouched, not guessed):');
    for (const s of skipped.slice(0, 20)) console.log(`  ${pad(s.key, 44)}${s.why}`);
    if (skipped.length > 20) console.log(`  … +${skipped.length - 20}`);
  }

  const sqlPath = flag('sql');
  if (sqlPath) {
    const body = changes
      .map((c) => `UPDATE bsaas_catalog SET price_cents = ${Math.round(c.to * 100)} WHERE feature_key = '${c.key}';`)
      .join('\n');
    fs.writeFileSync(
      sqlPath,
      `-- BSaaS price alignment (generated by price-bsaas-catalog.cjs)\n-- k = $${k.toFixed(2)}/anchor; ${changes.length} SKUs\n\nBEGIN;\n${body}\nCOMMIT;\n`,
    );
    console.log(`\nwrote ${sqlPath} (${changes.length} statements)`);
  }

  if (has('apply')) {
    if (!has('yes')) {
      console.log('\n--apply requires --yes. Nothing written.');
    } else {
      await client.query('BEGIN');
      for (const c of changes) {
        await client.query('UPDATE bsaas_catalog SET price_cents = $1, updated_at = now() WHERE feature_key = $2', [
          Math.round(c.to * 100),
          c.key,
        ]);
      }
      await client.query('COMMIT');
      console.log(`\napplied ${changes.length} price updates`);
    }
  }

  await client.end();
})();
