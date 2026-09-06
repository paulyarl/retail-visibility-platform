/**
 * Proving Ground campaign tests — Migration 262 (spec §4.1, §4.2)
 * docs/LocalBiz/PROVING_GROUND_CAMPAIGN_SPEC.md
 *
 * Covers:
 * - transitionsFor('proving_ground') → review machine
 * - createCampaign structural-duplicate guardrail (city scope + proving_ground)
 * - attachChildCampaign guards (parent kind, child scope, one-parent rule)
 * - detachChildCampaign guards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockStageHistory } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockStageHistory: { create: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
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

import MarketingCampaignService, {
  transitionsFor,
} from '../MarketingCampaignService';

const service = MarketingCampaignService;

// ====================
// TRANSITIONS
// ====================

describe('proving_ground transitions', () => {
  it('transitionsFor(proving_ground) returns the review machine', () => {
    expect(transitionsFor('proving_ground')).toEqual(transitionsFor('review_management'));
  });
});

// ====================
// STRUCTURAL-DUPLICATE GUARDRAIL (§4.1)
// ====================
// One active proving ground per city/category signature. The city/category
// scope branch keys on scope + campaign_category + category + city + state.

describe('proving_ground structural-duplicate guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.findFirst.mockResolvedValue(null);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: data.id }),
    );
  });

  it('blocks a second active proving ground with the same city/category signature', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-pg-001',
      display_id: 'MC-PG1',
      scope: 'city',
      campaign_category: 'proving_ground',
      category: 'Grocery',
      city: 'Madison',
      state: 'WI',
      stage: 'seek',
    });

    await expect(
      service.createCampaign({
        scope: 'city',
        campaignCategory: 'proving_ground',
        category: 'Grocery',
        city: 'Madison',
        state: 'WI',
        title: 'Proving Ground — Madison Grocery',
      }),
    ).rejects.toThrow(/same structural signature already exists/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('allows a fresh proving ground after the prior one was killed (inactive stage)', async () => {
    // findFirst returns null because the query excludes inactive stages —
    // simulate by simply returning no active match.
    mockCampaignsList.findFirst.mockResolvedValueOnce(null);

    const result = await service.createCampaign({
      scope: 'city',
      campaignCategory: 'proving_ground',
      category: 'Grocery',
      city: 'Madison',
      state: 'WI',
      title: 'Proving Ground — Madison Grocery',
    });

    expect(result.campaign_category).toBe('proving_ground');
    expect(result.stage).toBe('seek'); // review machine — parent stays at 'seek'
    expect(mockCampaignsList.create).toHaveBeenCalled();
  });

  it('does not collide with a discovery campaign sharing the same category+city', async () => {
    // A 'proving_ground' campaign_category differs structurally from
    // 'review_management' — same city/category under a different kind is a
    // different signature, so no conflict.
    mockCampaignsList.findFirst.mockResolvedValueOnce(null);

    const result = await service.createCampaign({
      scope: 'city',
      campaignCategory: 'proving_ground',
      category: 'Middle Eastern Grocery',
      city: 'Madison',
      state: 'WI',
      title: 'Proving Ground — Madison Grocery',
    });

    expect(mockCampaignsList.create).toHaveBeenCalled();
    expect(result.campaign_category).toBe('proving_ground');
  });
});

// ====================
// ATTACH / DETACH CHILD (§4.2)
// ====================

describe('attachChildCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.update.mockResolvedValue({});
  });

  const pgParent = { id: 'mcamp-pg-001', campaign_category: 'proving_ground', scope: 'city' };
  const intChild = { id: 'mcamp-int-001', scope: 'intelligence', parent_campaign_id: null };

  it('attaches an intelligence campaign to a proving-ground parent', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce(intChild);

    const result = await service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001');

    expect(result).toEqual({ attached: true, parentId: 'mcamp-pg-001', childId: 'mcamp-int-001' });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: 'mcamp-int-001' },
      data: { parent_campaign_id: 'mcamp-pg-001' },
    });
  });

  it('rejects when the parent is not a proving-ground campaign (409)', async () => {
    mockCampaignsList.findUnique.mockResolvedValueOnce({
      ...pgParent,
      campaign_category: 'review_management',
    });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001'),
    ).rejects.toThrow('parent_not_proving_ground');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('rejects when the child is not intelligence scope (400)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({ ...intChild, scope: 'business' });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001'),
    ).rejects.toThrow('child_not_intelligence_scope');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('rejects a second attach when the child is already parented (409)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({ ...intChild, parent_campaign_id: 'mcamp-pg-other' });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001'),
    ).rejects.toThrow('child_already_parented');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('throws not-found when the parent does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.attachChildCampaign('mcamp-missing', 'mcamp-int-001'),
    ).rejects.toThrow();
  });
});

describe('detachChildCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.update.mockResolvedValue({});
  });

  it('detaches a parented child', async () => {
    mockCampaignsList.findUnique.mockResolvedValueOnce({
      id: 'mcamp-int-001',
      scope: 'intelligence',
      parent_campaign_id: 'mcamp-pg-001',
    });

    const result = await service.detachChildCampaign('mcamp-int-001');
    expect(result).toEqual({ detached: true, childId: 'mcamp-int-001' });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: 'mcamp-int-001' },
      data: { parent_campaign_id: null },
    });
  });

  it('rejects when the child has no parent (409)', async () => {
    mockCampaignsList.findUnique.mockResolvedValueOnce({
      id: 'mcamp-int-001',
      scope: 'intelligence',
      parent_campaign_id: null,
    });

    await expect(service.detachChildCampaign('mcamp-int-001')).rejects.toThrow('child_not_parented');
  });
});
