/**
 * ensureProspectSiblingLinks / ensureSeedLinksForProspect — the prospect
 * family is the unit of seed attachment. Once a seed has its primary link,
 * every other sibling under the group's business_prospect_id attaches with
 * link_role='sibling' so Linked Campaigns reflects the whole family.
 *
 * Covers: attaching unlinked siblings, idempotent no-op when the family is
 * already attached, no-prospect early exit, and the prospect-keyed entry
 * used on sibling creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: vi.fn(),
}));

import DirectorySeedCampaignLinkService from '../DirectorySeedCampaignLinkService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

function linkRow(campaignId: string, role: string) {
  return {
    id: 'dscl-1',
    seed_id: 'seed-1',
    campaign_id: campaignId,
    tenant_id: 'ten-1',
    link_role: role,
    nap_match_confidence: 'none',
    nap_match_summary: {},
    last_synced_at: null,
    last_sync_fields: null,
    created_at: new Date(),
    updated_at: new Date(),
    display_id: 'C-1',
    business_name: 'Biz',
    category: 'Grocery Store',
    city: 'Milwaukee',
    state: 'WI',
    stage: 'seek',
    campaign_category: 'review_management',
  };
}

function setupDb(opts: {
  prospectId: string | null;
  seedId?: string | null;
  siblings: string[];
  linked: string[];
}) {
  mockQueryRaw.mockImplementation(async (strings: any, ...values: any[]) => {
    const q = sqlText(strings);
    // ensureSeedLinksForProspect — find the group's primary-linked seed.
    // ('SELECT' prefixes disambiguate: the prospect-id lookup below also
    // carries `dscl.seed_id = …` in its WHERE clause.)
    if (q.includes('SELECT dscl.seed_id')) {
      return opts.seedId === undefined || opts.seedId === null ? [] : [{ seed_id: opts.seedId }];
    }
    // ensureProspectSiblingLinks — resolve the group's prospect id.
    if (q.includes('SELECT mc.business_prospect_id')) {
      return opts.prospectId ? [{ business_prospect_id: opts.prospectId }] : [];
    }
    // Sibling roster for the group.
    if (q.includes('WHERE business_prospect_id')) {
      return opts.siblings.map((id) => ({ id }));
    }
    // Already-linked campaign ids on this seed.
    if (q.includes('SELECT campaign_id FROM directory_seed_campaign_links')) {
      return opts.linked.map((id) => ({ campaign_id: id }));
    }
    // computeNapMatch — no overlap → 'none', skips auto-projection.
    if (q.includes('CROSS JOIN mkt_campaigns_list')) return [];
    // listLinks result for the per-sibling linkCampaign calls.
    if (q.includes('directory_seed_campaign_links dscl')) {
      const campaignId = opts.linked[0] ?? opts.siblings[0] ?? 'camp-x';
      return [linkRow(campaignId, 'sibling')];
    }
    // Campaign existence + sibling flags (per-sibling linkCampaign) —
    // the requested id arrives as a bound value; only 'camp-primary' is
    // flagged primary so the non_primary_sibling guard behaves.
    if (q.includes('FROM mkt_campaigns_list')) {
      const campaignId =
        values.find((v) => typeof v === 'string' && v.startsWith('camp-')) ?? 'camp-x';
      return [
        {
          id: campaignId,
          business_prospect_id: opts.prospectId,
          is_primary_sibling: campaignId === 'camp-primary',
        },
      ];
    }
    // Existing-primary check.
    if (q.includes('directory_seed_campaign_links')) return [];
    // Seed existence + tenant.
    if (q.includes('FROM directory_presence_seeds')) {
      return [{ tenant_id: 'ten-1', listing_id: 'list-1' }];
    }
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
});

describe('ensureProspectSiblingLinks', () => {
  it('attaches every unlinked sibling with role=sibling', async () => {
    setupDb({
      prospectId: 'bp-1',
      siblings: ['camp-primary', 'camp-b', 'camp-c'],
      linked: ['camp-primary'],
    });
    const res = await DirectorySeedCampaignLinkService.ensureProspectSiblingLinks('seed-1');
    expect(res.linked.sort()).toEqual(['camp-b', 'camp-c']);
    // One INSERT per newly attached sibling (each link also writes the
    // mkt_prospect_queue.seed_id stamp via a second $executeRaw).
    const inserts = mockExecuteRaw.mock.calls.filter((c) =>
      sqlText(c[0]).includes('INSERT INTO directory_seed_campaign_links'),
    );
    expect(inserts).toHaveLength(2);
  });

  it('is a no-op when the whole family is already attached', async () => {
    setupDb({
      prospectId: 'bp-1',
      siblings: ['camp-primary', 'camp-b'],
      linked: ['camp-primary', 'camp-b'],
    });
    const res = await DirectorySeedCampaignLinkService.ensureProspectSiblingLinks('seed-1');
    expect(res.linked).toEqual([]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('exits early when the seed has no prospect-grouped primary', async () => {
    setupDb({ prospectId: null, siblings: [], linked: [] });
    const res = await DirectorySeedCampaignLinkService.ensureProspectSiblingLinks('seed-1');
    expect(res.linked).toEqual([]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe('ensureSeedLinksForProspect', () => {
  it('resolves the prospect’s primary-linked seed and attaches siblings', async () => {
    setupDb({
      prospectId: 'bp-1',
      seedId: 'seed-1',
      siblings: ['camp-primary', 'camp-new'],
      linked: ['camp-primary'],
    });
    const res = await DirectorySeedCampaignLinkService.ensureSeedLinksForProspect('bp-1');
    expect(res.linked).toEqual(['camp-new']);
    const inserts = mockExecuteRaw.mock.calls.filter((c) =>
      sqlText(c[0]).includes('INSERT INTO directory_seed_campaign_links'),
    );
    expect(inserts).toHaveLength(1);
  });

  it('does nothing when the prospect has no primary-linked seed', async () => {
    setupDb({ prospectId: 'bp-1', seedId: null, siblings: ['camp-a'], linked: [] });
    const res = await DirectorySeedCampaignLinkService.ensureSeedLinksForProspect('bp-1');
    expect(res.linked).toEqual([]);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe('linkCampaign — family attach on primary link', () => {
  it('a successful primary link auto-attaches the remaining siblings', async () => {
    setupDb({
      prospectId: 'bp-1',
      siblings: ['camp-primary', 'camp-b'],
      linked: ['camp-primary'],
    });
    await DirectorySeedCampaignLinkService.linkCampaign('seed-1', 'camp-primary', 'primary');
    // The primary insert + the sibling attach = 2 link writes (queue
    // seed_id stamps ride alongside each).
    const inserts = mockExecuteRaw.mock.calls.filter((c) =>
      sqlText(c[0]).includes('INSERT INTO directory_seed_campaign_links'),
    );
    expect(inserts).toHaveLength(2);
  });
});
