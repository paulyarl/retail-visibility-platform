#!/usr/bin/env node
/**
 * gen-tier-doc-blocks.cjs — sprint plan Phase 5 (D3: generated doc blocks).
 *
 * Renders the fixture-derived sections of the contract docs so the docs are a
 * build artefact of shared/tier-contract.json rather than a parallel copy.
 *
 * Marker format in the target markdown:
 *   <!-- BEGIN tier-contract:<block-name> -->
 *   ...generated content...
 *   <!-- END tier-contract:<block-name> -->
 *
 * CLI:
 *   node scripts/gen-tier-doc-blocks.cjs --write   # update docs in place
 *   node scripts/gen-tier-doc-blocks.cjs --check   # exit 1 if any block differs
 *
 * The vitest suite (tier-doc-generation.test.ts) imports renderBlock() and
 * asserts the on-disk markers match — a stale doc fails the suite, so
 * `pnpm gen:tier-docs --write` (or this script directly) is the fix.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const contract = require(path.join(ROOT, 'shared/tier-contract.json'));

const BEGIN = (name) => `<!-- BEGIN tier-contract:${name} -->`;
const END = (name) => `<!-- END tier-contract:${name} -->`;

// --- renderers -------------------------------------------------------------

/** Full-order table: every tier_order member, class + layer + price columns. */
function renderTierOrderTable() {
  const order = contract.tier_order;
  const names = contract.display_names;
  const pricing = contract.pricing;
  const layers = contract.tier_layers;
  const layerOf = {};
  for (const [layer, keys] of Object.entries(layers)) {
    if (layer.startsWith('$')) continue;
    for (const k of keys) layerOf[k] = layer;
  }
  const classOf = (k) =>
    contract.tier_classes.active.includes(k)
      ? 'active'
      : contract.tier_classes.inactive_legacy.includes(k)
        ? 'inactive legacy'
        : 'pseudo';
  const layerLabel = {
    gateway: 'Gateway',
    entry_presence: 'Entry Presence',
    commerce: 'Commerce',
    scale: 'Scale',
  };
  const rows = order.map((key, i) => {
    const display = names[key] ?? '—';
    const price = pricing[key] !== undefined ? `$${pricing[key]}` : '—';
    const layer = layerLabel[layerOf[key]] ?? '—';
    return `| ${i} | \`${key}\` | ${display} | ${price} | ${layer} | ${classOf(key)} |`;
  });
  return [
    '| # | Key | Display | Price/mo | Layer | Class |',
    '|---|-----|---------|----------|-------|-------|',
    ...rows,
    '',
    '_Price `—` = unpinned (0.4 dormant-price decision pending) or never-priced. Display `—` = no catalog-facing name by rule._',
  ].join('\n');
}

/** The canonical TIER_ORDER literal — every copy must equal this. */
function renderTierOrderArray() {
  const order = contract.tier_order;
  const lines = [];
  for (let i = 0; i < order.length; i += 5) {
    lines.push(' ' + order.slice(i, i + 5).map((k) => `'${k}'`).join(', ') + ',');
  }
  // trim trailing comma on last line
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  return ['```', `[${lines[0].trim()}`, ...lines.slice(1), ']', '```'].join('\n');
}

/** The capability-key contract block for the cheatsheet. */
function renderKeyContract() {
  const kc = contract.key_contract;
  const code = kc.sentinels
    .map(([k, meaning]) => `${k.padEnd(24)} → ${meaning}`)
    .join('\n');
  const rules = kc.rules.map((r) => `- ${r}`).join('\n');
  return ['```', code, '```', '', rules].join('\n');
}

const RENDERERS = {
  'tier-order-table': renderTierOrderTable,
  'tier-order-array': renderTierOrderArray,
  'key-contract': renderKeyContract,
};

const TARGETS = {
  '.devin/skills/tier-hierarchy.md': ['tier-order-table', 'tier-order-array'],
  '.devin/skills/capability-module-cheatsheet.md': ['key-contract'],
};

// --- marker plumbing --------------------------------------------------------

/** Extract the generated content between markers, or null if absent. */
function extractBlock(docText, name) {
  const b = docText.indexOf(BEGIN(name));
  const e = docText.indexOf(END(name));
  if (b === -1 || e === -1 || e < b) return null;
  return docText.slice(b + BEGIN(name).length, e).replace(/^\n+|\n+$/g, '');
}

/** Replace (or report) every known block in a doc. */
function syncDoc(relPath, { write }) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, 'utf8');
  const diffs = [];
  let next = text;
  for (const name of TARGETS[relPath] ?? []) {
    const want = RENDERERS[name]();
    const have = extractBlock(next, name);
    if (have === null) {
      diffs.push({ block: name, status: 'markers-missing' });
      continue;
    }
    if (have !== want) {
      diffs.push({ block: name, status: 'stale' });
      if (write) {
        next = next.replace(
          BEGIN(name) + next.slice(next.indexOf(BEGIN(name)) + BEGIN(name).length, next.indexOf(END(name))) + END(name),
          `${BEGIN(name)}\n${want}\n${END(name)}`,
        );
      }
    }
  }
  if (write && diffs.some((d) => d.status === 'stale')) fs.writeFileSync(abs, next);
  return diffs;
}

module.exports = { renderBlock: (name) => RENDERERS[name](), extractBlock, syncDoc, TARGETS, BEGIN, END };

if (require.main === module) {
  const write = process.argv.includes('--write');
  let bad = 0;
  for (const rel of Object.keys(TARGETS)) {
    for (const d of syncDoc(rel, { write })) {
      bad++;
      console.log(`${rel}: ${d.block} → ${d.status}${write && d.status === 'stale' ? ' (rewritten)' : ''}`);
    }
  }
  if (bad && !write) {
    console.log('\nDoc blocks are stale — run: node apps/api/scripts/gen-tier-doc-blocks.cjs --write');
    process.exit(1);
  }
  if (!bad) console.log('All generated doc blocks are in sync.');
}
