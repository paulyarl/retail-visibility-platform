/**
 * IntelligenceProfileService — signal_weight resolution tests.
 *
 * Covers the pure half of the resolver (resolveSignalWeightsFromProfiles):
 *   - national fallback when no scoped profile carries the platform
 *   - confidence-gated local-over-national precedence
 *   - regional (state-scoped) layer between local and national
 *   - platform-scoped profiles preferred over cross-platform ones
 *   - the local-vs-national divergence reading
 *   - platform-key normalization (apple_maps → apple, GBP → google)
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../prisma', () => ({ prisma: {} }));
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  resolveSignalWeightsFromProfiles,
  normalizeSignalPlatformKey,
  LOCAL_PRECEDENCE_CONFIDENCE,
} from '../intelligence/IntelligenceProfileService';

const profile = (over: Record<string, any> = {}) => ({
  id: 'ip-1',
  version: 1,
  reference_city: null,
  reference_state: null,
  reference_platform: null,
  configuration_json: {},
  ...over,
});

const weights = (entries: Array<[string, number, number?]>) => ({
  platform_signal_weights: entries.map(([platform, weight, confidence]) => ({
    platform,
    weight,
    basis: `basis for ${platform}`,
    confidence: confidence ?? 0.9,
    observations: 8,
  })),
});

describe('normalizeSignalPlatformKey', () => {
  it('folds aliases onto the audit platform keys', () => {
    expect(normalizeSignalPlatformKey('Google')).toBe('google');
    expect(normalizeSignalPlatformKey('google_business_profile')).toBe('google');
    expect(normalizeSignalPlatformKey('Apple Maps')).toBe('apple');
    expect(normalizeSignalPlatformKey('apple_maps')).toBe('apple');
    expect(normalizeSignalPlatformKey('Better Business Bureau')).toBe('bbb');
    expect(normalizeSignalPlatformKey('Meta')).toBe('facebook');
    expect(normalizeSignalPlatformKey('  ')).toBeNull();
  });
});

describe('resolveSignalWeightsFromProfiles', () => {
  it('resolves a national weight when only the national layer carries it', () => {
    const profiles = [
      profile({ configuration_json: weights([['google', 0.9], ['yelp', 0.2]]) }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google', 'yelp'],
      city: 'Indianapolis',
      state: 'IN',
    });
    expect(out.get('google')).toMatchObject({ weight: 0.9, scope: 'national' });
    expect(out.get('yelp')).toMatchObject({ weight: 0.2, scope: 'national' });
  });

  it('lets a confident local estimate outrank the national one — and reports the divergence', () => {
    const profiles = [
      profile({ id: 'ip-nat', configuration_json: weights([['google', 0.9]]) }),
      profile({
        id: 'ip-local',
        reference_city: 'Indianapolis',
        reference_state: 'IN',
        configuration_json: weights([['google', 0.6, 0.8]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    const w = out.get('google')!;
    expect(w.scope).toBe('local');
    expect(w.weight).toBe(0.6);
    expect(w.profileId).toBe('ip-local');
    // local 0.6 − national 0.9 = −0.3
    expect(w.divergence).toBeCloseTo(-0.3, 3);
  });

  it('keeps the national estimate when the local one is below the confidence gate', () => {
    const profiles = [
      profile({ id: 'ip-nat', configuration_json: weights([['google', 0.9]]) }),
      profile({
        id: 'ip-local',
        reference_city: 'Indianapolis',
        reference_state: 'IN',
        configuration_json: weights([['google', 0.6, LOCAL_PRECEDENCE_CONFIDENCE - 0.1]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    const w = out.get('google')!;
    expect(w.scope).toBe('national');
    expect(w.weight).toBe(0.9);
    expect(w.profileId).toBe('ip-nat');
    // Divergence is still reported — the disagreement is itself an observation.
    expect(w.divergence).toBeCloseTo(-0.3, 3);
  });

  it('returns a low-confidence local estimate when it is the only measurement', () => {
    const profiles = [
      profile({
        id: 'ip-local',
        reference_city: 'Indianapolis',
        reference_state: 'IN',
        configuration_json: weights([['google', 0.6, 0.3]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    const w = out.get('google')!;
    expect(w.scope).toBe('local');
    expect(w.weight).toBe(0.6);
    expect(w.confidence).toBe(0.3);
  });

  it('lets a confident regional (state-scoped) estimate outrank the national one', () => {
    const profiles = [
      profile({ id: 'ip-nat', configuration_json: weights([['google', 0.9]]) }),
      profile({
        id: 'ip-state',
        reference_state: 'IN',
        configuration_json: weights([['google', 0.7, 0.8]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    expect(out.get('google')).toMatchObject({ weight: 0.7, scope: 'regional', profileId: 'ip-state' });
  });

  it('ignores a local profile for a different city', () => {
    const profiles = [
      profile({ id: 'ip-nat', configuration_json: weights([['google', 0.9]]) }),
      profile({
        id: 'ip-other',
        reference_city: 'Chicago',
        reference_state: 'IL',
        configuration_json: weights([['google', 0.1, 0.95]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    expect(out.get('google')).toMatchObject({ weight: 0.9, scope: 'national', profileId: 'ip-nat' });
  });

  it('prefers a platform-scoped profile over a cross-platform one at the same layer', () => {
    const profiles = [
      profile({ id: 'ip-cross', version: 2, configuration_json: weights([['google', 0.9]]) }),
      profile({
        id: 'ip-google',
        version: 1,
        reference_platform: 'google',
        configuration_json: weights([['google', 0.8]]),
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google'],
      city: 'Indianapolis',
      state: 'IN',
    });
    expect(out.get('google')).toMatchObject({ weight: 0.8, profileId: 'ip-google' });
  });

  it('normalizes the requested platform onto the audit vocabulary', () => {
    const profiles = [
      profile({ configuration_json: weights([['apple_maps', 0.4], ['google_business_profile', 0.95]]) }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['apple', 'google'],
      city: null,
      state: null,
    });
    expect(out.get('apple')).toMatchObject({ weight: 0.4 });
    expect(out.get('google')).toMatchObject({ weight: 0.95 });
  });

  it('omits platforms no profile measures, and skips malformed entries', () => {
    const profiles = [
      profile({
        configuration_json: {
          platform_signal_weights: [
            { platform: 'google', weight: 0.9, confidence: 0.8 },
            { platform: '', weight: 0.5 },
            { platform: 'yelp', weight: 'high' },
            { platform: 'facebook', weight: 1.4 }, // clamped to 1
          ],
        },
      }),
    ];
    const out = resolveSignalWeightsFromProfiles(profiles, {
      platforms: ['google', 'yelp', 'facebook', 'bbb'],
      city: 'Indianapolis',
      state: 'IN',
    });
    expect(out.has('google')).toBe(true);
    expect(out.has('yelp')).toBe(false); // malformed weight → dropped
    expect(out.get('facebook')!.weight).toBe(1); // clamped
    expect(out.has('bbb')).toBe(false); // unmeasured → absent → unweighted
  });
});
