/**
 * Bronze Standard System — IntelligenceProfileService tests
 *
 * Covers:
 *   - resolveBronzeStandard: city → state → nationwide cascade with
 *     platform-exact → cross-platform at each layer
 *   - mergeBronzeCoverage: §7.3 carry-forward of external-provenance slots
 *     (operator_self_discovery / business_audit), dedupe, status repair
 *   - recordBronzeExternalFill: new draft version, dedupe, no-active → null
 *   - serializeBronzeStandard: establishment_reference + discovery blocks,
 *     slot cap, catalog drift note
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
  mkt_bronze_catalog_meta: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
  $queryRawUnsafe: vi.fn(),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { IntelligenceProfileService, type IntelligenceProfile } from '../intelligence/IntelligenceProfileService';

const PROFILE = (over: Partial<IntelligenceProfile> = {}): IntelligenceProfile => ({
  id: 'mip-bronze-1',
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  version: 1,
  intelligence_focus: 'bronze_standards',
  reference_city: null,
  reference_state: null,
  reference_platform: null,
  configuration_json: {},
  status: 'active',
  created_at: new Date() as any,
  updated_at: new Date() as any,
  ...over,
} as IntelligenceProfile);

describe('IntelligenceProfileService — Bronze Standard methods', () => {
  let service: IntelligenceProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.mkt_bronze_catalog_meta.findUnique.mockResolvedValue({ catalog_revision: 1 });
    service = IntelligenceProfileService.getInstance();
  });

  describe('resolveBronzeStandard', () => {
    it('resolves a city-scoped profile at Layer 1', async () => {
      const cityProfile = PROFILE({ reference_city: 'Kansas City', reference_state: 'MO' });
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(cityProfile);
      const result = await service.resolveBronzeStandard('african grocery store', null, 'Kansas City', 'MO');
      expect(result?.id).toBe('mip-bronze-1');
      expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          intelligence_focus: 'bronze_standards',
          reference_city: 'Kansas City',
          reference_state: 'MO',
          reference_platform: null,
          status: 'active',
        }),
        orderBy: { version: 'desc' },
      });
    });

    it('falls back to nationwide when no city/state profile exists', async () => {
      // platform=null skips the platform-exact calls: city → state → nationwide.
      mockPrisma.mkt_intelligence_profiles.findFirst
        .mockResolvedValueOnce(null) // city cross-platform
        .mockResolvedValueOnce(null) // state cross-platform
        .mockResolvedValueOnce(PROFILE()); // nationwide
      const result = await service.resolveBronzeStandard('african grocery store', null, 'Kansas City', 'MO');
      expect(result).not.toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledTimes(3);
    });

    it('prefers platform-exact over cross-platform at the city layer', async () => {
      const platformProfile = PROFILE({ reference_city: 'Kansas City', reference_state: 'MO', reference_platform: 'google' });
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(platformProfile);
      const result = await service.resolveBronzeStandard('african grocery store', 'google', 'Kansas City', 'MO');
      expect(result?.reference_platform).toBe('google');
      expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ reference_platform: 'google' }),
        orderBy: { version: 'desc' },
      });
    });

    it('normalizes category/city/state on lookup', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      await service.resolveBronzeStandard('African_Grocery_Store', null, 'kansas city', 'missouri');
      expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          category_key: 'african grocery store',
          reference_city: 'Kansas City',
          reference_state: 'MO',
        }),
        orderBy: { version: 'desc' },
      });
    });

    it('returns null when no profile exists at any layer', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      const result = await service.resolveBronzeStandard('african grocery store');
      expect(result).toBeNull();
    });
  });

  describe('mergeBronzeCoverage (§7.3)', () => {
    const EXTERNAL_SLOT = {
      business_name: 'Mama Nkechi',
      address: '4122 Troost',
      discovered_by: 'operator_self_discovery',
    };
    const SCAN_SLOT = {
      business_name: 'Scan Found Co',
      address: '1 Main St',
      discovered_by: 'bronze_establishment_scan',
    };

    it('carries external-provenance slots into the new coverage', () => {
      const prior = [
        { reason_key: 'community_only_presence', status: 'filled', slots: [EXTERNAL_SLOT] },
      ];
      const incoming = [
        { reason_key: 'community_only_presence', status: 'empty_unproven', slots: [], empty_slot_note: 'executed, returned 0' },
      ];
      const merged = service.mergeBronzeCoverage(prior, incoming);
      const entry = merged.find((e) => e.reason_key === 'community_only_presence');
      expect(entry.slots).toHaveLength(1);
      expect(entry.slots[0].discovered_by).toBe('operator_self_discovery');
      // Carried external slots keep the entry filled.
      expect(entry.status).toBe('filled');
      expect(entry.empty_slot_note).toBeNull();
    });

    it('drops scan-provenance slots the new scan did not re-find', () => {
      const prior = [
        { reason_key: 'r', status: 'filled', slots: [SCAN_SLOT] },
      ];
      const merged = service.mergeBronzeCoverage(prior, []);
      expect(merged).toHaveLength(0);
    });

    it('carries an external slot for a reason absent from the new coverage', () => {
      const prior = [
        { reason_key: 'r1', status: 'filled', slots: [EXTERNAL_SLOT] },
      ];
      const merged = service.mergeBronzeCoverage(prior, []);
      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('filled');
      expect(merged[0].slots[0].business_name).toBe('Mama Nkechi');
    });

    it('dedupes carried slots on business_name + address', () => {
      const prior = [
        { reason_key: 'r', status: 'filled', slots: [EXTERNAL_SLOT] },
      ];
      const incoming = [
        { reason_key: 'r', status: 'filled', slots: [{ ...EXTERNAL_SLOT, discovered_by: 'bronze_establishment_scan' }] },
      ];
      const merged = service.mergeBronzeCoverage(prior, incoming);
      expect(merged[0].slots).toHaveLength(1);
    });

    it('merges external and scan slots side by side', () => {
      const auditSlot = { business_name: 'Audit Biz', address: '9 Oak', discovered_by: 'business_audit' };
      const prior = [
        { reason_key: 'r', status: 'filled', slots: [auditSlot] },
      ];
      const incoming = [
        { reason_key: 'r', status: 'filled', slots: [SCAN_SLOT] },
      ];
      const merged = service.mergeBronzeCoverage(prior, incoming);
      expect(merged[0].slots).toHaveLength(2);
    });
  });

  describe('recordBronzeExternalFill', () => {
    it('creates a new DRAFT version with the slot appended', async () => {
      const active = PROFILE({
        version: 2,
        configuration_json: {
          reason_coverage: [{ reason_key: 'r1', status: 'empty_unproven', slots: [], empty_slot_note: 'x' }],
        } as any,
      });
      mockPrisma.mkt_intelligence_profiles.findFirst
        .mockResolvedValueOnce(active)          // active lookup
        .mockResolvedValueOnce({ version: 2 }); // max version lookup
      mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ id: 'mip-bronze-1', version: 3 });

      const draft = await service.recordBronzeExternalFill('mip-bronze-1', 'r1', {
        business_name: 'Mama Nkechi',
        address: '4122 Troost',
        discovered_by: 'business_audit',
      });

      expect(draft).not.toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'mip-bronze-1',
          version: 3,
          status: 'draft',
          intelligence_focus: 'bronze_standards',
          configuration_json: expect.objectContaining({
            reason_coverage: [
              expect.objectContaining({
                reason_key: 'r1',
                status: 'filled',
                slots: [expect.objectContaining({ business_name: 'Mama Nkechi', discovered_by: 'business_audit' })],
              }),
            ],
          }),
        }),
      });
    });

    it('returns null when no ACTIVE bronze profile exists (fill not recorded)', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      const result = await service.recordBronzeExternalFill('mip-bronze-1', 'r1', {
        business_name: 'B',
        discovered_by: 'operator_self_discovery',
      });
      expect(result).toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.create).not.toHaveBeenCalled();
    });

    it('returns null when the profile is not bronze-focused', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(
        PROFILE({ intelligence_focus: 'gold_standards' }),
      );
      const result = await service.recordBronzeExternalFill('mip-bronze-1', 'r1', {
        business_name: 'B',
        discovered_by: 'operator_self_discovery',
      });
      expect(result).toBeNull();
    });
  });

  describe('serializeBronzeStandard', () => {
    const coverageProfile = PROFILE({
      version: 3,
      reference_city: 'Kansas City',
      reference_state: 'MO',
      configuration_json: {
        catalog_revision: 1,
        reason_coverage: [
          {
            reason_key: 'absent_from_platform',
            status: 'filled',
            slots: [
              {
                business_name: 'Mama Nkechi',
                observed_platform: 'google',
                digital_quality: 'very_low',
                discovered_by: 'operator_self_discovery',
                category_fit_evidence: 'carries fufu flour',
                operational_evidence: 'recent reviews',
                platform_presence: { google: 'absent' },
              },
              { business_name: 'Second Fill', discovered_by: 'emerging_scan' },
              { business_name: 'Third Fill', discovered_by: 'emerging_scan' },
            ],
          },
          { reason_key: 'community_only_presence', status: 'empty_unproven', slots: [], empty_slot_note: 'executed, returned 0' },
        ],
        not_applicable_reasons: ['port_specific_importer'],
        vector_execution_log: [
          { vector: 'church bulletins', executed: true, returned: 0 },
        ],
        scope_mix: { universal: 9, category: 4, location: 2, category_location: 1, platform_bound: 1 },
      } as any,
    });

    it('emits the discovery calibration block with exemplars + empty report', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');
      expect(block).toContain('=== BRONZE STANDARD — MARKET CALIBRATION ===');
      expect(block).toContain('CALIBRATION');
      expect(block).toContain('Mama Nkechi');
      expect(block).toContain('out-of-loop ground truth');
      expect(block).toContain('[community_only_presence] empty_unproven');
      expect(block).toContain('port_specific_importer');
      expect(block).toContain('church bulletins: executed, returned 0');
      expect(block).toContain('=== END BRONZE STANDARD ===');
    });

    it('emits the establishment_reference hunt list', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'establishment_reference');
      expect(block).toContain('=== BRONZE STANDARD — NATIONAL REFERENCE ===');
      expect(block).toContain('reason_coverage entry');
      expect(block).toContain('Mama Nkechi');
    });

    it('caps emitted slots at MAX_SLOTS_PER_REASON (2) and notes the overflow', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');
      expect(block).toContain('Mama Nkechi');
      expect(block).toContain('Second Fill');
      expect(block).not.toContain('Third Fill');
      expect(block).toContain('+1 more slot(s) withheld');
    });

    it('appends a catalog drift note when the profile is behind the catalog', async () => {
      mockPrisma.mkt_bronze_catalog_meta.findUnique.mockResolvedValue({ catalog_revision: 5 });
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { reason_key: 'new_reason', label: 'New Reason', gap_kind: 'never_covered' },
      ]);
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');
      expect(block).toContain('=== BRONZE CATALOG DRIFT ===');
      expect(block).toContain('[new_reason] New Reason — never_covered');
    });

    it('omits the drift note when the profile is current', async () => {
      mockPrisma.mkt_bronze_catalog_meta.findUnique.mockResolvedValue({ catalog_revision: 1 });
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');
      expect(block).not.toContain('BRONZE CATALOG DRIFT');
    });

    it('returns empty string for a profile without configuration_json', async () => {
      const block = await service.serializeBronzeStandard(PROFILE({ configuration_json: null as any }), 'discovery');
      expect(block).toBe('');
    });
  });
});
