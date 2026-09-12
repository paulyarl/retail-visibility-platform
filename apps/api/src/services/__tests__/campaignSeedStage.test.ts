import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma + logger + id-generator + dependencies so we can test the
// seed-stage transition logic in isolation without a DB.
const { mockCampaignsList, mockStageHistory, mockRevenue, mockGbpEnhancer } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
  mockStageHistory: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  mockRevenue: { aggregate: vi.fn() },
  mockGbpEnhancer: { populateContactFields: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
    marketing_revenue: mockRevenue,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mcamp-test-001',
  generateStageHistoryId: () => 'msh-test-001',
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

// GBP enrichment is dynamically imported inside transitionStage on
// seek → seed. Mock the module the same way the service imports it.
vi.mock('../MarketingGbpEnhancerService', () => ({
  MarketingGbpEnhancerService: {
    getInstance: () => mockGbpEnhancer,
  },
}));

import MarketingCampaignService from '../MarketingCampaignService';

// MarketingCampaignService default export is the singleton instance.
const service = MarketingCampaignService;

const reviewCampaign = (overrides: any = {}) => ({
  id: 'mcamp-seed-001',
  stage: 'seek',
  campaign_category: 'review_management',
  ...overrides,
});

describe('campaign seed stage (Migration 280)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ id: where.id, ...data }),
    );
    mockGbpEnhancer.populateContactFields.mockResolvedValue(undefined);
  });

  describe('transitionStage date stamping', () => {
    it('sets date_seed on seek → seed', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(reviewCampaign());

      await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'seed',
        triggerType: 'manual',
      });

      const updateData = mockCampaignsList.update.mock.calls[0][0].data;
      expect(updateData.stage).toBe('seed');
      expect(updateData.date_seed).toBeInstanceOf(Date);
      expect(updateData.date_preview_built).toBeUndefined();
    });

    it('sets date_preview_built (not date_seed) on seed → preview_built', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({ stage: 'seed', phone: '555-0100' }),
      );

      await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'preview_built',
        triggerType: 'manual',
      });

      const updateData = mockCampaignsList.update.mock.calls[0][0].data;
      expect(updateData.stage).toBe('preview_built');
      expect(updateData.date_preview_built).toBeInstanceOf(Date);
      expect(updateData.date_seed).toBeUndefined();
    });

    it('rejects seek → preview_built (must pass through seed)', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(reviewCampaign());

      await expect(
        service.transitionStage({
          campaignId: 'mcamp-seed-001',
          toStage: 'preview_built',
          triggerType: 'manual',
        }),
      ).rejects.toThrow();
      expect(mockCampaignsList.update).not.toHaveBeenCalled();
    });
  });

  describe('best-effort GBP enrichment hook', () => {
    it('fires populateContactFields on seek → seed when phone and website are missing', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({ phone: null, website_url: null }),
      );

      await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'seed',
        triggerType: 'manual',
      });

      expect(mockGbpEnhancer.populateContactFields).toHaveBeenCalledWith('mcamp-seed-001', undefined);
    });

    it('does not fire when contact fields already exist', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({ phone: '555-0100', website_url: 'https://example.com' }),
      );

      await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'seed',
        triggerType: 'manual',
      });

      expect(mockGbpEnhancer.populateContactFields).not.toHaveBeenCalled();
    });

    it('does not fire on seed → preview_built', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({ stage: 'seed', phone: null, website_url: null }),
      );

      await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'preview_built',
        triggerType: 'manual',
      });

      expect(mockGbpEnhancer.populateContactFields).not.toHaveBeenCalled();
    });

    it('proceeds with the transition when enrichment fails (soft gate)', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({ phone: null, website_url: null }),
      );
      mockGbpEnhancer.populateContactFields.mockRejectedValue(new Error('GBP API down'));

      const result = await service.transitionStage({
        campaignId: 'mcamp-seed-001',
        toStage: 'seed',
        triggerType: 'manual',
      });

      expect(result.stage).toBe('seed');
    });
  });

  describe('track switch remapping', () => {
    it('maps seed → audit_identified on escalation to the recovery track', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({
          stage: 'seed',
          campaign_category: 'profile_repair',
          repair_track: 'standard',
        }),
      );

      const result = await service.switchRepairTrack({
        campaignId: 'mcamp-seed-001',
        toTrack: 'escalated',
        reason: 'BBB complaint discovered during seeding',
      });

      expect(result.stage).toBe('audit_identified');
      expect(result.repair_track).toBe('escalated');
    });

    it('maps audit_identified → seek on de-escalation to the review track', async () => {
      mockCampaignsList.findUnique.mockResolvedValue(
        reviewCampaign({
          stage: 'audit_identified',
          campaign_category: 'profile_repair',
          repair_track: 'escalated',
        }),
      );

      const result = await service.switchRepairTrack({
        campaignId: 'mcamp-seed-001',
        toTrack: 'standard',
        reason: 'Complaint resolved without escalation',
      });

      expect(result.stage).toBe('seek');
      expect(result.repair_track).toBe('standard');
    });
  });

  describe('dashboard active stages', () => {
    it('counts seed-stage campaigns as active', async () => {
      mockCampaignsList.groupBy.mockResolvedValue([]);
      mockCampaignsList.aggregate.mockResolvedValue({ _sum: { amount_paid_cents: null, retainer_amount_cents: null } });
      mockCampaignsList.count.mockResolvedValue(0);
      mockCampaignsList.findMany.mockResolvedValue([]);
      mockStageHistory.findMany.mockResolvedValue([]);
      mockStageHistory.count.mockResolvedValue(0);
      mockRevenue.aggregate.mockResolvedValue({ _sum: { amount_cents: null }, _count: { id: 0 } });

      await service.getDashboardStats();

      expect(mockCampaignsList.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: expect.objectContaining({
              in: expect.arrayContaining(['seek', 'seed', 'preview_built']),
            }),
          }),
        }),
      );
    });
  });
});
