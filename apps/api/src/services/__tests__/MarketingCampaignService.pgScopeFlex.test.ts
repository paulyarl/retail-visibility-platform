import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PG scope flex (culture-fit §6.5) — three surfaces:
 *
 *   1. promoteToProvingGround: scope-conditional validation — category is the
 *      market identity (both scopes); city only required for city-scope PGs.
 *   2. attachChildCampaign: business-scope children attach only on
 *      geography-free (mixed) PGs; intelligence/enrichment rules unchanged.
 *   3. groupQueueEntriesIntoProvingGround: queue-list initiation — creates or
 *      reuses the PG campaign and stamps proving_ground_id on the entries
 *      (Migration 282).
 */

const {
  mockCampaignsList,
  mockProspectQueue,
} = vi.hoisted(() => ({
  mockCampaignsList: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  mockProspectQueue: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_prospect_queue: mockProspectQueue,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateCampaignId: () => 'mkt-test-001',
  generateStageHistoryId: () => 'msh-test-001',
  generateProspectQueueId: () => 'pque-test-001',
}));

vi.mock('../MarketingCategoryToneService', () => ({
  default: { getPresetByCategory: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { getLabel: vi.fn().mockResolvedValue(null) },
}));

import MarketingCampaignService from '../MarketingCampaignService';

const service = MarketingCampaignService;
const PG_ID = 'mkt-pg-001';
const SOURCE_ID = 'mkt-intel-001';

const discoverySource = (overrides: Record<string, any> = {}) => ({
  id: SOURCE_ID,
  scope: 'intelligence',
  campaign_category: 'intelligence',
  intelligence_campaign_kind: 'discovery',
  intelligence_focus: 'emerging',
  category: 'fleet services',
  city: 'Austin',
  state: 'TX',
  parent_campaign_id: null,
  ...overrides,
});

const pgParent = (overrides: Record<string, any> = {}) => ({
  id: PG_ID,
  scope: 'city',
  campaign_category: 'proving_ground',
  category: 'fleet services',
  city: 'Austin',
  ...overrides,
});

describe('attachChildCampaign — business children on geography-free PGs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.update.mockResolvedValue({});
  });

  it('attaches a business-scope child when the PG has no city (mixed PG)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent({ city: null, scope: 'category' }))
      .mockResolvedValueOnce({ id: 'mkt-biz-1', scope: 'business', campaign_category: 'review_management', parent_campaign_id: null });

    const result = await service.attachChildCampaign(PG_ID, 'mkt-biz-1');

    expect(result).toEqual({ attached: true, parentId: PG_ID, childId: 'mkt-biz-1' });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: 'mkt-biz-1' },
      data: { parent_campaign_id: PG_ID },
    });
  });

  it('rejects a business-scope child when the PG has a fixed city', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent({ city: 'Austin' }))
      .mockResolvedValueOnce({ id: 'mkt-biz-1', scope: 'business', campaign_category: 'review_management', parent_campaign_id: null });

    await expect(service.attachChildCampaign(PG_ID, 'mkt-biz-1'))
      .rejects.toThrow('business_children_require_geography_free_pg');
    expect(mockCampaignsList.update).not.toHaveBeenCalled();
  });

  it('still attaches intelligence discovery children (regression)', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent())
      .mockResolvedValueOnce({
        id: 'mkt-intel-9', scope: 'intelligence', campaign_category: 'intelligence',
        intelligence_campaign_kind: 'discovery', intelligence_focus: 'competitive',
        parent_campaign_id: null,
      });

    const result = await service.attachChildCampaign(PG_ID, 'mkt-intel-9');
    expect(result.attached).toBe(true);
  });

  it('rejects non-discovery intelligence children', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent())
      .mockResolvedValueOnce({
        id: 'mkt-intel-9', scope: 'intelligence', campaign_category: 'intelligence',
        intelligence_campaign_kind: 'establishment', intelligence_focus: 'emerging',
        parent_campaign_id: null,
      });

    await expect(service.attachChildCampaign(PG_ID, 'mkt-intel-9'))
      .rejects.toThrow('child_not_discovery_prospect_run');
  });

  it('attaches directory_enrichment children on category scope', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent())
      .mockResolvedValueOnce({ id: 'mkt-enr-1', scope: 'category', campaign_category: 'directory_enrichment', parent_campaign_id: null });

    const result = await service.attachChildCampaign(PG_ID, 'mkt-enr-1');
    expect(result.attached).toBe(true);
  });

  it('rejects a child that is already parented', async () => {
    mockCampaignsList.findUnique
      .mockResolvedValueOnce(pgParent({ city: null }))
      .mockResolvedValueOnce({ id: 'mkt-biz-1', scope: 'business', campaign_category: 'review_management', parent_campaign_id: 'mkt-other' });

    await expect(service.attachChildCampaign(PG_ID, 'mkt-biz-1'))
      .rejects.toThrow('child_already_parented');
  });
});

describe('promoteToProvingGround — scope-conditional validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Isolate from createCampaign/attachChildCampaign internals.
    vi.spyOn(service, 'createCampaign').mockResolvedValue({ id: PG_ID } as any);
    vi.spyOn(service, 'attachChildCampaign').mockResolvedValue({ attached: true, parentId: PG_ID, childId: SOURCE_ID });
    mockCampaignsList.findFirst.mockResolvedValue(null); // no duplicate PG
    // Attached-children load for domain expansion (Migration 283).
    mockCampaignsList.findMany.mockResolvedValue([]);
  });

  it('creates a category-scope PG without requiring a city', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(discoverySource({ city: null }));

    const result = await service.promoteToProvingGround(SOURCE_ID, { scope: 'category' });

    expect(service.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'category', campaignCategory: 'proving_ground', category: 'fleet services' }),
      undefined,
    );
    expect(result.attached).toEqual([SOURCE_ID]);
  });

  it('still requires a city for city-scope PGs (default scope)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(discoverySource({ city: null }));

    await expect(service.promoteToProvingGround(SOURCE_ID))
      .rejects.toThrow('city is required to create a city-scope proving ground');
    expect(service.createCampaign).not.toHaveBeenCalled();
  });

  it('requires a category in both scopes', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(discoverySource({ category: null }));

    await expect(service.promoteToProvingGround(SOURCE_ID, { scope: 'category' }))
      .rejects.toThrow('category is required to create a proving ground');
  });

  it('reuses an existing active PG for the same signature', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(discoverySource());
    mockCampaignsList.findFirst.mockResolvedValue({ id: 'mkt-pg-existing' });

    const result = await service.promoteToProvingGround(SOURCE_ID, { scope: 'city' });

    expect(result.reusedExisting).toBe(true);
    expect(service.createCampaign).not.toHaveBeenCalled();
    expect(service.attachChildCampaign).toHaveBeenCalledWith('mkt-pg-existing', SOURCE_ID, undefined);
  });
});

describe('groupQueueEntriesIntoProvingGround — queue-list initiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(service, 'createCampaign').mockResolvedValue({ id: PG_ID } as any);
    mockCampaignsList.findFirst.mockResolvedValue(null); // no duplicate PG
    mockProspectQueue.updateMany.mockResolvedValue({ count: 2 });
  });

  it('creates a PG and stamps proving_ground_id on the selected entries', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'fleet services', city: 'Austin', state: 'TX' },
      { id: 'pque-2', category: 'fleet services', city: 'Austin', state: 'TX' },
    ]);

    const result = await service.groupQueueEntriesIntoProvingGround({
      queueEntryIds: ['pque-1', 'pque-2'],
      title: 'Austin Fleet PG',
    });

    expect(service.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'city',
        campaignCategory: 'proving_ground',
        category: 'fleet services',
        city: 'Austin',
        title: 'Austin Fleet PG',
      }),
      undefined,
    );
    expect(mockProspectQueue.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['pque-1', 'pque-2'] } },
      data: { proving_ground_id: PG_ID, updated_at: expect.any(Date) },
    });
    expect(result).toMatchObject({ reusedExisting: false, stamped: 2, notFound: [] });
  });

  it('modal-defaults category/city/state from the grouped entries', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'plumbing', city: 'Tulsa', state: 'OK' },
      { id: 'pque-2', category: 'plumbing', city: null, state: 'OK' },
    ]);

    await service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1', 'pque-2'] });

    expect(service.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'plumbing', city: 'Tulsa', state: 'OK' }),
      undefined,
    );
  });

  it('reuses an existing PG instead of tripping the duplicate guardrail', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'fleet services', city: 'Austin', state: 'TX' },
    ]);
    mockCampaignsList.findFirst.mockResolvedValue({ id: 'mkt-pg-existing' });

    const result = await service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1'] });

    expect(result.reusedExisting).toBe(true);
    expect(service.createCampaign).not.toHaveBeenCalled();
    expect(mockProspectQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ proving_ground_id: 'mkt-pg-existing' }) }),
    );
  });

  it('reports notFound ids and stamps only the found rows', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'fleet services', city: 'Austin', state: 'TX' },
    ]);

    const result = await service.groupQueueEntriesIntoProvingGround({
      queueEntryIds: ['pque-1', 'pque-missing'],
    });

    expect(result.notFound).toEqual(['pque-missing']);
    expect(mockProspectQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['pque-1'] } } }),
    );
  });

  it('creates a geography-free (category-scope) PG when entries have no city', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'fleet services', city: null, state: null },
      { id: 'pque-2', category: 'fleet services', city: null, state: null },
    ]);

    await service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1', 'pque-2'] });

    expect(service.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'category', category: 'fleet services', city: undefined }),
      undefined,
    );
  });

  it('throws when no category is derivable from input or entries', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: null, city: 'Austin', state: 'TX' },
    ]);

    await expect(service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1'] }))
      .rejects.toThrow('category is required to create a proving ground');
  });
});

describe('PG domain model (Migration 283 — describe + auto-expand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProspectQueue.updateMany.mockResolvedValue({ count: 3 });
    mockCampaignsList.update.mockResolvedValue({});
  });

  it('derives secondary_categories + member_geos from grouped entries on create', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'African Grocery', city: 'Indianapolis', state: 'IN' },
      { id: 'pque-2', category: 'African Grocery', city: 'Indianapolis', state: 'IN' },
      { id: 'pque-3', category: 'India Grocery', city: 'Plainfield', state: 'IN' },
    ]);
    mockCampaignsList.findFirst.mockResolvedValue(null);
    vi.spyOn(service, 'createCampaign').mockResolvedValue({
      id: PG_ID,
      campaign_category: 'proving_ground',
      category: 'African Grocery',
      city: 'Indianapolis',
      state: 'IN',
      secondary_categories: [],
      member_geos: null,
    } as any);

    const result = await service.groupQueueEntriesIntoProvingGround({
      queueEntryIds: ['pque-1', 'pque-2', 'pque-3'],
    });

    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: PG_ID },
      data: expect.objectContaining({
        secondary_categories: ['India Grocery'],
        member_geos: [{ city: 'Plainfield', state: 'IN' }],
      }),
    });
    expect(result.domainExpanded).toEqual({
      categories: ['India Grocery'],
      geos: [{ city: 'Plainfield', state: 'IN' }],
    });
  });

  it('adds to an explicit PG target and expands its domain (no signature lookup)', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'African Grocery', city: 'Milwaukee', state: 'WI' },
    ]);
    mockCampaignsList.findUnique.mockResolvedValue(
      pgParent({
        category: 'African Grocery',
        city: 'Madison',
        state: 'WI',
        secondary_categories: [],
        member_geos: [{ city: 'Plainfield', state: 'WI' }],
      }),
    );

    const result = await service.groupQueueEntriesIntoProvingGround({
      queueEntryIds: ['pque-1'],
      provingGroundId: PG_ID,
    });

    expect(result.reusedExisting).toBe(true);
    expect(mockCampaignsList.findFirst).not.toHaveBeenCalled();
    expect(service.createCampaign).not.toHaveBeenCalled();
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: PG_ID },
      data: expect.objectContaining({
        member_geos: [
          { city: 'Plainfield', state: 'WI' },
          { city: 'Milwaukee', state: 'WI' },
        ],
      }),
    });
    expect(result.domainExpanded.geos).toEqual([{ city: 'Milwaukee', state: 'WI' }]);
    expect(mockProspectQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ proving_ground_id: PG_ID }) }),
    );
  });

  it('rejects an explicit target that is not a proving ground', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'fleet services', city: 'Austin', state: 'TX' },
    ]);
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'mkt-biz-1', campaign_category: 'review_management' });

    await expect(
      service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1'], provingGroundId: 'mkt-biz-1' }),
    ).rejects.toThrow('target_not_proving_ground');
  });

  it('does not record member_geos on a geography-free PG (unconstrained geo domain)', async () => {
    mockProspectQueue.findMany.mockResolvedValue([
      { id: 'pque-1', category: 'Nigerian Grocery', city: 'Chicago', state: 'IL' },
    ]);
    vi.spyOn(service, 'createCampaign').mockResolvedValue({
      id: PG_ID,
      campaign_category: 'proving_ground',
      category: 'African Grocery',
      city: null,
      state: null,
      secondary_categories: [],
      member_geos: null,
    } as any);
    mockCampaignsList.findFirst.mockResolvedValue(null);

    const result = await service.groupQueueEntriesIntoProvingGround({ queueEntryIds: ['pque-1'] });

    // Category widens; geography stays unconstrained — no member_geos write.
    expect(result.domainExpanded).toEqual({ categories: ['Nigerian Grocery'], geos: [] });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: PG_ID },
      data: expect.objectContaining({
        secondary_categories: ['Nigerian Grocery'],
        member_geos: null,
      }),
    });
  });

  it('expands the domain from merged runs on promoteToProvingGround', async () => {
    vi.spyOn(service, 'createCampaign').mockResolvedValue({
      id: PG_ID,
      campaign_category: 'proving_ground',
      category: 'fleet services',
      city: 'Austin',
      state: 'TX',
      secondary_categories: [],
      member_geos: null,
    } as any);
    vi.spyOn(service, 'attachChildCampaign').mockResolvedValue({ attached: true } as any);
    mockCampaignsList.findUnique.mockResolvedValue(discoverySource());
    mockCampaignsList.findFirst.mockResolvedValue(null);
    // The attached load: source + merged run spanning a new category + geo.
    mockCampaignsList.findMany.mockResolvedValue([
      { category: 'fleet services', city: 'Austin', state: 'TX' },
      { category: 'logistics', city: 'Dallas', state: 'TX' },
    ]);

    const result = await service.promoteToProvingGround(SOURCE_ID, {
      mergeCampaignIds: ['mkt-intel-2'],
    });

    expect(result.domainExpanded).toEqual({
      categories: ['logistics'],
      geos: [{ city: 'Dallas', state: 'TX' }],
    });
    expect(mockCampaignsList.update).toHaveBeenCalledWith({
      where: { id: PG_ID },
      data: expect.objectContaining({
        secondary_categories: ['logistics'],
        member_geos: [{ city: 'Dallas', state: 'TX' }],
      }),
    });
  });
});
