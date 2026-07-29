import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockStageHistory,
  mockPreviewTokens,
} = vi.hoisted(() => ({
  mockCampaignsList: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  mockStageHistory: { create: vi.fn() },
  mockPreviewTokens: { findMany: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
    mkt_deliverable_preview_tokens: mockPreviewTokens,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-test-001',
  generateStageHistoryId: () => 'msh-test-001',
}));

import MarketingCampaignService from '../MarketingCampaignService';

const staleShownCampaign = (id: string) => ({
  id,
  stage: 'shown',
  date_shown: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  business_name: 'Test Biz',
});

describe('autoAdvanceStaleShownCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(staleShownCampaign(where.id)));
    mockCampaignsList.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ ...staleShownCampaign(where.id), ...data }));
    mockStageHistory.create.mockResolvedValue({});
  });

  it('advances stale shown campaigns to lost when no live preview tokens', async () => {
    mockCampaignsList.findMany.mockResolvedValue([staleShownCampaign('mkt-1')]);
    mockPreviewTokens.findMany.mockResolvedValue([]);

    const result = await MarketingCampaignService.getInstance().autoAdvanceStaleShownCampaigns(7);

    expect(result).toEqual({ advanced: 1, skipped: 0 });
    expect(mockCampaignsList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mkt-1' },
        data: expect.objectContaining({ stage: 'lost' }),
      })
    );
    expect(mockStageHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          from_stage: 'shown',
          to_stage: 'lost',
          trigger_type: 'automated',
        }),
      })
    );
  });

  it('skips campaigns with live preview tokens', async () => {
    mockCampaignsList.findMany.mockResolvedValue([staleShownCampaign('mkt-2')]);
    mockPreviewTokens.findMany.mockResolvedValue([{ campaign_id: 'mkt-2' }]);

    const result = await MarketingCampaignService.getInstance().autoAdvanceStaleShownCampaigns(7);

    expect(result).toEqual({ advanced: 0, skipped: 1 });
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
    expect(mockStageHistory.create).not.toHaveBeenCalled();
  });

  it('returns zeros when no stale campaigns exist', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);

    const result = await MarketingCampaignService.getInstance().autoAdvanceStaleShownCampaigns(7);

    expect(result).toEqual({ advanced: 0, skipped: 0 });
    expect(mockPreviewTokens.findMany).not.toHaveBeenCalled();
  });
});
