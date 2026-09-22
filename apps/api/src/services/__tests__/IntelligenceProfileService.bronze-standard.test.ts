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

  describe('recordBronzeExternalFills (§7.4 consumer write-back)', () => {
    it('carries a multi-reason batch into ONE new draft version', async () => {
      const active = PROFILE({
        version: 2,
        configuration_json: {
          reason_coverage: [
            { reason_key: 'r1', status: 'empty_unproven', slots: [], empty_slot_note: 'executed, returned 0' },
            { reason_key: 'r2', status: 'filled', slots: [{ business_name: 'Prior Co', address: '1 A St', discovered_by: 'bronze_establishment_scan' }] },
          ],
        } as any,
      });
      mockPrisma.mkt_intelligence_profiles.findFirst
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce({ version: 2 });
      mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ id: 'mip-bronze-1', version: 3 });

      const draft = await service.recordBronzeExternalFills('mip-bronze-1', [
        { reason_key: 'r1', slot: { business_name: 'KCK Grocery', address: '900 Central', observed_city: 'Kansas City', observed_state: 'KS', discovered_by: 'emerging_scan', discovered_via: 'community vector' } },
        { reason_key: 'r2', slot: { business_name: 'Second Co', address: '2 B St', discovered_by: 'emerging_scan' } },
        { reason_key: 'r3', slot: { business_name: 'Third Co', discovered_by: 'emerging_scan' } },
      ]);

      expect(draft).not.toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.create).toHaveBeenCalledTimes(1);
      const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
      const r1 = config.reason_coverage.find((e: any) => e.reason_key === 'r1');
      expect(r1.status).toBe('filled');
      expect(r1.empty_slot_note).toBeNull();
      expect(r1.slots[0]).toMatchObject({
        business_name: 'KCK Grocery',
        discovered_by: 'emerging_scan',
        observed_city: 'Kansas City',
        observed_state: 'KS',
      });
      const r2 = config.reason_coverage.find((e: any) => e.reason_key === 'r2');
      expect(r2.slots.map((s: any) => s.business_name)).toEqual(['Prior Co', 'Second Co']);
      // A reason absent from prior coverage gets a new filled entry.
      const r3 = config.reason_coverage.find((e: any) => e.reason_key === 'r3');
      expect(r3.status).toBe('filled');
      expect(r3.slots).toHaveLength(1);
    });

    it('dedupes the same business written under one reason within the batch', async () => {
      const active = PROFILE({ configuration_json: { reason_coverage: [] } as any });
      mockPrisma.mkt_intelligence_profiles.findFirst
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce({ version: 1 });
      mockPrisma.mkt_intelligence_profiles.create.mockResolvedValue({ id: 'mip-bronze-1', version: 2 });

      await service.recordBronzeExternalFills('mip-bronze-1', [
        { reason_key: 'r1', slot: { business_name: 'Dup Co', address: '5 Main', discovered_by: 'emerging_scan' } },
        { reason_key: 'r1', slot: { business_name: 'dup co', address: '5 Main', discovered_by: 'emerging_scan', discovered_via: 'second hit' } },
      ]);

      const config = mockPrisma.mkt_intelligence_profiles.create.mock.calls[0][0].data.configuration_json;
      const entry = config.reason_coverage.find((e: any) => e.reason_key === 'r1');
      expect(entry.slots).toHaveLength(1);
      // Re-hit updates in place — the second fill's fields merge over the first.
      expect(entry.slots[0].discovered_via).toBe('second hit');
    });

    it('returns null on an empty fill set without touching the DB', async () => {
      const result = await service.recordBronzeExternalFills('mip-bronze-1', []);
      expect(result).toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.findFirst).not.toHaveBeenCalled();
    });

    it('returns null when no ACTIVE bronze profile exists (fills noted, not written)', async () => {
      mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
      const result = await service.recordBronzeExternalFills('mip-bronze-1', [
        { reason_key: 'r1', slot: { business_name: 'B', discovered_by: 'emerging_scan' } },
      ]);
      expect(result).toBeNull();
      expect(mockPrisma.mkt_intelligence_profiles.create).not.toHaveBeenCalled();
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

    it('discovery block carries the bronze_attribution directive (spec §7.4)', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');
      expect(block).toContain('ATTRIBUTION');
      expect(block).toContain('bronze_attribution');
      expect(block).toContain('reason_key');
    });

    it('establishment_reference block does NOT carry the attribution directive (it produces bronze output, not prospects)', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'establishment_reference');
      expect(block).not.toContain('bronze_attribution');
    });

    it('emits the establishment_reference hunt list', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'establishment_reference');
      expect(block).toContain('=== BRONZE STANDARD — REFERENCE PROFILE ===');
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

    // ── Scope as scan context (spec §3.6.1 / §6.2.1) ──────────────────────
    // The analyst hunting these reasons needs each reason's scope: it says how
    // far a finding generalizes and which empty status applies (proof is
    // scope-relative). Both blocks must carry it — and the definition, not
    // just the variable.
    const scopedProfile = PROFILE({
      version: 3,
      reference_city: 'Kansas City',
      reference_state: 'MO',
      configuration_json: {
        catalog_revision: 1,
        reason_coverage: [
          {
            reason_key: 'trade_manifest_only',
            status: 'filled',
            slots: [{ business_name: 'Arsema Food Mart', discovered_by: 'bronze_establishment_scan' }],
          },
          { reason_key: 'community_only_presence', status: 'empty_unproven', slots: [], empty_slot_note: 'executed, returned 0' },
        ],
        catalog_snapshot: [
          {
            reason_key: 'trade_manifest_only',
            label: 'Trade / import-only visibility',
            priority: 1,
            provenance: 'derived',
            scope_category_key: 'african grocery store',
            scope_city: null,
            scope_state: null,
            scope_platform: null,
          },
          {
            reason_key: 'community_only_presence',
            label: 'Community-known, no reviews',
            priority: 3,
            provenance: 'derived',
            scope_category_key: null,
            scope_city: null,
            scope_state: null,
            scope_platform: null,
          },
        ],
        vector_execution_log: [{ vector: 'church bulletins', executed: true, returned: 0 }],
      } as any,
    });

    it('establishment_reference carries each reason\'s scope + the scope definition', async () => {
      const block = await service.serializeBronzeStandard(scopedProfile, 'establishment_reference');

      expect(block).toContain('Scope: category=african grocery store');
      expect(block).toContain('Scope: universal');
      // The definition travels with the block so the line is usable.
      expect(block).toContain('REASON SCOPE');
      expect(block).toContain('proof is scope-relative');
      expect(block).toContain('empty_proven_elsewhere');
    });

    it('discovery annotates exemplars + empty slots with the reason scope', async () => {
      const block = await service.serializeBronzeStandard(scopedProfile, 'discovery');

      expect(block).toContain('[trade_manifest_only] Arsema Food Mart [scope: category=african grocery store]');
      expect(block).toContain('[community_only_presence] empty_unproven — executed, returned 0 [scope: universal]');
      expect(block).toContain('REASON SCOPE');
    });

    it('omits the scope annotation when the profile has no catalog snapshot (never guesses)', async () => {
      const block = await service.serializeBronzeStandard(coverageProfile, 'discovery');

      expect(block).not.toContain('[scope: universal]');
      expect(block).not.toContain('[scope: category=');
      // …but the rule still reaches the analyst, since it governs the empty status.
      expect(block).toContain('proof is scope-relative');
    });

    // ── national_proof — the cascading-profile supplement ────────────────
    // When a market-scoped profile resolves, the national row is injected
    // alongside it as a compact proof record: which reasons are proven, one
    // exemplar name each, and the unproven key list. It exists to ground
    // empty_proven_elsewhere and exemplar evidence depth — so it must NOT
    // re-emit the full slot detail, vector log, or drift expansion.
    it('national_proof emits a compact proven/unproven record, one exemplar per reason', async () => {
      const nationalProfile = PROFILE({
        version: 4,
        configuration_json: coverageProfile.configuration_json,
      });
      const block = await service.serializeBronzeStandard(nationalProfile, 'national_proof');

      expect(block).toContain('=== BRONZE STANDARD — NATIONAL PROOF REFERENCE ===');
      expect(block).toContain('Profile scope: nationwide');
      expect(block).toContain('empty_proven_elsewhere');
      expect(block).toContain('--- Proven at national scope ---');
      expect(block).toContain('[absent_from_platform] Mama Nkechi');
      // Compact: first exemplar only — the other two slots stay out.
      expect(block).not.toContain('Second Fill');
      expect(block).not.toContain('Third Fill');
      expect(block).toContain('--- Not yet proven at national scope ---');
      expect(block).toContain('community_only_presence');
      // No hunt-list framing, no vector log, no drift expansion.
      expect(block).not.toContain('Vector Execution Log');
      expect(block).not.toContain('BRONZE CATALOG DRIFT');
      expect(block).toContain('=== END BRONZE NATIONAL PROOF ===');
    });

    it('national_proof returns empty string for a profile without configuration_json', async () => {
      const block = await service.serializeBronzeStandard(PROFILE({ configuration_json: null as any }), 'national_proof');
      expect(block).toBe('');
    });

    it('annotates filled slots with observed_city/observed_state when the catchment crosses city lines', async () => {
      const metroProfile = PROFILE({
        configuration_json: {
          catalog_revision: 1,
          reason_coverage: [
            {
              reason_key: 'community_only_presence',
              status: 'filled',
              slots: [{ business_name: 'KCK Grocery', observed_city: 'Kansas City', observed_state: 'KS', discovered_by: 'bronze_establishment_scan' }],
            },
          ],
        } as any,
      });
      const block = await service.serializeBronzeStandard(metroProfile, 'discovery');
      expect(block).toContain('KCK Grocery [Kansas City, KS]');
    });
  });

  // §10.2 regression — the whole reason bronze uses its own intelligence_focus
  // (Option A). activateDraft's retire query is focus-scoped, so activating a
  // bronze draft must NOT retire the active gold_standards profile for the
  // same (category, city, state, platform) tuple.
  describe('activateDraft — bronze does not retire gold (§10.2)', () => {
    it('retires only the bronze scope tuple (focus is part of the retire where)', async () => {
      const draft = PROFILE({ status: 'draft', version: 2 });
      mockPrisma.mkt_intelligence_profiles.findUnique.mockResolvedValueOnce(draft);
      mockPrisma.mkt_intelligence_profiles.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.mkt_intelligence_profiles.update.mockResolvedValueOnce({ ...draft, status: 'active' });

      const activated = await service.activateDraft('mip-bronze-1', 2);

      expect(activated.status).toBe('active');
      expect(mockPrisma.mkt_intelligence_profiles.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          intelligence_focus: 'bronze_standards',
          status: 'active',
          category_key: 'african grocery store',
          reference_city: null,
          reference_state: null,
          reference_platform: null,
        }),
        data: expect.objectContaining({ status: 'retired' }),
      });
    });
  });
});
