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
const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async (_category: string, _focus?: string) => null),
    resolveGoldStandard: vi.fn(async (_category: string, _platform?: string | null) => null),
    serializeGoldStandard: vi.fn((_profile: any, _role: string) => ''),
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
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService };
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

import { MarketingExecutionService } from '../MarketingExecutionService';

describe('MarketingExecutionService.resolvePrompt (§1B profile amplification)', () => {
  let service: MarketingExecutionService;

  beforeEach(() => {
    service = MarketingExecutionService.getInstance();
    vi.clearAllMocks();
    // Reset default behavior: resolve returns null, resolveGoldStandard returns null
    mockProfileService.resolve.mockImplementation(async () => null);
    mockProfileService.resolveGoldStandard.mockImplementation(async () => null);
    mockProfileService.serializeGoldStandard.mockImplementation(() => '');
    // Reset composer to a default composed body
    mockComposerService.composeIntelligencePrompt.mockImplementation(async (input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: input.focus,
    }));
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
    mockProfileService.resolve.mockResolvedValueOnce({
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
    mockProfileService.resolve.mockResolvedValueOnce(null);

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
    mockProfileService.resolve.mockResolvedValueOnce(null);

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
    mockProfileService.resolve.mockResolvedValueOnce({
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
    // Business-scope §1B path calls resolve with no focus (category-only
    // match). Migration 205 — the campaign's city is now passed as the 3rd
    // arg so business audits resolve a city-scoped profile.
    expect(mockProfileService.resolve).toHaveBeenCalledWith('  Auto Repair  ', undefined, 'Test City', undefined, undefined);
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
      expect(mockProfileService.resolve).not.toHaveBeenCalled();
    });

    it('signal_triage + populated audit_signals + active profile → appends category block with framing directive', async () => {
      mockProfileService.resolve.mockResolvedValueOnce({
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

    it('signal_triage + populated audit_signals + no active profile → base render only', async () => {
      mockProfileService.resolve.mockResolvedValueOnce(null);

      const template = makeRepairTemplate();
      const campaign = makeCampaign('business', 'Unknown Niche');

      const { renderedPrompt, resolution } = await service.resolvePrompt({
        template,
        campaign,
        variables: { audit_signals: 'suspension' },
      });

      expect(renderedPrompt).not.toContain('PROFILE_BLOCK');
      expect(renderedPrompt).not.toContain('CATEGORY INTELLIGENCE (SUPPLEMENTARY');
      expect(resolution.intelligence_mode).toBe('none');
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
});
