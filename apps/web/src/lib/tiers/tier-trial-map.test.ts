/**
 * Tier contract — Phase 1.6 (web side): `TIER_LIMITS[*].trialTarget`.
 *
 * The web has no trial→base lookup table like the api's five copies; its
 * representation is declarative — each `trial_*` entry in `TIER_LIMITS`
 * carries a `trialTarget` field. Same contract, other side: where a web entry
 * names a target it MUST agree with the fixture's `trial_map.canonical`.
 *
 * `expired_trial` carries no `trialTarget` — it is an expired STATE, not a
 * tier to resolve (H2; only the api's limits map proxies it, and that is a
 * declared site exception there, not a web concern).
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { TIER_LIMITS } from '../tiers';

const CANONICAL = contract.trial_map.canonical as Record<string, string>;

const LIMITS = TIER_LIMITS as Record<
  string,
  { isTrial?: boolean; isExpired?: boolean; trialTarget?: string }
>;
const TRIAL_ENTRIES = Object.keys(LIMITS).filter((k) => k.startsWith('trial_'));

describe('tier contract (web) — TIER_LIMITS trialTarget', () => {
  it('every trial_* entry names a trialTarget', () => {
    for (const k of TRIAL_ENTRIES) {
      expect(LIMITS[k].trialTarget, `${k} has no trialTarget`).toBeTruthy();
    }
  });

  it('every trialTarget agrees with the fixture canonical map', () => {
    for (const k of TRIAL_ENTRIES) {
      expect(
        LIMITS[k].trialTarget,
        `${k}.trialTarget is '${LIMITS[k].trialTarget}', canonical is '${CANONICAL[k] ?? 'unmapped'}'`,
      ).toBe(CANONICAL[k]);
    }
  });

  it('expired_trial names no target — it presents as itself', () => {
    expect(LIMITS['expired_trial'].trialTarget).toBeUndefined();
  });
});
