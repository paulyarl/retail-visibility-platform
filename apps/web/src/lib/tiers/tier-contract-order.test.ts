/**
 * Tier contract — Phase 1.1/1.3 (web side).
 *
 * The web twin of `apps/api/src/services/__tests__/tier-contract-order.test.ts`.
 * Same fixture, same assertions, other side of the boundary — that is the whole
 * point of D6: two suites, one truth. If these two ever disagree, one of them is
 * wrong and the fixture says which.
 *
 * Phase 1.3 lives here because the display-name and price maps are web-side:
 * active tiers need both, `inactive_legacy` need order membership only,
 * `pseudo_tiers` are exempt by rule (D8).
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { TIER_ORDER } from '../growth-tips/tipEngine';
import { TIER_DISPLAY_NAMES, TIER_PRICING, TIER_FEATURES } from './tier-features';
import { CATALOG_TIER_ORDER } from '../features/feature-catalog';
import { CAPABILITY_TIER_SORT_ORDER } from '../../app/api/admin/capabilities/route';

describe('tier contract (web) — order matches the fixture', () => {
  it('tipEngine declares the fixture order exactly', () => {
    expect([...TIER_ORDER]).toEqual(contract.tier_order);
  });

  it('is missing no fixture key (the 2026-10-15 defect)', () => {
    const missing = contract.tier_order.filter((k) => !TIER_ORDER.includes(k as never));
    expect(missing, `tipEngine is missing ${missing.join(', ')}`).toEqual([]);
  });

  it('holds the critical order invariants by index position', () => {
    const order = TIER_ORDER as readonly string[];
    const [eLo, eHi] = contract.critical_order_invariants.ecommerce_between;
    expect(order.indexOf(eLo)).toBeLessThan(order.indexOf('ecommerce'));
    expect(order.indexOf('ecommerce')).toBeLessThan(order.indexOf(eHi));

    const [oLo, oHi] = contract.critical_order_invariants.organization_between;
    expect(order.indexOf(oLo)).toBeLessThan(order.indexOf('organization'));
    expect(order.indexOf('organization')).toBeLessThan(order.indexOf(oHi));

    expect(order.indexOf('directory_presence'))
      .toBeLessThan(order.indexOf(contract.critical_order_invariants.directory_presence_before));
  });
});

describe('tier contract (web) — Phase 1.1, intended-subset arrays', () => {
  /**
   * Not every order-shaped structure is a copy of the canonical 16. Subsets are
   * legitimate when the consumer's vocabulary is deliberately narrower — the
   * contract for them is RELATIVE ORDER: filtering the fixture order down to the
   * subset's keys must reproduce the subset exactly.
   */
  const SUBSETS: Array<[string, readonly string[]]> = [
    // Legacy 4-rung catalog vocabulary (PlatformFeature.requiredTier admits
    // only these keys).
    ['feature-catalog CATALOG_TIER_ORDER', CATALOG_TIER_ORDER],
    // Sparse sort map for the four tiers the admin capabilities route iterates.
    ['admin/capabilities CAPABILITY_TIER_SORT_ORDER', Object.keys(CAPABILITY_TIER_SORT_ORDER)],
  ];

  it.each(SUBSETS)('%s keeps the fixture relative order', (_name, subset) => {
    const inFixture = contract.tier_order.filter((k) => subset.includes(k));
    expect([...subset], `${_name} keys must appear in fixture order`).toEqual(inFixture);
  });

  it.each(SUBSETS)('%s keys are all real tier keys', (_name, subset) => {
    for (const k of subset) {
      expect(contract.tier_order, `${k} is not a contract tier`).toContain(k);
    }
  });
});

describe('tier contract (web) — Phase 1.3, per D8 class', () => {
  it('every active tier resolves in TIER_DISPLAY_NAMES', () => {
    const names = TIER_DISPLAY_NAMES as Record<string, string>;
    const missing = contract.tier_classes.active.filter((t) => !names[t]);
    expect(missing, `no display name for ${missing.join(', ')}`).toEqual([]);
  });

  it('every active tier resolves in TIER_PRICING', () => {
    const pricing = TIER_PRICING as Record<string, number>;
    const missing = contract.tier_classes.active.filter((t) => typeof pricing[t] !== 'number');
    expect(missing, `no price for ${missing.join(', ')}`).toEqual([]);
  });

  it('inactive_legacy needs order membership only — no display name or price required', () => {
    // Asserted as a NEGATIVE so a future contributor does not "fix" the gap by
    // inventing values for dormant tiers. `custom` currently violates this on
    // both sides; it is recorded in the plan rather than silently satisfied.
    const names = TIER_DISPLAY_NAMES as Record<string, string>;
    const order = TIER_ORDER as readonly string[];
    for (const t of contract.tier_classes.inactive_legacy) {
      expect(order, `${t} must stay in the order array`).toContain(t);
      void names[t];
    }
  });

  it('no pseudo-tier is a rung', () => {
    for (const t of contract.tier_classes.pseudo_tiers) {
      expect(TIER_ORDER as readonly string[]).not.toContain(t);
    }
  });
});

describe('tier contract (web) — 1.5a, the chain-mirror invariant', () => {
  /**
   * A chain tier mirrors its base tier: whatever `starter` grants, `chain_starter`
   * grants too. This is the REAL invariant the failed 1.5 was reaching for — and
   * the 1.5 diagnostic is what found it.
   *
   * The naive bidirectional check (TIER_FEATURES ↔ FEATURE_TIER_MAP) was
   * unwritable: the map is single-valued while the bags are multi-valued, so 27
   * features appear in two bags legitimately — and most of those pairs ARE the
   * chain mirror. Asserting the mirror directly tests the fact instead of
   * demanding 27 correct rows be "fixed". See the plan, "1.5 is unwritable as
   * specified".
   */
  // `TIER_FEATURES` is declared `as const`, so the bags are readonly.
  const bag = TIER_FEATURES as unknown as Record<string, readonly string[]>;

  /**
   * `it.fails` — a DOCUMENTED KNOWN-RED, not a deleted assertion.
   *
   * The invariant does not hold today: 14 features are granted at the base tier
   * and absent from the chain tier.
   *
   *   chain_starter     ← basic_categories, category_quick_start, image_finder, clover_pos
   *   chain_professional ← business_logo, interactive_maps, privacy_mode,
   *                        custom_marketing_copy, priority_support, square_pos,
   *                        payment_client_credentials
   *   chain_enterprise  ← advanced_analytics, sla_guarantee, custom_integrations, customDomains
   *
   * `tier-hierarchy.md` says `chain_professional` is "professional level", which
   * implies the mirror. Either the chain bags are incomplete (a real bug) or a
   * chain tier is a genuinely different bundle and the doc is loose — undecided.
   *
   * `it.fails` is the honest instrument: the suite stays green, the gap stays
   * visible in the source, and **fixing the code makes this test fail** — forcing
   * whoever fixes it to promote the assertion rather than leave it buried.
   */
  it.fails.each(contract.chain_mirrors.map((m) => [m.chain, m.base] as const))(
    'KNOWN-RED: %s grants everything %s grants',
    (chain, base) => {
      const chainBag = new Set(bag[chain] ?? []);
      const missing = (bag[base] ?? []).filter((f) => !chainBag.has(f));
      expect(missing, `${chain} is missing from ${base}: ${missing.join(', ')}`).toEqual([]);
    },
  );
});
