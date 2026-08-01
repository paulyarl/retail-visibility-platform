import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const {
  mockExecutions,
  mockTemplates,
  mockCampaigns,
  mockDeliverables,
  mockSections,
  mockFilterFlags,
  mockStageHistory,
} = vi.hoisted(() => ({
  mockExecutions: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockTemplates: { findUnique: vi.fn() },
  mockCampaigns: { findUnique: vi.fn(), update: vi.fn() },
  mockDeliverables: { create: vi.fn() },
  mockSections: { createMany: vi.fn() },
  mockFilterFlags: { create: vi.fn() },
  mockStageHistory: { create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prompt_executions_list: mockExecutions,
    mkt_prompt_templates_list: mockTemplates,
    mkt_campaigns_list: mockCampaigns,
    mkt_deliverables_list: mockDeliverables,
    mkt_deliverable_section: mockSections,
    mkt_filter_flags_list: mockFilterFlags,
    mkt_stage_history_list: mockStageHistory,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generatePromptTemplateId: () => 'mpt-test',
  generatePromptExecutionId: () => 'mpe-test-001',
  generateFilterFlagId: () => 'mff-test-001',
  generateDeliverableId: () => 'mdel-test-001',
  generateDeliverableSectionId: () => 'mds-test-001',
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    recoveryAiProvider: undefined,
    recoveryAiModel: undefined,
  },
}));

// Mock MarketingPromptService (default export is an instance)
const mockPromptService = {
  createExecution: vi.fn(),
  getExecution: vi.fn(),
  updateExecution: vi.fn(),
};
vi.mock('../MarketingPromptService', () => ({
  default: mockPromptService,
}));

// Mock MarketingCampaignService (default export is an instance)
const mockCampaignService = {
  transitionStage: vi.fn(),
};
vi.mock('../MarketingCampaignService', () => ({
  default: mockCampaignService,
}));

// Mock AiProviderFactory
const mockAiResult = {
  content: '{"recovery_resolution": {"deliverableText": "This is a professionally drafted response to the complaint that acknowledges the issue and offers a fair resolution. We take all feedback seriously and appreciate the opportunity to make things right.", "submissionGuide": "1. Log into your Google Business Profile. 2. Navigate to Reviews. 3. Click Reply on the complaint. 4. Paste the response draft. 5. Click Post."}}',
  usage: { totalTokens: 450 },
};
const mockProvider = {
  generateChatCompletion: vi.fn().mockResolvedValue(mockAiResult),
  isAvailable: vi.fn().mockReturnValue(true),
};
vi.mock('../ai-providers/AiProviderFactory', () => ({
  AiProviderFactory: {
    getInstance: () => ({
      getChatConfig: vi.fn().mockResolvedValue({ provider: mockProvider, model: 'gpt-4o-mini' }),
      generateChatCompletion: vi.fn().mockResolvedValue(mockAiResult),
    }),
  },
  getChatConfig: vi.fn().mockResolvedValue({ provider: mockProvider, model: 'gpt-4o-mini' }),
}));

import RecoveryResolutionService from '../RecoveryResolutionService';

// ====================
// FIXTURES
// ====================

const mockCampaign = {
  id: 'mcamp-1',
  stage: 'intake_submitted',
  campaign_category: 'recovery_management',
  notes: 'Customer complained about late delivery and damaged product.',
  mkt_audits_list: [],
  mkt_dispute_intake: {
    id: 'mdint-1',
    owner_statement: 'The delivery was late due to a courier issue, not our fault.',
    proposed_resolution: 'Partial Refund',
    service_date: null,
    status_flag: null,
    mkt_dispute_attachments: [{ file_name: 'receipt.pdf', file_type: 'pdf' }],
  },
};

const mockExecution = {
  id: 'mpe-1',
  campaign_id: 'mcamp-1',
  template_id: 'mpt-recovery-resolution-default',
  status: 'pending',
  variables_used: {
    complaintText: 'Customer complained about late delivery.',
    intakePayload: '{"ownerStatement":"test"}',
    attachmentMeta: '[]',
  },
  mkt_prompt_templates_list: {
    id: 'mpt-recovery-resolution-default',
    body: 'Complaint: {{complaintText}}\nIntake: {{intakePayload}}\nAttachments: {{attachmentMeta}}',
    output_schema: { name: 'recovery_resolution' },
  },
};

// ====================
// TESTS
// ====================

describe('RecoveryResolutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
  });

  // ─── enqueue ────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('creates a pending prompt execution with interpolated variables', async () => {
      mockCampaigns.findUnique.mockResolvedValue(mockCampaign);
      mockPromptService.createExecution.mockResolvedValue({ id: 'mpe-new-001' });

      const result = await RecoveryResolutionService.enqueue('mcamp-1', 'mdint-1');

      expect(result.executionId).toBe('mpe-new-001');
      expect(result.campaignId).toBe('mcamp-1');
      expect(mockPromptService.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'mcamp-1',
          templateId: 'mpt-recovery-resolution-default',
          executedBy: 'recovery-agent',
        }),
        undefined,
      );
    });

    it('throws if campaign not found', async () => {
      mockCampaigns.findUnique.mockResolvedValue(null);

      await expect(RecoveryResolutionService.enqueue('nonexistent', 'mdint-1')).rejects.toThrow('not found');
    });
  });

  // ─── run (happy path) ───────────────────────────────────────────

  describe('run — happy path', () => {
    it('invokes AI, validates output, creates deliverable + sections, transitions stage', async () => {
      mockPromptService.getExecution.mockResolvedValue(mockExecution);
      mockPromptService.updateExecution.mockResolvedValue({});
      mockDeliverables.create.mockResolvedValue({ id: 'mdel-test-001' });
      mockSections.createMany.mockResolvedValue({ count: 2 });
      mockCampaignService.transitionStage.mockResolvedValue({ stage: 'final_resolution_drafted' });

      const result = await RecoveryResolutionService.run('mpe-1');

      expect(result.passed).toBe(true);
      expect(result.deliverableId).toBe('mdel-test-001');
      expect(result.stage).toBe('final_resolution_drafted');

      // Verify deliverable was created with recovery_resolution type
      expect(mockDeliverables.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliverable_type: 'recovery_resolution',
            status: 'drafted',
          }),
        }),
      );

      // Verify two sections were created
      expect(mockSections.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ section_type: 'response_draft' }),
            expect.objectContaining({ section_type: 'submission_guide' }),
          ]),
        }),
      );

      // Verify stage transition
      expect(mockCampaignService.transitionStage).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'mcamp-1',
          toStage: 'final_resolution_drafted',
          triggerType: 'system',
        }),
        undefined,
      );
    });

    it('skips non-pending executions (idempotent)', async () => {
      mockPromptService.getExecution.mockResolvedValue({
        ...mockExecution,
        status: 'completed',
      });

      const result = await RecoveryResolutionService.run('mpe-1');

      expect(result.passed).toBe(false);
      expect(result.deliverableId).toBe('');
      expect(mockDeliverables.create).not.toHaveBeenCalled();
    });
  });

  // ─── run (validation failure) ───────────────────────────────────

  describe('run — validation failure', () => {
    it('creates filter flags and leaves stage unchanged on invalid JSON', async () => {
      mockPromptService.getExecution.mockResolvedValue(mockExecution);
      mockPromptService.updateExecution.mockResolvedValue({});
      mockFilterFlags.create.mockResolvedValue({});

      // Override AI to return invalid JSON
      const { AiProviderFactory } = await import('../ai-providers/AiProviderFactory');
      AiProviderFactory.getInstance().generateChatCompletion.mockResolvedValueOnce({
        content: 'This is not JSON at all.',
        usage: { totalTokens: 100 },
      });

      const result = await RecoveryResolutionService.run('mpe-1');

      expect(result.passed).toBe(false);
      expect(result.stage).toBe('intake_submitted');
      expect(mockFilterFlags.create).toHaveBeenCalled();
      expect(mockDeliverables.create).not.toHaveBeenCalled();
      expect(mockCampaignService.transitionStage).not.toHaveBeenCalled();
    });

    it('creates filter flags on schema mismatch (missing fields)', async () => {
      mockPromptService.getExecution.mockResolvedValue(mockExecution);
      mockPromptService.updateExecution.mockResolvedValue({});
      mockFilterFlags.create.mockResolvedValue({});

      // Override AI to return JSON that doesn't match the schema
      const { AiProviderFactory } = await import('../ai-providers/AiProviderFactory');
      AiProviderFactory.getInstance().generateChatCompletion.mockResolvedValueOnce({
        content: '{"recovery_resolution": {"deliverableText": "too short"}}',
        usage: { totalTokens: 100 },
      });

      const result = await RecoveryResolutionService.run('mpe-1');

      expect(result.passed).toBe(false);
      expect(result.stage).toBe('intake_submitted');
      expect(mockFilterFlags.create).toHaveBeenCalled();
      expect(mockDeliverables.create).not.toHaveBeenCalled();
    });
  });

  // ─── run (execution not found) ──────────────────────────────────

  describe('run — error cases', () => {
    it('throws if execution not found', async () => {
      mockPromptService.getExecution.mockResolvedValue(null);

      await expect(RecoveryResolutionService.run('nonexistent')).rejects.toThrow('not found');
    });
  });
});
