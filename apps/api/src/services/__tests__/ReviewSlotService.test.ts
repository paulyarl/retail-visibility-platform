import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockSlots,
  mockCampaigns,
  mockVoiceProfile,
  aiMock,
} = vi.hoisted(() => ({
  mockSlots: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mockCampaigns: { findUnique: vi.fn() },
  mockVoiceProfile: { findUnique: vi.fn() },
  aiMock: { generateChatCompletion: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_deliverable_review_slot: mockSlots,
    mkt_campaigns_list: mockCampaigns,
    mkt_owner_voice_profile: mockVoiceProfile,
    mkt_audits_list: {},
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDeliverableReviewSlotId: () => 'mdrs-test-001',
}));

vi.mock('../ai-providers', () => ({
  default: aiMock,
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

import { ReviewSlotService } from '../deliverable/ReviewSlotService';

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
              { text: 'Diagnostic fee was ridiculous', rating: 1, date: '2024-02-10', author: 'Jennifer', owner_response: null },
              { text: 'Great service, fair price', rating: 5, date: '2024-01-20', author: 'Mike', owner_response: null },
              { text: 'Took too long', rating: 2, date: '2024-01-15', author: 'Bob', owner_response: null },
            ],
          },
          yelp: {
            reviews: [
              { text: 'Would not recommend', rating: 1, date: '2024-01-10', author: 'Sue', owner_response: null },
            ],
          },
        },
        negative_review_themes: [
          { theme: 'pricing', summary: 'Customers feel diagnostic fee is too high', supporting_review_count: 3 },
        ],
        unanswered_negative_review_examples: [],
      },
    },
  ],
  ...overrides,
});

const baseSlot = (overrides: Partial<any> = {}) => ({
  id: 'mdrs-1',
  deliverable_id: null,
  campaign_id: 'mcamp-1',
  platform: 'google',
  review_text: 'Diagnostic fee was ridiculous',
  review_rating: 1,
  review_date: new Date('2024-02-10'),
  review_author: 'Jennifer',
  sentiment: 'negative',
  theme: null,
  is_negative_first: true,
  response_text: null,
  response_source: null,
  response_ai_provider: null,
  response_ai_model: null,
  response_tokens_used: 0,
  quality_gate_passed: null,
  quality_gate_issues: [],
  status: 'draft',
  slot_index: 0,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('ReviewSlotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMock.generateChatCompletion.mockResolvedValue({
      content: 'Hi Jennifer — you\'re right, the trip fee should have been clearer. We\'ve updated our intake process. — Sarah',
      model: 'gpt-4-test',
      usage: { totalTokens: 85 },
    });
  });

  // ─── ingestReviews ─────────────────────────────────────────────────────

  describe('ingestReviews', () => {
    it('returns existing slots if already ingested (idempotent)', async () => {
      mockSlots.findMany.mockResolvedValue([baseSlot()]);
      const result = await ReviewSlotService.getInstance().ingestReviews('mcamp-1');
      expect(result.ingested).toBe(0);
      expect(result.slots).toHaveLength(1);
      expect(mockSlots.create).not.toHaveBeenCalled();
    });

    it('ingests all unanswered reviews from audit data', async () => {
      mockSlots.findMany.mockResolvedValue([]); // no existing slots
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await ReviewSlotService.getInstance().ingestReviews('mcamp-1');

      expect(result.ingested).toBe(4); // 3 google + 1 yelp
      expect(mockSlots.create).toHaveBeenCalledTimes(4);
    });

    it('sorts slots with negative-first (1-star) first', async () => {
      mockSlots.findMany.mockResolvedValue([]);
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await ReviewSlotService.getInstance().ingestReviews('mcamp-1');

      // First slot should be the 1-star review
      expect(result.slots[0].reviewRating).toBe(1);
      expect(result.slots[0].isNegativeFirst).toBe(true);
    });

    it('throws when no audit exists', async () => {
      mockSlots.findMany.mockResolvedValue([]);
      mockCampaigns.findUnique.mockResolvedValue({ id: 'mcamp-1', mkt_audits_list: [] });

      await expect(ReviewSlotService.getInstance().ingestReviews('mcamp-1'))
        .rejects.toThrow(/No business_analysis audit/i);
    });

    it('throws when no unanswered reviews found', async () => {
      mockSlots.findMany.mockResolvedValue([]);
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit({
        mkt_audits_list: [{
          id: 'audit-1',
          platform: 'business_analysis',
          created_at: new Date(),
          audit_data: { platforms: { google: { reviews: [] } } },
        }],
      }));

      await expect(ReviewSlotService.getInstance().ingestReviews('mcamp-1'))
        .rejects.toThrow(/No unanswered reviews/i);
    });
  });

  // ─── listSlots ─────────────────────────────────────────────────────────

  describe('listSlots', () => {
    it('returns slots sorted by slot_index', async () => {
      mockSlots.findMany.mockResolvedValue([baseSlot({ slot_index: 0 }), baseSlot({ id: 'mdrs-2', slot_index: 1 })]);
      const result = await ReviewSlotService.getInstance().listSlots('mcamp-1');
      expect(result).toHaveLength(2);
      expect(result[0].slotIndex).toBe(0);
    });
  });

  // ─── generateAllResponses ──────────────────────────────────────────────

  describe('generateAllResponses', () => {
    it('generates responses for all draft slots', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue(null); // no voice profile — uses defaults
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.findMany.mockResolvedValue([
        baseSlot({ id: 'mdrs-1', slot_index: 0 }),
        baseSlot({ id: 'mdrs-2', slot_index: 1, review_text: 'Great service', review_rating: 5 }),
      ]);
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      const result = await ReviewSlotService.getInstance().generateAllResponses('mcamp-1');

      expect(result.generated).toBe(2);
      expect(aiMock.generateChatCompletion).toHaveBeenCalledTimes(2);
      expect(mockSlots.update).toHaveBeenCalledTimes(2);
    });

    it('returns 0 generated when no draft slots exist', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.findMany.mockResolvedValue([]);

      const result = await ReviewSlotService.getInstance().generateAllResponses('mcamp-1');
      expect(result.generated).toBe(0);
      expect(aiMock.generateChatCompletion).not.toHaveBeenCalled();
    });

    it('uses owner voice profile when available', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue({
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'we', formality: 'formal', humor: 'none',
        apology_style: 'direct_apology', signoff_style: 'team', signature: '- The Team',
      });
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.findMany.mockResolvedValue([baseSlot()]);
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      await ReviewSlotService.getInstance().generateAllResponses('mcamp-1');

      // Check the prompt sent to AI includes voice fields
      const callArgs = aiMock.generateChatCompletion.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('we'); // voice person
      expect(callArgs.messages[1].content).toContain('formal'); // voice formality
      expect(callArgs.messages[1].content).toContain('- The Team'); // signature
    });

    it('records errors for slots without review text', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.findMany.mockResolvedValue([
        baseSlot({ id: 'mdrs-1', review_text: null }),
      ]);

      const result = await ReviewSlotService.getInstance().generateAllResponses('mcamp-1');

      expect(result.generated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('no review text');
    });
  });

  // ─── regenerateSlot ────────────────────────────────────────────────────

  describe('regenerateSlot', () => {
    it('regenerates a single slot response via AI', async () => {
      mockSlots.findUnique.mockResolvedValue(baseSlot());
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudit());
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      const result = await ReviewSlotService.getInstance().regenerateSlot('mdrs-1');

      expect(result.responseText).toContain('Hi Jennifer');
      expect(result.responseSource).toBe('ai');
      expect(result.status).toBe('draft'); // reset to draft after regen
      expect(aiMock.generateChatCompletion).toHaveBeenCalledOnce();
    });

    it('throws when slot not found', async () => {
      mockSlots.findUnique.mockResolvedValue(null);
      await expect(ReviewSlotService.getInstance().regenerateSlot('nonexistent'))
        .rejects.toThrow(/not found/i);
    });
  });

  // ─── updateSlotResponse ────────────────────────────────────────────────

  describe('updateSlotResponse', () => {
    it('edits response text and marks as external', async () => {
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      const result = await ReviewSlotService.getInstance().updateSlotResponse('mdrs-1', 'Manually edited response');

      expect(result.responseText).toBe('Manually edited response');
      expect(result.responseSource).toBe('external');
      expect(result.status).toBe('draft');
    });
  });

  // ─── approveSlot ───────────────────────────────────────────────────────

  describe('approveSlot', () => {
    it('approves a slot with a response', async () => {
      mockSlots.findUnique.mockResolvedValue(baseSlot({ response_text: 'Some response' }));
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      const result = await ReviewSlotService.getInstance().approveSlot('mdrs-1');
      expect(result.status).toBe('approved');
    });

    it('throws when approving a slot without a response', async () => {
      mockSlots.findUnique.mockResolvedValue(baseSlot({ response_text: null }));

      await expect(ReviewSlotService.getInstance().approveSlot('mdrs-1'))
        .rejects.toThrow(/without a response/i);
    });
  });

  // ─── skipSlot ──────────────────────────────────────────────────────────

  describe('skipSlot', () => {
    it('skips a slot', async () => {
      mockSlots.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSlot(), ...data }));

      const result = await ReviewSlotService.getInstance().skipSlot('mdrs-1');
      expect(result.status).toBe('skipped');
    });
  });
});
