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

const { mockCampaignsList, mockStageHistory, mockQueue } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockStageHistory: { create: vi.fn() },
  mockQueue: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_stage_history_list: mockStageHistory,
    mkt_prospect_queue: mockQueue,
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
import MarketingProspectQueueService from '../MarketingProspectQueueService';

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
// DIRECTORY_ENRICHMENT DEDUP (sprint plan M4)
// ====================
// Enrichment campaigns dedup on scope + campaign_category + category + city +
// state — sentinel values ('__all__', '__location__') participate in the
// signature like any other value.

describe('directory_enrichment structural-duplicate guardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStageHistory.create.mockResolvedValue({});
    mockCampaignsList.findFirst.mockResolvedValue(null);
    mockCampaignsList.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: data.id }),
    );
  });

  it('blocks a duplicate national category enrichment campaign (__all__ sentinel)', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-enr-001',
      display_id: 'MC-ENR1',
      scope: 'category',
      campaign_category: 'directory_enrichment',
      category: 'Halal Grocery',
      city: '__all__',
      state: '__all__',
      stage: 'seek',
    });

    await expect(
      service.createCampaign({
        scope: 'category',
        campaignCategory: 'directory_enrichment',
        category: 'Halal Grocery',
        city: '__all__',
        state: '__all__',
        title: 'Category Enrichment — Halal Grocery — National',
      }),
    ).rejects.toThrow(/same structural signature already exists/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('blocks a duplicate location enrichment campaign (__location__ sentinel)', async () => {
    mockCampaignsList.findFirst.mockResolvedValueOnce({
      id: 'mcamp-enr-002',
      display_id: 'MC-ENR2',
      scope: 'city',
      campaign_category: 'directory_enrichment',
      category: '__location__',
      city: 'Columbus',
      state: 'OH',
      stage: 'seek',
    });

    await expect(
      service.createCampaign({
        scope: 'city',
        campaignCategory: 'directory_enrichment',
        category: '__location__',
        city: 'Columbus',
        state: 'OH',
        title: 'Location Enrichment — Columbus, OH',
      }),
    ).rejects.toThrow(/same structural signature already exists/);

    expect(mockCampaignsList.create).not.toHaveBeenCalled();
  });

  it('does not collide with a proving_ground campaign on the same market', async () => {
    // campaign_category differs → different signature.
    mockCampaignsList.findFirst.mockResolvedValueOnce(null);

    const result = await service.createCampaign({
      scope: 'city',
      campaignCategory: 'directory_enrichment',
      category: '__location__',
      city: 'Madison',
      state: 'WI',
      title: 'Location Enrichment — Madison, WI',
    });

    expect(mockCampaignsList.create).toHaveBeenCalled();
    expect(result.campaign_category).toBe('directory_enrichment');
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

  it('rejects a business-scope child under a geography-having PG (400)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce({ ...pgParent, city: 'Indianapolis' })
      .mockResolvedValueOnce({ ...intChild, scope: 'business' });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001'),
    ).rejects.toThrow('business_children_require_geography_free_pg');
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

  it('is idempotent when re-attaching to the same parent (no-op success)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({ ...intChild, parent_campaign_id: 'mcamp-pg-001' });

    const result = await service.attachChildCampaign('mcamp-pg-001', 'mcamp-int-001');

    expect(result).toEqual({ attached: true, parentId: 'mcamp-pg-001', childId: 'mcamp-int-001' });
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('throws not-found when the parent does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.attachChildCampaign('mcamp-missing', 'mcamp-int-001'),
    ).rejects.toThrow();
  });

  // Directory enrichment children (sprint plan C): category/city-scope
  // enrichment campaigns attach without the intelligence kind/focus checks.
  const enrichCategoryChild = {
    id: 'mcamp-enr-001',
    scope: 'category',
    campaign_category: 'directory_enrichment',
    parent_campaign_id: null,
  };
  const enrichLocationChild = {
    id: 'mcamp-enr-002',
    scope: 'city',
    campaign_category: 'directory_enrichment',
    parent_campaign_id: null,
  };

  it('attaches a category-scope directory_enrichment child (skips intelligence checks)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce(enrichCategoryChild);

    const result = await service.attachChildCampaign('mcamp-pg-001', 'mcamp-enr-001');

    expect(result).toEqual({ attached: true, parentId: 'mcamp-pg-001', childId: 'mcamp-enr-001' });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: 'mcamp-enr-001' },
      data: { parent_campaign_id: 'mcamp-pg-001' },
    });
  });

  it('attaches a city-scope directory_enrichment child', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce(enrichLocationChild);

    const result = await service.attachChildCampaign('mcamp-pg-001', 'mcamp-enr-002');
    expect(result.attached).toBe(true);
  });

  it('rejects a directory_enrichment child at a non-enrichment scope (400)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({ ...enrichCategoryChild, scope: 'intelligence' });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-enr-001'),
    ).rejects.toThrow('child_not_enrichment_scope');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('still rejects unrelated non-intelligence children (e.g. review_management category scope)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({
        id: 'mcamp-rm-001',
        scope: 'category',
        campaign_category: 'review_management',
        parent_campaign_id: null,
      });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-rm-001'),
    ).rejects.toThrow('child_not_intelligence_scope');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('rejects an already-parented directory_enrichment child (409)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent)
      .mockResolvedValueOnce({ ...enrichCategoryChild, parent_campaign_id: 'mcamp-pg-other' });

    await expect(
      service.attachChildCampaign('mcamp-pg-001', 'mcamp-enr-001'),
    ).rejects.toThrow('child_already_parented');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
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


// ====================
// GAP LOG � append-only incident record (�4.5)
// ====================

describe('appendGapLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.update.mockResolvedValue({});
  });

  it('appends a timestamped entry preserving existing entries', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({
      id: 'mcamp-pg-001',
      gap_log: [{ timestamp: '2026-09-01T00:00:00Z', field: 'contact.phone', description: 'prior', severity: 'minor', resolver: 'self' }],
    });

    const result = await service.appendGapLog('mcamp-pg-001', {
      field: 'contact.email',
      description: 'No verified email for any prospect',
      severity: 'important',
      resolver: 'staff',
    }, { userId: 'uid-op-1' } as any);

    const updateCall = mockCampaignsList.update.mock.calls[0][0];
    expect(updateCall.data.gap_log).toHaveLength(2);
    expect(updateCall.data.gap_log[1]).toMatchObject({
      field: 'contact.email',
      severity: 'important',
      logged_by: 'uid-op-1',
    });
    expect(updateCall.data.gap_log[1].timestamp).toBeTruthy();
    expect(result.entry.field).toBe('contact.email');
  });

  it('starts the log when gap_log is null', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'mcamp-pg-001', gap_log: null });

    await service.appendGapLog('mcamp-pg-001', {
      field: 'seed.nap', description: 'x', severity: 'minor', resolver: 'self',
    });

    const updateCall = mockCampaignsList.update.mock.calls[0][0];
    expect(updateCall.data.gap_log).toHaveLength(1);
  });

  it('throws not-found when the campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);

    await expect(
      service.appendGapLog('mcamp-missing', {
        field: 'x', description: 'y', severity: 'minor', resolver: 'self',
      }),
    ).rejects.toThrow(/not found/i);
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });
});

// ====================
// QUEUE � account_family identity patch (�4.9)
// ====================

describe('queue update � account_family', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'pque-001', ...data }));
  });

  it('allows a family-only patch on a hold row (identity, not cadence)', async () => {
    mockQueue.findUnique.mockResolvedValue({ id: 'pque-001', status: 'hold' });

    await MarketingProspectQueueService.update('pque-001', { account_family: 'Tairov' });

    expect(mockQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { account_family: 'Tairov' } }),
    );
  });

  it('allows a family-only patch on an in_thread row', async () => {
    mockQueue.findUnique.mockResolvedValue({ id: 'pque-001', status: 'in_thread' });

    await MarketingProspectQueueService.update('pque-001', { account_family: 'Tairov' });
    expect(mockQueue.update).toHaveBeenCalled();
  });

  it('rejects a family patch on a dismissed row', async () => {
    mockQueue.findUnique.mockResolvedValue({ id: 'pque-001', status: 'dismissed' });

    await expect(
      MarketingProspectQueueService.update('pque-001', { account_family: 'Tairov' }),
    ).rejects.toThrow(/not editable/);
  });

  it('still rejects cadence-field patches on hold rows', async () => {
    mockQueue.findUnique.mockResolvedValue({ id: 'pque-001', status: 'hold' });

    await expect(
      MarketingProspectQueueService.update('pque-001', { priority: 'high' }),
    ).rejects.toThrow(/not editable/);
  });
});
