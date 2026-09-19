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

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProfilesFindMany } = vi.hoisted(() => ({
  mockProfilesFindMany: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { mkt_intelligence_profiles: { findMany: mockProfilesFindMany } },
}));
vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  resolveSignalWeightsFromProfiles,
  normalizeSignalPlatformKey,
  LOCAL_PRECEDENCE_CONFIDENCE,
  IntelligenceProfileService,
  selectLeadPlatform,
  platformGapSeverity,
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
    // The §4 confidence gate drove the precedence — divergence is emittable.
    expect(w.precedenceViaConfidence).toBe(true);
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
    // …but the gate did NOT drive precedence → not a confidence-gated divergence.
    expect(w.precedenceViaConfidence).toBe(false);
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
    // Low-confidence fallback ≠ confidence-gated precedence — no divergence.
    expect(w.precedenceViaConfidence).toBe(false);
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

describe('resolveSignalDivergences (spec §5)', () => {
  const service = IntelligenceProfileService.getInstance();
  const ctx = { userId: 'op-1', region: 'us' } as any;

  const dbProfile = (over: Record<string, any> = {}) => ({
    id: 'ip-1',
    category_key: 'auto_repair',
    version: 1,
    status: 'active',
    reference_city: null,
    reference_state: null,
    reference_platform: null,
    configuration_json: {},
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits only confidence-gated divergences across every measured platform', async () => {
    mockProfilesFindMany.mockResolvedValue([
      dbProfile({
        id: 'ip-nat',
        configuration_json: weights([['google', 0.9], ['yelp', 0.2], ['bbb', 0.3]]),
      }),
      dbProfile({
        id: 'ip-local',
        reference_city: 'Indianapolis',
        reference_state: 'IN',
        // google diverges confidently; yelp agrees with national; bbb local
        // estimate is thin → below the §4 gate → not a divergence.
        configuration_json: weights([
          ['google', 0.6, 0.8],
          ['yelp', 0.2, 0.9],
          ['bbb', 0.9, LOCAL_PRECEDENCE_CONFIDENCE - 0.1],
        ]),
      }),
    ]);
    const out = await service.resolveSignalDivergences(
      { category: 'Auto Repair', city: 'Indianapolis', state: 'IN' },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0].platform).toBe('google');
    expect(out[0].divergence).toBeCloseTo(-0.3, 3);
    expect(out[0].precedenceViaConfidence).toBe(true);
  });

  it('returns [] when the local estimate is thin — no divergence from a fallback', async () => {
    mockProfilesFindMany.mockResolvedValue([
      dbProfile({ id: 'ip-nat', configuration_json: weights([['google', 0.9]]) }),
      dbProfile({
        id: 'ip-local',
        reference_city: 'Indianapolis',
        reference_state: 'IN',
        configuration_json: weights([['google', 0.3, 0.4]]), // below τ → national wins
      }),
    ]);
    const out = await service.resolveSignalDivergences(
      { category: 'Auto Repair', city: 'Indianapolis', state: 'IN' },
      ctx,
    );
    expect(out).toEqual([]);
  });

  it('returns [] when no profiles carry signal weights', async () => {
    mockProfilesFindMany.mockResolvedValue([dbProfile()]);
    const out = await service.resolveSignalDivergences(
      { category: 'Auto Repair', city: 'Indianapolis', state: 'IN' },
      ctx,
    );
    expect(out).toEqual([]);
  });

  it('is non-fatal on lookup failure', async () => {
    mockProfilesFindMany.mockRejectedValue(new Error('db down'));
    const out = await service.resolveSignalDivergences(
      { category: 'Auto Repair', city: 'Indianapolis', state: 'IN' },
      ctx,
    );
    expect(out).toEqual([]);
  });
});

// ─── Lead-platform selection (spec §2 "Reported, not applied") ──────────

const resolvedWeight = (over: Record<string, any> = {}) => ({
  platform: 'google',
  weight: 0.9,
  basis: 'basis for google',
  confidence: 0.9,
  observations: 8,
  scope: 'national',
  profileId: 'ip-nat',
  profileVersion: 1,
  divergence: null,
  precedenceViaConfidence: false,
  ...over,
});

describe('platformGapSeverity', () => {
  it('accumulates gap_analysis + failed quality gates per platform', () => {
    const severity = platformGapSeverity({
      gap_analysis: [
        { platform: 'Google', severity: 'non_negotiable' },
        { platform: 'google', severity: 'recommended' },
        { platform: 'Yelp', severity: 'recommended' },
      ],
      quality_gate_results: [
        { platform: 'google', gate: 'photos', passed: false, severity: 'recommended' },
        { platform: 'yelp', gate: 'hours', passed: true, severity: 'non_negotiable' }, // passed — not a gap
      ],
    });
    expect(severity.get('google')).toBeCloseTo(2.0, 5); // 1 + 0.5 + 0.5
    expect(severity.get('yelp')).toBeCloseTo(0.5, 5);
  });

  it('ignores malformed entries and unmapped platforms', () => {
    const severity = platformGapSeverity({
      gap_analysis: [
        { platform: 'google' },                    // no severity → 0 points
        { platform: '', severity: 'non_negotiable' },
        'garbage',
        { platform: 'google', severity: 'weird' }, // unknown severity → 0
      ],
    });
    expect(severity.has('google')).toBe(false);
    expect(severity.size).toBe(0);
  });
});

describe('selectLeadPlatform (argmax signal_weight × gap_severity)', () => {
  it('picks the platform that matters AND where the business is weak', () => {
    // google matters most (0.9) but the business is weakest on bbb (2 gaps)
    // — the product decides, not either fact alone.
    const resolved = new Map<string, any>([
      ['google', resolvedWeight({ platform: 'google', weight: 0.9 })],
      ['bbb', resolvedWeight({ platform: 'bbb', weight: 0.3, basis: 'bbb basis' })],
      ['yelp', resolvedWeight({ platform: 'yelp', weight: 0.2 })],
    ]);
    const audit = {
      gap_analysis: [
        { platform: 'google', severity: 'non_negotiable' },   // 0.9 × 1 = 0.9
        { platform: 'bbb', severity: 'non_negotiable' },      // 0.3 × 1.5 = 0.45
        { platform: 'bbb', severity: 'recommended' },
        { platform: 'yelp', severity: 'non_negotiable' },     // 0.2 × 1 = 0.2
      ],
    };
    const lead = selectLeadPlatform(audit, resolved)!;
    expect(lead.platform).toBe('google');
    expect(lead.score).toBeCloseTo(0.9, 5);
    expect(lead.basis).toBe('basis for google');
    expect(lead.scope).toBe('national');
  });

  it('lets a weaker-signal platform win when the business is much weaker there', () => {
    const resolved = new Map<string, any>([
      ['google', resolvedWeight({ platform: 'google', weight: 0.9 })],
      ['yelp', resolvedWeight({ platform: 'yelp', weight: 0.4 })],
    ]);
    const audit = {
      gap_analysis: [
        { platform: 'google', severity: 'recommended' },      // 0.9 × 0.5 = 0.45
        { platform: 'yelp', severity: 'non_negotiable' },     // 0.4 × 1.5 = 0.6
        { platform: 'yelp', severity: 'recommended' },
      ],
    };
    expect(selectLeadPlatform(audit, resolved)!.platform).toBe('yelp');
  });

  it('uses the effective (local) weight — never national when local diverged', () => {
    const resolved = new Map<string, any>([
      ['google', resolvedWeight({
        platform: 'google',
        weight: 0.6,                       // effective = local, not national 0.9
        scope: 'local',
        precedenceViaConfidence: true,
        divergence: -0.3,
      })],
      ['yelp', resolvedWeight({ platform: 'yelp', weight: 0.5 })],
    ]);
    const audit = {
      gap_analysis: [
        { platform: 'google', severity: 'non_negotiable' },   // 0.6 × 1 = 0.6
        { platform: 'yelp', severity: 'non_negotiable' },     // 0.5 × 1 = 0.5
      ],
    };
    const lead = selectLeadPlatform(audit, resolved)!;
    expect(lead.platform).toBe('google');
    expect(lead.scope).toBe('local');
  });

  it('returns null when nothing is weak — no premise without a gap', () => {
    const resolved = new Map<string, any>([
      ['google', resolvedWeight({ platform: 'google', weight: 0.9 })],
    ]);
    expect(selectLeadPlatform({ gap_analysis: [] }, resolved)).toBeNull();
    expect(selectLeadPlatform({}, resolved)).toBeNull();
  });

  it('returns null when no weights resolved — no traffic fact to report', () => {
    const audit = { gap_analysis: [{ platform: 'google', severity: 'non_negotiable' }] };
    expect(selectLeadPlatform(audit, new Map())).toBeNull();
  });

  it('skips platforms with gaps but no resolved weight', () => {
    const resolved = new Map<string, any>([
      ['yelp', resolvedWeight({ platform: 'yelp', weight: 0.2 })],
    ]);
    const audit = {
      gap_analysis: [
        { platform: 'google', severity: 'non_negotiable' },   // unmeasured → skip
        { platform: 'yelp', severity: 'recommended' },        // 0.2 × 0.5 = 0.1
      ],
    };
    expect(selectLeadPlatform(audit, resolved)!.platform).toBe('yelp');
  });
});
