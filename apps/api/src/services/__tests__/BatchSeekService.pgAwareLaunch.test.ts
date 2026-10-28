/**
 * BatchSeekService.launchBatch — PG-aware launch (2026-10-28 batch-born
 * discovery gap).
 *
 * A queue entry bonded to a proving ground must land in that PG: adopt the
 * PG's attached discovery campaign for the entry's focus, or create the run
 * and attach it at birth. Standalone entries keep the old behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockFindUnique, mockCreateCampaign } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreateCampaign: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    mkt_campaigns_list: { findUnique: mockFindUnique },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: vi.fn() }));

vi.mock('../../lib/id-generator', () => ({
  generateSeekBatchId: vi.fn(() => 'sb-test'),
  generateSeekBatchSlug: vi.fn(() => 'slug-test'),
  generateSeekBatchEntryId: vi.fn(() => 'sbe-test'),
}));

vi.mock('../MarketingCampaignService', () => ({
  default: { createCampaign: mockCreateCampaign },
}));

import BatchSeekService from '../BatchSeekService';

const sqlText = (arg: any) => (Array.isArray(arg) ? arg.join('') : String(arg));
const executedSql = () => mockExecuteRaw.mock.calls.map((c) => sqlText(c[0])).join('\n');
const executedValues = () => JSON.stringify(mockExecuteRaw.mock.calls);

const batchRow = {
  id: 'sb-test',
  profile_id: 'mip-test',
  profile_version: 5,
  niche_category: 'African Grocery Store',
  intelligence_focus: 'emerging',
  cities: ['Indianapolis'],
  state: null,
  status: 'draft',
};

const entryRow = (over: Record<string, any> = {}) => ({
  id: 'sbe-1',
  profile_id: 'mip-test',
  profile_version: 5,
  niche_category: 'African Grocery Store',
  city: 'Indianapolis',
  state: null,
  intelligence_focus: 'emerging',
  sort_order: 0,
  proving_ground_id: 'mcamp-pg',
  ...over,
});

const provingGround = {
  id: 'mcamp-pg',
  state: 'IN',
  campaign_category: 'proving_ground',
};

describe('BatchSeekService.launchBatch — PG awareness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockFindUnique.mockResolvedValue(provingGround);
  });

  it('adopts the PG attached discovery campaign instead of creating a twin', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([batchRow]) // batch row
      .mockResolvedValueOnce([entryRow()]) // entries
      .mockResolvedValueOnce([{ id: 'mcamp-attached' }]); // PG's attached child

    const result = await BatchSeekService.launchBatch('sb-test');

    expect(result.success).toBe(true);
    expect(result.campaignIds).toEqual(['mcamp-attached']);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
    expect(executedSql()).toContain('seek_batch_id');
    expect(executedValues()).toContain('mcamp-attached');
  });

  it('creates the run with the PG state and attaches it when the PG has no child', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([batchRow])
      .mockResolvedValueOnce([entryRow()])
      .mockResolvedValueOnce([]) // no attached child for this focus
      .mockResolvedValueOnce([]); // reuseExisting lookup
    mockCreateCampaign.mockResolvedValue({ id: 'mcamp-new' });

    const result = await BatchSeekService.launchBatch('sb-test');

    expect(result.campaignIds).toEqual(['mcamp-new']);
    expect(mockCreateCampaign).toHaveBeenCalledTimes(1);
    const payload = mockCreateCampaign.mock.calls[0][0];
    expect(payload.state).toBe('IN'); // inherited from the PG, not the null entry
    expect(payload.category).toBe('African Grocery Store');
    expect(payload.city).toBe('Indianapolis');
    expect(payload.intelligenceFocus).toBe('emerging');
    expect(executedSql()).toContain('parent_campaign_id');
    expect(executedValues()).toContain('mcamp-pg');
  });

  it('keeps standalone entries standalone (no PG, no attach)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([batchRow])
      .mockResolvedValueOnce([entryRow({ proving_ground_id: null })])
      .mockResolvedValueOnce([]); // reuseExisting lookup
    mockCreateCampaign.mockResolvedValue({ id: 'mcamp-standalone' });

    const result = await BatchSeekService.launchBatch('sb-test');

    expect(result.campaignIds).toEqual(['mcamp-standalone']);
    const payload = mockCreateCampaign.mock.calls[0][0];
    expect(payload.state).toBeUndefined();
    expect(executedSql()).not.toContain('parent_campaign_id');
  });
});
