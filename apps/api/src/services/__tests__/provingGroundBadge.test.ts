import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────
// The badge resolver reads mkt_campaigns_list twice (linked campaigns, then
// their parents) — mocked at the model level.

const { mockCampaigns, mockWarn } = vi.hoisted(() => ({
  mockCampaigns: { findMany: vi.fn() },
  mockWarn: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { mkt_campaigns_list: mockCampaigns },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: mockWarn, error: vi.fn() },
}));

import { resolveProvingGroundBadges } from '../provingGroundBadge';

type Row = {
  id: string;
  title: string | null;
  category: string | null;
  city: string | null;
  campaign_category: string;
  parent_campaign_id?: string | null;
};

function row(partial: Partial<Row> & { id: string }): Row {
  return {
    title: null,
    category: null,
    city: null,
    campaign_category: 'business',
    parent_campaign_id: null,
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaigns.findMany.mockResolvedValue([]);
});

describe('resolveProvingGroundBadges', () => {
  it('returns an empty map and skips the lookup when nothing is linked', async () => {
    const out = await resolveProvingGroundBadges([{ id: 'e1' }, { id: 'e2', proving_ground_id: null }]);
    expect(out.size).toBe(0);
    expect(mockCampaigns.findMany).not.toHaveBeenCalled();
  });

  it('resolves the badge from a direct proving_ground_id stamp', async () => {
    mockCampaigns.findMany.mockResolvedValue([
      row({ id: 'pg-1', title: 'Milwaukee Grocers', category: 'grocery', city: 'Milwaukee', campaign_category: 'proving_ground' }),
    ]);

    const out = await resolveProvingGroundBadges([{ id: 'e1', proving_ground_id: 'pg-1' }]);

    expect(out.get('e1')).toEqual({ id: 'pg-1', title: 'Milwaukee Grocers', category: 'grocery', city: 'Milwaukee' });
  });

  it('resolves the badge when the source campaign is itself a proving ground', async () => {
    mockCampaigns.findMany.mockResolvedValue([
      row({ id: 'pg-1', title: 'PG Direct', campaign_category: 'proving_ground' }),
    ]);

    const out = await resolveProvingGroundBadges([{ id: 'e1', source_campaign_id: 'pg-1' }]);

    expect(out.get('e1')?.id).toBe('pg-1');
  });

  it('resolves the badge from the source campaign\'s parent (discovery-child path)', async () => {
    const rows = [
      row({ id: 'child-1', campaign_category: 'business', parent_campaign_id: 'pg-1' }),
      row({ id: 'pg-1', title: 'Parent PG', campaign_category: 'proving_ground' }),
    ];
    mockCampaigns.findMany.mockImplementation(async ({ where }: any) => {
      const ids: string[] = where.id.in;
      return rows.filter((r) => ids.includes(r.id));
    });

    const out = await resolveProvingGroundBadges([{ id: 'e1', source_campaign_id: 'child-1' }]);

    expect(out.get('e1')?.id).toBe('pg-1');
    expect(out.get('e1')?.title).toBe('Parent PG');
  });

  it('leaves a row unbadged when its source campaign is not in a PG tree', async () => {
    mockCampaigns.findMany.mockResolvedValue([
      row({ id: 'c-1', campaign_category: 'business', parent_campaign_id: null }),
    ]);

    const out = await resolveProvingGroundBadges([{ id: 'e1', source_campaign_id: 'c-1' }]);

    expect(out.size).toBe(0);
  });

  it('degrades to no badges when the lookup throws (non-fatal)', async () => {
    mockCampaigns.findMany.mockRejectedValue(new Error('db down'));

    const out = await resolveProvingGroundBadges([{ id: 'e1', proving_ground_id: 'pg-1' }]);

    expect(out.size).toBe(0);
    expect(mockWarn).toHaveBeenCalled();
  });
});
