/**
 * Tests for IntelligenceProfileService.addGoldStandardCandidate — the
 * per-platform slot promotion method that replaces manual JSON surgery.
 *
 * Covers:
 *   - Success: adds a new candidate to a profile (new active version created)
 *   - Success: flips is_gold_standard on an existing candidate's platform evaluation
 *   - Idempotency: candidate already in slot → returns current active, no new version
 *   - Cap enforcement: 4 gold-standard on platform → throws
 *   - Non-gold-standard profile → throws (focus check)
 *   - Candidate not flagged gold-standard on target platform → throws
 *   - Profile not found → throws
 *   - New candidate preserves other platforms' flags from scan data
 *
 * Uses the same vi.mock + mocked Prisma pattern as the gold-standard test file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  mkt_intelligence_profiles: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
};

vi.mock('../BaseService', () => {
  class MockBaseService {
    get prisma() {
      return mockPrisma;
    }
    handleError(error: any, _ctx?: any) {
      return error;
    }
  }
  return { BaseService: MockBaseService };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { IntelligenceProfileService } from '../intelligence/IntelligenceProfileService';

describe('IntelligenceProfileService.addGoldStandardCandidate', () => {
  let service: IntelligenceProfileService;

  const activeProfile = {
    id: 'gs-african-grocery',
    category_key: 'african_grocery',
    category_name: 'African Grocery Store',
    version: 1,
    intelligence_focus: 'gold_standards',
    reference_city: null,
    reference_state: null,
    reference_platform: null,
    configuration_json: {
      expected_fields: { universal: {} },
      candidates: [],
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const newCandidate = {
    business_name: 'Afro Ethiopian Market',
    city: 'Washington',
    state: 'DC',
    nap: { name: 'Afro Ethiopian Market', address: '123 9th St NW', phone: '+12025550100' },
    ownership_type: 'independent',
    location_count_estimate: 1,
    independence_rationale: 'Single-location independent operator',
    platform_evaluations: [
      {
        platform: 'google',
        profile_url: 'https://www.google.com/maps/place/Afro+Ethiopian+Market',
        quality_score: 9,
        quality_rationale: 'Complete profile, excellent branding',
        is_gold_standard: true,
        branding_artifacts: { has_logo: true, has_cover_photo: true, photo_count: 28 },
        platform_config: { primary_category: 'African goods store', claimed: true },
        quality_gates_passed: ['business_name', 'hours', 'website'],
        quality_gates_failed: [],
      },
      {
        platform: 'yelp',
        profile_url: 'https://www.yelp.com/biz/afro-ethiopian-market',
        quality_score: 7,
        quality_rationale: 'Good but missing cover photo',
        is_gold_standard: false,
        branding_artifacts: { has_logo: true, has_cover_photo: false, photo_count: 12 },
        platform_config: { primary_category: 'African Grocery', claimed: false },
        quality_gates_passed: ['business_name', 'hours'],
        quality_gates_failed: ['claimed'],
      },
    ],
    category_notes: 'Strong Google presence, weaker on Yelp',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = IntelligenceProfileService.getInstance();
    // Default: $transaction delegates to the callback with mockPrisma as tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('adds a new candidate to an empty profile and creates a new active version', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(activeProfile);
    // Inside the transaction: findMany returns the latest version (v1)
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([activeProfile]);
    const createdProfile = { ...activeProfile, version: 2, configuration_json: { candidates: [newCandidate] } };
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue(createdProfile);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.addGoldStandardCandidate('gs-african-grocery', {
      candidate: newCandidate,
      platform: 'google',
    });

    expect(result.version).toBe(2);
    expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
      where: { id: 'gs-african-grocery', status: 'active' },
      data: { status: 'retired', updated_at: expect.any(Date) },
    });
    // Verify the new version was created with the candidate appended
    const createCall = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0];
    expect(createCall.data.id).toBe('gs-african-grocery');
    expect(createCall.data.version).toBe(2);
    expect(createCall.data.status).toBe('active');
    const config = createCall.data.configuration_json;
    expect(config.candidates).toHaveLength(1);
    expect(config.candidates[0].business_name).toBe('Afro Ethiopian Market');
    // Google flag should be true
    const googleEval = config.candidates[0].platform_evaluations.find((pe: any) => pe.platform === 'google');
    expect(googleEval.is_gold_standard).toBe(true);
  });

  it('preserves other platforms flags from scan data when adding a new candidate', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([activeProfile]);
    const createdProfile = { ...activeProfile, version: 2 };
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue(createdProfile);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    await service.addGoldStandardCandidate('gs-african-grocery', {
      candidate: newCandidate,
      platform: 'google',
    });

    const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
    const yelpEval = config.candidates[0].platform_evaluations.find((pe: any) => pe.platform === 'yelp');
    // Yelp was not flagged gold-standard in the scan — should remain false
    expect(yelpEval.is_gold_standard).toBe(false);
  });

  it('flips is_gold_standard on an existing candidate for the target platform (per-platform promotion)', async () => {
    // Scenario: the analyst flagged the candidate gold-standard on BOTH Google
    // and Yelp in the scan. The operator already promoted to Google's slot
    // (prior call). Now the operator promotes to Yelp's slot. The input
    // candidate (from the scan) has is_gold_standard=true on both platforms;
    // the profile's existing copy only has Google flipped so far.
    const candidateFlaggedOnBoth = {
      ...newCandidate,
      platform_evaluations: [
        { platform: 'google', profile_url: 'https://www.google.com/maps/place/Afro+Ethiopian+Market', quality_score: 9, is_gold_standard: true, quality_gates_passed: ['business_name'], quality_gates_failed: [] },
        { platform: 'yelp', profile_url: 'https://www.yelp.com/biz/afro-ethiopian-market', quality_score: 8, is_gold_standard: true, quality_gates_passed: ['business_name'], quality_gates_failed: [] },
      ],
    };
    // Profile already has the candidate, but only Google is flagged gold-standard
    // (from the prior promotion to Google's slot)
    const profileWithCandidate = {
      ...activeProfile,
      configuration_json: {
        candidates: [
          {
            ...candidateFlaggedOnBoth,
            platform_evaluations: [
              { platform: 'google', is_gold_standard: true, quality_score: 9 },
              { platform: 'yelp', is_gold_standard: false, quality_score: 8 },
            ],
          },
        ],
      },
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithCandidate);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([profileWithCandidate]);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ ...profileWithCandidate, version: 2 });
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    await service.addGoldStandardCandidate('gs-african-grocery', {
      candidate: candidateFlaggedOnBoth,
      platform: 'yelp',
    });

    const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
    // Should still be 1 candidate (not duplicated)
    expect(config.candidates).toHaveLength(1);
    const yelpEval = config.candidates[0].platform_evaluations.find((pe: any) => pe.platform === 'yelp');
    expect(yelpEval.is_gold_standard).toBe(true);
    // Google should remain true (unchanged)
    const googleEval = config.candidates[0].platform_evaluations.find((pe: any) => pe.platform === 'google');
    expect(googleEval.is_gold_standard).toBe(true);
  });

  it('is idempotent — returns current active without creating a new version when already in slot', async () => {
    const profileWithCandidate = {
      ...activeProfile,
      version: 3,
      configuration_json: {
        candidates: [
          {
            ...newCandidate,
            platform_evaluations: [
              { platform: 'google', is_gold_standard: true, quality_score: 9 },
            ],
          },
        ],
      },
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithCandidate);

    const result = await service.addGoldStandardCandidate('gs-african-grocery', {
      candidate: newCandidate,
      platform: 'google',
    });

    // Should return the current active (version 3) without creating a new version
    expect(result.version).toBe(3);
    // No transaction should have been started (no new version)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.mkt_intelligence_profiles.create).not.toHaveBeenCalled();
  });

  it('throws when the platform slot is full (4 gold-standard candidates)', async () => {
    const fullProfile = {
      ...activeProfile,
      configuration_json: {
        candidates: [
          { business_name: 'Biz A', platform_evaluations: [{ platform: 'google', is_gold_standard: true }] },
          { business_name: 'Biz B', platform_evaluations: [{ platform: 'google', is_gold_standard: true }] },
          { business_name: 'Biz C', platform_evaluations: [{ platform: 'google', is_gold_standard: true }] },
          { business_name: 'Biz D', platform_evaluations: [{ platform: 'google', is_gold_standard: true }] },
        ],
      },
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(fullProfile);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([fullProfile]);

    await expect(
      service.addGoldStandardCandidate('gs-african-grocery', {
        candidate: newCandidate,
        platform: 'google',
      }),
    ).rejects.toThrow(/already has 4 gold-standard/);
  });

  it('throws when the profile is not a gold-standard profile', async () => {
    const emergingProfile = {
      ...activeProfile,
      intelligence_focus: 'emerging',
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(emergingProfile);

    await expect(
      service.addGoldStandardCandidate('gs-african-grocery', {
        candidate: newCandidate,
        platform: 'google',
      }),
    ).rejects.toThrow(/not a gold-standard profile/);
  });

  it('throws when the candidate was not flagged gold-standard on the target platform', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(activeProfile);

    await expect(
      service.addGoldStandardCandidate('gs-african-grocery', {
        candidate: newCandidate,
        platform: 'yelp', // yelp has is_gold_standard = false in newCandidate
      }),
    ).rejects.toThrow(/not flagged gold-standard on yelp/);
  });

  it('throws when the active profile is not found', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);

    await expect(
      service.addGoldStandardCandidate('nonexistent-profile', {
        candidate: newCandidate,
        platform: 'google',
      }),
    ).rejects.toThrow(/Active profile nonexistent-profile not found/);
  });

  it('throws when platform is empty', async () => {
    await expect(
      service.addGoldStandardCandidate('gs-african-grocery', {
        candidate: newCandidate,
        platform: '  ',
      }),
    ).rejects.toThrow(/Platform is required/);
  });

  it('throws when candidate has no business_name', async () => {
    await expect(
      service.addGoldStandardCandidate('gs-african-grocery', {
        candidate: { ...newCandidate, business_name: '' },
        platform: 'google',
      }),
    ).rejects.toThrow(/business_name is required/);
  });

  it('matches existing candidate case-insensitively by business_name', async () => {
    // Analyst flagged gold-standard on both Google and Yelp; operator already
    // promoted to Google, now promoting to Yelp.
    const candidateFlaggedOnBoth = {
      ...newCandidate,
      platform_evaluations: [
        { platform: 'google', quality_score: 9, is_gold_standard: true, quality_gates_passed: ['business_name'], quality_gates_failed: [] },
        { platform: 'yelp', quality_score: 8, is_gold_standard: true, quality_gates_passed: ['business_name'], quality_gates_failed: [] },
      ],
    };
    const profileWithCandidate = {
      ...activeProfile,
      configuration_json: {
        candidates: [
          {
            business_name: 'afro ethiopian market', // lowercase
            platform_evaluations: [
              { platform: 'google', is_gold_standard: true, quality_score: 9 },
              { platform: 'yelp', is_gold_standard: false, quality_score: 8 },
            ],
          },
        ],
      },
    };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithCandidate);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([profileWithCandidate]);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ ...profileWithCandidate, version: 2 });
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    // Input candidate has different casing: "Afro Ethiopian Market"
    await service.addGoldStandardCandidate('gs-african-grocery', {
      candidate: candidateFlaggedOnBoth,
      platform: 'yelp',
    });

    const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
    // Should NOT have duplicated the candidate
    expect(config.candidates).toHaveLength(1);
    const yelpEval = config.candidates[0].platform_evaluations.find((pe: any) => pe.platform === 'yelp');
    expect(yelpEval.is_gold_standard).toBe(true);
  });

  it('uses the scoped profile directly when scope is passed but profileId is already scoped', async () => {
    // Reproduces the production bug: the frontend resolves the active profile
    // for a Pittsburgh campaign and gets back the scoped Pittsburgh profile
    // (not the nationwide one). It then promotes a candidate with
    // scope: { city: 'Pittsburgh', state: 'PA' }. The backend must use the
    // scoped profile directly instead of trying to derive from nationwide
    // (which would throw "not found or not nationwide-scoped").
    const scopedProfile = {
      ...activeProfile,
      id: 'mip-pittsburgh-scoped',
      reference_city: 'Pittsburgh',
      reference_state: 'PA',
    };
    // First findFirst: the scope-branch check (returns the scoped profile)
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(scopedProfile);
    // Second findFirst: the active-profile load inside the try block
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(scopedProfile);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([scopedProfile]);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ ...scopedProfile, version: 2 });
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.addGoldStandardCandidate('mip-pittsburgh-scoped', {
      candidate: newCandidate,
      platform: 'google',
      scope: { city: 'Pittsburgh', state: 'PA' },
    });

    expect(result.version).toBe(2);
    // The new version should be created against the scoped profile id, not a
    // newly-derived one.
    const createCall = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0];
    expect(createCall.data.id).toBe('mip-pittsburgh-scoped');
    expect(createCall.data.reference_city).toBe('Pittsburgh');
    expect(createCall.data.reference_state).toBe('PA');
  });

  it('derives a scoped profile from nationwide when scope is passed and profileId is nationwide', async () => {
    // The original intended scope path: profileId is the nationwide profile,
    // scope is provided → backend resolves/creates a scoped profile and
    // promotes into it.
    const nationwideProfile = {
      ...activeProfile,
      id: 'gs-nationwide-001',
      reference_city: null,
      reference_state: null,
    };
    const scopedProfile = {
      ...nationwideProfile,
      id: 'gs-pittsburgh-scoped',
      reference_city: 'Pittsburgh',
      reference_state: 'PA',
      configuration_json: { ...nationwideProfile.configuration_json, candidates: [] },
    };
    // First findFirst: the scope-branch check (returns nationwide — not scoped)
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(nationwideProfile);
    // createScopedGoldStandardProfile: load nationwide
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(nationwideProfile);
    // createScopedGoldStandardProfile: check existing scoped (none)
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);
    // createScopedGoldStandardProfile: create the scoped profile
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce(scopedProfile);
    // Active-profile load inside the try block
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(scopedProfile);
    // Transaction findMany
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([scopedProfile]);
    // Transaction create (new version)
    const promotedProfile = { ...scopedProfile, version: 2 };
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValueOnce(promotedProfile);
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.addGoldStandardCandidate('gs-nationwide-001', {
      candidate: newCandidate,
      platform: 'google',
      scope: { city: 'Pittsburgh', state: 'PA' },
    });

    expect(result.version).toBe(2);
    expect(result.id).toBe('gs-pittsburgh-scoped');
  });
});

describe('IntelligenceProfileService.removeGoldStandardCandidate', () => {
  let service: IntelligenceProfileService;

  const profileWithSlots = {
    id: 'gs-beauty-supply',
    category_key: 'beauty_supply',
    category_name: 'Beauty Supply',
    version: 1,
    intelligence_focus: 'gold_standards',
    reference_city: null,
    reference_state: null,
    reference_platform: null,
    configuration_json: {
      candidates: [
        {
          business_name: 'BPolished Beauty Supply',
          city: 'Addison',
          platform_evaluations: [
            { platform: 'google', is_gold_standard: true, quality_score: 9.1 },
            { platform: 'yelp', is_gold_standard: true, quality_score: 8.5 },
          ],
        },
        {
          business_name: 'Kinks and Curls',
          city: 'Lawrenceville',
          platform_evaluations: [
            { platform: 'google', is_gold_standard: true, quality_score: 8.8 },
          ],
        },
      ],
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = IntelligenceProfileService.getInstance();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  it('flips is_gold_standard to false on the target platform and creates a new version', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithSlots);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([profileWithSlots]);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ ...profileWithSlots, version: 2 });
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.removeGoldStandardCandidate('gs-beauty-supply', {
      businessName: 'BPolished Beauty Supply',
      platform: 'google',
    });

    expect(result.version).toBe(2);
    const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
    const candidate = config.candidates.find((c: any) => c.business_name === 'BPolished Beauty Supply');
    const googleEval = candidate.platform_evaluations.find((pe: any) => pe.platform === 'google');
    expect(googleEval.is_gold_standard).toBe(false);
    // Yelp should remain true (per-platform — only Google was removed)
    const yelpEval = candidate.platform_evaluations.find((pe: any) => pe.platform === 'yelp');
    expect(yelpEval.is_gold_standard).toBe(true);
  });

  it('is idempotent — returns current active when candidate not in slot', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithSlots);

    // Kinks and Curls is not gold-standard on yelp
    const result = await service.removeGoldStandardCandidate('gs-beauty-supply', {
      businessName: 'Kinks and Curls',
      platform: 'yelp',
    });

    expect(result.version).toBe(1);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.mkt_intelligence_profiles.create).not.toHaveBeenCalled();
  });

  it('is idempotent — returns current active when candidate not in profile at all', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithSlots);

    const result = await service.removeGoldStandardCandidate('gs-beauty-supply', {
      businessName: 'Nonexistent Business',
      platform: 'google',
    });

    expect(result.version).toBe(1);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when the profile is not a gold-standard profile', async () => {
    const emergingProfile = { ...profileWithSlots, intelligence_focus: 'emerging' };
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(emergingProfile);

    await expect(
      service.removeGoldStandardCandidate('gs-beauty-supply', {
        businessName: 'BPolished Beauty Supply',
        platform: 'google',
      }),
    ).rejects.toThrow(/not a gold-standard profile/);
  });

  it('throws when the active profile is not found', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);

    await expect(
      service.removeGoldStandardCandidate('nonexistent', {
        businessName: 'BPolished Beauty Supply',
        platform: 'google',
      }),
    ).rejects.toThrow(/Active profile nonexistent not found/);
  });

  it('throws when platform is empty', async () => {
    await expect(
      service.removeGoldStandardCandidate('gs-beauty-supply', {
        businessName: 'BPolished Beauty Supply',
        platform: '  ',
      }),
    ).rejects.toThrow(/Platform is required/);
  });

  it('matches candidate case-insensitively', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(profileWithSlots);
    mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([profileWithSlots]);
    mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ ...profileWithSlots, version: 2 });
    mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValue({ count: 1 });

    // Input has different casing than the stored candidate
    await service.removeGoldStandardCandidate('gs-beauty-supply', {
      businessName: 'bpolished beauty supply',
      platform: 'google',
    });

    const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
    const candidate = config.candidates.find((c: any) =>
      (c.business_name || '').toLowerCase() === 'bpolished beauty supply',
    );
    expect(candidate).toBeDefined();
    const googleEval = candidate.platform_evaluations.find((pe: any) => pe.platform === 'google');
    expect(googleEval.is_gold_standard).toBe(false);
  });
});
