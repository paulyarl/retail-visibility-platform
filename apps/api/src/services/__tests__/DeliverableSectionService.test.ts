import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockSections,
  mockCampaigns,
  mockVoiceProfile,
  aiMock,
} = vi.hoisted(() => ({
  mockSections: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockCampaigns: { findUnique: vi.fn() },
  mockVoiceProfile: { findUnique: vi.fn() },
  aiMock: { generateChatCompletion: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_deliverable_section: mockSections,
    mkt_campaigns_list: mockCampaigns,
    mkt_owner_voice_profile: mockVoiceProfile,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDeliverableSectionId: () => 'mds-test-001',
}));

vi.mock('../ai-providers', () => ({
  default: aiMock,
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

import { DeliverableSectionService } from '../deliverable/DeliverableSectionService';

// ─── Fixtures ────────────────────────────────────────────────────────────

const campaignWithFullAudit = (overrides: Partial<any> = {}) => ({
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
          google: { displayed_name: 'Test Auto', displayed_phone: '555-123-4567' },
          yelp: { displayed_name: 'Test Auto Repair', displayed_phone: '555-999-8888' },
        },
        negative_review_themes: [
          { theme: 'pricing', summary: 'Diagnostic fee too high', supporting_review_count: 3 },
          { theme: 'delays', summary: 'Service took too long', supporting_review_count: 2 },
        ],
        nap_consistency: {
          overall_status: 'inconsistent',
          canonical_name: 'Test Auto Repair',
          canonical_phone: '555-123-4567',
          canonical_address: '123 Main St, Austin, TX',
          name_variations: ['Test Auto'],
          phone_variations: ['555-999-8888'],
          address_variations: [],
        },
        website: {
          url: 'https://example.com',
          has_booking: false,
          call_to_action_present: 'no',
          click_to_call_available: 'no',
          conversion_opportunities: ['Add online booking', 'Add click-to-call button'],
        },
      },
    },
  ],
  ...overrides,
});

const baseSection = (overrides: Partial<any> = {}) => ({
  id: 'mds-1',
  deliverable_id: null,
  campaign_id: 'mcamp-1',
  section_type: 'recovery_playbook',
  title: 'Recovery Playbook',
  content: '## Pricing\nWhat usually went wrong: ...',
  source: 'ai',
  quality_gate_passed: true,
  quality_gate_issues: [],
  status: 'draft',
  section_index: 100,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('DeliverableSectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMock.generateChatCompletion.mockResolvedValue({
      content: '## Pricing\nWhat usually went wrong: Customers feel the diagnostic fee is too high.\nResponse template: [template]',
      model: 'gpt-4-test',
      usage: { totalTokens: 200 },
    });
  });

  // ─── listSections ──────────────────────────────────────────────────────

  describe('listSections', () => {
    it('returns sections sorted by section_index', async () => {
      mockSections.findMany.mockResolvedValue([
        baseSection({ section_index: 100 }),
        baseSection({ id: 'mds-2', section_index: 200, section_type: 'listing_corrections' }),
      ]);
      const result = await DeliverableSectionService.getInstance().listSections('mcamp-1');
      expect(result).toHaveLength(2);
      expect(result[0].sectionIndex).toBe(100);
    });
  });

  // ─── generateAllSections ───────────────────────────────────────────────

  describe('generateAllSections', () => {
    it('generates playbook, corrections, and CTA when audit has all issues', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithFullAudit());
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockSections.findFirst.mockResolvedValue(null); // no existing sections
      mockSections.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await DeliverableSectionService.getInstance().generateAllSections('mcamp-1');

      expect(result.generated).toContain('recovery_playbook');
      expect(result.generated).toContain('listing_corrections');
      expect(result.generated).toContain('cta_fixes');
      expect(aiMock.generateChatCompletion).toHaveBeenCalledTimes(3);
    });

    it('only generates playbook when no NAP or website issues', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithFullAudit({
        mkt_audits_list: [{
          id: 'audit-1',
          platform: 'business_analysis',
          created_at: new Date(),
          audit_data: {
            platforms: {},
            negative_review_themes: [
              { theme: 'pricing', summary: 'Too high', supporting_review_count: 3 },
            ],
            nap_consistency: { overall_status: 'consistent' },
            website: { has_booking: true, call_to_action_present: 'yes', click_to_call_available: 'yes' },
          },
        }],
      }));
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockSections.findFirst.mockResolvedValue(null);
      mockSections.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await DeliverableSectionService.getInstance().generateAllSections('mcamp-1');

      expect(result.generated).toEqual(['recovery_playbook']);
      expect(aiMock.generateChatCompletion).toHaveBeenCalledOnce();
    });

    it('skips playbook when no negative themes', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithFullAudit({
        mkt_audits_list: [{
          id: 'audit-1',
          platform: 'business_analysis',
          created_at: new Date(),
          audit_data: {
            platforms: {},
            negative_review_themes: [],
            nap_consistency: { overall_status: 'inconsistent', canonical_name: 'X', canonical_phone: 'Y', canonical_address: 'Z' },
            website: { has_booking: false, call_to_action_present: 'no', click_to_call_available: 'no', conversion_opportunities: [] },
          },
        }],
      }));
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockSections.findFirst.mockResolvedValue(null);
      mockSections.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await DeliverableSectionService.getInstance().generateAllSections('mcamp-1');

      expect(result.generated).not.toContain('recovery_playbook');
      expect(result.generated).toContain('listing_corrections');
      expect(result.generated).toContain('cta_fixes');
    });
  });

  // ─── generateSection (single) ──────────────────────────────────────────

  describe('generateSection', () => {
    it('creates a new recovery_playbook section', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithFullAudit());
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockSections.findFirst.mockResolvedValue(null);
      mockSections.create.mockImplementation(({ data }: any) => Promise.resolve({ id: data.id, ...data }));

      const result = await DeliverableSectionService.getInstance().generateSection('mcamp-1', 'recovery_playbook');

      expect(result.sectionType).toBe('recovery_playbook');
      expect(result.title).toBe('Recovery Playbook');
      expect(result.source).toBe('ai');
      expect(result.status).toBe('draft');
      expect(mockSections.create).toHaveBeenCalledOnce();
    });

    it('updates an existing section instead of creating a duplicate', async () => {
      mockCampaigns.findUnique.mockResolvedValue(campaignWithFullAudit());
      mockVoiceProfile.findUnique.mockResolvedValue(null);
      mockSections.findFirst.mockResolvedValue(baseSection());
      mockSections.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSection(), ...data }));

      const result = await DeliverableSectionService.getInstance().generateSection('mcamp-1', 'recovery_playbook');

      expect(mockSections.update).toHaveBeenCalledOnce();
      expect(mockSections.create).not.toHaveBeenCalled();
      expect(result.status).toBe('draft'); // reset to draft after regen
    });

    it('throws when no audit data exists', async () => {
      mockCampaigns.findUnique.mockResolvedValue({ id: 'mcamp-1', mkt_audits_list: [] });

      await expect(DeliverableSectionService.getInstance().generateSection('mcamp-1', 'recovery_playbook'))
        .rejects.toThrow(/No business_analysis audit/i);
    });
  });

  // ─── updateSection ─────────────────────────────────────────────────────

  describe('updateSection', () => {
    it('edits section content and marks as external', async () => {
      mockSections.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSection(), ...data }));

      const result = await DeliverableSectionService.getInstance().updateSection('mds-1', 'Manually edited content');
      expect(result.content).toBe('Manually edited content');
      expect(result.source).toBe('external');
      expect(result.status).toBe('draft');
    });
  });

  // ─── approveSection ────────────────────────────────────────────────────

  describe('approveSection', () => {
    it('approves a section', async () => {
      mockSections.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSection(), ...data }));

      const result = await DeliverableSectionService.getInstance().approveSection('mds-1');
      expect(result.status).toBe('approved');
    });
  });

  // ─── skipSection ───────────────────────────────────────────────────────

  describe('skipSection', () => {
    it('skips a section', async () => {
      mockSections.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseSection(), ...data }));

      const result = await DeliverableSectionService.getInstance().skipSection('mds-1');
      expect(result.status).toBe('skipped');
    });
  });
});
