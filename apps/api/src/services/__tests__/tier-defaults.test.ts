/**
 * Tier contract — Phase 1.7 (api side): the shared "no/unknown tier" default.
 *
 * Five call sites used to answer "tenant with no tier" five different ways:
 * `starter` (an INACTIVE legacy tier — a silent over-grant), `discovery`,
 * and `professional` (a *high* gate for unknown features). Decision: one
 * shared default — `directory_presence`, the free gateway, least privilege —
 * exported once as `DEFAULT_TIER` and pinned here against the fixture.
 *
 * Blast radius (per the plan): `getRequiredTier` moving professional →
 * directory_presence LOOSENS the unknown-feature gate — an unlisted feature
 * key now passes for every tier rather than requiring professional+. Accepted
 * because 'premium by omission' was never a defensible answer, but it is a
 * live-gate change and ships as its own commit.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { DEFAULT_TIER } from '../../utils/tier-defaults';
import { getSKULimit, getTierInfo, TIER_LIMITS } from '../../utils/tier-limits';
import {
  getEffectiveTier,
  getEffectiveTierWithTrialInfo,
} from '../../utils/trial-tier-transparency';
import { getRequiredTier } from '../../middleware/tier-access';

describe('tier contract — the shared default (Phase 1.7)', () => {
  it('DEFAULT_TIER matches the fixture', () => {
    expect(DEFAULT_TIER).toBe(contract.default_tier);
    expect(contract.tier_order).toContain(DEFAULT_TIER);
  });

  it('getSKULimit answers the default for null AND unknown keys', () => {
    const expected = TIER_LIMITS[DEFAULT_TIER].maxSkus;
    expect(getSKULimit(null)).toBe(expected);
    expect(getSKULimit(undefined)).toBe(expected);
    expect(getSKULimit('__no_such_tier__')).toBe(expected);
  });

  it('getTierInfo answers the default for null AND unknown keys', () => {
    const expected = TIER_LIMITS[DEFAULT_TIER];
    expect(getTierInfo(null)).toEqual(expected);
    expect(getTierInfo('__no_such_tier__')).toEqual(expected);
  });

  it('getEffectiveTier / getEffectiveTierWithTrialInfo answer the default for null', () => {
    expect(getEffectiveTier(null)).toBe(DEFAULT_TIER);
    expect(getEffectiveTier(undefined)).toBe(DEFAULT_TIER);
    expect(getEffectiveTierWithTrialInfo(null).effectiveTier).toBe(DEFAULT_TIER);
  });

  it('getRequiredTier answers the default for an unknown feature', () => {
    expect(getRequiredTier('__no_such_feature__')).toBe(DEFAULT_TIER);
  });
});
