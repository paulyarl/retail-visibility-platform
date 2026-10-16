/**
 * Tier contract — Phase 1.1/1.2 (api side).
 *
 * Pins every API-side `TIER_ORDER` to the shared fixture. D1 is "assert first":
 * this asserts the existing copies to each other via the fixture rather than
 * refactoring them into one module first.
 *
 * The class of defect this exists to catch (found 2026-10-15, live):
 * `QuickLinksService` and `NextStepsService` were missing `presence`,
 * `ecommerce` AND `organization`. Because each copy's `tierIndex` returns 0 for
 * an unknown key, those tenants silently compared BELOW `commitment` on two
 * operator surfaces. Nothing failed — a missing tier is an under-gate, not a
 * crash.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { TIER_ORDER as QUICK_LINKS_ORDER } from '../QuickLinksService';
import { TIER_ORDER as NEXT_STEPS_ORDER } from '../NextStepsService';
import { TIER_ORDER as GROWTH_TIP_ORDER } from '../GrowthTipService';

const COPIES: Array<[string, readonly string[]]> = [
  ['QuickLinksService', QUICK_LINKS_ORDER],
  ['NextStepsService', NEXT_STEPS_ORDER],
  ['GrowthTipService', GROWTH_TIP_ORDER],
];

describe('tier contract — order arrays match the fixture', () => {
  it.each(COPIES)('%s declares the fixture order exactly', (_name, order) => {
    expect([...order]).toEqual(contract.tier_order);
  });

  it('no copy is missing a fixture key (the 2026-10-15 defect)', () => {
    for (const [name, order] of COPIES) {
      const missing = contract.tier_order.filter((k) => !order.includes(k));
      expect(missing, `${name} is missing ${missing.join(', ')}`).toEqual([]);
    }
  });
});

describe('tier contract — the critical order invariants', () => {
  it('ecommerce sits between commitment and omnichannel', () => {
    for (const [name, order] of COPIES) {
      const [lo, hi] = contract.critical_order_invariants.ecommerce_between;
      expect(order.indexOf(lo), `${name}`).toBeLessThan(order.indexOf('ecommerce'));
      expect(order.indexOf('ecommerce'), `${name}`).toBeLessThan(order.indexOf(hi));
    }
  });

  it('organization sits between professional and enterprise', () => {
    for (const [name, order] of COPIES) {
      const [lo, hi] = contract.critical_order_invariants.organization_between;
      expect(order.indexOf(lo), `${name}`).toBeLessThan(order.indexOf('organization'));
      expect(order.indexOf('organization'), `${name}`).toBeLessThan(order.indexOf(hi));
    }
  });

  it('directory_presence comes before the paid entry modes', () => {
    for (const [name, order] of COPIES) {
      expect(order.indexOf('directory_presence'), `${name}`)
        .toBeLessThan(order.indexOf(contract.critical_order_invariants.directory_presence_before));
    }
  });
});

describe('tier contract — the fixture is internally consistent', () => {
  it('the three classes partition the order, and pseudo_tiers are outside it', () => {
    const { active, inactive_legacy, pseudo_tiers } = contract.tier_classes;
    const classified = [...active, ...inactive_legacy];

    // Every order key is classified exactly once.
    expect([...classified].sort()).toEqual([...contract.tier_order].sort());
    // No duplicates across the two in-order classes.
    expect(new Set(classified).size).toBe(classified.length);
    // Pseudo tiers never appear as a rung.
    for (const t of pseudo_tiers) expect(contract.tier_order).not.toContain(t);
  });

  it('every active tier carries a price', () => {
    const priced = contract.pricing as Record<string, number>;
    for (const t of contract.tier_classes.active) {
      expect(typeof priced[t], `${t} has no price`).toBe('number');
    }
  });
});
