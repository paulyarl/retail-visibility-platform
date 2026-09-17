/**
 * Unit tests for MarketContext injection into intelligence campaigns.
 *
 * Covers the three injection points in MarketingExecutionService.resolvePrompt:
 *   1. Gold-standard establishment scan → formatEstablishmentMarketContext
 *   2. Gold-standard discovery scan (degraded + normal) → formatDiscoveryMarketContext
 *   3. Emerging/competitive discovery scan → formatDiscoveryMarketContext
 *
 * Also covers:
 *   - National campaigns (no city) → no market context injection
 *   - Business-scope campaigns → market context via buildMarketContextBlock
 *     (which reads MarketContextLoader, not the intelligence-scope formatters)
 *   - Market context block appears after gold standard block
 *   - Graceful degradation when enrichment hasn't run
 *
 * Spec: docs/LocalBiz/INTELLIGENCE_CAMPAIGN_MARKET_CONTEXT_SPEC.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockFormatEstablishment, mockFormatDiscovery, mockFormatCategoryId, mockFormatVocab, mockVocabService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async () => null),
    resolveGoldStandard: vi.fn(async () => null),
    serializeGoldStandard: vi.fn(() => ''),
    resolveBronzeStandard: vi.fn(async () => null),
    serializeBronzeStandard: vi.fn(() => ''),
    renderBusinessProfileBlock: vi.fn(() => ''),
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
    loadLocationContext: vi.fn(async () => ({})),
    hasCategoryIntelligence: vi.fn(() => false),
    hasLocationIntelligence: vi.fn(() => false),
  };
  const mockFormatEstablishment = vi.fn(() => '');
  const mockFormatDiscovery = vi.fn(() => '');
  const mockFormatCategoryId = vi.fn(() => '');
  const mockFormatVocab = vi.fn(() => '');
  const mockVocabService = {
    loadVocabulary: vi.fn(async () => ({ directoryLabels: [], registeredLabels: [] })),
    isKnownLabel: vi.fn(async () => false),
    findRegisteredValue: vi.fn(async () => null),
  };
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockFormatEstablishment, mockFormatDiscovery, mockFormatCategoryId, mockFormatVocab, mockVocabService };
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

vi.mock('../intelligence/MarketContextBindingFormatters', () => ({
  formatEstablishmentMarketContext: mockFormatEstablishment,
  formatDiscoveryMarketContext: mockFormatDiscovery,
  formatCategoryIdentificationMarketContext: mockFormatCategoryId,
  formatKnownCategoryVocabulary: mockFormatVocab,
}));

vi.mock('../CategoryVocabularyService', () => ({
  CategoryVocabularyService: {
    getInstance: () => mockVocabService,
  },
  default: mockVocabService,
}));

import { MarketingExecutionService } from '../MarketingExecutionService';

describe('MarketContext injection into intelligence campaigns', () => {
  let service: MarketingExecutionService;

  beforeEach(() => {
    service = MarketingExecutionService.getInstance();
    vi.clearAllMocks();
    // Reset defaults: no profiles, no gold standard
    mockProfileService.resolve.mockImplementation(async () => null);
    mockProfileService.resolveGoldStandard.mockImplementation(async () => null);
    mockProfileService.serializeGoldStandard.mockImplementation(() => '');
    mockComposerService.composeIntelligencePrompt.mockImplementation(async (input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: input.focus,
    }));
    // Reset market context to empty by default
    mockMarketContextLoader.loadMarketContext.mockImplementation(async () => ({ category: {}, location: {} }));
    mockMarketContextLoader.loadLocationContext.mockImplementation(async () => ({}));
    mockFormatEstablishment.mockImplementation(() => '');
    mockFormatDiscovery.mockImplementation(() => '');
    mockFormatCategoryId.mockImplementation(() => '');
    mockFormatVocab.mockImplementation(() => '');
    mockVocabService.loadVocabulary.mockImplementation(async () => ({ directoryLabels: [], registeredLabels: [] }));
  });

  // ─── Establishment scan ────────────────────────────────────────────────

  describe('establishment scan', () => {
    const makeEstTemplate = () => ({
      body: 'Find best-in-class {{category}} in {{city}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'gold_standard_scan' },
      outputSchema: { name: 'gold_standard_scan' },
    });

    const makeEstCampaign = (city: string | null = 'Indianapolis', state: string | null = 'IN') => ({
      id: 'camp-est-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city,
      state,
      intelligence_focus: 'gold_standards',
      intelligence_campaign_kind: 'establishment',
    });

    it('injects market context when enrichment data exists', async () => {
      const marketData = {
        category: { category_profile: { business_model: 'independent' }, category_signals: ['hours'] },
        location: { city_profile: { metro_description: 'Midwest hub' } },
      };
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce(marketData);
      mockFormatEstablishment.mockReturnValueOnce('=== MARKET CONTEXT (from prior enrichment runs) ===\nCATEGORY PROFILE...');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeEstTemplate(),
        campaign: makeEstCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('MARKET CONTEXT (from prior enrichment runs)');
      expect(mockMarketContextLoader.loadMarketContext).toHaveBeenCalledWith(
        'African Grocery Store', 'Indianapolis', 'IN', undefined,
      );
      expect(mockFormatEstablishment).toHaveBeenCalledWith(
        marketData, 'African Grocery Store', 'Indianapolis', 'IN',
      );
    });

    it('does not inject market context when enrichment data is empty', async () => {
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce({ category: {}, location: {} });
      // Formatter returns '' for empty data

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeEstTemplate(),
        campaign: makeEstCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
    });

    it('does not inject market context for national campaigns (no city)', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeEstTemplate(),
        campaign: makeEstCampaign(null, null),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
      expect(mockMarketContextLoader.loadMarketContext).not.toHaveBeenCalled();
    });
  });

  // ─── Gold-standard discovery scan (degraded) ───────────────────────────

  describe('gold-standard discovery scan (degraded — no gold standard)', () => {
    const makeGsDiscoveryTemplate = () => ({
      body: 'Discover {{category}} in {{city}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'gold_standard_scan' },
      outputSchema: { name: 'gold_standard_scan' },
    });

    const makeGsDiscoveryCampaign = () => ({
      id: 'camp-gs-disc-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'gold_standards',
      intelligence_campaign_kind: 'discovery',
    });

    it('injects market context in degraded mode when enrichment data exists', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);
      const marketData = {
        category: { market_density: 'sparse' },
        location: { market_gaps: [{ category: 'african grocery', signal: 'unmet demand' }] },
      };
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce(marketData);
      mockFormatDiscovery.mockReturnValueOnce('=== MARKET CONTEXT (from prior enrichment runs) ===\nMARKET GAPS...');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeGsDiscoveryTemplate(),
        campaign: makeGsDiscoveryCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('DEGRADED MODE');
      expect(renderedPrompt).toContain('MARKET CONTEXT');
      expect(mockFormatDiscovery).toHaveBeenCalled();
    });

    it('does not inject market context in degraded mode when enrichment is empty', async () => {
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(null);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeGsDiscoveryTemplate(),
        campaign: makeGsDiscoveryCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('DEGRADED MODE');
      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
    });
  });

  // ─── Gold-standard discovery scan (normal) ────────────────────────────

  describe('gold-standard discovery scan (normal — with gold standard)', () => {
    const makeGsDiscoveryTemplate = () => ({
      body: 'Discover {{category}} in {{city}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'gold_standard_scan' },
      outputSchema: { name: 'gold_standard_scan' },
    });

    const makeGsDiscoveryCampaign = () => ({
      id: 'camp-gs-disc-2',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'gold_standards',
      intelligence_campaign_kind: 'discovery',
    });

    it('injects market context after gold standard block when enrichment data exists', async () => {
      const goldStandard = { id: 'gs-001', version: 1, reference_platform: 'google' };
      mockProfileService.resolveGoldStandard.mockResolvedValueOnce(goldStandard);
      mockProfileService.serializeGoldStandard.mockReturnValueOnce('=== GOLD STANDARD DISCOVERY ===\nBenchmark...');
      const marketData = {
        category: { category_profile: { business_model: 'independent' } },
        location: { city_profile: { metro_description: 'Midwest hub' } },
      };
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce(marketData);
      mockFormatDiscovery.mockReturnValueOnce('=== MARKET CONTEXT (from prior enrichment runs) ===\nCATEGORY PROFILE...');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeGsDiscoveryTemplate(),
        campaign: makeGsDiscoveryCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('GOLD STANDARD DISCOVERY');
      expect(renderedPrompt).toContain('MARKET CONTEXT');
      // Market context appears after gold standard
      const gsIdx = renderedPrompt.indexOf('GOLD STANDARD DISCOVERY');
      const mcIdx = renderedPrompt.indexOf('MARKET CONTEXT');
      expect(mcIdx).toBeGreaterThan(gsIdx);
    });
  });

  // ─── Emerging/competitive discovery scan ──────────────────────────────

  describe('emerging/competitive discovery scan', () => {
    const makeIntelTemplate = () => ({
      body: 'Discover {{category}} in {{city}}',
      prompt_type: 'seek',
      scope: 'intelligence',
      output_schema: { name: 'intelligence_discovery' },
      outputSchema: { name: 'intelligence_discovery' },
    });

    const makeIntelCampaign = (focus: 'emerging' | 'competitive' = 'emerging') => ({
      id: 'camp-intel-1',
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: focus,
      intelligence_campaign_kind: 'discovery',
    });

    it('injects market context for emerging focus when enrichment data exists', async () => {
      const marketData = {
        category: { prospect_signals: ['thin online presence'] },
        location: { market_gaps: [{ category: 'african grocery', signal: 'unmet demand', area: 'south side' }] },
      };
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce(marketData);
      mockFormatDiscovery.mockReturnValueOnce('=== MARKET CONTEXT (from prior enrichment runs) ===\nEMERGING focus...');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('MARKET CONTEXT');
      expect(mockFormatDiscovery).toHaveBeenCalledWith(
        marketData, 'African Grocery Store', 'Indianapolis', 'IN', 'emerging',
      );
    });

    it('injects market context for competitive focus when enrichment data exists', async () => {
      const marketData = {
        category: { category_signals: ['published hours'] },
        location: { city_profile: { metro_description: 'Midwest hub' } },
      };
      mockMarketContextLoader.loadMarketContext.mockResolvedValueOnce(marketData);
      mockFormatDiscovery.mockReturnValueOnce('=== MARKET CONTEXT (from prior enrichment runs) ===\nCOMPETITIVE focus...');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('competitive'),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('MARKET CONTEXT');
      expect(mockFormatDiscovery).toHaveBeenCalledWith(
        marketData, 'African Grocery Store', 'Indianapolis', 'IN', 'competitive',
      );
    });

    it('does not inject market context when enrichment data is empty', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign: makeIntelCampaign('emerging'),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
    });

    it('does not inject market context for national campaigns (no city)', async () => {
      const campaign = { ...makeIntelCampaign('emerging'), city: null, state: null };

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeIntelTemplate(),
        campaign,
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
      expect(mockMarketContextLoader.loadMarketContext).not.toHaveBeenCalled();
    });
  });

  // ─── Category identification seek (location + vocabulary injection) ────

  describe('category identification seek', () => {
    const makeCatIdTemplate = () => ({
      body: 'Identify {{business_name}} in {{city}}, {{state}}',
      prompt_type: 'seek',
      scope: 'business',
      output_schema: { name: 'category_identification' },
      outputSchema: { name: 'category_identification' },
    });

    const makeCatIdCampaign = (city: string | null = 'Indianapolis', state: string | null = 'IN') => ({
      id: 'camp-catid-1',
      scope: 'business',
      category: '', // the category is what the scan determines
      business_name: 'Test Business',
      city,
      state,
    });

    it('injects the vocabulary block after the location block', async () => {
      const locCtx = { city_profile: { metro_description: 'Midwest hub' } };
      mockMarketContextLoader.loadLocationContext.mockResolvedValueOnce(locCtx);
      mockFormatCategoryId.mockReturnValueOnce('=== MARKET CONTEXT (from prior location enrichment) ===\nCITY PROFILE...');
      mockVocabService.loadVocabulary.mockResolvedValueOnce({
        directoryLabels: ['Grocery Store'],
        registeredLabels: ['Somali Grocery Store'],
      });
      mockFormatVocab.mockReturnValueOnce('=== KNOWN CATEGORY VOCABULARY ===\nGrocery Store');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeCatIdTemplate(),
        campaign: makeCatIdCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('MARKET CONTEXT');
      expect(renderedPrompt).toContain('KNOWN CATEGORY VOCABULARY');
      expect(mockMarketContextLoader.loadLocationContext).toHaveBeenCalledWith('Indianapolis', 'IN', undefined);
      expect(mockFormatCategoryId).toHaveBeenCalledWith(locCtx, 'Indianapolis', 'IN');
      expect(mockFormatVocab).toHaveBeenCalledWith(['Grocery Store'], ['Somali Grocery Store']);
      // Vocabulary renders after the location block.
      expect(renderedPrompt.indexOf('KNOWN CATEGORY VOCABULARY'))
        .toBeGreaterThan(renderedPrompt.indexOf('MARKET CONTEXT'));
    });

    it('injects the vocabulary block even when the campaign has no city', async () => {
      mockVocabService.loadVocabulary.mockResolvedValueOnce({
        directoryLabels: ['Grocery Store'],
        registeredLabels: [],
      });
      mockFormatVocab.mockReturnValueOnce('=== KNOWN CATEGORY VOCABULARY ===\nGrocery Store');

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeCatIdTemplate(),
        campaign: makeCatIdCampaign(null, null),
        variables: undefined,
      });

      expect(mockMarketContextLoader.loadLocationContext).not.toHaveBeenCalled();
      expect(renderedPrompt).toContain('KNOWN CATEGORY VOCABULARY');
    });

    it('renders cleanly when the vocabulary is empty (no block injected)', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeCatIdTemplate(),
        campaign: makeCatIdCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('KNOWN CATEGORY VOCABULARY');
      expect(renderedPrompt).toContain('Identify Test Business');
    });

    it('does not inject the vocabulary block for non-category-identification seeks', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: {
          body: 'Audit {{business_name}}',
          prompt_type: 'seek',
          scope: 'business',
          output_schema: { name: 'business_analysis' },
          outputSchema: { name: 'business_analysis' },
        },
        campaign: makeCatIdCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).not.toContain('KNOWN CATEGORY VOCABULARY');
      expect(mockVocabService.loadVocabulary).not.toHaveBeenCalled();
    });
  });

  // ─── Business-scope campaigns (business-audit market context path) ────

  describe('business-scope campaigns (market context via the business-audit path)', () => {
    const makeBusinessTemplate = () => ({
      body: 'Audit {{business_name}} in {{category}}',
      prompt_type: 'seek',
      scope: 'business',
    });

    const makeBusinessCampaign = () => ({
      id: 'camp-biz-1',
      scope: 'business',
      category: 'African Grocery Store',
      business_name: 'Test Business',
      city: 'Indianapolis',
      state: 'IN',
    });

    it('omits the market context block when enrichment data is empty', async () => {
      const { renderedPrompt } = await service.resolvePrompt({
        template: makeBusinessTemplate(),
        campaign: makeBusinessCampaign(),
        variables: undefined,
      });

      // Business audits read market context through MarketContextLoader
      // (buildMarketContextBlock) rather than the intelligence-scope formatters —
      // with no enrichment rows the loader returns empty and no block is emitted.
      expect(mockMarketContextLoader.loadMarketContext).toHaveBeenCalled();
      expect(renderedPrompt).not.toContain('MARKET CONTEXT');
    });

    it('injects category + city blocks, including city_profile, when enrichment exists', async () => {
      mockMarketContextLoader.loadMarketContext.mockImplementationOnce(async () => ({
        category: { category_summary: 'Category market summary.', market_density: 'moderate' },
        location: {
          market_summary: 'City market summary.',
          city_profile: { metro_description: 'Midwest metro' },
        },
      }));
      mockMarketContextLoader.hasCategoryIntelligence.mockReturnValueOnce(true);
      mockMarketContextLoader.hasLocationIntelligence.mockReturnValueOnce(true);

      const { renderedPrompt } = await service.resolvePrompt({
        template: makeBusinessTemplate(),
        campaign: makeBusinessCampaign(),
        variables: undefined,
      });

      expect(renderedPrompt).toContain('=== CATEGORY MARKET CONTEXT ===');
      expect(renderedPrompt).toContain('Category market summary.');
      expect(renderedPrompt).toContain('Market density: moderate');
      expect(renderedPrompt).toContain('=== CITY MARKET CONTEXT ===');
      expect(renderedPrompt).toContain('City market summary.');
      // The Market Context binding documents city_profile — it must actually render.
      expect(renderedPrompt).toContain('City profile (structural):');
      expect(renderedPrompt).toContain('Midwest metro');
    });
  });
});
