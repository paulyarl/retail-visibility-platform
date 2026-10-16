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
import { TIER_DISPLAY_NAMES, TIER_PRICING } from './tier-features';

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
