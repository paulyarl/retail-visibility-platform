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
    mkt_audits_list: { create: vi.fn(async ({ data }: any) => ({ ...data, id: 'ma-1' })) },
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
    resolveBronzeStandard: vi.fn(async () => null),
    recordBronzeExternalFills: vi.fn(async () => ({ id: 'mip-bronze-1', version: 4 })),
    resolveSignalWeightMapForCampaign: vi.fn(async () => undefined),
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
// The signal-registry sweep is advisory — stub the singleton so the suite
// controls which INT_* codes count as registered. The fixture emits
// INT_COMMUNITY_SIGNAL, which is NOT in this list, so it surfaces as a
// suggested_signals entry.
vi.mock('../services/MarketingSignalRegistryService', () => ({
  default: {
    listSignals: vi.fn(async () => [
      { code: 'INT_LOW_VISIBILITY' },
      { code: 'INT_MULTISOURCE_IDENTITY' },
    ]),
  },
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

  it('maps the __all__ campaign marker to the national NULL slot (no __All__ orphan)', async () => {
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValueOnce({
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
      city: '__all__',
      state: '__all__',
    });

    await service.importExternalResult({
      campaignId: 'camp-bronze-1',
      templateId: TEMPLATE.id,
      rawOutput: PAYLOAD,
    });

    expect(mockProfileService.importAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        intelligenceFocus: 'bronze_standards',
        referenceCity: null,
        referenceState: null,
      }),
      undefined,
    );
    // The sentinel must not leak into the prior-active lookup either —
    // normalizeReferenceCity('__all__') would title-case an orphan slot.
    expect(mockPrisma.mkt_intelligence_profiles.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reference_city: null, reference_state: null }),
      }),
    );
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

// ─── Consumer write-back (spec §7.2/§7.3/§7.4) ──────────────────────────
// The bronze establishment scan may miss a business its consumers reach:
// an intelligence_discovery candidate carrying causal bronze_attribution
// becomes a CONFIRMATORY (emerging_scan/competitive_scan) slot on the
// resolved active bronze profile — one draft per import, operator
// activation is the review gate. A business-scope audit of an attributed
// prospect is ground truth — business_audit slots survive re-scans.

const DISCOVERY_TEMPLATE = {
  id: 'mpt-seed-intelligence-discovery-001',
  name: 'Seek: Intelligence Discovery',
  version: 1,
  body: 'Discover {{category}} in {{city}}',
  prompt_type: 'seek',
  scope: 'intelligence',
  output_schema: { name: 'intelligence_discovery' },
};

const BA_TEMPLATE = {
  id: 'mpt-6oeuiizo',
  name: 'Business Digital Audit',
  version: 12,
  body: 'Audit {{business_name}}',
  prompt_type: 'seek',
  scope: 'business',
  output_schema: { name: 'business_analysis' },
};

const DISCOVERY_CAMPAIGN = {
  id: 'camp-discovery-1',
  scope: 'intelligence',
  category: 'African Grocery Store',
  intelligence_focus: 'emerging',
  intelligence_campaign_kind: 'discovery',
  intelligence_platform: null,
  city: 'Kansas City',
  state: 'MO',
};

const CANDIDATE = (over: Record<string, any> = {}) => ({
  business_name: 'KCK Grocery',
  category: 'African Grocery Store',
  city: 'Kansas City',
  state: 'KS',
  address: '900 Central Ave',
  location_status: 'inside_city',
  ownership_type: 'independent',
  category_fit: 'verified',
  identity_confidence: 'high',
  discovery_signals: ['INT_COMMUNITY_SIGNAL'],
  discovery_provenance: [{ source: 'community forum', role: 'discovery', url: 'https://forum.example/t' }],
  business_seek_recommended: true,
  business_seek_priority: 'high',
  ...over,
});

const DISCOVERY_PAYLOAD = (candidates: any[], focus = 'emerging') => JSON.stringify({
  intelligence_mode: 'profile',
  category: 'African Grocery Store',
  city: 'Kansas City',
  state: 'MO',
  focus,
  discovered_businesses: candidates,
  qualifying_businesses: candidates,
  candidate_count: candidates.length,
  qualifying_count: candidates.length,
  hold_count: 0,
});

const AUDIT_CAMPAIGN = {
  id: 'camp-audit-1',
  scope: 'business',
  business_name: 'Arsema Food Mart',
  category: 'African Grocery Store',
  city: 'Kansas City',
  state: 'MO',
  intelligence_platform: null,
  address_line1: '100 Main St',
  address_city: 'Kansas City',
  address_state: 'MO',
  discovery_context: null,
};

const AUDIT_PAYLOAD = (over: Record<string, any> = {}) => JSON.stringify({
  audit_metadata: {
    audit_date: '2026-09-21',
    requested_business: { business_name: 'Arsema Food Mart', city: 'Kansas City', state: 'MO', category: 'African Grocery Store' },
    identity_status: 'confirmed',
    identity_confidence: 'high',
  },
  summary: 'Storefront is real; digital presence is thin.',
  platforms: {
    google: {
      profile_status: 'unclaimed',
      rating: 4.6,
      total_reviews: 41,
      reviews_with_observable_response: 0,
      observable_unanswered_reviews: 0,
      observable_unanswered_negative_reviews: 0,
      observable_unanswered_positive_reviews: 0,
      observable_response_rate_percent: null,
    },
  },
  website: { status: 'none_found' },
  nap_consistency: { overall_status: 'consistent' },
  digital_opportunity_score: { score: 62 },
  high_attention: true,
  data_quality: { confidence: 'medium' },
  ...over,
});

describe('importExternalResult — bronze consumer write-back', () => {
  let service: MarketingPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = MarketingPromptService.getInstance();
    mockProfileService.resolveBronzeStandard.mockResolvedValue({ id: 'mip-bronze-1', version: 2 });
  });

  it('writes attributed candidates to the resolved bronze profile as emerging_scan fills', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    const attributed = CANDIDATE({
      bronze_attribution: [{ reason_key: 'community_only_presence', basis: 'community forum mention surfaced the business' }],
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: DISCOVERY_PAYLOAD([attributed]),
    });

    expect(mockProfileService.resolveBronzeStandard).toHaveBeenCalledWith(
      'African Grocery Store', null, 'Kansas City', 'MO', undefined,
    );
    expect(mockProfileService.recordBronzeExternalFills).toHaveBeenCalledWith(
      'mip-bronze-1',
      [expect.objectContaining({
        reason_key: 'community_only_presence',
        slot: expect.objectContaining({
          business_name: 'KCK Grocery',
          observed_city: 'Kansas City',
          observed_state: 'KS',
          discovered_by: 'emerging_scan',
          discovered_via: 'community forum mention surfaced the business',
        }),
      })],
      undefined,
      expect.objectContaining({ suggestedReasons: [], suggestedSignals: expect.any(Array) }),
    );
  });

  it('does NOT write fills for candidates without causal attribution', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: DISCOVERY_PAYLOAD([CANDIDATE()]),
    });

    // No attribution → no fills. The call still happens because the fixture's
    // unregistered INT_COMMUNITY_SIGNAL sweeps into suggested_signals — a
    // suggestions-only draft is the intended "pattern not on the list" path.
    expect(mockProfileService.recordBronzeExternalFills).toHaveBeenCalledWith(
      'mip-bronze-1',
      [],
      undefined,
      expect.objectContaining({
        suggestedSignals: [expect.objectContaining({ code: 'INT_COMMUNITY_SIGNAL', source: 'unmatched_signal' })],
      }),
    );
  });

  it('skips outside_market and benchmark_only candidates even when attributed', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    const att = [{ reason_key: 'r1', basis: 'vector hit' }];
    const outside = CANDIDATE({ location_status: 'outside_market', bronze_attribution: att });
    const benchmark = CANDIDATE({ business_name: 'Bench Co', address: '1 Bench', benchmark_only: true, bronze_attribution: att });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      // outside_market can only appear in discovered_businesses (refinement
      // rejects it in qualifying) — pass a qualifying set containing just
      // the benchmark candidate.
      rawOutput: JSON.stringify({
        intelligence_mode: 'profile',
        category: 'African Grocery Store',
        city: 'Kansas City',
        state: 'MO',
        focus: 'emerging',
        discovered_businesses: [outside, benchmark],
        qualifying_businesses: [benchmark],
        candidate_count: 2,
        qualifying_count: 1,
        hold_count: 0,
      }),
    });

    // No fills — outside_market/benchmark_only candidates are excluded. Their
    // unregistered signals still feed the vocabulary sweep (a signal pattern
    // observed on a context candidate is still catalog evidence).
    expect(mockProfileService.recordBronzeExternalFills).toHaveBeenCalledWith(
      'mip-bronze-1',
      [],
      undefined,
      expect.objectContaining({ suggestedSignals: expect.any(Array) }),
    );
  });

  it('emits competitive_scan provenance under focus=competitive', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue({ ...DISCOVERY_CAMPAIGN, intelligence_focus: 'competitive' });
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    const attributed = CANDIDATE({
      bronze_attribution: [{ reason_key: 'absent_from_platform', basis: 'platform sweep surfaced it' }],
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: DISCOVERY_PAYLOAD([attributed], 'competitive'),
    });

    expect(mockProfileService.recordBronzeExternalFills).toHaveBeenCalledWith(
      'mip-bronze-1',
      [expect.objectContaining({
        slot: expect.objectContaining({ discovered_by: 'competitive_scan' }),
      })],
      undefined,
      expect.objectContaining({ suggestedReasons: [], suggestedSignals: expect.any(Array) }),
    );
  });

  it('dedupes a business present in both discovered and qualifying sets', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    const attributed = CANDIDATE({
      bronze_attribution: [{ reason_key: 'community_only_presence', basis: 'vector' }],
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: DISCOVERY_PAYLOAD([attributed]),
    });

    const fills = mockProfileService.recordBronzeExternalFills.mock.calls[0][1];
    expect(fills).toHaveLength(1);
  });

  it('passes scan vocabulary proposals and unregistered INT_* codes as suggestions', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    const attributed = CANDIDATE({
      bronze_attribution: [{ reason_key: 'community_only_presence', basis: 'vector' }],
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: JSON.stringify({
        intelligence_mode: 'profile',
        category: 'African Grocery Store',
        city: 'Kansas City',
        state: 'MO',
        focus: 'emerging',
        discovered_businesses: [attributed],
        qualifying_businesses: [attributed],
        candidate_count: 1,
        qualifying_count: 1,
        hold_count: 0,
        suggested_reasons: [
          { proposed_label: 'Diaspora Classifieds Only', proposed_definition: 'found only via diaspora classifieds' },
        ],
        suggested_signals: [
          { code: 'INT_SEASONAL_OPERATION', proposed_label: 'Seasonal', proposed_definition: 'seasonal hours' },
          { code: 'RA_NOT_INT', proposed_label: 'bad', proposed_definition: 'non-INT dropped' },
        ],
      }),
    });

    const extras = mockProfileService.recordBronzeExternalFills.mock.calls[0][3];
    expect(extras.suggestedReasons).toHaveLength(1);
    expect(extras.suggestedReasons[0].proposed_label).toBe('Diaspora Classifieds Only');
    // Explicit INT_* proposal kept; the non-INT code dropped; and the fixture's
    // unregistered INT_COMMUNITY_SIGNAL was swept in as an unmatched_signal.
    const codes = extras.suggestedSignals.map((s: any) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['INT_SEASONAL_OPERATION', 'INT_COMMUNITY_SIGNAL']));
    expect(codes).not.toContain('RA_NOT_INT');
    const swept = extras.suggestedSignals.find((s: any) => s.code === 'INT_COMMUNITY_SIGNAL');
    expect(swept.source).toBe('unmatched_signal');
    expect(swept.exemplar_leads).toContain('KCK Grocery');
  });

  it('notes fills without writing when no active bronze profile resolves', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(DISCOVERY_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(DISCOVERY_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      category: 'African Grocery Store', intelligence_platform: null, city: 'Kansas City', state: 'MO',
    });
    mockProfileService.resolveBronzeStandard.mockResolvedValue(null);
    const attributed = CANDIDATE({
      bronze_attribution: [{ reason_key: 'community_only_presence', basis: 'vector' }],
    });

    await service.importExternalResult({
      campaignId: DISCOVERY_CAMPAIGN.id,
      templateId: DISCOVERY_TEMPLATE.id,
      rawOutput: DISCOVERY_PAYLOAD([attributed]),
    });

    expect(mockProfileService.recordBronzeExternalFills).not.toHaveBeenCalled();
  });

  it('writes a business_audit fill when an attributed prospect audit fails non_negotiable gates', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(BA_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(AUDIT_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      ...AUDIT_CAMPAIGN,
      discovery_context: {
        bronze_attribution: [{ reason_key: 'trade_manifest_only', basis: 'customs vector surfaced it' }],
      },
    });

    await service.importExternalResult({
      campaignId: AUDIT_CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: AUDIT_PAYLOAD({
        quality_gate_results: {
          results: [
            { gate: 'gbp_claimed', passed: false, severity: 'non_negotiable' },
            { gate: 'photo_count', passed: true, severity: 'recommended' },
          ],
        },
      }),
    });

    expect(mockProfileService.recordBronzeExternalFills).toHaveBeenCalledWith(
      'mip-bronze-1',
      [expect.objectContaining({
        reason_key: 'trade_manifest_only',
        slot: expect.objectContaining({
          business_name: 'Arsema Food Mart',
          discovered_by: 'business_audit',
          discovered_via: 'customs vector surfaced it',
          digital_quality: 'low',
        }),
      })],
      undefined,
    );
  });

  it('does NOT write an audit fill when the attributed business passes its gates', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(BA_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(AUDIT_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({
      ...AUDIT_CAMPAIGN,
      discovery_context: {
        bronze_attribution: [{ reason_key: 'trade_manifest_only', basis: 'customs vector' }],
      },
    });

    await service.importExternalResult({
      campaignId: AUDIT_CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: AUDIT_PAYLOAD({
        quality_gate_results: { results: [{ gate: 'gbp_claimed', passed: true, severity: 'non_negotiable' }] },
      }),
    });

    expect(mockProfileService.recordBronzeExternalFills).not.toHaveBeenCalled();
  });

  it('does NOT write an audit fill when the campaign carries no bronze attribution', async () => {
    vi.spyOn(service, 'getTemplate').mockResolvedValue(BA_TEMPLATE as any);
    mockCampaignService.getCampaign.mockResolvedValue(AUDIT_CAMPAIGN);
    mockPrisma.mkt_campaigns_list.findUnique.mockResolvedValue({ ...AUDIT_CAMPAIGN });

    await service.importExternalResult({
      campaignId: AUDIT_CAMPAIGN.id,
      templateId: BA_TEMPLATE.id,
      rawOutput: AUDIT_PAYLOAD({
        quality_gate_results: { results: [{ gate: 'gbp_claimed', passed: false, severity: 'non_negotiable' }] },
      }),
    });

    expect(mockProfileService.resolveBronzeStandard).not.toHaveBeenCalled();
    expect(mockProfileService.recordBronzeExternalFills).not.toHaveBeenCalled();
  });
});
