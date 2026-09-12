import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * getProvingGroundStageDistribution — PG stage-culture fit §6.2.
 *
 * The distribution is a read-only roll-up over the PG tree's business
 * campaigns. These tests pin the corrected semantics the implementation
 * spec calls out:
 *   - distinct processed_campaign_id counting (AC84 double-graduation)
 *   - stillInQueue from queue STATUS buckets (dismiss() can leave a
 *     processed_campaign_id on a dismissed row — subtraction goes negative)
 *   - business grandchildren via parent_campaign_id (queue-invisible)
 *   - seededPreGraduation from queue.seed_id (NOT the campaign 'seed' stage)
 *   - duplicate lineage paths deduped (queue + parent → same campaign)
 */

const {
  mockCampaignsList,
  mockProspectQueue,
} = vi.hoisted(() => ({
  mockCampaignsList: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
  },
  mockProspectQueue: {
    findMany: vi.fn(),
    count: vi.fn(),
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

const PG_ID = 'mkt-pg-001';
const INTEL_CHILD_ID = 'mkt-intel-002';

const pgCampaign = () => ({
  id: PG_ID,
  campaign_category: 'proving_ground',
});

/**
 * Wire the mocks for a scenario. `findMany` on campaigns is called twice —
 * once for tree children, once for direct business children — so the mock
 * distinguishes by the where clause.
 */
function wireScenario({
  children = [{ id: INTEL_CHILD_ID }],
  queueEntries = [] as Array<{ processed_campaign_id: string | null }>,
  directBusinessChildren = [] as Array<{ id: string }>,
  stageGroups = [] as Array<{ stage: string; _count: { id: number } }>,
  stillInQueue = 0,
  seededPreGraduation = 0,
  dismissed = 0,
} = {}) {
  mockCampaignsList.findUnique.mockResolvedValue(pgCampaign());
  mockCampaignsList.findMany.mockImplementation(({ where }: any) => {
    // Tree children: { parent_campaign_id: pgId }
    if (where.parent_campaign_id === PG_ID) return Promise.resolve(children);
    // Direct business children: { parent_campaign_id: { in: treeIds }, scope }
    if (where.parent_campaign_id?.in) return Promise.resolve(directBusinessChildren);
    return Promise.resolve([]);
  });
  mockProspectQueue.findMany.mockResolvedValue(queueEntries);
  mockCampaignsList.groupBy.mockResolvedValue(stageGroups);
  mockProspectQueue.count.mockImplementation(({ where }: any) => {
    if (where.status === 'dismissed') return Promise.resolve(dismissed);
    if (where.seed_id?.not === null) return Promise.resolve(seededPreGraduation);
    return Promise.resolve(stillInQueue);
  });
}

describe('getProvingGroundStageDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError when the campaign does not exist', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(null);
    await expect(
      MarketingCampaignService.getProvingGroundStageDistribution('mkt-missing'),
    ).rejects.toThrow(/not found/i);
  });

  it('throws ValidationError for a non-proving_ground campaign', async () => {
    mockCampaignsList.findUnique.mockResolvedValue({ id: 'mkt-1', campaign_category: 'review_management' });
    await expect(
      MarketingCampaignService.getProvingGroundStageDistribution('mkt-1'),
    ).rejects.toThrow(/not_a_proving_ground/);
  });

  it('counts distinct processed campaigns, not queue rows (AC84 dedup)', async () => {
    wireScenario({
      // Two queue rows graduated into the SAME campaign.
      queueEntries: [
        { processed_campaign_id: 'mkt-biz-1' },
        { processed_campaign_id: 'mkt-biz-1' },
        { processed_campaign_id: 'mkt-biz-2' },
      ],
      stageGroups: [
        { stage: 'seek', _count: { id: 1 } },
        { stage: 'shown', _count: { id: 1 } },
      ],
    });

    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(dist.totalInPipeline).toBe(2);
    expect(mockCampaignsList.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(['mkt-biz-1', 'mkt-biz-2']) } },
      }),
    );
    const groupByIds = mockCampaignsList.groupBy.mock.calls[0][0].where.id.in;
    expect(new Set(groupByIds).size).toBe(groupByIds.length);
  });

  it('unions queue-graduated campaigns with queue-invisible business grandchildren', async () => {
    wireScenario({
      queueEntries: [{ processed_campaign_id: 'mkt-biz-queue' }],
      // Derive flows attach business campaigns under intelligence children
      // via parent_campaign_id with no queue linkage.
      directBusinessChildren: [{ id: 'mkt-biz-derived' }],
      stageGroups: [
        { stage: 'seek', _count: { id: 2 } },
      ],
    });

    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(dist.totalInPipeline).toBe(2);
    const groupByIds = mockCampaignsList.groupBy.mock.calls[0][0].where.id.in;
    expect(groupByIds).toEqual(expect.arrayContaining(['mkt-biz-queue', 'mkt-biz-derived']));
  });

  it('dedupes a campaign visible through both queue linkage and parent linkage', async () => {
    wireScenario({
      queueEntries: [{ processed_campaign_id: 'mkt-biz-1' }],
      directBusinessChildren: [{ id: 'mkt-biz-1' }],
      stageGroups: [{ stage: 'seek', _count: { id: 1 } }],
    });

    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(dist.totalInPipeline).toBe(1);
  });

  it('queries queue rows across the whole tree — PG itself plus children', async () => {
    wireScenario({});
    await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    // Migration 282 — the linkage is OR'd: legacy source_campaign_id tree
    // membership OR direct proving_ground_id stamping (queue-list-initiated
    // PGs have no discovery source).
    expect(mockProspectQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { source_campaign_id: { in: expect.arrayContaining([PG_ID, INTEL_CHILD_ID]) } },
            { proving_ground_id: PG_ID },
          ],
          processed_campaign_id: { not: null },
        },
      }),
    );
  });

  it('computes stillInQueue from status buckets, not subtraction', async () => {
    wireScenario({ stillInQueue: 7 });
    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(mockProspectQueue.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['queued', 'hold', 'in_thread', 'verify_then_outreach'] },
        }),
      }),
    );
    expect(dist.stillInQueue).toBe(7);
  });

  it('counts seeded pre-graduation prospects from queue.seed_id within open statuses', async () => {
    wireScenario({ seededPreGraduation: 3 });
    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(mockProspectQueue.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seed_id: { not: null },
          status: { in: ['queued', 'hold', 'in_thread', 'verify_then_outreach'] },
        }),
      }),
    );
    expect(dist.seededPreGraduation).toBe(3);
  });

  it('counts dismissed rows separately — including rows that kept a processed_campaign_id', async () => {
    wireScenario({
      // A dismissed row that graduated before dismissal still contributes
      // its campaign to the pipeline (it exists), while the row counts as
      // dismissed — the old subtraction formula double-counted this case.
      queueEntries: [{ processed_campaign_id: 'mkt-biz-1' }],
      dismissed: 1,
      stageGroups: [{ stage: 'seek', _count: { id: 1 } }],
    });

    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(dist.dismissed).toBe(1);
    expect(dist.totalInPipeline).toBe(1);
    expect(dist.stillInQueue).toBe(0);
    expect(dist.stillInQueue).toBeGreaterThanOrEqual(0);
  });

  it('returns arbitrary stage keys verbatim — recovery stages included', async () => {
    wireScenario({
      queueEntries: [
        { processed_campaign_id: 'mkt-biz-1' },
        { processed_campaign_id: 'mkt-biz-2' },
      ],
      stageGroups: [
        { stage: 'outreach_dispatched', _count: { id: 1 } },
        { stage: 'tenant_onboarded', _count: { id: 1 } },
      ],
    });

    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(dist.byStage).toEqual({
      outreach_dispatched: 1,
      tenant_onboarded: 1,
    });
  });

  it('skips the stage groupBy when no campaigns have graduated', async () => {
    wireScenario({});
    const dist = await MarketingCampaignService.getProvingGroundStageDistribution(PG_ID);

    expect(mockCampaignsList.groupBy).not.toHaveBeenCalled();
    expect(dist).toEqual({
      totalInPipeline: 0,
      byStage: {},
      stillInQueue: 0,
      seededPreGraduation: 0,
      dismissed: 0,
    });
  });
});
