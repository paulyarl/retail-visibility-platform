/**
 * Unit tests for MarketingExecutionService.resolvePrompt (§1B, GAP-P7).
 *
 * Tests the profile-aware amplification seam:
 *   - Business seek + matching category → block present + intelligence_mode 'profile'
 *   - Business seek + mismatched category → byte-identical base render + 'none'
 *   - Business seek + absent category → byte-identical base render + 'none'
 *   - Fulfill/retainer prompt → no amplification (gate: seek-only)
 *   - Category/city scope → no amplification (gate: business-only)
 *
 * The key regression guarantee: when no profile is found, the rendered prompt
 * must be byte-identical to the pre-amplification render (renderTemplate()).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock instances are stable across factory + test code
const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockFormatEstablishment, mockFormatDiscovery, mockCatalogService, mockGeographyGridService, mockLocationEnrichmentService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async (_category: string, _focus?: string) => null),
    resolveCategoryIntelligence: vi.fn(async (_category: string, _city?: string | null, _platform?: string | null) => null),
    resolveGoldStandard: vi.fn(async (_category: string, _platform?: string | null) => null),
    serializeGoldStandard: vi.fn((_profile: any, _role: string) => ''),
    resolveBronzeStandard: vi.fn(async () => null),
    serializeBronzeStandard: vi.fn((_profile: any, _role: string) => ''),
    resolveSignalWeightsForCampaign: vi.fn(async () => undefined),
    serializeSignalWeightContext: vi.fn((_resolved: any, _auditData: any) => ''),
    renderBusinessProfileBlock: vi.fn(
      (profile: any, _city?: string | null, headerTitle?: string) =>
        `\n${headerTitle ? `=== ${headerTitle} ===\n` : ''}PROFILE_BLOCK:${profile.id}:v${profile.version}`,
    ),
  };
  const mockPromptService = {
    getTemplate: vi.fn(),
    createExecution: vi.fn(),
    updateExecution: vi.fn(),
  };
  const mockCampaignService = { getCampaign: vi.fn() };
  const mockAiProvider = { generateChatCompletion: vi.fn() };
  const mockHotProspectService = { syncFromExecution: vi.fn() };
  const mockComposerService = {
    composeIntelligencePrompt: vi.fn(async (_input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: _input.focus,
    })),
  };
  const mockMarketContextLoader = {
    loadMarketContext: vi.fn(async () => ({ category: {}, location: {} })),
    hasCategoryIntelligence: vi.fn(() => false),
    hasLocationIntelligence: vi.fn(() => false),
  };
  const mockFormatEstablishment = vi.fn(() => '');
  const mockFormatDiscovery = vi.fn(() => '');
  const mockCatalogService = {
    applicableReasons: vi.fn(async () => []),
    currentRevision: vi.fn(async () => 1),
    serializeCatalogBlock: vi.fn(() => ''),
  };
  const mockGeographyGridService = {
    getGrid: vi.fn(async () => null),
    upsertGrid: vi.fn(async () => undefined),
  };
  const mockLocationEnrichmentService = {
    getNationalCoverage: vi.fn(async () => null),
    applyEnrichmentPacket: vi.fn(async () => null),
  };
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockFormatEstablishment, mockFormatDiscovery, mockCatalogService, mockGeographyGridService, mockLocationEnrichmentService };
});

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => mockProfileService,
  },
}));

vi.mock('../intelligence/PromptComposerService', () => ({
  PromptComposerService: {
    getInstance: () => mockComposerService,
  },
}));

vi.mock('../MarketingPromptService', () => ({
  MarketingPromptService: {
    getInstance: () => mockPromptService,
  },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: mockCampaignService,
}));

vi.mock('../ai-providers', () => ({
  default: mockAiProvider,
}));

vi.mock('../MarketingHotProspectService', () => ({
  MarketingHotProspectService: {
    getInstance: () => mockHotProspectService,
  },
}));

vi.mock('../intelligence/MarketContextLoader', () => ({
  MarketContextLoader: {
    getInstance: () => mockMarketContextLoader,
  },
}));

vi.mock('../intelligence/BronzeReasonCatalogService', () => ({
  BronzeReasonCatalogService: {
    getInstance: () => mockCatalogService,
  },
}));

vi.mock('../intelligence/GeographyGridService', () => ({
  GeographyGridService: {
    getInstance: () => mockGeographyGridService,
  },
}));

// Intercepts the lazy `import('./LocationMarketEnrichmentService.js')` inside
// resolvePrompt's national location branch — the specifier resolves to the
// same module.
vi.mock('../LocationMarketEnrichmentService', () => ({
  default: mockLocationEnrichmentService,
}));

vi.mock('../intelligence/MarketContextBindingFormatters', () => ({
  formatEstablishmentMarketContext: mockFormatEstablishment,
  formatDiscoveryMarketContext: mockFormatDiscovery,
}));

import { MarketingExecutionService } from '../MarketingExecutionService';

describe('MarketingExecutionService.resolvePrompt (§1B profile amplification)', () => {
  let service: MarketingExecutionService;

  beforeEach(() => {
    service = MarketingExecutionService.getInstance();
    vi.clearAllMocks();
    // Reset default behavior: resolve returns null, resolveGoldStandard returns null
    mockProfileService.resolve.mockImplementation(async () => null);
    mockProfileService.resolveCategoryIntelligence.mockImplementation(async () => null);
    mockProfileService.resolveGoldStandard.mockImplementation(async () => null);
    mockProfileService.serializeGoldStandard.mockImplementation(() => '');
    // Reset composer to a default composed body
    mockComposerService.composeIntelligencePrompt.mockImplementation(async (input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: input.focus,
    }));
    // Reset market context loader + formatters to empty (no market context block)
    mockMarketContextLoader.loadMarketContext.mockImplementation(async () => ({ category: {}, location: {} }));
    mockFormatEstablishment.mockImplementation(() => '');
    mockFormatDiscovery.mockImplementation(() => '');
    // Reset bronze profile resolution to absent (no folded city scan) and the
    // catalog service to an empty catalog.
    mockProfileService.resolveBronzeStandard.mockImplementation(async () => null);
    mockProfileService.serializeBronzeStandard.mockImplementation(() => '');
    mockProfileService.resolveSignalWeightsForCampaign.mockImplementation(async () => undefined);
    mockProfileService.serializeSignalWeightContext.mockImplementation(() => '');
    mockCatalogService.applicableReasons.mockImplementation(async () => []);
    mockCatalogService.currentRevision.mockImplementation(async () => 1);
    mockCatalogService.serializeCatalogBlock.mockImplementation(() => '');
    // Reset the city-level geography grid cache to a miss (campaign-derived grid).
    mockGeographyGridService.getGrid.mockImplementation(async () => null);
  });

  const makeTemplate = (promptType: string, body = 'Hello {{business_name}} in {{category}}') => ({
    body,
    prompt_type: promptType,
    scope: 'business',
  });

  const makeCampaign = (scope: string, category: string) => ({
    id: 'camp-1',
    scope,
    category,
    business_name: 'Test Business',
    city: 'Test City',
    state: 'TS',
  });

  it('business seek + matching category → amplification + intelligence_mode profile', async () => {
    mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce({
      id: 'auto_repair_us',
      version: 1,
      category_key: 'auto repair',
      status: 'active',
    });

    const template = makeTemplate('seek');
    const campaign = makeCampaign('business', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('PROFILE_BLOCK:auto_repair_us:v1');
    expect(resolution.intelligence_mode).toBe('profile');
    expect(resolution.profile_id).toBe('auto_repair_us');
    expect(resolution.profile_version).toBe(1);
  });

  it('business seek + mismatched category → byte-identical base render + none', async () => {
    mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);

    const template = makeTemplate('seek');
    const campaign = makeCampaign('business', 'Unknown Category');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
    expect(resolution.profile_id).toBeNull();
  });

  it('business seek + absent category → byte-identical base render + none', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign('business', '');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
    // resolve should not have been called for empty category
    expect(mockProfileService.resolve).not.toHaveBeenCalled();
  });

  it('business seek + inactive profile version → treated as absent (resolve returns null)', async () => {
    mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);

    const template = makeTemplate('seek');
    const campaign = makeCampaign('business', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
  });

  it('business seek + case/whitespace variant of category → resolve called with raw category', async () => {
    mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce({
      id: 'auto_repair_us',
      version: 1,
      status: 'active',
    });

    const template = makeTemplate('seek');
    const campaign = makeCampaign('business', '  Auto Repair  ');

    const { resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(resolution.intelligence_mode).toBe('profile');
    // Business-scope §1B path resolves category intelligence with the raw
    // category string. Migration 205 — the campaign's city is now passed as the
    // 2nd arg so business audits resolve a city-scoped profile.
    expect(mockProfileService.resolveCategoryIntelligence).toHaveBeenCalledWith('  Auto Repair  ', 'Test City', undefined, undefined);
  });

  it('fulfill prompt → no amplification (gate: seek-only)', async () => {
    const template = makeTemplate('fulfill');
    const campaign = makeCampaign('business', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
    expect(mockProfileService.resolve).not.toHaveBeenCalled();
  });

  it('fulfill_target + resolved signal weights → injects platform context even with no gold standard', async () => {
    // The fulfill prompt orders its per-platform fix sheets by
    // signal_weight × gap severity — the block must render even when no
    // gold-standard benchmark resolves.
    mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
    const resolved = new Map<string, any>([
      ['google', { platform: 'google', weight: 0.9, scope: 'national' }],
      ['yelp', { platform: 'yelp', weight: 0.4, scope: 'national' }],
    ]);
    mockProfileService.resolveSignalWeightsForCampaign.mockResolvedValueOnce(resolved);
    mockProfileService.serializeSignalWeightContext.mockReturnValueOnce(
      '=== PLATFORM SIGNAL WEIGHTS ===\n  google: 0.9 (national)',
    );

    const auditData = { platforms: { yelp: { profile_status: 'missing' } } };
    const template = makeTemplate('fulfill');
    const campaign = {
      ...makeCampaign('business', 'Auto Repair'),
      mkt_audits_list: [{ platform: 'business_analysis', audit_data: auditData }],
    };

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('PLATFORM SIGNAL WEIGHTS');
    expect(mockProfileService.resolveSignalWeightsForCampaign)
      .toHaveBeenCalledWith(campaign, auditData, undefined);
    expect(mockProfileService.serializeSignalWeightContext)
      .toHaveBeenCalledWith(resolved, auditData);
    // No gold standard → no profile attribution, but the weight block landed.
    expect(resolution.intelligence_mode).toBe('none');
    expect(resolution.profile_id).toBeNull();
  });

  it('fulfill_target + gold standard + signal weights → weight block appended after the target block', async () => {
    const goldStandard = { id: 'gs-auto-repair-001', version: 3, reference_platform: 'google' };
    mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
    mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD TARGET ===\nExpected fields...');
    const resolved = new Map<string, any>([
      ['google', { platform: 'google', weight: 0.9, scope: 'local' }],
    ]);
    mockProfileService.resolveSignalWeightsForCampaign.mockResolvedValueOnce(resolved);
    mockProfileService.serializeSignalWeightContext.mockReturnValueOnce('=== PLATFORM SIGNAL WEIGHTS ===');

    const template = makeTemplate('fulfill');
    const campaign = {
      ...makeCampaign('business', 'Auto Repair'),
      mkt_audits_list: [{ platform: 'business_analysis', audit_data: {} }],
    };

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    expect(renderedPrompt).toContain('GOLD STANDARD TARGET');
    expect(renderedPrompt).toContain('PLATFORM SIGNAL WEIGHTS');
    expect(renderedPrompt.indexOf('GOLD STANDARD TARGET'))
      .toBeLessThan(renderedPrompt.indexOf('PLATFORM SIGNAL WEIGHTS'));
    expect(resolution.intelligence_mode).toBe('profile');
    expect(resolution.profile_id).toBe('gs-auto-repair-001');
    expect(mockProfileService.serializeGoldStandard)
      .toHaveBeenCalledWith(goldStandard, 'target');
  });

  it('retainer prompt → no amplification (gate: seek-only)', async () => {
    const template = makeTemplate('retainer');
    const campaign = makeCampaign('business', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
  });

  it('category scope → no amplification (gate: business-only)', async () => {
    // Use a template that only references category-scope variables
    const template = makeTemplate('seek', 'Analyze {{category}} in {{city}}');
    const campaign = makeCampaign('category', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
    expect(mockProfileService.resolve).not.toHaveBeenCalled();
  });

  it('city scope → no amplification (gate: business-only)', async () => {
    // Use a template that only references city-scope variables
    const template = makeTemplate('seek', 'Analyze {{city}}');
    const campaign = makeCampaign('city', 'Auto Repair');

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.intelligence_mode).toBe('none');
  });

  // ─── Profile Repair Signal-Triage Amplification Tests ───────────────────────
  describe('signal_triage role (template.category === profile_repair)', () => {
    const makeRepairTemplate = (body = 'Repair triage for {{business_name}}: {{audit_signals}}') => ({
      body,
      prompt_type: 'seek',
      category: 'profile_repair',
      scope: 'business',
    });

    it('signal_triage + empty audit_signals → suppresses category block (distractor fix)', async () => {
      const template = makeRepairTemplate();
      const campaign = {
        ...makeCampaign('business', 'Auto Repair'),
        has_website: 'yes',
        gbp_claimed: true,
        nap_consistent: true,
      };

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: '' },
      });

      expect(renderedPrompt).not.toContain('PROFILE_BLOCK');
      expect(renderedPrompt).not.toContain('CATEGORY INTELLIGENCE (SUPPLEMENTARY');
      expect(resolution.intelligence_mode).toBe('none');
      expect(resolution.profile_id).toBeNull();
      expect(mockProfileService.resolveCategoryIntelligence).not.toHaveBeenCalled();
    });

    it('signal_triage + populated audit_signals + active profile → appends category block with framing directive', async () => {
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce({
        id: 'auto_repair_us',
        version: 1,
        status: 'active',
      });

      const template = makeRepairTemplate();
      const campaign = makeCampaign('business', 'Auto Repair');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift\nunclaimed_profile' },
      });

      expect(renderedPrompt).toContain('nap_drift\nunclaimed_profile');
      expect(renderedPrompt).toContain('=== CATEGORY INTELLIGENCE (SUPPLEMENTARY — REPAIR SIGNALS ARE PRIMARY) ===');
      expect(renderedPrompt).toContain('PROFILE_BLOCK:auto_repair_us:v1');
      expect(resolution.intelligence_mode).toBe('profile');
      expect(resolution.profile_id).toBe('auto_repair_us');
    });

    it('signal_triage + populated audit_signals + no profile + no gold standard → base render only', async () => {
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const template = makeRepairTemplate();
      const campaign = makeCampaign('business', 'Unknown Niche');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'suspension' },
      });

      expect(renderedPrompt).not.toContain('PROFILE_BLOCK');
      expect(renderedPrompt).not.toContain('CATEGORY INTELLIGENCE (SUPPLEMENTARY');
      expect(renderedPrompt).not.toContain('GOLD STANDARD');
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('signal_triage + populated audit_signals + no profile + gold standard → injects benchmark (§4.5 decoupling)', async () => {
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      const goldStandard = { id: 'gs-auto-repair-001', version: 3, reference_platform: 'google' };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD BENCHMARK ===\nExpected fields...');

      const template = makeRepairTemplate();
      const campaign = makeCampaign('business', 'Auto Repair');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift' },
      });

      // GS benchmark injected even though no CI profile resolved
      expect(renderedPrompt).toContain('GOLD STANDARD BENCHMARK');
      expect(renderedPrompt).not.toContain('CATEGORY INTELLIGENCE (SUPPLEMENTARY');
      expect(resolution.intelligence_mode).toBe('profile');
      expect(resolution.profile_id).toBe('gs-auto-repair-001');
      expect(resolution.profile_version).toBe(3);
      // Benchmark role (not discovery/target); no platform on a plain
      // business-scope repair campaign → null passthrough
      expect(mockProfileService.serializeGoldStandard).toHaveBeenCalledWith(goldStandard, 'benchmark');
      expect(mockProfileService.resolveGoldStandard).toHaveBeenCalledWith('Auto Repair', null, 'Test City', 'TS', undefined);
    });

    it('signal_triage + gold-standard-only category → CI block suppressed, never a focus-less resolve', async () => {
      // Regression: a focus-less resolve() returns the newest active row for
      // (category, city) regardless of focus — i.e. the gold_standards profile
      // when no discovery profile exists. That rendered an EMPTY category-
      // intelligence shell and duplicated the gold-standard block under a second
      // header (same profile id). CI must resolve discovery-focus only, and the
      // benchmark must inject exactly once.
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      const goldStandard = { id: 'gs-african-grocery-001', version: 8, reference_platform: null };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD BENCHMARK ===\nExpected fields...');

      const template = makeRepairTemplate();
      const campaign = makeCampaign('business', 'African Grocery Store');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift\nplatform_gap' },
      });

      expect(renderedPrompt).not.toContain('CATEGORY INTELLIGENCE (SUPPLEMENTARY');
      expect(renderedPrompt).not.toContain('=== END CATEGORY INTELLIGENCE ===');
      expect(renderedPrompt).toContain('GOLD STANDARD BENCHMARK');
      // Exactly one profile id in play — the benchmark's, not a duplicated CI id.
      expect(resolution.profile_id).toBe('gs-african-grocery-001');
      // CI resolution is focus-aware; the focus-less resolve is never used here.
      expect(mockProfileService.resolve).not.toHaveBeenCalled();
      expect(mockProfileService.resolveCategoryIntelligence).toHaveBeenCalledWith('African Grocery Store', 'Test City', undefined, undefined);
    });

    it('signal_triage + resolved signal weights → injects platform context even with no CI profile or gold standard', async () => {
      // Signal weight is independent of the CI/gold-standard blocks: weights
      // live on every active profile for the category, so the platform-context
      // block must render even when neither benchmark resolves.
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
      const resolved = new Map<string, any>([
        ['google', { platform: 'google', weight: 0.95, scope: 'national' }],
        ['yelp', { platform: 'yelp', weight: 0.2, scope: 'national' }],
      ]);
      mockProfileService.resolveSignalWeightsForCampaign.mockResolvedValueOnce(resolved);
      mockProfileService.serializeSignalWeightContext.mockReturnValueOnce(
        '=== PLATFORM SIGNAL WEIGHTS ===\n  google: 0.95 (national)',
      );

      const auditData = { platforms: { google: { profile_status: 'unclaimed' } } };
      const template = makeRepairTemplate();
      const campaign = {
        ...makeCampaign('business', 'African Grocery Store'),
        mkt_audits_list: [{ platform: 'business_analysis', audit_data: auditData }],
      };

      const { renderedPrompt } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift\nplatform_gap' },
      });

      expect(renderedPrompt).toContain('PLATFORM SIGNAL WEIGHTS');
      expect(mockProfileService.resolveSignalWeightsForCampaign)
        .toHaveBeenCalledWith(campaign, auditData, undefined);
      expect(mockProfileService.serializeSignalWeightContext)
        .toHaveBeenCalledWith(resolved, auditData);
    });

    it('signal_triage + resolved signal weights + gold standard → weight block appended after the benchmark', async () => {
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      const goldStandard = { id: 'gs-auto-repair-001', version: 3, reference_platform: 'google' };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD BENCHMARK ===\nExpected fields...');
      const resolved = new Map<string, any>([
        ['google', { platform: 'google', weight: 0.9, scope: 'local' }],
      ]);
      mockProfileService.resolveSignalWeightsForCampaign.mockResolvedValueOnce(resolved);
      mockProfileService.serializeSignalWeightContext.mockReturnValueOnce('=== PLATFORM SIGNAL WEIGHTS ===');

      const template = makeRepairTemplate();
      const campaign = {
        ...makeCampaign('business', 'Auto Repair'),
        mkt_audits_list: [{ platform: 'business_analysis', audit_data: {} }],
      };

      const { renderedPrompt } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift' },
      });

      expect(renderedPrompt).toContain('GOLD STANDARD BENCHMARK');
      expect(renderedPrompt).toContain('PLATFORM SIGNAL WEIGHTS');
      expect(renderedPrompt.indexOf('GOLD STANDARD BENCHMARK'))
        .toBeLessThan(renderedPrompt.indexOf('PLATFORM SIGNAL WEIGHTS'));
    });

    it('signal_triage + no resolved weights → no platform context block (legacy render)', async () => {
      mockProfileService.resolveCategoryIntelligence.mockResolvedValueOnce(null);
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
      mockProfileService.resolveSignalWeightsForCampaign.mockResolvedValueOnce(undefined);
      mockProfileService.serializeSignalWeightContext.mockReturnValueOnce('');

      const template = makeRepairTemplate();
      const campaign = {
        ...makeCampaign('business', 'Unknown Niche'),
        mkt_audits_list: [{ platform: 'business_analysis', audit_data: {} }],
      };

      const { renderedPrompt } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'nap_drift' },
      });

      expect(renderedPrompt).not.toContain('PLATFORM SIGNAL WEIGHTS');
      expect(mockProfileService.serializeSignalWeightContext)
        .toHaveBeenCalledWith(undefined, {});
    });
  });

  // ─── Universal Business Prompt Auto-Sourcing Tests ─────────────────────────
  describe('universal business prompt auto-sourcing', () => {
    it('auto-sources recovery_resolution variables from campaign notes and intake', async () => {
      const template = {
        id: 'mpt-recovery-resolution-default',
        body: 'Complaint: {{complaintText}}\nIntake: {{intakePayload}}',
        prompt_type: 'recovery_resolution',
        scope: 'business',
      };
      const campaign = {
        id: 'camp-rec-1',
        scope: 'business',
        category: 'Dentist',
        notes: 'Customer dispute regarding billing on 2026-05-01',
        mkt_dispute_intake: [
          {
            intake_kind: 'dispute',
            owner_statement: 'Disputed charge explanation',
            proposed_resolution: 'Full refund',
          },
        ],
      };

      const { renderedPrompt } = await service.resolvePrompt({
        template,
        campaign,
        variables: { complaintText: '', intakePayload: '' },
      });

      expect(renderedPrompt).toContain('Customer dispute regarding billing');
      expect(renderedPrompt).toContain('Disputed charge explanation');
    });

    it('auto-sources fulfill variables (voice, services) when missing or empty', async () => {
      const template = {
        id: 'mpt-seed-fulfill-002',
        body: 'Business: {{business_name}}\nVoice: {{voice}}\nServices: {{services}}',
        prompt_type: 'fulfill',
        scope: 'business',
      };
      const campaign = {
        id: 'camp-ful-1',
        scope: 'business',
        business_name: 'Acme Auto',
        category: 'Auto Repair',
        tone: 'enthusiastic and helpful',
        service_category: 'Brake Repair, Oil Change',
      };

      const { renderedPrompt } = await service.resolvePrompt({
        template,
        campaign,
        variables: { voice: '', services: '' },
      });

      expect(renderedPrompt).toContain('Acme Auto');
      expect(renderedPrompt).toContain('enthusiastic and helpful');
      expect(renderedPrompt).toContain('Brake Repair, Oil Change');
    });
  });

  // ─── Intelligence-scope composer path + gold standard injection ──────────
  describe('intelligence-scope composer path — gold standard discovery benchmark', () => {
    const makeIntelTemplate = (body = 'Discover {{category}} in {{city}}') => ({
      body,
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_discovery' },
      outputSchema: { name: 'intelligence_discovery' },
    });

    const makeIntelCampaign = (focus = 'emerging', platform: string | null = null) => ({
      id: 'camp-intel-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      intelligence_focus: focus,
      intelligence_platform: platform,
      intelligence_campaign_kind: 'discovery',
    });

    it('injects gold standard discovery benchmark when profile exists', async () => {
      const goldStandard = {
        id: 'gs-african-grocery-001',
        version: 2,
        reference_platform: 'google',
      };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce(
        '=== GOLD STANDARD DISCOVERY BENCHMARK ===\nRate each candidate...',
      );

      const template = makeIntelTemplate();
      const campaign = makeIntelCampaign('emerging', 'google');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: undefined,
      });

      expect(renderedPrompt).toContain('GOLD STANDARD DISCOVERY BENCHMARK');
      expect(resolution.gold_standard_profile_id).toBe('gs-african-grocery-001');
      expect(resolution.gold_standard_profile_version).toBe(2);
      // serializeGoldStandard called with discovery_benchmark role
      expect(mockProfileService.serializeGoldStandard).toHaveBeenCalledWith(goldStandard, 'discovery_benchmark');
      // resolveGoldStandard called with platform, city, state, ctx
      expect(mockProfileService.resolveGoldStandard).toHaveBeenCalledWith('African Grocery Store', 'google', 'Kansas City', 'MO', undefined);
    });

    it('appends degraded-mode note when no gold standard exists', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const template = makeIntelTemplate();
      const campaign = makeIntelCampaign('competitive', null);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: undefined,
      });

      expect(renderedPrompt).toContain('NO GOLD STANDARD PROFILE');
      expect(renderedPrompt).toContain('BENCHMARKING ABSENT');
      expect(resolution.gold_standard_profile_id).toBeNull();
      expect(resolution.gold_standard_profile_version).toBeNull();
    });

    it('appends the campaign-derived GEOGRAPHY GRID directive (category-independent sweep)', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: {
          ...makeIntelCampaign('emerging', 'google'),
          intelligence_zip_codes: '64118, 64124',
        },
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== GEOGRAPHY GRID — AUTHORITATIVE SWEEP UNITS ===');
      expect(renderedPrompt).toContain('Market: Kansas City, MO');
      expect(renderedPrompt).toContain('64118, 64124');
      // The core fix: the label-independent sweep must not be token-keyed.
      expect(renderedPrompt).toContain('Do NOT key these datasets on the category name');
      // Appended after the platform + gold-standard blocks — final word on scope.
      expect(renderedPrompt.indexOf('GEOGRAPHY GRID')).toBeGreaterThan(
        renderedPrompt.indexOf('PLATFORM DISCOVERY FOCUS'),
      );
    });

    it('passes campaign platform through to resolveGoldStandard', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
      const campaign = makeIntelCampaign('emerging', 'yelp');

      await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign,
        variables: undefined,
      });

      expect(mockProfileService.resolveGoldStandard).toHaveBeenCalledWith('African Grocery Store', 'yelp', 'Kansas City', 'MO', undefined);
    });

    it('passes null platform when campaign has no intelligence_platform', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
      const campaign = makeIntelCampaign('emerging', null);

      await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign,
        variables: undefined,
      });

      expect(mockProfileService.resolveGoldStandard).toHaveBeenCalledWith('African Grocery Store', null, 'Kansas City', 'MO', undefined);
    });

    it('works for competitive focus (not just emerging)', async () => {
      const goldStandard = { id: 'gs-001', version: 1, reference_platform: null };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD DISCOVERY BENCHMARK ===');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('competitive', null),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('GOLD STANDARD DISCOVERY BENCHMARK');
      expect(resolution.gold_standard_profile_id).toBe('gs-001');
      // Composer called with competitive focus
      expect(mockComposerService.composeIntelligencePrompt).toHaveBeenCalledWith(
        expect.objectContaining({ focus: 'competitive' }),
        undefined,
      );
    });

    it('composer body is still rendered (gold standard is appended, not replacing)', async () => {
      mockComposerService.composeIntelligencePrompt.mockResolvedValueOnce({
        body: 'COMPOSED_INTEL_BODY',
        resolution: { profile_id: 'intel-profile-1', profile_version: 3, intelligence_mode: 'profile' as const },
        focus: 'emerging',
      });
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce({
        id: 'gs-001',
        version: 1,
        reference_platform: 'google',
      });
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD DISCOVERY BENCHMARK ===');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', 'google'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('COMPOSED_INTEL_BODY');
      expect(renderedPrompt).toContain('GOLD STANDARD DISCOVERY BENCHMARK');
      // Focus profile resolution preserved
      expect(resolution.profile_id).toBe('intel-profile-1');
      expect(resolution.profile_version).toBe(3);
      expect(resolution.intelligence_mode).toBe('profile');
      // Gold standard resolution also present
      expect(resolution.gold_standard_profile_id).toBe('gs-001');
    });
  });

  // ─── Bronze standard calibration injection (stage-3 consumer, spec §7) ───
  // The emerging discovery scan is the primary bronze consumer: the resolved
  // city (or national, via cascade) bronze profile is injected as MARKET
  // CALIBRATION framing — exemplars + empty-slot report + vector log.
  // Competitive never receives it (§9); absence produces a soft degraded
  // note, not a block.
  describe('intelligence-scope composer path — bronze standard calibration', () => {
    const makeIntelTemplate = (body = 'Discover {{category}} in {{city}}') => ({
      body,
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_discovery' },
      outputSchema: { name: 'intelligence_discovery' },
    });

    const makeIntelCampaign = (focus = 'emerging', platform: string | null = null) => ({
      id: 'camp-intel-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      intelligence_focus: focus,
      intelligence_platform: platform,
      intelligence_campaign_kind: 'discovery',
    });

    it('injects the MARKET CALIBRATION block on emerging discovery when a bronze profile resolves', async () => {
      const bronzeProfile = { id: 'bz-kc-001', version: 2, reference_city: 'Kansas City', reference_state: 'MO' };
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(bronzeProfile);
      mockProfileService.serializeBronzeStandard.mockReturnValueOnce(
        '=== BRONZE STANDARD — MARKET CALIBRATION ===\nexemplars + empty slots + vector log',
      );

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', null),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('BRONZE STANDARD — MARKET CALIBRATION');
      expect(resolution.bronze_standard_profile_id).toBe('bz-kc-001');
      expect(resolution.bronze_standard_profile_version).toBe(2);
      // Resolved with the campaign's category + market + platform, and
      // serialized with the 'discovery' role (calibration, not hunt list).
      expect(mockProfileService.resolveBronzeStandard).toHaveBeenCalledWith(
        'African Grocery Store', null, 'Kansas City', 'MO', undefined,
      );
      expect(mockProfileService.serializeBronzeStandard).toHaveBeenCalledWith(bronzeProfile, 'discovery', undefined);
    });

    it('appends the absent-calibration note on emerging discovery when no bronze profile resolves', async () => {
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(null);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', null),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('NO BRONZE STANDARD PROFILE — BLIND-SPOT CALIBRATION ABSENT');
      // NB: the discovery schema's prompt suffix quotes the block name in its
      // attribution rules, so assert on the injection itself — the serializer
      // is never reached when nothing resolves.
      expect(mockProfileService.serializeBronzeStandard).not.toHaveBeenCalled();
      expect(resolution.bronze_standard_profile_id).toBeNull();
      expect(resolution.bronze_standard_profile_version).toBeNull();
    });

    it('never injects bronze into competitive discovery (spec §9)', async () => {
      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('competitive', null),
        variables: undefined,
      });

      expect(mockProfileService.resolveBronzeStandard).not.toHaveBeenCalled();
      expect(mockProfileService.serializeBronzeStandard).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('BLIND-SPOT CALIBRATION');
      expect(resolution.bronze_standard_profile_id).toBeNull();
    });
  });

  // ─── Platform discovery focus directive (focus amplifier) ────────────────
  describe('intelligence-scope composer path — platform discovery focus directive', () => {
    const makeIntelTemplate = (body = 'Discover {{category}} in {{city}}') => ({
      body,
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_discovery' },
      outputSchema: { name: 'intelligence_discovery' },
    });

    const makeIntelCampaign = (focus = 'emerging', platform: string | null = null) => ({
      id: 'camp-intel-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      intelligence_focus: focus,
      intelligence_platform: platform,
      intelligence_campaign_kind: 'discovery',
    });

    it('emerging + platform → directive targets businesses with GAPS on the platform', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', 'google'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('PLATFORM DISCOVERY FOCUS: Google');
      expect(renderedPrompt).toContain('GAPS on Google');
      // Spectrum of gaps — not just binary "missing"
      expect(renderedPrompt).toContain('COMPLETELY ABSENT');
      expect(renderedPrompt).toContain('UNCLAIMED');
      expect(renderedPrompt).toContain('NAP DRIFT');
      expect(renderedPrompt).toContain('SPARSE/INCOMPLETE');
      expect(renderedPrompt).toContain('POORLY RATED');
      // Should NOT contain competitive-targeting language
      expect(renderedPrompt).not.toContain('PRESENT on Google');
      expect(renderedPrompt).not.toContain('competitive leaderboard');
    });

    it('competitive + platform → directive targets businesses PRESENT on the platform', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('competitive', 'yelp'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('PLATFORM DISCOVERY FOCUS: Yelp');
      expect(renderedPrompt).toContain('PRESENT on Yelp');
      expect(renderedPrompt).toContain('competitive leaderboard');
      // Should NOT contain emerging-targeting language
      expect(renderedPrompt).not.toContain('MISSING from Yelp');
    });

    it('no platform → no platform directive block', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', null),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('PLATFORM DISCOVERY FOCUS');
    });

    it('platform directive appears before gold standard block', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce({
        id: 'gs-001',
        version: 1,
        reference_platform: 'google',
      });
      mockProfileService.serializeGoldStandard.mockReturnValueOnce(
        '=== GOLD STANDARD DISCOVERY BENCHMARK ===\nRate each candidate...',
      );

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', 'google'),
        variables: undefined,
      });

      const platformIdx = renderedPrompt.indexOf('PLATFORM DISCOVERY FOCUS');
      const gsIdx = renderedPrompt.indexOf('GOLD STANDARD DISCOVERY BENCHMARK');
      expect(platformIdx).toBeGreaterThan(-1);
      expect(gsIdx).toBeGreaterThan(-1);
      expect(platformIdx).toBeLessThan(gsIdx);
    });

    it('emerging directive mentions INT_SINGLE_SOURCE, INT_LOW_VISIBILITY, and INT_WEAK_MAINSTREAM_INDEXING', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging', 'google'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('INT_SINGLE_SOURCE');
      expect(renderedPrompt).toContain('INT_LOW_VISIBILITY');
      expect(renderedPrompt).toContain('INT_WEAK_MAINSTREAM_INDEXING');
    });

    it('works for different platforms (not just google)', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('competitive', 'facebook'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('PLATFORM DISCOVERY FOCUS: Facebook');
      expect(renderedPrompt).toContain('PRESENT on Facebook');
    });
  });

  // ─── Enrichment prompt: Gold Standard removed (V8 reframing) ────────
  // The V8 reframing decoupled the gold standard from enrichment prompts.
  // The gold standard is now business-scope only — it is consumed by the
  // seed/business audit, not by location or category enrichment. These tests
  // verify that enrichment prompts do NOT inject the gold standard.
  describe('emerging establishment — folded bronze city scan (spec §6.3 / D4)', () => {
    const makeEstabTemplate = () => ({
      body: 'Establish the intelligence profile for {{category}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_profile' },
      outputSchema: { name: 'intelligence_profile' },
    });

    const makeEstabCampaign = (overrides: Record<string, any> = {}) => ({
      id: 'camp-estab-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'emerging',
      intelligence_platform: null,
      intelligence_campaign_kind: 'establishment',
      ...overrides,
    });

    it('injects hunt list + dual-payload directive when a bronze profile resolves', async () => {
      const bronzeProfile = { id: 'bz-african-001', version: 1, reference_city: null, reference_state: null };
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(bronzeProfile);
      mockProfileService.serializeBronzeStandard.mockReturnValueOnce(
        '=== BRONZE STANDARD — NATIONAL REFERENCE ===\nhunt list',
      );
      mockCatalogService.applicableReasons.mockResolvedValueOnce([{ reason_key: 'trade_manifest_only' }]);
      mockCatalogService.currentRevision.mockResolvedValueOnce(7);
      mockCatalogService.serializeCatalogBlock.mockReturnValueOnce('=== BRONZE REASON CATALOG ===\nrev 7');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('BRONZE STANDARD — CITY SCAN (FOLDED)');
      expect(renderedPrompt).toContain('BRONZE STANDARD — NATIONAL REFERENCE');
      expect(renderedPrompt).toContain('BRONZE REASON CATALOG');
      expect(renderedPrompt).toContain('DUAL-PAYLOAD OUTPUT — FOLDED CITY BRONZE SCAN');
      expect(renderedPrompt).toContain('PAYLOAD 2 — bronze_standard_scan');
      expect(renderedPrompt).toContain('reference_city = "Indianapolis"');
      expect(renderedPrompt).toContain('reference_state = "IN"');
      // The bronze output contract is injected so the second payload validates
      expect(renderedPrompt).toContain('reason_coverage');
      expect(mockProfileService.resolveBronzeStandard).toHaveBeenCalledWith(
        'African Grocery Store', null, 'Indianapolis', 'IN', undefined,
      );
      expect(mockProfileService.serializeBronzeStandard).toHaveBeenCalledWith(
        bronzeProfile, 'establishment_reference', undefined,
      );
      expect(mockCatalogService.applicableReasons).toHaveBeenCalledWith(
        expect.objectContaining({ categoryKey: 'African Grocery Store', city: 'Indianapolis', state: 'IN' }),
        undefined,
      );
      expect(resolution.bronze_standard_profile_id).toBe('bz-african-001');
      expect(resolution.bronze_standard_profile_version).toBe(1);
    });

    it('skips the fold when no bronze profile resolves', async () => {
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(null);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('CITY SCAN (FOLDED)');
      expect(renderedPrompt).not.toContain('DUAL-PAYLOAD OUTPUT');
      expect(mockCatalogService.applicableReasons).not.toHaveBeenCalled();
      expect(resolution.bronze_standard_profile_id).toBeNull();
    });

    it('appends the campaign-derived GEOGRAPHY GRID directive for the profile substrate', async () => {
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign({
          city: 'Kansas City',
          state: 'MO',
          intelligence_zip_codes: '64118,64124',
        }),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== GEOGRAPHY GRID — AUTHORITATIVE SWEEP UNITS ===');
      expect(renderedPrompt).toContain('Market: Kansas City, MO');
      expect(renderedPrompt).toContain('64118, 64124');
      // The establishment prompt authors the profile's geography_grid from this grid.
      expect(renderedPrompt).toContain('Copy this grid verbatim into the profile\'s "geography_grid" field');
    });

    it('does not fold into competitive or national establishment campaigns', async () => {
      // Competitive focus — bronze never enters competitive output (§9).
      const competitive = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign({ intelligence_focus: 'competitive' }),
        variables: undefined,
      });
      expect(competitive.renderedPrompt).not.toContain('CITY SCAN (FOLDED)');
      expect(mockProfileService.resolveBronzeStandard).not.toHaveBeenCalled();

      // Nationwide campaign — no city/state, so no market to hunt (stage 2 is
      // city-scoped by construction).
      const national = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign({ city: null, state: null }),
        variables: undefined,
      });
      expect(national.renderedPrompt).not.toContain('CITY SCAN (FOLDED)');
      expect(mockProfileService.resolveBronzeStandard).not.toHaveBeenCalled();
    });
  });

  // ── National establishment (__all__ sentinel) — sprint: national layer ──
  // A '__all__' establishment campaign renders the national template variant
  // (NATIONAL_ESTABLISHMENT_TEMPLATE_ID) instead of the city-scoped body, and
  // carries no geography grid / bronze fold — both are city-scoped by
  // construction.
  describe('national establishment (__all__ sentinel)', () => {
    const makeEstabTemplate = () => ({
      body: 'Establish the intelligence profile for {{category}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_profile' },
      outputSchema: { name: 'intelligence_profile' },
    });

    const makeEstabCampaign = (overrides: Record<string, any> = {}) => ({
      id: 'camp-estab-nat-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: '__all__',
      state: '__all__',
      intelligence_focus: 'emerging',
      intelligence_platform: null,
      intelligence_campaign_kind: 'establishment',
      ...overrides,
    });

    it('renders the seeded national template body for a __all__ campaign', async () => {
      mockPromptService.getTemplate.mockResolvedValueOnce({
        body: 'NATIONAL BODY for {{category}} on {{platform}}',
        prompt_type: 'seek',
      });

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign(),
        variables: undefined,
      });

      expect(mockPromptService.getTemplate).toHaveBeenCalledWith(
        'mpt-seed-intel-profile-establishment-national-001', undefined,
      );
      expect(renderedPrompt).toContain('NATIONAL BODY for African Grocery Store');
      // The city-scoped body was NOT rendered.
      expect(renderedPrompt).not.toContain('Establish the intelligence profile for');
      // National campaigns carry no catchment — no grid directive, no fold.
      expect(renderedPrompt).not.toContain('GEOGRAPHY GRID');
      expect(renderedPrompt).not.toContain('CITY SCAN (FOLDED)');
      expect(mockGeographyGridService.getGrid).not.toHaveBeenCalled();
      expect(mockProfileService.resolveBronzeStandard).not.toHaveBeenCalled();
    });

    it('falls back to the selected template body when the national seed is absent', async () => {
      mockPromptService.getTemplate.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: { ...makeEstabTemplate(), body: 'CITY BODY for {{category}} in {{city}}' },
        campaign: makeEstabCampaign(),
        variables: undefined,
      });

      // Degraded but non-fatal — the operator-selected body renders with the
      // literal sentinel until the seed runs.
      expect(renderedPrompt).toContain('CITY BODY for African Grocery Store in __all__');
    });

    it('does not fetch the national template for a city-scoped establishment', async () => {
      await service.resolvePrompt({
        template: makeEstabTemplate(),
        campaign: makeEstabCampaign({ city: 'Indianapolis', state: 'IN' }),
        variables: undefined,
      });

      expect(mockPromptService.getTemplate).not.toHaveBeenCalled();
    });
  });

  // ── Bronze-standard scans never enter the composer (sprint plan 6.2/10) ──
  // composeIntelligencePrompt's focus ternary loads the COMPETITIVE fragment
  // for any non-emerging focus — a bronze campaign reaching the composer would
  // silently get competitive framing. The isBronzeStandardFocus gate must
  // divert every bronze scan to its dedicated branch.
  describe('bronze_standards scans bypass the composer path', () => {
    const makeBronzeTemplate = (kind: 'establishment' | 'discovery') => ({
      body: 'Bronze scan for {{category}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'bronze_standard_scan' },
      outputSchema: { name: 'bronze_standard_scan' },
      intelligence_campaign_kind: kind,
    });

    const makeBronzeCampaign = (overrides: Record<string, any> = {}) => ({
      id: 'camp-bronze-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'bronze_standards',
      intelligence_platform: null,
      intelligence_campaign_kind: 'discovery',
      ...overrides,
    });

    it('stage-1 national establishment injects the catalog block and never composes', async () => {
      mockCatalogService.applicableReasons.mockResolvedValueOnce([{ reason_key: 'trade_manifest_only' }]);
      mockCatalogService.currentRevision.mockResolvedValueOnce(7);
      mockCatalogService.serializeCatalogBlock.mockReturnValueOnce('=== BRONZE REASON CATALOG ===\nrev 7');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeBronzeTemplate('establishment'),
        campaign: makeBronzeCampaign({
          city: null, state: null, intelligence_campaign_kind: 'establishment',
        }),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('BRONZE REASON CATALOG');
      expect(mockComposerService.composeIntelligencePrompt).not.toHaveBeenCalled();
    });

    it('stage-2 city discovery injects the national reference block and never composes', async () => {
      const bronzeProfile = { id: 'bz-1', version: 1, reference_city: null, reference_state: null };
      mockProfileService.resolveBronzeStandard.mockResolvedValueOnce(bronzeProfile);
      mockProfileService.serializeBronzeStandard.mockReturnValueOnce(
        '=== BRONZE STANDARD — NATIONAL REFERENCE ===\nhunt list',
      );
      mockCatalogService.applicableReasons.mockResolvedValueOnce([]);
      mockCatalogService.currentRevision.mockResolvedValueOnce(1);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeBronzeTemplate('discovery'),
        campaign: makeBronzeCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('BRONZE STANDARD — NATIONAL REFERENCE');
      expect(mockComposerService.composeIntelligencePrompt).not.toHaveBeenCalled();
      expect(resolution.bronze_standard_profile_id).toBe('bz-1');
    });
  });

  describe('enrichment prompt — gold standard not injected (V8 reframing)', () => {
    const makeEnrichmentTemplate = (scope: string, body = 'CITY: {{city}} STATE: {{state}}') => ({
      body,
      prompt_type: 'enrichment',
      scope,
      output_schema: { name: 'location_enrichment' },
    });

    const makeCategoryEnrichmentCampaign = (category: string, city: string, state: string, parentCampaignId?: string) => ({
      id: 'camp-enr-1',
      scope: 'category',
      category,
      city,
      state,
      parent_campaign_id: parentCampaignId ?? null,
    });

    const makeLocationEnrichmentCampaign = (city: string, state: string, parentCampaignId?: string) => ({
      id: 'camp-enr-loc-1',
      scope: 'city',
      category: '__location__',
      city,
      state,
      parent_campaign_id: parentCampaignId ?? null,
    });

    it('category enrichment does NOT inject gold standard (business-scope only)', async () => {
      // Even if a gold standard exists, it should NOT be injected into
      // enrichment prompts. The gold standard is consumed by the seed audit.
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce({
        id: 'gs-african-grocery',
        version: 2,
        category_name: 'African Grocery Store',
        reference_city: null,
        reference_state: null,
      });
      mockProfileService.serializeGoldStandard.mockReturnValueOnce(
        '=== GOLD STANDARD MARKET REFERENCE ===\nCategory: African Grocery Store\nDIRECTIVE: ...',
      );

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEnrichmentTemplate('category'),
        campaign: makeCategoryEnrichmentCampaign('African Grocery Store', 'Indianapolis', 'IN'),
        variables: undefined,
      });

      // Gold standard is NOT injected into enrichment prompts
      expect(renderedPrompt).not.toContain('GOLD STANDARD MARKET REFERENCE');
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('location enrichment with PG parent does NOT resolve or inject gold standard', async () => {
      mockCampaignService.getCampaign.mockResolvedValueOnce({
        id: 'mcamp-pg-001',
        category: 'African Grocery Store',
        campaign_category: 'proving_ground',
      });

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEnrichmentTemplate('city'),
        campaign: makeLocationEnrichmentCampaign('Indianapolis', 'IN', 'mcamp-pg-001'),
        variables: undefined,
      });

      // Gold standard is NOT resolved or injected for enrichment prompts
      expect(renderedPrompt).not.toContain('GOLD STANDARD MARKET REFERENCE');
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('enrichment + no gold standard → base render only, intelligence_mode none', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEnrichmentTemplate('category'),
        campaign: makeCategoryEnrichmentCampaign('African Grocery Store', 'Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('GOLD STANDARD');
      expect(resolution.profile_id).toBeNull();
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('location enrichment without PG parent → no gold standard lookup, base render only', async () => {
      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeEnrichmentTemplate('city'),
        campaign: makeLocationEnrichmentCampaign('Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(mockProfileService.resolveGoldStandard).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('GOLD STANDARD');
      expect(resolution.intelligence_mode).toBe('none');
    });
  });

  // ─── Category-set enrichment (PG shelf sweep) ─────────────────────────
  // The sweep spawns one scope='category' directory_enrichment child carrying
  // the residual no-profile markets in discovery_context.shelf_sweep. The
  // set template's {{markets}} placeholder is auto-sourced from that payload,
  // and each distinct city gets its own structural CITY PROFILE block.
  describe('enrichment prompt — category set (PG shelf sweep)', () => {
    const makeSetTemplate = () => ({
      body: 'CATEGORY: {{category}}\nMARKETS:\n{{markets}}',
      prompt_type: 'enrichment',
      scope: 'category',
      output_schema: { name: 'category_set_enrichment' },
    });
    const makeSetCampaign = (markets: any[] | null) => ({
      id: 'camp-set-1',
      scope: 'category',
      category: 'Halal Market',
      city: 'Fort Wayne',
      state: 'IN',
      discovery_context: markets ? { shelf_sweep: { markets } } : null,
    });
    const SET_MARKETS = [
      { category: 'Halal Market', city: 'Fort Wayne', state: 'IN' },
      { category: 'Butcher Shop', city: 'Auburn', state: 'IN' },
      { category: 'Kebab House', city: 'Fort Wayne', state: 'IN' },
    ];

    it('auto-sources {{markets}} from the sweep payload', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeSetTemplate(),
        campaign: makeSetCampaign(SET_MARKETS),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('- Halal Market — Fort Wayne, IN');
      expect(renderedPrompt).toContain('- Butcher Shop — Auburn, IN');
      expect(renderedPrompt).toContain('- Kebab House — Fort Wayne, IN');
    });

    it('renders the single-market fallback line when no sweep set exists', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeSetTemplate(),
        campaign: makeSetCampaign(null),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('no sweep set');
    });

    it('injects one CITY PROFILE block per distinct city when profiles exist', async () => {
      const realPrisma = (service as any).prisma;
      (service as any).prisma = {
        $queryRaw: vi.fn(async () => [
          { context: { city_profile: { metro_description: 'Mid-size Midwest metro', major_industries: ['logistics'] } } },
        ]),
      };
      try {
        const { renderedPrompt } = await service.resolvePrompt({
          template: makeSetTemplate(),
          campaign: makeSetCampaign(SET_MARKETS),
          variables: undefined,
        });

        // Two distinct cities in the set → two profile blocks.
        expect(renderedPrompt.match(/=== CITY PROFILE \(structural\) ===/g)).toHaveLength(2);
        expect(renderedPrompt).toContain('City: Fort Wayne, IN');
        expect(renderedPrompt).toContain('City: Auburn, IN');
      } finally {
        (service as any).prisma = realPrisma;
      }
    });
  });

  // ─── Category intelligence injection (campaign lane) ──────────────────
  // The establishment profile's vocabulary (synonyms, subcategories,
  // corridors, swallowing labels, evidence rules, signal weights,
  // prohibited inferences) is the fact source the enrichment packet
  // otherwise re-derives. resolvePrompt injects it for city-scoped
  // category enrichment, competitive → emerging, same order as the
  // deterministic lane's resolveProfileForMarket.
  describe('enrichment prompt — category intelligence injection', () => {
    const makeCategoryTemplate = () => ({
      body: 'CATEGORY: {{category}}\nCITY: {{city}} STATE: {{state}}',
      prompt_type: 'enrichment',
      scope: 'category',
      output_schema: { name: 'category_enrichment' },
    });
    const makeCategoryCampaign = (category: string, city: string, state: string) => ({
      id: 'camp-enr-ci-1',
      scope: 'category',
      category,
      city,
      state,
      parent_campaign_id: null,
    });
    const INTEL_PROFILE = (focus: string) => ({
      id: `ip-${focus}-1`,
      version: 3,
      intelligence_focus: focus,
      configuration_json: {
        category_name: 'African Grocery Store',
        synonyms: ['african market', 'african food market', 'habesha store'],
        subcategories: ['West African grocery', 'Ethiopian and Eritrean grocery'],
        terminology: { merkato: 'Amharic for market' },
        geography_grid: {
          corridors: ['Lafayette Rd / International Marketplace'],
          adjacent_municipalities: ['Speedway', 'Lawrence'],
          derivation_basis: 'platform evidence sweep',
        },
        generic_label_set: [{ source: 'google', labels: ['Convenience store', 'Grocery store'] }],
        category_evidence_rules: { snap_registry: 'SNAP-authorized retailers qualify' },
        platform_signal_weights: [{ platform: 'google', weight: 0.6, basis: 'most listings' }],
        prohibited_inferences: ['never claim delivery service'],
      },
    });

    it('injects ESTABLISHED CATEGORY INTELLIGENCE when a competitive profile exists', async () => {
      mockProfileService.resolve.mockResolvedValueOnce(INTEL_PROFILE('competitive'));

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeCategoryTemplate(),
        campaign: makeCategoryCampaign('African Grocery Store', 'Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== ESTABLISHED CATEGORY INTELLIGENCE (authoritative vocabulary) ===');
      expect(renderedPrompt).toContain('african market');
      expect(renderedPrompt).toContain('West African grocery');
      expect(renderedPrompt).toContain('Lafayette Rd / International Marketplace');
      expect(renderedPrompt).toContain('Convenience store, Grocery store');
      expect(renderedPrompt).toContain('never claim delivery service');
      // Provenance stays 'none' at render — lineage is stamped at apply.
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('falls back to the emerging profile when competitive misses', async () => {
      mockProfileService.resolve
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(INTEL_PROFILE('emerging'));

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeCategoryTemplate(),
        campaign: makeCategoryCampaign('African Grocery Store', 'Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== ESTABLISHED CATEGORY INTELLIGENCE');
      expect(renderedPrompt).toContain('focus: emerging');
      const calls = mockProfileService.resolve.mock.calls;
      expect(calls[0][1]).toBe('competitive');
      expect(calls[1][1]).toBe('emerging');
    });

    it('no profile → no block, base render passthrough', async () => {
      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeCategoryTemplate(),
        campaign: makeCategoryCampaign('African Grocery Store', 'Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('ESTABLISHED CATEGORY INTELLIGENCE');
      expect(renderedPrompt).toContain('CATEGORY: African Grocery Store');
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('national (__all__) category enrichment resolves the national slot + emits framing', async () => {
      mockProfileService.resolve.mockResolvedValueOnce(INTEL_PROFILE('competitive'));

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeCategoryTemplate(),
        campaign: makeCategoryCampaign('African Grocery Store', '__all__', '__all__'),
        variables: undefined,
      });

      // Resolves the national slot — reference_city NULL — never the literal
      // '__all__' city. Competitive first, emerging fallback preserved.
      expect(mockProfileService.resolve).toHaveBeenCalledWith(
        'African Grocery Store', 'competitive', null, null, undefined,
      );
      expect(renderedPrompt).toContain('=== ESTABLISHED CATEGORY INTELLIGENCE (authoritative vocabulary) ===');
      expect(renderedPrompt).toContain('NATIONAL category intelligence');
      // The national public-surface framing directive is present and tells
      // the model the packet is a national page, not a city page.
      expect(renderedPrompt).toContain('=== NATIONAL SURFACE FRAMING ===');
      expect(renderedPrompt).toContain('NATIONAL category page');
      expect(renderedPrompt).toContain('market-agnostic');
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('national (__all__) emits the framing directive even when no profile resolves', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeCategoryTemplate(),
        campaign: makeCategoryCampaign('African Grocery Store', '__all__', '__all__'),
        variables: undefined,
      });

      // Both slots probed (competitive → emerging), nothing found — the
      // packet still carries the national framing so copy stays
      // market-agnostic.
      expect(mockProfileService.resolve).toHaveBeenCalledTimes(2);
      expect(renderedPrompt).not.toContain('ESTABLISHED CATEGORY INTELLIGENCE');
      expect(renderedPrompt).toContain('=== NATIONAL SURFACE FRAMING ===');
      // The framing block itself carries no sentinel vocabulary — the
      // campaign's literal '__all__' appears only via {{city}} substitution.
      const framing = renderedPrompt.slice(renderedPrompt.indexOf('=== NATIONAL SURFACE FRAMING ==='));
      expect(framing).not.toContain('__all__');
      expect(framing).not.toContain('national sentinel');
    });

    it('location enrichment skips category resolution entirely', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: {
          body: 'CITY: {{city}} STATE: {{state}}',
          prompt_type: 'enrichment',
          scope: 'city',
          output_schema: { name: 'location_enrichment' },
        },
        campaign: {
          id: 'camp-enr-loc-2',
          scope: 'city',
          category: '__location__',
          city: 'Indianapolis',
          state: 'IN',
          parent_campaign_id: null,
        },
        variables: undefined,
      });

      expect(mockProfileService.resolve).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('ESTABLISHED CATEGORY INTELLIGENCE');
    });

    it('category-set sweep skips category resolution (residual no-profile markets)', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: {
          body: 'CATEGORY: {{category}}\nMARKETS:\n{{markets}}',
          prompt_type: 'enrichment',
          scope: 'category',
          output_schema: { name: 'category_set_enrichment' },
        },
        campaign: {
          id: 'camp-set-2',
          scope: 'category',
          category: 'Halal Market',
          city: 'Fort Wayne',
          state: 'IN',
          discovery_context: null,
        },
        variables: undefined,
      });

      expect(mockProfileService.resolve).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('ESTABLISHED CATEGORY INTELLIGENCE');
    });
  });

  // ─── Location enrichment — market geography grid injection ─────────────
  // The city-level grid cache (mkt_geography_grids) is the established,
  // category-independent retail catchment — populated by establishment
  // imports and shared across categories. Location enrichment injects it so
  // the packet grounds notable_areas / metro fields in established
  // geography instead of re-deriving a different catchment.
  describe('enrichment prompt — location geography grid injection', () => {
    const makeLocationTemplate = () => ({
      body: 'CITY: {{city}} STATE: {{state}}',
      prompt_type: 'enrichment',
      scope: 'city',
      output_schema: { name: 'location_enrichment' },
    });
    const makeLocationCampaign = (city: string, state: string) => ({
      id: 'camp-enr-geo-1',
      scope: 'city',
      category: '__location__',
      city,
      state,
      parent_campaign_id: null,
    });
    const CACHED_GRID = {
      city: 'Indianapolis',
      state: 'IN',
      zips: ['46201', '46208', '46254'],
      corridors: ['Lafayette Rd / International Marketplace', 'W 38th St'],
      adjacent_municipalities: ['Speedway', 'Lawrence', 'Beech Grove'],
      radius_miles: 20,
    };

    it('injects MARKET GEOGRAPHY GRID when a cached grid exists', async () => {
      mockGeographyGridService.getGrid.mockResolvedValueOnce(CACHED_GRID);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeLocationTemplate(),
        campaign: makeLocationCampaign('Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== MARKET GEOGRAPHY GRID (established catchment) ===');
      expect(renderedPrompt).toContain('46201, 46208, 46254');
      expect(renderedPrompt).toContain('Lafayette Rd / International Marketplace');
      expect(renderedPrompt).toContain('Speedway; Lawrence; Beech Grove');
      expect(renderedPrompt).toContain('Search radius: 20 miles');
      // Category resolution must NOT fire for a location render.
      expect(mockProfileService.resolve).not.toHaveBeenCalled();
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('no cached grid → no block, base render passthrough', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeLocationTemplate(),
        campaign: makeLocationCampaign('Indianapolis', 'IN'),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('MARKET GEOGRAPHY GRID');
      expect(renderedPrompt).toContain('CITY: Indianapolis');
    });

    it('category enrichment does NOT consult the grid cache', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: {
          body: 'CATEGORY: {{category}}\nCITY: {{city}} STATE: {{state}}',
          prompt_type: 'enrichment',
          scope: 'category',
          output_schema: { name: 'category_enrichment' },
        },
        campaign: {
          id: 'camp-enr-cat-geo',
          scope: 'category',
          category: 'African Grocery Store',
          city: 'Indianapolis',
          state: 'IN',
          parent_campaign_id: null,
        },
        variables: undefined,
      });

      expect(mockGeographyGridService.getGrid).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('MARKET GEOGRAPHY GRID');
    });
  });

  // ─── National location enrichment ('__all__' sentinel) ─────────────────
  // The national location page's fact layer is measured coverage, not a
  // city geography grid: resolvePrompt renders the national template
  // variant (no city placeholders), injects the deterministic NATIONAL
  // COVERAGE GRID, and appends the national public-surface framing.
  describe('enrichment prompt — national location (__all__ sentinel)', () => {
    const makeLocationTemplate = (body: string) => ({
      body,
      prompt_type: 'enrichment',
      scope: 'city',
      output_schema: { name: 'location_enrichment' },
    });
    const makeNationalCampaign = () => ({
      id: 'camp-enr-natloc-1',
      scope: 'city',
      category: '__location__',
      city: '__all__',
      state: '__all__',
      parent_campaign_id: null,
    });
    const COVERAGE = {
      totalStates: 2,
      totalCities: 12,
      totalListings: 240,
      states: [
        { state: 'IN', cityCount: 8, listingCount: 120 },
        { state: 'OH', cityCount: 4, listingCount: 120 },
      ],
      topCities: [{ city: 'Indianapolis', state: 'IN', listingCount: 45 }],
    };

    it('renders the national template + coverage grid + national framing', async () => {
      mockPromptService.getTemplate.mockResolvedValueOnce({
        body: 'NATIONAL LOCATION BODY — coverage page, no city placeholders',
        prompt_type: 'enrichment',
      });
      mockLocationEnrichmentService.getNationalCoverage.mockResolvedValueOnce(COVERAGE);

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template: makeLocationTemplate('CITY BODY for {{city}}, {{state}}'),
        campaign: makeNationalCampaign(),
        variables: undefined,
      });

      // National template variant substituted for the city-scoped body.
      expect(mockPromptService.getTemplate).toHaveBeenCalledWith(
        'mpt-location-enrichment-national', undefined,
      );
      expect(renderedPrompt).toContain('NATIONAL LOCATION BODY');
      expect(renderedPrompt).not.toContain('CITY BODY for __all__');

      // Measured coverage injected as the grounding fact layer.
      expect(renderedPrompt).toContain('=== NATIONAL COVERAGE GRID (measured platform coverage) ===');
      expect(renderedPrompt).toContain('240 published listings across 12 markets in 2 states');
      expect(renderedPrompt).toContain('IN: 120 listings across 8 markets');
      expect(renderedPrompt).toContain('Indianapolis, IN (45)');

      // National public-surface framing — market-agnostic directive.
      expect(renderedPrompt).toContain('=== NATIONAL SURFACE FRAMING ===');
      expect(renderedPrompt).toContain('NATIONAL location page');

      // No city-scope machinery: no geography grid, no category profile.
      expect(mockGeographyGridService.getGrid).not.toHaveBeenCalled();
      expect(mockProfileService.resolve).not.toHaveBeenCalled();
      expect(resolution.intelligence_mode).toBe('none');
    });

    it('emits the framing directive even when coverage computation returns nothing', async () => {
      mockPromptService.getTemplate.mockResolvedValueOnce(null);
      mockLocationEnrichmentService.getNationalCoverage.mockResolvedValueOnce({
        totalStates: 0, totalCities: 0, totalListings: 0, states: [], topCities: [],
      });

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeLocationTemplate('CITY BODY for {{city}}, {{state}}'),
        campaign: makeNationalCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('NATIONAL COVERAGE GRID');
      expect(renderedPrompt).toContain('=== NATIONAL SURFACE FRAMING ===');
      // The framing block carries no sentinel vocabulary.
      const framing = renderedPrompt.slice(renderedPrompt.indexOf('=== NATIONAL SURFACE FRAMING ==='));
      expect(framing).not.toContain('__all__');
    });

    it('city-scoped location enrichment still takes the geography grid path', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeLocationTemplate('CITY BODY for {{city}}, {{state}}'),
        campaign: {
          id: 'camp-enr-loc-city',
          scope: 'city',
          category: '__location__',
          city: 'Indianapolis',
          state: 'IN',
          parent_campaign_id: null,
        },
        variables: undefined,
      });

      // City path untouched: grid consulted, national template not fetched,
      // no national framing.
      expect(mockGeographyGridService.getGrid).toHaveBeenCalled();
      expect(mockPromptService.getTemplate).not.toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('NATIONAL SURFACE FRAMING');
    });
  });
});
