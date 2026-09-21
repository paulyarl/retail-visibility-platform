/**
 * Bronze Standard — post-import hook (sprint plan Phase 6.1 / Phase 10).
 *
 * `MarketingPromptService.importExternalResult` must persist a DRAFT bronze
 * profile for a `bronze_standard_scan` import REGARDLESS of campaign kind
 * (stage-1 establishment and stage-2 discovery both produce profiles — the
 * hook is keyed on the schema name, spec §6.1), must NOT create an audit row
 * (auditPlatform: null), and must apply the §7.3 merge so external-provenance
 * slots survive a re-scan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockPrisma, mockProfileService, mockCampaignService, mockCatalogService } = vi.hoisted(() => {
  const mockTx = {
    mkt_prompt_executions_list: { create: vi.fn(async ({ data }: any) => ({ ...data })) },
    mkt_audits_list: { create: vi.fn() },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (fn: any) => fn(mockTx)),
    mkt_campaigns_list: { findUnique: vi.fn() },
    mkt_intelligence_profiles: { findFirst: vi.fn() },
  };
  const mockProfileService = {
    importAsDraft: vi.fn(async (input: any) => ({
      id: 'mip-bronze-1',
      version: 1,
      category_key: input.categoryKey,
      intelligence_focus: input.intelligenceFocus,
    })),
    mergeBronzeCoverage: vi.fn((_prior: any, incoming: any) => incoming ?? []),
  };
  const mockCampaignService = { getCampaign: vi.fn() };
  const mockCatalogService = {
    applicableReasons: vi.fn(async () => []),
    currentRevision: vi.fn(async () => 9),
  };
  return { mockTx, mockPrisma, mockProfileService, mockCampaignService, mockCatalogService };
});

vi.mock('../prisma', () => ({ prisma: mockPrisma }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../services/MarketingCampaignService', () => ({ default: mockCampaignService }));
// Keep the pure snapshot builders real (they are the thing under test in the
// rebuild assertions); only the DB-bound singleton is stubbed.
vi.mock('../services/intelligence/BronzeReasonCatalogService', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    BronzeReasonCatalogService: { getInstance: () => mockCatalogService },
  };
});
vi.mock('../services/intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: { getInstance: () => mockProfileService },
  normalizeCategoryKey: (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
  normalizeReferenceCity: (s: string | null | undefined) => (s ? s.trim() : null),
  normalizeReferenceState: (s: string | null | undefined) => (s ? s.trim().toUpperCase() : null),
  normalizePlatformScope: (s: string | null | undefined) => (s ? s.trim().toLowerCase() || null : null),
}));

import { MarketingPromptService } from '../services/MarketingPromptService';

const TEMPLATE = {
  id: 'mpt-seed-bronze-standard-scan-001',
  name: 'Seek: Bronze Standard Scan',
  version: 1,
  body: 'Bronze scan for {{category}}',
  prompt_type: 'seek',
  scope: 'intelligence',
  output_schema: { name: 'bronze_standard_scan' },
};

const PAYLOAD = JSON.stringify({
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  catalog_revision: 1,
  reason_coverage: [
    { reason_key: 'trade_manifest_only', status: 'filled', slots: [{ business_name: 'Arsema Food Mart', discovered_by: 'bronze_establishment_scan' }] },
  ],
});

describe('importExternalResult — bronze_standard_scan hook', () => {
  let service: MarketingPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = MarketingPromptService.getInstance();
    vi.spyOn(service, 'getTemplate').mockResolvedValue(TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue({
      id: 'camp-bronze-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'discovery',
      city: 'Indianapolis',
      state: 'IN',
    });
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'discovery',
      city: 'Indianapolis',
      state: 'IN',
    });
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValue(null);
  });

  it('persists a bronze draft for an establishment import and creates no audit', async () => {
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValueOnce({
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
      city: null,
      state: null,
    });

    const result = await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    expect(mockProfileService.importAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        intelligenceFocus: 'bronze_standards',
        referenceCity: null,
        referenceState: null,
        referencePlatform: null,
      }),
      undefined,
    );
    // auditPlatform: null → no audit row for a bronze scan
    expect(mockTx.mkt_audits_list.create).not.toHaveBeenCalled();
    expect(result.audit).toBeNull();
  });

  it('persists a bronze draft for a discovery import too (hook keyed on schema name, not kind)', async () => {
    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    expect(mockProfileService.importAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        intelligenceFocus: 'bronze_standards',
        referenceCity: 'Indianapolis',
        referenceState: 'IN',
      }),
      undefined,
    );
    expect(mockTx.mkt_audits_list.create).not.toHaveBeenCalled();
  });

  it('carries external-provenance slots forward via the §7.3 merge on re-scan', async () => {
    const priorCoverage = [
      { reason_key: 'trade_manifest_only', status: 'filled', slots: [{ business_name: 'Ground Truth Co', discovered_by: 'business_audit' }] },
    ];
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce({
      id: 'mip-bronze-1',
      version: 3,
      configuration_json: { reason_coverage: priorCoverage },
    });
    mockProfileService.mergeBronzeCoverage.mockReturnValueOnce([
      { reason_key: 'trade_manifest_only', status: 'filled', slots: [
        { business_name: 'Arsema Food Mart', discovered_by: 'bronze_establishment_scan' },
        { business_name: 'Ground Truth Co', discovered_by: 'business_audit' },
      ] },
    ]);

    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    expect(mockProfileService.mergeBronzeCoverage).toHaveBeenCalledWith(
      priorCoverage,
      expect.any(Array),
    );
    const input = mockProfileService.importAsDraft.mock.calls[0][0];
    const merged = (input.configurationJson as any).reason_coverage;
    expect(merged.flatMap((e: any) => e.slots).map((s: any) => s.business_name)).toContain('Ground Truth Co');
  });

  it('does not call the merge when no prior active bronze profile exists', async () => {
    mockPrisma.mkt_intelligence_profiles.findFirst.mockResolvedValueOnce(null);

    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    expect(mockProfileService.mergeBronzeCoverage).not.toHaveBeenCalled();
  });

  // §4 — the snapshot is a verbatim embedding of the DB catalog rows. The
  // model's echo is lossy (it never sees scope unless the injected block
  // carries it), so the hook rebuilds it from the catalog table.
  const CATALOG_ROWS = [
    {
      reason_key: 'absent_from_platform', label: 'Absent', definition: 'd', signals: ['s'],
      expected_vectors: ['platform-presence audit'], priority: 1, provenance: 'derived',
      scope_category_key: null, scope_city: null, scope_state: null, scope_platform: null,
    },
    {
      reason_key: 'trade_manifest_only', label: 'Trade', definition: 'd', signals: [],
      expected_vectors: [], priority: 1, provenance: 'derived',
      scope_category_key: 'african grocery store', scope_city: null, scope_state: null, scope_platform: null,
    },
  ];

  it('rebuilds catalog_snapshot + scope_mix from the catalog table when the scan produced one', async () => {
    mockCatalogService.applicableReasons.mockResolvedValue(CATALOG_ROWS as any);
    mockCatalogService.currentRevision.mockResolvedValue(9);
    const rawOutput = JSON.stringify({
      ...JSON.parse(PAYLOAD),
      catalog_snapshot: [{ reason_key: 'trade_manifest_only', scope_category_key: null, scope_city: null }],
      scope_mix: { universal: 1, category: 0, location: 0, category_location: 0, platform_bound: 0 },
    });

    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput,
    });

    const config = mockProfileService.importAsDraft.mock.calls[0][0].configurationJson as any;
    // Snapshot + mix come from the catalog rows, not the payload's echo.
    expect(config.catalog_revision).toBe(9);
    expect(config.scope_mix).toMatchObject({ universal: 1, category: 1, platform_bound: 0 });
    expect(config.catalog_snapshot.map((r: any) => r.scope_category_key)).toEqual([
      null,
      'african grocery store',
    ]);
    // …resolved at this profile's scope (city/state from the campaign).
    expect(mockCatalogService.applicableReasons).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'african grocery store', city: 'Indianapolis', state: 'IN' }),
      undefined,
    );
  });

  it('keeps the payload snapshot when the catalog table is empty (migration unapplied)', async () => {
    mockCatalogService.applicableReasons.mockResolvedValue([] as any);
    const rawOutput = JSON.stringify({
      ...JSON.parse(PAYLOAD),
      catalog_snapshot: [{ reason_key: 'trade_manifest_only', scope_category_key: null }],
      scope_mix: { universal: 1, category: 0, location: 0, category_location: 0, platform_bound: 0 },
    });

    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput,
    });

    const config = mockProfileService.importAsDraft.mock.calls[0][0].configurationJson as any;
    expect(config.catalog_snapshot).toHaveLength(1);
    expect(config.scope_mix).toMatchObject({ universal: 1 });
    expect(config.catalog_revision).toBe(1);
  });

  it('leaves a snapshot-less payload alone (the city scan contracts on reason coverage)', async () => {
    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    const config = mockProfileService.importAsDraft.mock.calls[0][0].configurationJson as any;
    expect(mockCatalogService.applicableReasons).not.toHaveBeenCalled();
    expect(config.catalog_revision).toBe(1);
    expect(config.catalog_snapshot).toBeUndefined();
  });
});
