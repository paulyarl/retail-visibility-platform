/**
 * Gold Standard System — Sprint 0 service tests
 *
 * Tests IntelligenceProfileService gold-standard methods:
 *   - resolveGoldStandard resolves nationwide gold-standard profile (city→state→nationwide cascade)
 *   - serializeGoldStandard produces a benchmark block with expected fields
 *   - serializeGoldStandard produces a target block with target directive
 *   - serializeGoldStandard returns empty string for empty configuration
 *   - buildGoldStandardScanVariables populates category + platform
 *   - listActive filters by focus when provided
 *   - listDrafts filters by focus when provided
 *
 * Uses the vi.hoisted() + mocked Prisma pattern from the focus-alignment tests.
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

describe('IntelligenceProfileService — Gold Standard methods (Sprint 0)', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = IntelligenceProfileService.getInstance();
  });

  describe('resolveGoldStandard', () => {
    it('resolves nationwide gold-standard profile when no city/state/platform provided', async () => {
      const fakeProfile = {
        id: 'gs-test-001',
        category_key: 'african_grocery',
        category_name: 'African Grocery Store',
        version: 1,
        intelligence_focus: 'gold_standards',
        reference_city: null,
        reference_state: null,
        reference_platform: null,
        configuration_json: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(fakeProfile);
      const result = await service.resolveGoldStandard('african_grocery');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-test-001');
      // resolveGoldStandard now has its own cascade (city→state→nationwide).
      // With no city/state/platform, it goes directly to the nationwide
      // cross-platform layer: reference_city=null, reference_state=null,
      // reference_platform=null, focus=gold_standards, status=active.
      const callArg = mockPrisma.mkt_intelligence_profiles.findFirst.mock.calls[0][0];
      expect(callArg.where.intelligence_focus).toBe('gold_standards');
      expect(callArg.where.status).toBe('active');
      expect(callArg.where.reference_city).toBeNull();
      expect(callArg.where.reference_state).toBeNull();
      expect(callArg.where.reference_platform).toBeNull();
    });

    it('returns null when no active gold-standard profile exists', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      const result = await service.resolveGoldStandard('nonexistent_category');
      expect(result).toBeNull();
    });

    // Regression: focus contamination. Previously, when a focus was
    // requested but no focus-matched profile existed, the resolver fell
    // back to a category-only match that DROPPED the focus filter. That
    // returned an 'emerging' profile as the "gold standard" result. The
    // fix: when focus is explicitly requested, a miss must return null
    // rather than a profile of a different intelligence type.
    it('returns null when gold_standards focus is requested but only an emerging profile exists (no focus contamination)', async () => {
      const emergingProfile = {
        id: 'emerging-001',
        category_key: 'african grocery store',
        category_name: 'African Grocery Store',
        version: 3,
        intelligence_focus: 'emerging',
        reference_city: 'indianapolis',
        reference_state: 'IN',
        reference_platform: null,
        configuration_json: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Mock: any focus-filtered query (gold_standards) returns null;
      // an unfiltered category-only query returns the emerging profile.
      // The buggy code returned emergingProfile here; the fix returns null.
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.intelligence_focus === 'gold_standards') return Promise.resolve(null);
        // Unfiltered category-only fallback — what the bug used to hit.
        if (args?.where?.category_key && !args?.where?.intelligence_focus) {
          return Promise.resolve(emergingProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('African Grocery Store');
      expect(result).toBeNull();
    });

    // Same regression via the public resolve() path with platform='all'.
    // Mirrors the reported HTTP request:
    //   GET /intelligence-profiles/resolve/African Grocery Store?focus=gold_standards&platform=all
    it('resolve() with focus=gold_standards + platform=all returns null when only an emerging profile exists', async () => {
      const emergingProfile = {
        id: 'mip-2mqjt8p4',
        category_key: 'african grocery store',
        category_name: 'African Grocery Store',
        version: 3,
        intelligence_focus: 'emerging',
        reference_city: 'indianapolis',
        reference_state: 'IN',
        reference_platform: null,
        configuration_json: {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        // Platform-aware chain (steps 1-4) applies focus — all miss.
        if (args?.where?.intelligence_focus === 'gold_standards') return Promise.resolve(null);
        // Legacy focus-specific match (step 3) — also misses.
        // Legacy category-only fallback (step 4, now removed) — would
        // have returned emergingProfile. The fix returns null instead.
        if (args?.where?.category_key && !args?.where?.intelligence_focus) {
          return Promise.resolve(emergingProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolve('African Grocery Store', 'gold_standards', null, 'all');
      expect(result).toBeNull();
    });
  });

  describe('resolveGoldStandard — scoped resolution (city→state→nationwide cascade)', () => {
    const nationwideProfile = {
      id: 'gs-nationwide-001',
      category_key: 'beauty_supply',
      category_name: 'Beauty Supply Store',
      version: 2,
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
      reference_platform: null,
      configuration_json: { expected_fields: {}, candidates: [] },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const cityScopedProfile = {
      ...nationwideProfile,
      id: 'gs-atlanta-001',
      reference_city: 'atlanta',
      reference_state: 'GA',
    };

    const stateScopedProfile = {
      ...nationwideProfile,
      id: 'gs-ga-001',
      reference_city: null,
      reference_state: 'GA',
    };

    it('resolves city-specific profile first when city+state provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === 'atlanta' && args?.where?.reference_state === 'GA') {
          return Promise.resolve(cityScopedProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply', null, 'Atlanta', 'GA');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-atlanta-001');
    });

    it('falls back to state-specific when city-specific not found', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === 'atlanta' && args?.where?.reference_state === 'GA') {
          return Promise.resolve(null); // no city-specific
        }
        if (args?.where?.reference_city === null && args?.where?.reference_state === 'GA') {
          return Promise.resolve(stateScopedProfile); // state-specific exists
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply', null, 'Atlanta', 'GA');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-ga-001');
    });

    it('falls back to nationwide when no city or state profile exists', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === 'atlanta' && args?.where?.reference_state === 'GA') {
          return Promise.resolve(null);
        }
        if (args?.where?.reference_city === null && args?.where?.reference_state === 'GA') {
          return Promise.resolve(null);
        }
        if (args?.where?.reference_city === null && args?.where?.reference_state === null) {
          return Promise.resolve(nationwideProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply', null, 'Atlanta', 'GA');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-nationwide-001');
    });

    it('resolves state-specific profile when only state is provided (no city)', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === null && args?.where?.reference_state === 'GA') {
          return Promise.resolve(stateScopedProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply', null, null, 'GA');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-ga-001');
    });

    it('resolves nationwide when no city or state provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === null && args?.where?.reference_state === null) {
          return Promise.resolve(nationwideProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-nationwide-001');
    });

    it('returns null when no gold-standard profile exists at any scope', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      const result = await service.resolveGoldStandard('beauty_supply', null, 'Atlanta', 'GA');
      expect(result).toBeNull();
    });

    it('prefers platform-specific at each geographic layer', async () => {
      const platformProfile = { ...cityScopedProfile, reference_platform: 'google' };
      mockPrisma.mkt_intelligence_profiles.findFirst.mockImplementation((args: any) => {
        if (args?.where?.reference_city === 'atlanta' && args?.where?.reference_state === 'GA' && args?.where?.reference_platform === 'google') {
          return Promise.resolve(platformProfile);
        }
        return Promise.resolve(null);
      });
      const result = await service.resolveGoldStandard('beauty_supply', 'google', 'Atlanta', 'GA');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('gs-atlanta-001');
      expect(result?.reference_platform).toBe('google');
    });
  });

  describe('createScopedGoldStandardProfile', () => {
    const nationwideProfile = {
      id: 'gs-nationwide-001',
      category_key: 'beauty_supply',
      category_name: 'Beauty Supply Store',
      version: 2,
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
      reference_platform: null,
      configuration_json: {
        expected_fields: { universal: { canonical_name: 'Beauty Supply Store' } },
        quality_gates: [{ field: 'hours', severity: 'recommended' }],
        candidates: [{ business_name: 'Existing Nationwide Exemplar' }],
      },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('creates a scoped profile from the nationwide profile with empty candidates', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(nationwideProfile); // load nationwide
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null); // no existing scoped
      mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({
        ...nationwideProfile,
        id: 'gs-atlanta-new',
        version: 1,
        reference_city: 'atlanta',
        reference_state: 'GA',
        configuration_json: {
          expected_fields: nationwideProfile.configuration_json.expected_fields,
          quality_gates: nationwideProfile.configuration_json.quality_gates,
          candidates: [],
          scan_metadata: { scoped_from: 'gs-nationwide-001', scoped_from_version: 2 },
        },
      });
      const result = await service.createScopedGoldStandardProfile({
        nationwideProfileId: 'gs-nationwide-001',
        city: 'Atlanta',
        state: 'GA',
      });
      expect(result.id).toBe('gs-atlanta-new');
      expect(result.reference_city).toBe('atlanta');
      expect(result.reference_state).toBe('GA');
      expect(result.version).toBe(1);
      // Verify the created profile has empty candidates (bar copied, slots empty)
      const createArg = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0];
      expect(createArg.data.candidates).toBeUndefined(); // candidates is in configuration_json
      expect(createArg.data.configuration_json.candidates).toEqual([]);
      expect(createArg.data.configuration_json.expected_fields).toEqual(
        nationwideProfile.configuration_json.expected_fields,
      );
      expect(createArg.data.configuration_json.quality_gates).toEqual(
        nationwideProfile.configuration_json.quality_gates,
      );
    });

    it('is idempotent — returns existing scoped profile if one already exists', async () => {
      const existing = { ...nationwideProfile, id: 'gs-atlanta-existing', reference_city: 'atlanta', reference_state: 'GA' };
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(nationwideProfile); // load nationwide
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(existing); // existing scoped
      const result = await service.createScopedGoldStandardProfile({
        nationwideProfileId: 'gs-nationwide-001',
        city: 'Atlanta',
        state: 'GA',
      });
      expect(result.id).toBe('gs-atlanta-existing');
      expect(mockPrisma.mkt_intelligence_profiles.create).not.toHaveBeenCalled();
    });

    it('throws when nationwide profile not found', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      await expect(
        service.createScopedGoldStandardProfile({
          nationwideProfileId: 'nonexistent',
          city: 'Atlanta',
          state: 'GA',
        }),
      ).rejects.toThrow(/not found or not nationwide-scoped/);
    });

    it('throws when no city or state provided', async () => {
      await expect(
        service.createScopedGoldStandardProfile({
          nationwideProfileId: 'gs-nationwide-001',
          city: null,
          state: null,
        }),
      ).rejects.toThrow(/At least one of city or state/);
    });
  });

  describe('buildGoldStandardScanVariables', () => {
    it('populates category and platform from campaign', () => {
      const vars = service.buildGoldStandardScanVariables({
        category: 'African Grocery Store',
        intelligence_platform: 'google',
      });
      expect(vars.category).toBe('African Grocery Store');
      expect(vars.platform).toBe('google');
    });

    it('defaults platform to "all" when not set', () => {
      const vars = service.buildGoldStandardScanVariables({
        category: 'African Grocery Store',
        intelligence_platform: null,
      });
      expect(vars.platform).toBe('all');
    });

    it('defaults category to empty string when not set', () => {
      const vars = service.buildGoldStandardScanVariables({});
      expect(vars.category).toBe('');
      expect(vars.platform).toBe('all');
    });
  });

  describe('serializeGoldStandard', () => {
    const fakeProfile = {
      id: 'gs-test-001',
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      version: 2,
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
      configuration_json: {
        expected_fields: {
          universal: {
            canonical_name: 'African Grocery Store',
            hours_present: true,
            website_present: true,
            quality_gates: [
              { field: 'business_name', description: 'Canonical name', severity: 'non_negotiable' },
              { field: 'hours', description: 'Operating hours', severity: 'recommended' },
            ],
          },
          platforms: {
            google: {
              primary_category: 'African goods store',
              additional_categories: ['Grocery store'],
              expected_photo_count: 10,
              branding_expectations: {
                has_logo: true,
                has_cover_photo: true,
                photo_count: 10,
              },
              quality_gates: [
                { field: 'primary_category', description: 'Correct GBP category', severity: 'non_negotiable' },
              ],
            },
          },
        },
        candidates: [
          {
            business_name: 'Afro Ethiopian Market',
            city: 'Kansas City',
            platform_evaluations: [
              {
                platform: 'google',
                profile_url: 'https://www.google.com/maps/place/Afro+Ethiopian+Market',
                quality_score: 8,
                is_gold_standard: true,
                branding_artifacts: {
                  has_logo: true,
                  photo_count: 12,
                },
              },
              {
                platform: 'yelp',
                profile_url: 'https://www.yelp.com/biz/afro-ethiopian-market',
                quality_score: 6,
                is_gold_standard: false,
              },
            ],
          },
        ],
      },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    it('produces a BENCHMARK block with expected fields for role=benchmark', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      expect(block).toContain('GOLD STANDARD BENCHMARK');
      expect(block).toContain('Compare the business');
      expect(block).toContain('African Grocery Store');
      expect(block).toContain('gs-test-001');
      expect(block).toContain('v2');
    });

    it('produces a TARGET block with target directive for role=target', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'target');
      expect(block).toContain('GOLD STANDARD TARGET');
      expect(block).toContain('Generate fix instructions');
      expect(block).toContain('African Grocery Store');
    });

    it('includes universal expected fields', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      expect(block).toContain('Canonical name: African Grocery Store');
      expect(block).toContain('Hours present: true');
      expect(block).toContain('Website present: true');
    });

    it('includes quality gates with severity', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      expect(block).toContain('[non_negotiable] business_name');
      expect(block).toContain('[recommended] hours');
    });

    it('includes platform-specific expected fields', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      expect(block).toContain('Platform: google');
      expect(block).toContain('Primary category: African goods store');
      expect(block).toContain('Expected photo count: 10');
    });

    it('includes pattern exemplars with destination URLs', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      expect(block).toContain('Pattern Exemplars');
      expect(block).toContain('Afro Ethiopian Market');
      expect(block).toContain('Destination URL: https://www.google.com/maps/place/Afro+Ethiopian+Market');
      expect(block).toContain('Quality score: 8/10');
    });

    it('excludes non-gold-standard candidates from exemplars', () => {
      const block = service.serializeGoldStandard(fakeProfile, 'benchmark');
      // The yelp evaluation has is_gold_standard=false, so it should NOT appear
      expect(block).not.toContain('yelp');
    });

    it('returns empty string for profile with no configuration_json', () => {
      const emptyProfile = { ...fakeProfile, configuration_json: null } as any;
      const block = service.serializeGoldStandard(emptyProfile, 'benchmark');
      expect(block).toBe('');
    });

    it('returns empty string for profile with no expected_fields and no candidates', () => {
      const emptyProfile = { ...fakeProfile, configuration_json: {} } as any;
      const block = service.serializeGoldStandard(emptyProfile, 'benchmark');
      expect(block).toBe('');
    });
  });

  describe('serializeGoldStandard — discovery_benchmark role', () => {
    const fakeProfileWithPlatform = {
      id: 'gs-google-001',
      category_key: 'african_grocery',
      category_name: 'African Grocery Store',
      version: 3,
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
      reference_platform: 'google',
      configuration_json: {
        expected_fields: {
          universal: {
            canonical_name: 'African Grocery Store',
            hours_present: true,
            website_present: true,
            quality_gates: [
              { field: 'business_name', description: 'Canonical name', severity: 'non_negotiable' },
            ],
          },
          platforms: {
            google: {
              primary_category: 'African goods store',
              quality_gates: [
                { field: 'primary_category', description: 'Correct GBP category', severity: 'non_negotiable' },
              ],
            },
          },
        },
        candidates: [],
      },
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    it('produces a DISCOVERY BENCHMARK block with the correct header label', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      expect(block).toContain('GOLD STANDARD DISCOVERY BENCHMARK');
      expect(block).not.toContain('GOLD STANDARD BENCHMARK');
      expect(block).not.toContain('GOLD STANDARD DISCOVERY CRITERIA');
    });

    it('includes platform scope line when reference_platform is set', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      expect(block).toContain('Platform scope: google');
    });

    it('shows cross-platform label when reference_platform is null', () => {
      const crossPlatformProfile = { ...fakeProfileWithPlatform, reference_platform: null } as any;
      const block = service.serializeGoldStandard(crossPlatformProfile, 'discovery_benchmark');
      expect(block).toContain('Platform scope: cross-platform (all platforms)');
    });

    it('directive instructs per-platform rating and gold_standard_match', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      expect(block).toContain('Rate each discovered candidate');
      expect(block).toContain('per-platform');
      expect(block).toContain('gold_standard_match');
      expect(block).toContain('gold_standard_gate_results');
      // Relative-top directive: gates are informational, not a filter
      expect(block).toContain('does NOT filter gold_standard_match');
      expect(block).toContain('TOP candidates per platform');
    });

    it('directive instructs platform_analysis aggregation and outreach recommendation', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      expect(block).toContain('platform_analysis.platform_breakdown');
      expect(block).toContain('primary_platform');
      expect(block).toContain('recommended_platform_focus');
      expect(block).toContain('highest-opportunity platform');
    });

    it('directive does NOT contain benchmark-role or discovery-role text', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      // benchmark role: "Compare the business's actual profile"
      expect(block).not.toContain("Compare the business's actual profile");
      // discovery role: "Return the same expected_fields in your output"
      expect(block).not.toContain('Return the same expected_fields in your output');
    });

    it('still serializes universal + platform expected fields', () => {
      const block = service.serializeGoldStandard(fakeProfileWithPlatform, 'discovery_benchmark');
      expect(block).toContain('Canonical name: African Grocery Store');
      expect(block).toContain('Platform: google');
      expect(block).toContain('Primary category: African goods store');
      expect(block).toContain('[non_negotiable] primary_category');
    });
  });

  describe('listActive — focus filtering', () => {
    it('passes focus filter to Prisma when provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([]);
      await service.listActive('gold_standards');
      const callArg = mockPrisma.mkt_intelligence_profiles.findMany.mock.calls[0][0];
      expect(callArg.where.status).toBe('active');
      expect(callArg.where.intelligence_focus).toBe('gold_standards');
    });

    it('omits focus filter when not provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([]);
      await service.listActive();
      const callArg = mockPrisma.mkt_intelligence_profiles.findMany.mock.calls[0][0];
      expect(callArg.where.status).toBe('active');
      expect(callArg.where.intelligence_focus).toBeUndefined();
    });
  });

  describe('listDrafts — focus filtering', () => {
    it('passes focus filter to Prisma when provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([]);
      await service.listDrafts('gold_standards');
      const callArg = mockPrisma.mkt_intelligence_profiles.findMany.mock.calls[0][0];
      expect(callArg.where.status).toBe('draft');
      expect(callArg.where.intelligence_focus).toBe('gold_standards');
    });

    it('omits focus filter when not provided', async () => {
      mockPrisma.mkt_intelligence_profiles.findMany.mockResolvedValue([]);
      await service.listDrafts();
      const callArg = mockPrisma.mkt_intelligence_profiles.findMany.mock.calls[0][0];
      expect(callArg.where.status).toBe('draft');
      expect(callArg.where.intelligence_focus).toBeUndefined();
    });
  });
});
