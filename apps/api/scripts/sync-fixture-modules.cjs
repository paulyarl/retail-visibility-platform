#!/usr/bin/env node
/**
 * sync-fixture-modules — regenerate `capability_modules` in
 * shared/tier-contract.json from the DB witness dump
 * (shared/tier-contract-db-witness.json → capability_features).
 *
 * The module key lists are DB-derived by contract (sprint plan 3.3/4.1):
 * the DB is authoritative for `capability_features_list`, the fixture embeds
 * a generated copy so fixture consumers don't need a second file, and
 * `tier-db-witness.test.ts` pins fixture === witness so a stale fixture fails.
 *
 * No DB access needed — run after refreshing the witness:
 *   node scripts/dump-tier-contract.cjs   (via doppler)
 *   node scripts/sync-fixture-modules.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const WITNESS = path.join(ROOT, 'shared/tier-contract-db-witness.json');
const FIXTURE = path.join(ROOT, 'shared/tier-contract.json');

const witness = JSON.parse(fs.readFileSync(WITNESS, 'utf8'));
const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

if (!witness.capability_features || typeof witness.capability_features !== 'object') {
  console.error('witness has no capability_features — re-run dump-tier-contract.cjs');
  process.exit(1);
}

// Deterministic output: capability keys sorted, feature lists pre-sorted by the dump.
const modules = {};
for (const cap of Object.keys(witness.capability_features).sort()) {
  modules[cap] = witness.capability_features[cap];
}

fixture.capability_modules = {
  $comment:
    'Generated from the DB witness (scripts/sync-fixture-modules.cjs — do NOT hand-edit). ' +
    `Source: shared/tier-contract-db-witness.json (env=${witness.env}, generated_at=${witness.generated_at}). ` +
    'tier-db-witness.test.ts asserts this block === witness.capability_features.',
  ...modules,
};

fs.writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
console.log(`fixture.capability_modules regenerated: ${Object.keys(modules).length} capability types`);
