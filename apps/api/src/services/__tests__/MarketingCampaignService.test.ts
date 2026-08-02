import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockStageHistory,
  mockPreviewTokens,
} = vi.hoisted(() => ({
  mockCampaignsList: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
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

vi.mock('../MarketingCategoryToneService', () => ({
  default: {
    getPresetByCategory: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: {
    getLabel: vi.fn().mockResolvedValue(null),
  },
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

    const result = await MarketingCampaignService.autoAdvanceStaleShownCampaigns(7);

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

    const result = await MarketingCampaignService.autoAdvanceStaleShownCampaigns(7);

    expect(result).toEqual({ advanced: 0, skipped: 1 });
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
    expect(mockStageHistory.create).not.toHaveBeenCalled();
  });

  it('returns zeros when no stale campaigns exist', async () => {
    mockCampaignsList.findMany.mockResolvedValue([]);

    const result = await MarketingCampaignService.autoAdvanceStaleShownCampaigns(7);

    expect(result).toEqual({ advanced: 0, skipped: 0 });
    expect(mockPreviewTokens.findMany).not.toHaveBeenCalled();
  });
});

// ====================
// deriveBusinessCampaign
// ====================

const parentCategoryCampaign = (overrides: Partial<any> = {}) => ({
  id: 'mcamp-parent-cat',
  display_id: 'MC-001',
  scope: 'category',
  category: 'HVAC',
  city: 'Plainfield',
  neighborhood: null,
  tone: 'Professional',
  attributes: ['High Ticket'],
  mkt_audits_list: [],
  ...overrides,
});

const parentCityCampaign = parentCategoryCampaign({
  id: 'mcamp-parent-city',
  scope: 'city',
  category: 'General',
});

const parentBusinessCampaign = parentCategoryCampaign({
  id: 'mcamp-parent-biz',
  scope: 'business',
  business_name: 'Parent Biz',
});

const parentWithOutreachAudit = parentCategoryCampaign({
  id: 'mcamp-parent-audit',
  mkt_audits_list: [
    {
      id: 'maud-1',
      platform: 'category_analysis',
      audit_data: {
        market_analysis: {
          recommended_outreach_angle: 'Peak Season Lead Capture',
        },
      },
    },
  ],
});

const parentWithCityCategoryAudit = parentCategoryCampaign({
  id: 'mcamp-parent-city-cat-audit',
  mkt_audits_list: [
    {
      id: 'maud-2',
      platform: 'city_category_analysis',
      audit_data: {
        outreach_recommendation: {
          primary_angle: 'Competitive visibility-gap audit for highly rated local HVAC contractors',
        },
      },
    },
  ],
});

const createdChild = (data: any) => ({
  id: 'mkt-test-001',
  stage: 'seek',
  scope: 'business',
  ...data,
});

describe('deriveBusinessCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve(createdChild(data)));
  });

  it('creates a seek-stage business child from a category-scope parent', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    const result = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Bassett Services',
      rating: 4.8,
      reviewCount: 850,
      location: '706 W Main St, Plainfield, IN',
    });

    expect(result.scope).toBe('business');
    expect(result.stage).toBe('seek');
    // Verify the create call inherited category/city from parent
    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'business',
          business_name: 'Bassett Services',
          category: 'HVAC',
          city: 'Plainfield',
          parent_campaign_id: 'mcamp-parent-cat',
          stage: 'seek',
          estimated_tier: 'High',
        }),
      })
    );
    // Stage history logged for the seek creation
    expect(mockStageHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          to_stage: 'seek',
          trigger_type: 'system',
        }),
      })
    );
  });

  it('creates a business child from a city-scope parent', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCityCampaign);

    const result = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-city',
      businessName: 'City Biz',
    });

    expect(result.scope).toBe('business');
    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'General',
          city: 'Plainfield',
          parent_campaign_id: 'mcamp-parent-city',
        }),
      })
    );
  });

  it('creates a business child from a business-scope parent (recursive allowed)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentBusinessCampaign);

    const result = await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-biz',
      businessName: 'Competitor Biz',
      rating: 4.2,
      reviewCount: 60,
    });

    expect(result.scope).toBe('business');
    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parent_campaign_id: 'mcamp-parent-biz',
          estimated_tier: 'Mid',
        }),
      })
    );
  });

  it('includes the outreach angle in notes when parent has a category_analysis audit', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentWithOutreachAudit);

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-audit',
      businessName: 'Polley\'s Perfect Seasons',
      rating: 4.9,
      reviewCount: 260,
      location: '564 Northfield Rd, Plainfield, IN',
    });

    const createCall = mockCampaignsList.create.mock.calls[0][0];
    expect(createCall.data.notes).toContain('Outreach angle: Peak Season Lead Capture');
    expect(createCall.data.notes).toContain('Derived from parent campaign MC-001 (category scope)');
    expect(createCall.data.notes).toContain('Discovered location: 564 Northfield Rd, Plainfield, IN');
  });

  it('includes the outreach angle in notes when parent has a city_category_analysis audit', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentWithCityCategoryAudit);

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-city-cat-audit',
      businessName: 'Central Air Heating and Cooling',
      rating: 5.0,
      reviewCount: 460,
      location: '1200 Leesburg Rd Suite A, Fort Wayne, IN 46808',
    });

    const createCall = mockCampaignsList.create.mock.calls[0][0];
    expect(createCall.data.notes).toContain('Outreach angle: Competitive visibility-gap audit for highly rated local HVAC contractors');
    expect(createCall.data.notes).toContain('Derived from parent campaign MC-001 (category scope)');
  });

  it('throws NotFoundError when parent campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);

    await expect(
      MarketingCampaignService.deriveBusinessCampaign({
        parentId: 'mcamp-missing',
        businessName: 'Ghost Biz',
      })
    ).rejects.toThrow(/Parent campaign mcamp-missing not found/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('infers tier as High when rating >= 4.5 and review_count >= 200', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Top Biz',
      rating: 4.5,
      reviewCount: 200,
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimated_tier: 'High' }),
      })
    );
  });

  it('infers tier as Mid when rating >= 4.0 but review_count < 200', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Mid Biz',
      rating: 4.0,
      reviewCount: 30,
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimated_tier: 'Mid' }),
      })
    );
  });

  it('infers tier as Mid when rating < 4.0 but review_count >= 50', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Review Heavy Biz',
      rating: 3.5,
      reviewCount: 50,
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimated_tier: 'Mid' }),
      })
    );
  });

  it('infers tier as Low when rating < 4.0 and review_count < 50', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Small Biz',
      rating: 3.0,
      reviewCount: 10,
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimated_tier: 'Low' }),
      })
    );
  });

  it('leaves estimated_tier null when no rating or review_count provided', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Unknown Biz',
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimated_tier: null }),
      })
    );
  });

  it('inherits tone and attributes from parent', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(parentCategoryCampaign());

    await MarketingCampaignService.deriveBusinessCampaign({
      parentId: 'mcamp-parent-cat',
      businessName: 'Inherited Biz',
    });

    expect(mockCampaignsList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tone: 'Professional',
          attributes: ['High Ticket'],
        }),
      })
    );
  });
});
