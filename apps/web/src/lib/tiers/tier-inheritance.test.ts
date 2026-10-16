/**
 * Tier contract — Phase 2 (web side): the inheritance graph + bag rules.
 *
 * Web twin of `apps/api/src/services/__tests__/tier-inheritance.test.ts`, plus
 * the assertions that need the feature bags (they live web-side; the api's
 * TIER_FEATURES is a fully-commented fallback — real api grants are DB rows).
 *
 * The four hard rules from tier-hierarchy.md §Inheritance, each named:
 *   2.1 presence must not inherit google_only
 *   2.2 discovery grants no platform-catalog browse/storefront
 *   2.3 nothing below commitment carries commerce/checkout keys
 *   2.4 directory_presence grants gateway chrome only (fixture allowlist)
 *   2.5 acyclic AND transitively closed; omnichannel inherits both money modes
 *   2.6 the five db_only tiers have no own TIER_FEATURES entries — by design
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 2.
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { TIER_HIERARCHY, TIER_FEATURES, getTierFeatures } from './tier-features';

const EDGES = contract.inheritance.edges as Record<string, string[]>;
const RULES = contract.inheritance.negative_rules;
const BAGS = TIER_FEATURES as unknown as Record<string, readonly string[]>;
const sorted = (xs: readonly string[] | undefined) => [...(xs ?? [])].sort();

function reachableFrom(edges: Record<string, string[]>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(edges[start] ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(edges[n] ?? []));
  }
  return seen;
}

describe('tier contract (web) — inheritance graph matches the fixture', () => {
  it.each(Object.keys(EDGES))('%s parents equal the fixture (as a set)', (tier) => {
    expect(sorted(TIER_HIERARCHY[tier]), `${tier}`).toEqual(sorted(EDGES[tier]));
  });

  it('declares no parents for keys the fixture does not know', () => {
    for (const tier of Object.keys(TIER_HIERARCHY)) {
      expect(EDGES, `TIER_HIERARCHY has '${tier}' — not a contract tier`).toHaveProperty(tier);
    }
  });
});

describe('tier contract (web) — 2.5: closure properties', () => {
  it('is transitively closed: every ancestor of a parent is already a parent', () => {
    for (const [tier, parents] of Object.entries(TIER_HIERARCHY)) {
      for (const p of parents) {
        for (const g of TIER_HIERARCHY[p] ?? []) {
          expect(parents, `${tier} inherits ${p} but not ${p}'s parent ${g} — closure broken`).toContain(g);
        }
      }
    }
  });

  it('is acyclic: no tier is reachable from itself', () => {
    for (const tier of Object.keys(TIER_HIERARCHY)) {
      expect(reachableFrom(TIER_HIERARCHY, tier), `${tier} reaches itself — inheritance cycle`).not.toContain(tier);
    }
  });

  it('omnichannel inherits BOTH money modes', () => {
    const { tier, must_inherit } = contract.inheritance.omnichannel_money_modes;
    for (const money of must_inherit) {
      expect(TIER_HIERARCHY[tier], `omnichannel must inherit ${money}`).toContain(money);
    }
  });
});

describe('tier contract (web) — 2.1: presence is not a google tier', () => {
  it('presence has no forbidden parents', () => {
    const rule = RULES.presence_must_not_inherit;
    for (const forbidden of rule.forbidden_parents) {
      expect(TIER_HIERARCHY[rule.tier], `presence must not inherit ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('presence resolves none of google_only\'s distinct features', () => {
    const googleOnlyDistinct = (BAGS.google_only ?? []).filter(
      (f) => !(BAGS.directory_presence ?? []).includes(f),
    );
    const resolved = new Set(getTierFeatures('presence'));
    const leaked = googleOnlyDistinct.filter((f) => resolved.has(f));
    expect(leaked, `presence leaked google_only features: ${leaked.join(', ')}`).toEqual([]);
  });
});

describe('tier contract (web) — 2.2/2.3: entry modes stay below commerce', () => {
  it('discovery resolves no platform-catalog keys', () => {
    const resolved = new Set(getTierFeatures(RULES.discovery_no_platform_storefront.tier));
    for (const key of RULES.discovery_no_platform_storefront.resolved_bag_must_not_contain) {
      expect(resolved, `discovery must not grant '${key}'`).not.toContain(key);
    }
  });

  it.each(RULES.no_checkout_below_commitment.tiers)(
    '%s resolves no commerce_/checkout_ keys (a storefront that accepts payment is a revenue bug)',
    (tier) => {
      const prefixes = RULES.no_checkout_below_commitment.resolved_bag_must_not_have_prefix;
      const leaked = getTierFeatures(tier).filter((f) =>
        prefixes.some((p) => f.startsWith(p)),
      );
      expect(leaked, `${tier} carries commerce keys: ${leaked.join(', ')}`).toEqual([]);
    },
  );
});

describe('tier contract (web) — 2.4: the gateway allowlist', () => {
  it('directory_presence grants only allowlisted chrome', () => {
    const allowed = new Set(contract.inheritance.gateway_allowlist.keys);
    const offList = (BAGS.directory_presence ?? []).filter((f) => !allowed.has(f));
    expect(offList, `directory_presence carries non-gateway keys: ${offList.join(', ')}`).toEqual([]);
  });
});

describe('tier contract (web) — 2.6: db-only grant tiers stay bag-less', () => {
  it.each(contract.inheritance.db_only_grant_tiers.tiers)(
    '%s has no own TIER_FEATURES entry (its grants live in tier_features_list)',
    (tier) => {
      expect(tier in BAGS, `${tier} gained a static bag — document why, or the db-only ruling is broken`).toBe(false);
    },
  );
});
