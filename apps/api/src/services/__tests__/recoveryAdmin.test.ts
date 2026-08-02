import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const {
  mockCampaigns,
  mockDeliverables,
  mockSections,
  mockIntakes,
} = vi.hoisted(() => ({
  mockCampaigns: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  mockDeliverables: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  mockSections: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), createMany: vi.fn() },
  mockIntakes: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
    mkt_deliverables_list: mockDeliverables,
    mkt_deliverable_section: mockSections,
    mkt_dispute_intake: mockIntakes,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDeliverableId: () => 'mdel-test-001',
  generateDeliverableSectionId: () => 'mds-test-001',
  generateFilterFlagId: () => 'mff-test-001',
  generatePromptExecutionId: () => 'mpe-test-001',
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    recoveryAiProvider: undefined,
    recoveryAiModel: undefined,
    webBaseUrl: 'http://localhost:3000',
  },
}));

// Mock MarketingPromptService
const mockPromptService = {
  createExecution: vi.fn(),
  getExecution: vi.fn(),
  updateExecution: vi.fn(),
};
vi.mock('../MarketingPromptService', () => ({
  default: mockPromptService,
}));

// Mock MarketingCampaignService
const mockCampaignService = {
  transitionStage: vi.fn(),
};
vi.mock('../MarketingCampaignService', () => ({
  default: mockCampaignService,
}));

// Mock MarketingOutreachService
const mockOutreachService = {
  logContact: vi.fn().mockResolvedValue({}),
  getInstance: () => mockOutreachService,
};
vi.mock('../MarketingOutreachService', () => ({
  MarketingOutreachService: { getInstance: () => mockOutreachService },
}));

// Mock AiProviderFactory (default export is the singleton instance)
const mockAiResult = {
  content: '{"recovery_resolution": {"deliverableText": "This is a professionally drafted response to the complaint that acknowledges the issue and offers a fair resolution. We take all feedback seriously.", "submissionGuide": "1. Log into your Google Business Profile. 2. Navigate to Reviews. 3. Click Reply. 4. Paste the response. 5. Click Post."}}',
  usage: { totalTokens: 450 },
};
const mockProvider = {
  generateChatCompletion: vi.fn().mockResolvedValue(mockAiResult),
  isAvailable: vi.fn().mockReturnValue(true),
};
vi.mock('../ai-providers/AiProviderFactory', () => ({
  default: {
    getChatConfig: vi.fn().mockResolvedValue({ provider: mockProvider, model: 'gpt-4o-mini' }),
    generateChatCompletion: vi.fn().mockResolvedValue(mockAiResult),
  },
}));

import RecoveryResolutionService from '../RecoveryResolutionService';

// ====================
// FIXTURES
// ====================

const mockDeliverable = {
  id: 'mdel-1',
  campaign_id: 'mcamp-1',
  deliverable_type: 'recovery_resolution',
  status: 'drafted',
  generated_at: new Date(),
};

const mockCampaign = {
  id: 'mcamp-1',
  business_name: 'Test Business',
  stage: 'final_resolution_drafted',
  campaign_category: 'recovery_management',
  email: 'owner@test.com',
};

const mockIntake = {
  id: 'mdint-1',
  campaign_id: 'mcamp-1',
  owner_statement: 'The delivery was late.',
  proposed_resolution: 'Partial refund',
  service_date: null,
  status_flag: null,
  mkt_dispute_attachments: [],
};

// ====================
// TESTS
// ====================

describe('RecoveryResolutionService — admin operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── approveDraft ──────────────────────────────────────────────

  describe('approveDraft', () => {
    it('approves draft, transitions to resolved_and_closed, delivers to owner', async () => {
      mockDeliverables.findFirst.mockResolvedValue(mockDeliverable);
      mockDeliverables.update.mockResolvedValue({});
      mockCampaigns.findUnique.mockResolvedValue(mockCampaign);
      mockSections.findMany.mockResolvedValue([
        { section_type: 'response_draft', content: 'Draft response text' },
        { section_type: 'submission_guide', content: 'Submission guide text' },
      ]);
      mockCampaignService.transitionStage
        .mockResolvedValueOnce({ stage: 'owner_approved' })
        .mockResolvedValueOnce({ stage: 'resolved_and_closed' });

      const result = await RecoveryResolutionService.approveDraft('mcamp-1');

      expect(result.campaignId).toBe('mcamp-1');
      expect(result.stage).toBe('resolved_and_closed');
      expect(result.deliverableId).toBe('mdel-1');

      // Verify deliverable marked as approved
      expect(mockDeliverables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mdel-1' },
          data: { status: 'approved' },
        }),
      );

      // Verify two-step transition
      expect(mockCampaignService.transitionStage).toHaveBeenCalledTimes(2);
      expect(mockCampaignService.transitionStage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ toStage: 'owner_approved', triggerType: 'manual' }),
        undefined,
      );
      expect(mockCampaignService.transitionStage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ toStage: 'resolved_and_closed', triggerType: 'manual' }),
        undefined,
      );

      // Verify owner delivery (logContact called)
      expect(mockOutreachService.logContact).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'mcamp-1',
          contactChannel: 'email',
        }),
        undefined,
      );
    });

    it('throws if no drafted deliverable found', async () => {
      mockDeliverables.findFirst.mockResolvedValue(null);

      await expect(RecoveryResolutionService.approveDraft('mcamp-1')).rejects.toThrow('No drafted recovery resolution');
    });
  });

  // ─── regenerate ────────────────────────────────────────────────

  describe('regenerate', () => {
    it('archives existing deliverable and enqueues a new execution', async () => {
      mockDeliverables.findFirst.mockResolvedValue(mockDeliverable);
      mockDeliverables.update.mockResolvedValue({});
      mockIntakes.findUnique.mockResolvedValue(mockIntake);
      mockCampaigns.findUnique.mockResolvedValue({
        ...mockCampaign,
        mkt_audits_list: [],
        mkt_dispute_intake: mockIntake,
      });
      mockPromptService.createExecution.mockResolvedValue({ id: 'mpe-new-002' });

      const result = await RecoveryResolutionService.regenerate('mcamp-1');

      expect(result.executionId).toBe('mpe-new-002');
      expect(result.campaignId).toBe('mcamp-1');

      // Verify old deliverable archived
      expect(mockDeliverables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mdel-1' },
          data: { status: 'archived' },
        }),
      );
    });

    it('throws if no intake found', async () => {
      mockDeliverables.findFirst.mockResolvedValue(null);
      mockIntakes.findUnique.mockResolvedValue(null);

      await expect(RecoveryResolutionService.regenerate('mcamp-1')).rejects.toThrow('not found');
    });
  });
});
