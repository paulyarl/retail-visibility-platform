import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockSlots,
  mockSections,
  mockCampaigns,
  mockVoiceProfile,
  mockPromptExecutions,
  mockAudits,
  execMock,
} = vi.hoisted(() => ({
  mockSlots: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mockSections: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mockCampaigns: { findUnique: vi.fn() },
  mockVoiceProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  mockPromptExecutions: { findFirst: vi.fn() },
  mockAudits: { findFirst: vi.fn().mockResolvedValue(null) },
  execMock: { executeSingle: vi.fn(), renderPrompt: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_deliverable_review_slot: mockSlots,
    mkt_deliverable_section: mockSections,
    mkt_campaigns_list: mockCampaigns,
    mkt_owner_voice_profile: mockVoiceProfile,
    mkt_prompt_executions_list: mockPromptExecutions,
    mkt_audits_list: mockAudits,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDeliverableReviewSlotId: () => 'mdrs-test-001',
  generateDeliverableSectionId: () => 'mds-test-001',
  generateOwnerVoiceProfileId: () => 'movp-test-001',
}));

vi.mock('../MarketingExecutionService', () => ({
  MarketingExecutionService: { getInstance: () => execMock },
}));

vi.mock('../../middleware/errorHandler', () => ({
  HttpError: class HttpError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
}));

import { ReviewSlotService } from '../deliverable/ReviewSlotService';
import { OwnerVoiceService } from '../deliverable/OwnerVoiceService';
import { DeliverableSectionService } from '../deliverable/DeliverableSectionService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const campaignWithAudit = (overrides: Partial<any> = {}) => ({
  id: 'mcamp-1',
  business_name: 'Test Auto Repair',
  category: 'auto_repair',
  city: 'Austin',
  state: 'TX',
  tone: 'short informal',
  phone: '555-123-4567',
  website_url: 'https://example.com',
  mkt_audits_list: [
    {
      id: 'audit-1',
      platform: 'business_analysis',
      created_at: new Date('2024-01-15'),
      audit_data: {
        platforms: {
          google: {
            reviews: [
              { text: 'Diagnostic fee was ridiculous', rating: 1, date: '2024-02-10', owner_response: 'We are so sorry this happened. We fixed it. Please come back.' },
              { text: 'Great service, fair price', rating: 5, date: '2024-01-20', owner_response: 'Thank you so much for the kind words. We appreciate you.' },
              { text: 'Took too long', rating: 2, date: '2024-01-15', owner_response: 'We appreciate the feedback and have sped up our intake process.' },
            ],
          },
        },
        negative_review_themes: [
          { theme: 'pricing', summary: 'Customers feel fees are too high', supporting_review_count: 3 },
        ],
        website: {},
      },
    },
  ],
  ...overrides,
});

const baseSlot = (overrides: Partial<any> = {}) => ({
  id: 'mdrs-1',
  campaign_id: 'mcamp-1',
  platform: 'google',
  review_text: 'Diagnostic fee was ridiculous',
  review_rating: 1,
  review_date: new Date('2024-02-10'),
  review_author: 'Jennifer',
  status: 'draft',
  slot_index: 0,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Deliverable construction — external lanes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execMock.renderPrompt.mockResolvedValue('RENDERED PROMPT');
    mockAudits.findFirst.mockResolvedValue(null);
  });

  // ─── Owner voice: apply imported execution ────────────────────────────

  describe('OwnerVoiceService.applyVoiceExecution', () => {
    it('persists the profile from the latest completed (imported) execution', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockPromptExecutions.findFirst.mockResolvedValue({
        id: 'mpe-ext-1',
        source: 'external',
        status: 'completed',
        filtered_output: null,
        raw_output: JSON.stringify({
          person: 'we', formality: 'formal', humor: 'none',
          apology_style: 'direct_apology', signoff_style: 'team', signature: '- The Team',
        }),
      });
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockVoiceProfile.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await OwnerVoiceService.getInstance().applyVoiceExecution('mcamp-1');

      expect(result.person).toBe('we');
      expect(result.formality).toBe('formal');
      expect(result.signature).toBe('- The Team');
      expect(result.inferredFromCount).toBe(3);
      expect(mockVoiceProfile.create).toHaveBeenCalledOnce();
    });

    it('preserves operator overrides when applying an execution', async () => {
      const existing = {
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'third_person', // operator-overridden
        formality: 'casual', humor: 'none',
        apology_style: 'fix_first', signoff_style: 'first_name', signature: null,
        operator_overrides: { person: true },
      };
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockPromptExecutions.findFirst.mockResolvedValue({
        id: 'mpe-ext-1',
        status: 'completed',
        filtered_output: '{"person":"first_person","formality":"casual","humor":"none","apology_style":"fix_first","signoff_style":"first_name","signature":"- Sarah"}',
        raw_output: null,
      });
      mockVoiceProfile.findUnique.mockResolvedValue(existing);
      mockVoiceProfile.update.mockImplementation(({ data }: any) => Promise.resolve({ ...existing, ...data }));

      await OwnerVoiceService.getInstance().applyVoiceExecution('mcamp-1');

      const updateCall = mockVoiceProfile.update.mock.calls[0][0];
      expect(updateCall.data.person).toBe('third_person'); // override preserved
    });

    it('throws when no completed inference execution exists', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockPromptExecutions.findFirst.mockResolvedValue(null);

      await expect(OwnerVoiceService.getInstance().applyVoiceExecution('mcamp-1'))
        .rejects.toThrow(/No completed voice-inference execution/i);
    });
  });

  // ─── Review slots: render-prompt for external draft ───────────────────

  describe('ReviewSlotService.renderSlotPrompt', () => {
    it('renders the slot draft prompt with slot + voice variables', async () => {
      mockSlots.findUnique.mockResolvedValue(baseSlot());
      mockVoiceProfile.findUnique.mockResolvedValue({
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'we', formality: 'formal', humor: 'none',
        apology_style: 'direct_apology', signoff_style: 'team', signature: '- The Team',
      });
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());

      const result = await ReviewSlotService.getInstance().renderSlotPrompt('mdrs-1');

      expect(result).toBe('RENDERED PROMPT');
      const call = execMock.renderPrompt.mock.calls[0][0];
      expect(call.templateId).toBe('mpt-review-response-draft');
      expect(call.campaignId).toBe('mcamp-1');
      expect(call.variables.review_text).toBe('Diagnostic fee was ridiculous');
      expect(call.variables.review_rating).toBe('1');
      expect(call.variables.voice_person).toBe('we');
      expect(call.variables.voice_signature).toBe('- The Team');
    });

    it('throws when the slot has no review text', async () => {
      mockSlots.findUnique.mockResolvedValue(baseSlot({ review_text: null }));

      await expect(ReviewSlotService.getInstance().renderSlotPrompt('mdrs-1'))
        .rejects.toThrow(/no review text/i);
    });
  });

  // ─── Sections: render-prompt for external draft ───────────────────────

  describe('DeliverableSectionService.renderSectionPrompt', () => {
    it('renders the recovery playbook prompt with theme-cluster variables', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockVoiceProfile.findUnique.mockResolvedValue(null);

      const result = await DeliverableSectionService.getInstance()
        .renderSectionPrompt('mcamp-1', 'recovery_playbook');

      expect(result).toBe('RENDERED PROMPT');
      const call = execMock.renderPrompt.mock.calls[0][0];
      expect(call.templateId).toBe('mpt-deliverable-section-recovery-playbook');
      expect(call.variables.theme_clusters).toContain('pricing');
      expect(call.variables.business_name).toBe('Test Auto Repair');
      expect(call.variables.voice_person).toBe('first_person'); // default when no profile
    });
  });
});
