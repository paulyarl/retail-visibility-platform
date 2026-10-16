/**
 * Tier contract — Phase 2 (api side): the inheritance graph.
 *
 * `checkTierAccess`'s fallback resolves exactly ONE hop, so `TIER_HIERARCHY`
 * entries ARE the transitive closure — not direct parents. The api copy had
 * silently diverged from web/doc before this pin (2026-10-16):
 * `discovery` lost `google_only`, `professional`/`enterprise`/`organization`
 * lost the entire commerce chain, `ecommerce`/`omnichannel` had NO edges, and
 * `chain_*` wrongly carried `commitment`.
 *
 * Bag-level rules (2.2/2.3/2.4) are asserted web-side only — this file's
 * TIER_FEATURES is the fully-commented fallback bag set; the DB holds the
 * api's real grant rows (0.2 leg).
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 2.
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { TIER_HIERARCHY } from '../../middleware/tier-access';

const EDGES = contract.inheritance.edges as Record<string, string[]>;
const sorted = (xs: readonly string[] | undefined) => [...(xs ?? [])].sort();

/** DFS reachability over a map — detects cycles whether edges are closures or not. */
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

describe('tier contract — inheritance graph matches the fixture', () => {
  it.each(Object.keys(EDGES))('%s parents equal the fixture (as a set)', (tier) => {
    expect(sorted(TIER_HIERARCHY[tier]), `${tier}`).toEqual(sorted(EDGES[tier]));
  });

  it('declares no parents for keys the fixture does not know', () => {
    for (const tier of Object.keys(TIER_HIERARCHY)) {
      expect(EDGES, `TIER_HIERARCHY has '${tier}' — not a contract tier`).toHaveProperty(tier);
    }
  });
});

describe('tier contract — 2.5: closure properties', () => {
  it('is transitively closed: every ancestor of a parent is already a parent', () => {
    for (const [tier, parents] of Object.entries(TIER_HIERARCHY)) {
      for (const p of parents) {
        const grandparents = TIER_HIERARCHY[p] ?? [];
        for (const g of grandparents) {
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

describe('tier contract — 2.1: presence does not inherit google_only', () => {
  it('presence has no forbidden parents', () => {
    const rule = contract.inheritance.negative_rules.presence_must_not_inherit;
    for (const forbidden of rule.forbidden_parents) {
      expect(TIER_HIERARCHY[rule.tier], `presence must not inherit ${forbidden}`).not.toContain(forbidden);
    }
  });
});
