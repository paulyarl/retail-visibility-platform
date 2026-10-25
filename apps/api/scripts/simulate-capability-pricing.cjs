#!/usr/bin/env node
/**
 * Capability pricing simulator — estimates tier and feature prices from the
 * value anchors in docs/CAPABILITY_VALUE_ANCHOR_SPEC.md.
 *
 * READ-ONLY. Reads the committed DB witness + the spec doc; touches no database.
 *
 *   node apps/api/scripts/simulate-capability-pricing.cjs
 *   node apps/api/scripts/simulate-capability-pricing.cjs --k 3.5
 *   node apps/api/scripts/simulate-capability-pricing.cjs --tier discovery=39
 *   node apps/api/scripts/simulate-capability-pricing.cjs --features funnel_options
 *
 * What it does:
 *   1. module value = Σ anchors (spec table)
 *   2. tier value  = Σ module value over the tier's EFFECTIVE set (inheritance
 *      closure from the witness), depth-weighted:
 *        _flexible → 1.0 · _enabled → 0.5 + 0.5·(options present / total)
 *        options only → options present / total
 *   3. fit k = Σ(P·V)/Σ(V²) through the origin, report R² and residuals
 *   4. module price = k · value, feature price = module price · anchor share
 *
 * Config / separation-controlled modules never enter tier value (they are
 * soft-gated or structural, not sold). Discretionary modules never enter tier
 * value either — they are bought on top by any tier.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../');
const WITNESS = path.join(ROOT, 'shared/tier-contract-db-witness.json');
const CONTRACT = path.join(ROOT, 'shared/tier-contract.json');
const SPEC = path.join(ROOT, 'docs/CAPABILITY_VALUE_ANCHOR_SPEC.md');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const witness = JSON.parse(fs.readFileSync(WITNESS, 'utf8'));
const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
const spec = fs.readFileSync(SPEC, 'utf8');

// ---- anchors: module -> Σ, and module -> {family: anchor} -------------------
const moduleValue = {};
const moduleFamilies = {};
for (const line of spec.split('\n')) {
  const m = line.match(/^\| `([a-z_]+)` \| (.+?) \| \*\*([\d.]+)\*\* \|/);
  if (!m) continue;
  const [, mod, cell, sum] = m;
  moduleValue[mod] = parseFloat(sum);
  const fams = {};
  for (const part of cell.split('·')) {
    const f = part.match(/^(.*?)\s*(\d\.\d)\s*$/);
    if (f) fams[f[1].trim()] = parseFloat(f[2]);
  }
  moduleFamilies[mod] = fams;
}
moduleValue.storefront_types = 3.4; // anchors live in prose (§6.1a)

const CONFIG = new Set(['storefront_layouts', 'storefront_gallery', 'storefront_hours', 'storefront_maps', 'storefront_options', 'product_types']);
const SEPARATION = new Set(['storefront_types']);
const DISCRETIONARY = new Set(['funnel_options', 'coupon_options', 'storefront_qr', 'flyer', 'flyer_gbp']);

const caps = witness.capability_features || {};
const keyToModule = {};
for (const [mod, keys] of Object.entries(caps)) for (const k of keys) keyToModule[k] = mod;

const edges = (contract.inheritance && contract.inheritance.edges) || {};
const tf = witness.tier_features || {};

const effective = (tier, seen = new Set()) => {
  if (seen.has(tier)) return new Set();
  seen.add(tier);
  const own = new Set((tf[tier] || []).filter((r) => r.is_enabled).map((r) => r.feature_key));
  for (const p of edges[tier] || []) for (const k of effective(p, seen)) own.add(k);
  return own;
};

const STATE = /_(enabled|disabled|flexible|on|off|frozen)$/;

/** depth-weighted module value for a tier */
function tierValue(tier) {
  const eff = effective(tier);
  const mods = new Set();
  for (const k of eff) if (keyToModule[k]) mods.add(keyToModule[k]);

  let value = 0;
  const priced = [];
  for (const mod of mods) {
    if (CONFIG.has(mod) || SEPARATION.has(mod) || DISCRETIONARY.has(mod)) continue;
    const keys = (caps[mod] || []).filter((k) => eff.has(k));
    const options = (caps[mod] || []).filter((k) => !STATE.test(k));
    const present = options.filter((k) => eff.has(k)).length;
    const share = options.length ? present / options.length : 0;
    const flex = keys.some((k) => k.endsWith('_flexible'));
    const en = keys.some((k) => k.endsWith('_enabled'));
    const depth = flex ? 1 : en ? 0.5 + 0.5 * share : share;
    const v = (moduleValue[mod] || 0) * depth;
    value += v;
    priced.push({ mod, v });
  }
  priced.sort((a, b) => b.v - a.v);
  return { value, priced };
}

// ---- tier table -------------------------------------------------------------
const prices = Object.fromEntries((witness.tiers || []).map((t) => [t.tier_key, t.price_monthly]));
const override = {};
for (const a of args) {
  if (!a.startsWith('--tier')) continue;
  const val = flag('tier');
  if (val) {
    const [t, p] = val.split('=');
    if (t && p) override[t] = Number(p);
  }
}
const ORDER = ['presence', 'discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'organization', 'enterprise'];

const rows = ORDER.map((tier) => {
  const { value } = tierValue(tier);
  return { tier, value, price: override[tier] ?? prices[tier] };
});

const num = rows.reduce((a, r) => a + r.price * r.value, 0);
const den = rows.reduce((a, r) => a + r.value * r.value, 0);
const kFitted = den ? num / den : 0;
const k = flag('k') ? Number(flag('k')) : kFitted;

const meanP = rows.reduce((a, r) => a + r.price, 0) / rows.length;
const ssTot = rows.reduce((a, r) => a + (r.price - meanP) ** 2, 0);
const ssRes = rows.reduce((a, r) => a + (r.price - k * r.value) ** 2, 0);
const r2 = ssTot ? 1 - ssRes / ssTot : 0;

const pad = (s, n) => String(s).padEnd(n);
const num_ = (v, n = 7) => String(Math.round(v * 100) / 100).padStart(n);

console.log('\n=== TIER VALUE vs PRICE ===\n');
console.log(`${pad('tier', 15)}${pad('value', 9)}${pad('price', 9)}${pad('at k', 9)}${pad('delta', 9)}`);
for (const r of rows) {
  const pred = k * r.value;
  console.log(`${pad(r.tier, 15)}${num_(r.value, 8)}${num_(r.price, 8)}${num_(pred, 9)}${num_(r.price - pred, 8)}`);
}
console.log(`\nk = $${k.toFixed(2)} / anchor${flag('k') ? ' (override)' : ' (fitted)'}   R² = ${r2.toFixed(3)}`);

// ---- module prices ----------------------------------------------------------
const mods = Object.entries(moduleValue)
  .filter(([m]) => !CONFIG.has(m) && !SEPARATION.has(m))
  .sort((a, b) => b[1] - a[1]);

console.log('\n=== MODULE PRICE AT k ===\n');
console.log(`${pad('module', 28)}${pad('value', 8)}${pad('price', 9)}${pad('bucket', 15)}`);
for (const [mod, val] of mods) {
  const bucket = DISCRETIONARY.has(mod) ? 'discretionary' : 'tier-included';
  console.log(`${pad(mod, 28)}${num_(val, 8)}${num_(k * val, 10)}  ${pad(bucket, 15)}`);
}

// ---- feature prices for one module -----------------------------------------
const featureMod = flag('features');
if (featureMod && moduleFamilies[featureMod]) {
  const fams = moduleFamilies[featureMod];
  const total = Object.values(fams).reduce((a, b) => a + b, 0);
  const modulePrice = k * total;
  console.log(`\n=== FEATURE PRICES — ${featureMod} (module $${modulePrice.toFixed(2)}) ===\n`);
  console.log(`${pad('family', 34)}${pad('anchor', 8)}${pad('share', 8)}${pad('price', 8)}`);
  for (const [fam, anchor] of Object.entries(fams).sort((a, b) => b[1] - a[1])) {
    console.log(`${pad(fam, 34)}${num_(anchor, 7)}${num_(anchor / total, 7)}${num_(modulePrice * (anchor / total), 8)}`);
  }
}

// ---- proposed ladder --------------------------------------------------------
if (args.includes('--ladder')) {
  console.log('\n=== PROPOSED LADDER (k × value, rounded to $1) ===\n');
  console.log(`${pad('tier', 15)}${pad('today', 9)}${pad('proposed', 11)}${pad('change', 10)}`);
  for (const r of rows) {
    const proposed = Math.round(k * r.value);
    console.log(`${pad(r.tier, 15)}${num_(r.price, 8)}${num_(proposed, 10)}${num_(proposed - r.price, 9)}`);
  }
}
// ---- optional band term (capacity) -----------------------------------------
const BAND_SOURCE = path.join(ROOT, 'apps/api/src/utils/tier-limits.ts');
function loadBandMap() {
  try {
    const src = fs.readFileSync(BAND_SOURCE, 'utf8');
    const out = {};
    for (const m of src.matchAll(/^\s{2}(\w+): \{\s*\n\s*name: '[^']*',\s*\n\s*maxSkus: (\d+)/gm)) {
      out[m[1]] = Number(m[2]);
    }
    return out;
  } catch {
    return {};
  }
}
const bandMap = loadBandMap();

if (args.includes('--band')) {
  const band = (t) => Math.log10(1 + (bandMap[t] ?? 0));
  const pts = rows.map((r) => ({ ...r, b: band(r.tier) }));

  // normal equations for P = k·V + b·B
  const Svv = pts.reduce((a, p) => a + p.value * p.value, 0);
  const Svb = pts.reduce((a, p) => a + p.value * p.b, 0);
  const Sbb = pts.reduce((a, p) => a + p.b * p.b, 0);
  const Svp = pts.reduce((a, p) => a + p.value * p.price, 0);
  const Sbp = pts.reduce((a, p) => a + p.b * p.price, 0);
  const det = Svv * Sbb - Svb * Svb;
  const k2 = det ? (Svp * Sbb - Sbp * Svb) / det : 0;
  const b2 = det ? (Sbp * Svv - Svp * Svb) / det : 0;

  const ssRes2 = pts.reduce((a, p) => a + (p.price - (k2 * p.value + b2 * p.b)) ** 2, 0);
  const r22 = ssTot ? 1 - ssRes2 / ssTot : 0;

  console.log('\n=== BAND-ADJUSTED FIT (price = k·value + b·log10(1+maxSkus)) ===\n');
  console.log(`${pad('tier', 15)}${pad('value', 8)}${pad('band', 7)}${pad('price', 9)}${pad('model', 9)}${pad('resid', 8)}`);
  for (const p of pts) {
    const model = k2 * p.value + b2 * p.b;
    console.log(`${pad(p.tier, 15)}${num_(p.value, 7)}${num_(p.b, 6)}${num_(p.price, 8)}${num_(model, 9)}${num_(p.price - model, 8)}`);
  }
  console.log(`\nk = $${k2.toFixed(2)}/anchor   b = $${b2.toFixed(2)}/decade of SKUs   R² = ${r22.toFixed(3)}`);
  console.log('(capacity is the one dimension no add-on can buy — a positive b prices it)');
}

console.log('');
