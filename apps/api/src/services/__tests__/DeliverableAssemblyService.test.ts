import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────

const {
  mockSlots,
  mockSections,
  mockCampaigns,
  mockDeliverables,
} = vi.hoisted(() => ({
  mockSlots: { findMany: vi.fn(), updateMany: vi.fn() },
  mockSections: { findMany: vi.fn(), updateMany: vi.fn() },
  mockCampaigns: { findUnique: vi.fn() },
  mockDeliverables: { update: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_deliverable_review_slot: mockSlots,
    mkt_deliverable_section: mockSections,
    mkt_campaigns_list: mockCampaigns,
    mkt_deliverables_list: mockDeliverables,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../middleware/errorHandler', () => ({
  NotFoundError: class NotFoundError extends Error {},
}));

import { DeliverableAssemblyService } from '../deliverable/DeliverableAssemblyService';

// ─── Fixtures ────────────────────────────────────────────────────────────

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
  response_text: 'Hi Jennifer — we hear you. We\'ve updated our intake process. — Sarah',
  response_source: 'ai',
  status: 'approved',
  slot_index: 0,
  ...overrides,
});

const baseSection = (overrides: Partial<any> = {}) => ({
  id: 'mds-1',
  deliverable_id: null,
  campaign_id: 'mcamp-1',
  section_type: 'recovery_playbook',
  title: 'Recovery Playbook',
  content: '## Pricing\nResponse template: ...',
  source: 'ai',
  status: 'approved',
  section_index: 100,
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────

describe('DeliverableAssemblyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getAssemblyStatus ─────────────────────────────────────────────────

  describe('getAssemblyStatus', () => {
    it('returns ready=true when all slots and sections are approved or skipped', async () => {
      mockSlots.findMany.mockResolvedValue([
        baseSlot({ status: 'approved' }),
        baseSlot({ id: 'mdrs-2', status: 'skipped' }),
      ]);
      mockSections.findMany.mockResolvedValue([baseSection({ status: 'approved' })]);

      const status = await DeliverableAssemblyService.getInstance().getAssemblyStatus('mcamp-1');

      expect(status.ready).toBe(true);
      expect(status.totalSlots).toBe(2);
      expect(status.approvedSlots).toBe(1);
      expect(status.skippedSlots).toBe(1);
      expect(status.draftSlots).toBe(0);
      expect(status.missingApprovals).toEqual([]);
    });

    it('returns ready=false when slots are still in draft', async () => {
      mockSlots.findMany.mockResolvedValue([
        baseSlot({ status: 'approved' }),
        baseSlot({ id: 'mdrs-2', status: 'draft' }),
      ]);
      mockSections.findMany.mockResolvedValue([]);

      const status = await DeliverableAssemblyService.getInstance().getAssemblyStatus('mcamp-1');

      expect(status.ready).toBe(false);
      expect(status.draftSlots).toBe(1);
      expect(status.missingApprovals).toContain('1 review slot(s) still in draft');
    });

    it('returns ready=false when sections are still in draft', async () => {
      mockSlots.findMany.mockResolvedValue([]);
      mockSections.findMany.mockResolvedValue([
        baseSection({ status: 'draft' }),
      ]);

      const status = await DeliverableAssemblyService.getInstance().getAssemblyStatus('mcamp-1');

      expect(status.ready).toBe(false);
      expect(status.draftSections).toBe(1);
      expect(status.missingApprovals).toContain('1 section(s) still in draft');
    });

    it('returns ready=true when no slots and no sections exist', async () => {
      mockSlots.findMany.mockResolvedValue([]);
      mockSections.findMany.mockResolvedValue([]);

      const status = await DeliverableAssemblyService.getInstance().getAssemblyStatus('mcamp-1');

      expect(status.ready).toBe(true);
    });
  });

  // ─── assemble ──────────────────────────────────────────────────────────

  describe('assemble', () => {
    it('assembles approved slots and sections into content', async () => {
      // First call: getAssemblyStatus — all approved/skipped so ready=true
      // Second call: approved-only fetch for actual assembly
      mockSlots.findMany
        .mockResolvedValueOnce([baseSlot({ status: 'approved' }), baseSlot({ id: 'mdrs-2', status: 'skipped' })])
        .mockResolvedValueOnce([baseSlot()]);
      mockSections.findMany
        .mockResolvedValueOnce([baseSection({ status: 'approved' }), baseSection({ id: 'mds-2', status: 'skipped' })])
        .mockResolvedValueOnce([baseSection()]);
      mockCampaigns.findUnique.mockResolvedValue({
        id: 'mcamp-1', business_name: 'Test Auto Repair', category: 'auto_repair', city: 'Austin', state: 'TX',
      });

      const result = await DeliverableAssemblyService.getInstance().assemble('mcamp-1');

      expect(result.slotCount).toBe(1);
      expect(result.sectionCount).toBe(1);
      expect(result.content).toContain('Test Auto Repair');
      expect(result.content).toContain('REVIEW RESPONSES');
      expect(result.content).toContain('RECOVERY PLAYBOOK');
      expect(result.content).toContain('Hi Jennifer');
    });

    it('throws when slots are still in draft', async () => {
      mockSlots.findMany.mockResolvedValue([baseSlot({ status: 'draft' })]);
      mockSections.findMany.mockResolvedValue([]);

      await expect(DeliverableAssemblyService.getInstance().assemble('mcamp-1'))
        .rejects.toThrow(/Cannot assemble/i);
    });

    it('includes skipped counts in the result', async () => {
      mockSlots.findMany
        .mockResolvedValueOnce([baseSlot({ status: 'approved' }), baseSlot({ id: 'mdrs-2', status: 'skipped' })])
        .mockResolvedValueOnce([baseSlot()]);
      mockSections.findMany
        .mockResolvedValueOnce([baseSection({ status: 'approved' }), baseSection({ id: 'mds-2', status: 'skipped' })])
        .mockResolvedValueOnce([baseSection()]);
      mockCampaigns.findUnique.mockResolvedValue({
        id: 'mcamp-1', business_name: 'Test', category: 'test', city: 'X', state: 'Y',
      });

      const result = await DeliverableAssemblyService.getInstance().assemble('mcamp-1');

      expect(result.skippedSlots).toBe(1);
      expect(result.skippedSections).toBe(1);
    });
  });
});
