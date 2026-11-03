import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Contract guard: tier prices come from TIER_PRICING, never a literal.
 *
 * Why this exists: three public surfaces — /features, /settings/offerings and
 * the signup wizard — each hand-typed the tier ladder, and each drifted
 * differently. Between them they sold a phantom $19 "Starter", quoted a
 * phantom $49 upgrade price, and labelled a $39 tier with a $59 tier's name.
 * The tier-contract suites could not catch it because `surface_files` only
 * lists files that DECLARE a tier map; these declared nothing and hardcoded
 * everything.
 *
 * Fix a hit by reading the value from the contract:
 *     ${TIER_PRICING.storefront}/mo
 */

const SRC = join(process.cwd(), 'src');

/**
 * Known debt. Every entry is a burn-down item, not an exemption — remove the
 * line when the file starts reading from the contract. The second test below
 * fails if an entry no longer has a literal, so this list cannot quietly rot.
 */
const KNOWN_DEBT = new Set([
  'lib/tiers.ts', // duplicate tier library — consolidate into lib/tiers/tier-features.ts
  'components/tiers/TierComparisonTable.tsx', // own price map
  'components/FeaturesSlider.tsx', // own price map
  'app/(platform)/settings/admin/demo-tenants/page.tsx',
  'app/(platform)/settings/admin/tier-system/page.tsx',
]);

/** Not tier prices — excluded by domain, not by debt. */
const NOT_TIER_PRICING = new Set([
  'lib/chain-tiers.ts', // chain pricing has its own fixture
  'app/solutions/clover-storefront/page.tsx', // marketing prose ("plans from $29/mo")
  'app/faq/page.tsx', // managed-services pricing
]);

const PRICE_LITERAL = /\$\d{2,5}\s*\/\s*mo/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('tier price contract', () => {
  // I/O bound: reads every .ts/.tsx under src. Vitest's 5s default is tight
  // when the full suite is running in parallel, so give the walk room.
  it('has no hardcoded $NN/mo tier prices outside the known-debt ledger', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (KNOWN_DEBT.has(rel) || NOT_TIER_PRICING.has(rel)) continue;

      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (PRICE_LITERAL.test(line)) offenders.push(`${rel}:${index + 1}  ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  }, 60_000);

  it('keeps the known-debt ledger honest — every entry still has a literal to burn down', () => {
    const stale = [...KNOWN_DEBT].filter((rel) => {
      try {
        return !PRICE_LITERAL.test(readFileSync(join(SRC, rel), 'utf8'));
      } catch {
        return true; // moved or deleted — the ledger needs updating either way
      }
    });

    expect(stale).toEqual([]);
  });
});
