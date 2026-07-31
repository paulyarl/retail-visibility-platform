import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockVoiceProfile,
  mockCampaigns,
  mockAudits,
} = vi.hoisted(() => ({
  mockVoiceProfile: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockCampaigns: {
    findUnique: vi.fn(),
  },
  mockAudits: {}, // not used directly — audits come via campaign include
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_owner_voice_profile: mockVoiceProfile,
    mkt_campaigns_list: mockCampaigns,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateOwnerVoiceProfileId: () => 'movp-test-001',
}));

vi.mock('../ai-providers', () => ({
  default: {
    generateChatCompletion: vi.fn().mockResolvedValue({
      content: '{"person":"first_person","formality":"casual","humor":"none","apology_style":"fix_first","signoff_style":"first_name","signature":"- Sarah"}',
      model: 'gpt-4-test',
      usage: { totalTokens: 100 },
    }),
  },
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

import { OwnerVoiceService } from '../deliverable/OwnerVoiceService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const campaignWithAudits = (overrides: Partial<any> = {}) => ({
  id: 'mcamp-1',
  business_name: 'Test Auto Repair',
  category: 'auto_repair',
  city: 'Austin',
  state: 'TX',
  tone: 'short informal',
  mkt_audits_list: [
    {
      id: 'audit-1',
      platform: 'business_analysis',
      created_at: new Date('2024-01-15'),
      audit_data: {
        platforms: {
          google: {
            reviews: [
              { text: 'Great service', owner_response: 'Thanks for the kind words! We appreciate your business. — Sarah' },
              { text: 'Quick fix', owner_response: 'Glad we could help. Come back anytime! — Sarah' },
              { text: 'Honest shop', owner_response: 'Thank you for trusting us. We take pride in honest work. — Sarah' },
              { text: 'Fair price', owner_response: 'We aim for fair pricing always. Thanks! — Sarah' },
            ],
          },
        },
      },
    },
  ],
  ...overrides,
});

const campaignNoResponses = (overrides: Partial<any> = {}) => ({
  id: 'mcamp-2',
  business_name: 'No Responses Shop',
  category: 'plumbing',
  city: 'Dallas',
  state: 'TX',
  tone: 'short informal',
  mkt_audits_list: [
    {
      id: 'audit-2',
      platform: 'business_analysis',
      created_at: new Date('2024-01-15'),
      audit_data: { platforms: { google: { reviews: [{ text: 'Bad service' }] } } },
    },
  ],
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('OwnerVoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProfile ────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns null when no profile exists', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      const result = await OwnerVoiceService.getInstance().getProfile('mcamp-1');
      expect(result).toBeNull();
    });

    it('returns the profile when it exists', async () => {
      const row = {
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'first_person', formality: 'casual', humor: 'none',
        apology_style: 'fix_first', signoff_style: 'first_name', signature: '- Sarah',
        inferred_from_count: 4, inferred_sample: 'sample text',
        operator_overrides: {}, created_at: new Date(), updated_at: new Date(),
      };
      mockVoiceProfile.findUnique.mockResolvedValue(row);
      const result = await OwnerVoiceService.getInstance().getProfile('mcamp-1');
      expect(result).not.toBeNull();
      expect(result?.person).toBe('first_person');
      expect(result?.apologyStyle).toBe('fix_first');
    });
  });

  // ─── upsertProfile ─────────────────────────────────────────────────────

  describe('upsertProfile', () => {
    it('creates a new profile when none exists', async () => {
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockVoiceProfile.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await OwnerVoiceService.getInstance().upsertProfile('mcamp-1', {
        person: 'first_person',
        formality: 'professional',
      });

      expect(mockVoiceProfile.create).toHaveBeenCalledOnce();
      expect(result.person).toBe('first_person');
      expect(result.formality).toBe('professional');
    });

    it('updates an existing profile and tracks overrides', async () => {
      const existing = {
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'first_person', formality: 'casual', humor: 'none',
        apology_style: 'fix_first', signoff_style: 'first_name', signature: null,
        operator_overrides: {},
      };
      mockVoiceProfile.findUnique.mockResolvedValue(existing);
      mockVoiceProfile.update.mockImplementation(({ data }: any) => Promise.resolve({ ...existing, ...data }));

      const result = await OwnerVoiceService.getInstance().upsertProfile('mcamp-1', {
        formality: 'formal',
      });

      expect(mockVoiceProfile.update).toHaveBeenCalledOnce();
      expect(result.formality).toBe('formal');
      // The update call should include operator_overrides tracking the override
      const updateCall = mockVoiceProfile.update.mock.calls[0][0];
      expect(updateCall.data.operator_overrides).toEqual({ formality: true });
    });
  });

  // ─── inferVoice ────────────────────────────────────────────────────────

  describe('inferVoice', () => {
    it('infers voice from existing owner responses', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudits());
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockVoiceProfile.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await OwnerVoiceService.getInstance().inferVoice('mcamp-1');

      expect(result.inferredFromCount).toBe(4);
      expect(result.person).toBe('first_person');
      expect(result.apologyStyle).toBe('fix_first');
      expect(result.signature).toBe('- Sarah');
      expect(mockVoiceProfile.create).toHaveBeenCalledOnce();
    });

    it('throws when fewer than 3 existing responses', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignNoResponses());

      await expect(OwnerVoiceService.getInstance().inferVoice('mcamp-2'))
        .rejects.toThrow(/need at least 3/i);
    });

    it('throws when no business_analysis audit exists', async () => {
      mockCampaigns.findUnique.mockResolvedValue({
        id: 'mcamp-3',
        mkt_audits_list: [],
      });

      await expect(OwnerVoiceService.getInstance().inferVoice('mcamp-3'))
        .rejects.toThrow(/No business_analysis audit/i);
    });

    it('preserves operator overrides when re-inferring', async () => {
      const existing = {
        id: 'movp-1', campaign_id: 'mcamp-1',
        person: 'third_person', // operator overrode this
        formality: 'casual', humor: 'none',
        apology_style: 'fix_first', signoff_style: 'first_name', signature: null,
        operator_overrides: { person: true },
      };
      mockCampaigns.findUnique.mockResolvedValue(campaignWithAudits());
      mockVoiceProfile.findUnique.mockResolvedValue(existing);
      mockVoiceProfile.update.mockImplementation(({ data }: any) => Promise.resolve({ ...existing, ...data }));

      const result = await OwnerVoiceService.getInstance().inferVoice('mcamp-1');

      // Should update (not create) since profile exists
      expect(mockVoiceProfile.update).toHaveBeenCalledOnce();
      expect(mockVoiceProfile.create).not.toHaveBeenCalled();
      // The inferred person is first_person, but operator overrode to third_person
      const updateCall = mockVoiceProfile.update.mock.calls[0][0];
      expect(updateCall.data.person).toBe('third_person'); // preserved override
    });
  });

  // ─── toVoiceFields ─────────────────────────────────────────────────────

  describe('toVoiceFields', () => {
    it('converts a profile to voice fields', () => {
      const profile = {
        id: 'movp-1', campaignId: 'mcamp-1',
        person: 'we', formality: 'professional', humor: 'light',
        apologyStyle: 'acknowledge_and_pivot', signoffStyle: 'team', signature: '- The Team',
        inferredFromCount: 5, inferredSample: null, operatorOverrides: null,
        createdAt: '', updatedAt: '',
      };
      const fields = OwnerVoiceService.getInstance().toVoiceFields(profile);
      expect(fields.person).toBe('we');
      expect(fields.apologyStyle).toBe('acknowledge_and_pivot');
    });
  });
});
