/**
 * Unit tests for the Verified Evidence block (Identity ledger → audit prompt).
 *
 * The Identity tab's mkt_identity_evidence rows are operator/owner-captured
 * ground truth. renderVerifiedEvidenceBlock injects them into the business
 * audit prompt so the analyst can weigh verified facts against scan-claimed
 * leads and platform data.
 *
 * Tests the renderVerifiedEvidenceBlock method on MarketingExecutionService:
 *   - Block renders evidence rows (state, source, corroborated fields, date,
 *     notes, owner-contact + sibling markers); absent (byte-identical render)
 *     when the ledger is empty; cap boundary: 9 rows → 8 + "+1 more".
 *   - Ledger read failure is non-fatal (byte-identical render).
 *   - resolution.verified_evidence_injected stamps the render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockCatalogService, mockGeographyGridService, mockEvidenceService } = vi.hoisted(() => {
  const mockProfileService = {
    resolve: vi.fn(async () => null),
    resolveCategoryIntelligence: vi.fn(async () => null),
    resolveGoldStandard: vi.fn(async () => null),
    serializeGoldStandard: vi.fn(() => ''),
    resolveBronzeStandard: vi.fn(async () => null),
    serializeBronzeStandard: vi.fn(async () => ''),
    serializeSignalWeightContext: vi.fn(() => ''),
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
    composeIntelligencePrompt: vi.fn(async (input: any) => ({
      body: 'COMPOSED_BODY',
      resolution: { profile_id: null, profile_version: null, intelligence_mode: 'none' as const },
      focus: input.focus,
    })),
  };
  const mockMarketContextLoader = {
    loadMarketContext: vi.fn(async () => ({ category: {}, location: {} })),
    hasCategoryIntelligence: vi.fn(() => false),
    hasLocationIntelligence: vi.fn(() => false),
  };
  const mockCatalogService = {
    applicableReasons: vi.fn(async () => []),
    currentRevision: vi.fn(async () => 1),
    serializeCatalogBlock: vi.fn(() => ''),
  };
  const mockGeographyGridService = {
    getGrid: vi.fn(async () => null),
    upsertGrid: vi.fn(async () => undefined),
  };
  const mockEvidenceService = {
    listForCampaign: vi.fn(async () => []),
  };
  return { mockProfileService, mockPromptService, mockCampaignService, mockAiProvider, mockHotProspectService, mockComposerService, mockMarketContextLoader, mockCatalogService, mockGeographyGridService, mockEvidenceService };
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

vi.mock('../IdentityEvidenceService', () => ({
  default: mockEvidenceService,
}));

import { MarketingExecutionService } from '../MarketingExecutionService';

const makeRow = (over: Record<string, any> = {}) => ({
  id: 'idev-1',
  campaignId: 'camp-1',
  businessProspectId: null,
  sourceName: 'Owner phone call',
  sourceUrl: null,
  tier: 'first_party',
  independenceGroup: 'manual',
  evidenceState: 'owner_confirmed',
  corroborates: ['name', 'address', 'phone'],
  ownerName: null,
  ownerPhone: null,
  ownerEmail: null,
  accessedAt: '2026-09-22',
  notes: 'Campaign verification — outcome: reached',
  createdBy: 'op-1',
  createdAt: '2026-09-22T14:00:00Z',
  shared: false,
  ...over,
});

describe('Verified Evidence block (Identity ledger → audit prompt)', () => {
  let service: MarketingExecutionService;

  beforeEach(() => {
    service = MarketingExecutionService.getInstance();
    vi.clearAllMocks();
    mockProfileService.resolve.mockImplementation(async () => null);
    mockProfileService.resolveCategoryIntelligence.mockImplementation(async () => null);
    mockProfileService.resolveGoldStandard.mockImplementation(async () => null);
    mockProfileService.serializeGoldStandard.mockImplementation(() => '');
    mockProfileService.resolveBronzeStandard.mockImplementation(async () => null);
    mockProfileService.serializeBronzeStandard.mockImplementation(async () => '');
    mockMarketContextLoader.loadMarketContext.mockImplementation(async () => ({ category: {}, location: {} }));
    mockCatalogService.serializeCatalogBlock.mockImplementation(() => '');
    mockGeographyGridService.getGrid.mockImplementation(async () => null);
    mockEvidenceService.listForCampaign.mockImplementation(async () => []);
  });

  const makeTemplate = (promptType: string, category = '', body = 'Hello {{business_name}} in {{category}}') => ({
    body,
    prompt_type: promptType,
    scope: 'business',
    category,
  });

  const makeCampaign = (overrides: Record<string, any> = {}) => ({
    id: 'camp-1',
    scope: 'business',
    category: 'Auto Repair',
    business_name: 'Test Business',
    city: 'Test City',
    state: 'TS',
    ...overrides,
  });

  it('renders the ledger rows with state, fields, date, and notes', async () => {
    mockEvidenceService.listForCampaign.mockImplementation(async () => [
      makeRow(),
      makeRow({
        id: 'idev-2',
        sourceName: 'Yelp listing',
        sourceUrl: 'https://yelp.com/biz/test',
        evidenceState: 'conflicting',
        corroborates: ['phone'],
        accessedAt: '2026-09-20',
        notes: 'shows old address',
        ownerName: 'Maria Daree',
      }),
    ]);

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template: makeTemplate('seek'),
      campaign: makeCampaign(),
      variables: undefined,
    });

    expect(renderedPrompt).toContain('=== VERIFIED EVIDENCE — OPERATOR / OWNER ===');
    expect(renderedPrompt).toContain('owner_confirmed / owner_corrected facts are the strongest evidence');
    expect(renderedPrompt).toContain('- [owner_confirmed] Owner phone call corroborates name, address, phone (2026-09-22)');
    expect(renderedPrompt).toContain('Campaign verification — outcome: reached');
    expect(renderedPrompt).toContain('- [conflicting] Yelp listing corroborates phone (2026-09-20) https://yelp.com/biz/test · owner contact captured — shows old address');
    expect(resolution.verified_evidence_injected).toBe(true);
  });

  it('empty ledger → byte-identical render (no block)', async () => {
    const template = makeTemplate('seek');
    const campaign = makeCampaign();

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(renderedPrompt).not.toContain('VERIFIED EVIDENCE');
    expect(resolution.verified_evidence_injected).toBe(false);
  });

  it('caps at 8 rows and reports the remainder', async () => {
    mockEvidenceService.listForCampaign.mockImplementation(async () =>
      Array.from({ length: 9 }, (_, i) => makeRow({ id: `idev-${i}`, sourceName: `Source ${i}` })),
    );

    const { renderedPrompt } = await service.resolvePrompt({
      template: makeTemplate('seek'),
      campaign: makeCampaign(),
      variables: undefined,
    });

    expect(renderedPrompt).toContain('Source 7');
    expect(renderedPrompt).not.toContain('Source 8');
    expect(renderedPrompt).toContain('… +1 more');
  });

  it('marks shared sibling rows', async () => {
    mockEvidenceService.listForCampaign.mockImplementation(async () => [
      makeRow({ campaignId: 'camp-sibling', shared: true }),
    ]);

    const { renderedPrompt } = await service.resolvePrompt({
      template: makeTemplate('seek'),
      campaign: makeCampaign(),
      variables: undefined,
    });

    expect(renderedPrompt).toContain('shared from sibling campaign');
  });

  it('ledger read failure → non-fatal, byte-identical render', async () => {
    mockEvidenceService.listForCampaign.mockImplementation(async () => {
      throw new Error('db down');
    });

    const template = makeTemplate('seek');
    const campaign = makeCampaign();

    const { renderedPrompt, resolution } = await service.resolvePrompt({
      template,
      campaign,
      variables: undefined,
    });

    const baseRendered = service.renderTemplate(template.body, undefined, campaign);
    expect(renderedPrompt).toBe(baseRendered);
    expect(resolution.verified_evidence_injected).toBe(false);
  });
});
