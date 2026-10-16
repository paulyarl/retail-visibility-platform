/**
 * Tier contract — Phase 1.7 (web side): the shared "no/unknown tier" default.
 *
 * Web twin of `apps/api/src/services/__tests__/tier-defaults.test.ts`.
 * `resolveTier` used to fabricate a 'storefront' TierInfo (despite a comment
 * claiming 'starter'), `mapTierLevel` silently upgraded unknown keys to
 * 'discovery', and `hasFeature` fell back to 'starter' — an inactive legacy
 * tier with a fat bag. All now answer `DEFAULT_TIER`.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { DEFAULT_TIER } from './tier-defaults';
import { resolveTier, hasFeature, type TierInfo, type ResolvedTier } from './tier-resolver';

const bareTier = (id: string): TierInfo => ({
  id,
  name: id,
  level: 'directory_presence',
  source: 'tenant',
  features: [],
  limits: {},
});

describe('tier contract (web) — the shared default (Phase 1.7)', () => {
  it('DEFAULT_TIER matches the fixture', () => {
    expect(DEFAULT_TIER).toBe(contract.default_tier);
    expect(contract.tier_order).toContain(DEFAULT_TIER);
  });

  it('resolveTier with no tiers resolves to the default, not a fabricated storefront', () => {
    const resolved = resolveTier(null, null, false);
    expect(resolved.effective.id).toBe(DEFAULT_TIER);
    expect(resolved.effective.level).toBe(DEFAULT_TIER);
  });

  it('mapTierLevel (via resolveTier) answers the default for unknown keys', () => {
    const resolved = resolveTier(null, bareTier('__no_such_tier__'), false);
    expect(resolved.effective.level).toBe(DEFAULT_TIER);
  });

  it('hasFeature falls back to the default — not the inactive starter bag', () => {
    // `category_quick_start` is in the starter bag but absent from
    // directory_presence. If the fallback were still 'starter' this is true.
    const resolved: ResolvedTier = {
      effective: { ...bareTier(''), features: [] },
      isChain: false,
      canUpgrade: false,
    };
    expect(hasFeature(resolved, 'category_quick_start')).toBe(false);
  });
});
