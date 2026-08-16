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
const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async (_category: string, _focus?: string) => null),
    renderBusinessProfileBlock: vi.fn((profile: any) => `\nPROFILE_BLOCK:${profile.id}:v${profile.version}`),
  };
  const mockPromptService = {
    getTemplate: vi.fn(),
    createExecution: vi.fn(),
    updateExecution: vi.fn(),
  };
  const mockCampaignService = { getCampaign: vi.fn() };
  const mockAiProvider = { generateChatCompletion: vi.fn() };
  const mockHotProspectService = { syncFromExecution: vi.fn() };
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService };
});

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => mockProfileService,
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
    // Reset default behavior: resolve returns null
    mockProfileService.resolve.mockImplementation(async () => null);
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
    expect(mockProfileService.resolve).toHaveBeenCalledWith('  Auto Repair  ', undefined, 'Test City', undefined);
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
});
