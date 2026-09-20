import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockCampaigns, mockDeliverables, mockSections, mockPromptService } = vi.hoisted(() => ({
  mockCampaigns: { findUnique: vi.fn(), update: vi.fn() },
  mockDeliverables: { findFirst: vi.fn(), create: vi.fn() },
  mockSections: { createMany: vi.fn() },
  mockPromptService: {
    getTemplate: vi.fn(),
    createExecution: vi.fn(),
    updateExecution: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_deliverables_list: mockDeliverables,
    mkt_deliverable_section: mockSections,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../MarketingPromptService', () => ({
  MarketingPromptService: { getInstance: () => mockPromptService },
}));

vi.mock('../MarketingExecutionService', () => ({
  MarketingExecutionService: { getInstance: () => ({}) },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {},
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({
      resolveSignalWeightMapForCampaign: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock('../ai-providers', () => ({ default: {} }));

vi.mock('../../lib/id-generator', () => ({
  generateDeliverableId: () => 'md-pkg-001',
  generateDeliverableSectionId: () => 'mds-001',
}));

import ProfileRepairPromptService, {
  PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID,
} from '../ProfileRepairPromptService';

// ====================
// FIXTURES
// ====================

const fulfillTemplate = {
  id: PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID,
  prompt_type: 'fulfill',
  output_schema: null,
};

const campaign = {
  id: 'mcamp-track-a',
  business_name: 'Joe\'s Plumbing',
  category: 'plumber',
  city: 'Austin',
  repair_fulfillment: { tier: 'standard', mode: 'dfy', platforms: ['google', 'yelp'] },
  mkt_audits_list: [],
  mkt_dispute_intake: [],
};

const fulfillOutput = JSON.stringify({
  deliverableText: '## Fix Sheets\nGoogle: correct the phone number.',
  submissionGuide: 'Submit changes at each platform dashboard.',
});

// W6a — fulfill import → citation_repair_package deliverable (drafted,
// JSON mime, two sections, idempotent, no stage transition).

describe('importExternalResult — fulfill → citation_repair_package (W6a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPromptService.getTemplate.mockResolvedValue(fulfillTemplate);
    mockPromptService.createExecution.mockResolvedValue({ id: 'exec-fulfill-1' });
    mockPromptService.updateExecution.mockResolvedValue({});
    mockCampaigns.findUnique.mockResolvedValue(campaign);
  });

  it('creates a drafted deliverable with deliverable_text + submission_guide sections', async () => {
    mockDeliverables.findFirst.mockResolvedValue(null);
    mockDeliverables.create.mockResolvedValue({ id: 'md-pkg-001' });
    mockSections.createMany.mockResolvedValue({ count: 2 });

    const result = await ProfileRepairPromptService.importExternalResult(
      'mcamp-track-a',
      PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID,
      fulfillOutput,
    );

    expect(result.passed).toBe(true);
    expect(result.deliverableId).toBe('md-pkg-001');

    expect(mockDeliverables.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deliverable_type: 'citation_repair_package',
        status: 'drafted',
        mime_type: 'application/json',
        execution_id: 'exec-fulfill-1',
      }),
    });

    const sections = mockSections.createMany.mock.calls[0][0].data;
    expect(sections).toHaveLength(2);
    expect(sections[0].section_type).toBe('deliverable_text');
    expect(sections[0].content).toContain('Fix Sheets');
    expect(sections[1].section_type).toBe('submission_guide');
    expect(sections[1].content).toContain('platform dashboard');
  });

  it('is idempotent — an existing non-preview package is reused, not duplicated', async () => {
    mockDeliverables.findFirst.mockResolvedValue({ id: 'md-existing-9' });

    const result = await ProfileRepairPromptService.importExternalResult(
      'mcamp-track-a',
      PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID,
      fulfillOutput,
    );

    expect(result.passed).toBe(true);
    expect(result.deliverableId).toBe('md-existing-9');
    expect(mockDeliverables.create).not.toHaveBeenCalled();
    expect(mockSections.createMany).not.toHaveBeenCalled();
  });

  it('fails cleanly on non-JSON output (execution marked failed, no deliverable)', async () => {
    const result = await ProfileRepairPromptService.importExternalResult(
      'mcamp-track-a',
      PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID,
      'this is not json',
    );

    expect(result.passed).toBe(false);
    expect(result.errors?.[0]).toContain('not valid JSON');
    expect(mockPromptService.updateExecution).toHaveBeenCalledWith(
      'exec-fulfill-1',
      expect.objectContaining({ status: 'failed' }),
      undefined,
    );
    expect(mockDeliverables.create).not.toHaveBeenCalled();
  });
});
