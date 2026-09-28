/**
 * linkCampaign — one seed per prospect (primary-link guard).
 *
 * A seed may bond to many campaigns, but only ONE may hold link_role
 * 'primary' — and that one must be the prospect's primary sibling (or a
 * solo campaign). A non-primary sibling attaches with link_role 'sibling'
 * to the seed owned by its primary; letting it take 'primary' would let a
 * second seed claim the same prospect.
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

const SIBLING_CAMPAIGN = {
  id: 'camp-sibling',
  business_prospect_id: 'bp-1',
  is_primary_sibling: false,
};

const PRIMARY_CAMPAIGN = {
  id: 'camp-primary',
  business_prospect_id: 'bp-1',
  is_primary_sibling: true,
};

const LEGACY_CAMPAIGN = {
  id: 'camp-legacy',
  business_prospect_id: null,
  is_primary_sibling: false,
};

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

function setupDb(opts: { campaign: any; existingPrimary?: any[]; linkedRole?: string }) {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    // computeNapMatch — seed NAP ⨯ campaign NAP. No row → 'none' confidence,
    // which also skips the high-confidence auto-projection path.
    if (q.includes('CROSS JOIN mkt_campaigns_list')) return [];
    // Campaign existence + sibling flags.
    if (q.includes('FROM mkt_campaigns_list')) return [opts.campaign];
    // listLinks result — returns the just-written link.
    if (q.includes('directory_seed_campaign_links dscl')) {
      return [linkRow(opts.campaign.id, opts.linkedRole ?? 'primary')];
    }
    // Existing-primary check (role='primary' only).
    if (q.includes('directory_seed_campaign_links')) {
      return opts.existingPrimary ?? [];
    }
    // Seed existence + tenant.
    if (q.includes('FROM directory_presence_seeds')) {
      return [{ tenant_id: 'ten-1', listing_id: 'list-1' }];
    }
    return [];
  });
}

describe('linkCampaign — primary link guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('refuses link_role=primary for a non-primary sibling campaign', async () => {
    setupDb({ campaign: SIBLING_CAMPAIGN });

    await expect(
      DirectorySeedCampaignLinkService.linkCampaign('seed-1', 'camp-sibling', 'primary'),
    ).rejects.toThrow('non_primary_sibling');

    // The link row must never be written.
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('refuses primary role even when the seed has no primary link yet', async () => {
    setupDb({ campaign: SIBLING_CAMPAIGN, existingPrimary: [] });

    await expect(
      DirectorySeedCampaignLinkService.linkCampaign('seed-1', 'camp-sibling', 'primary'),
    ).rejects.toThrow('non_primary_sibling');
  });

  it('still allows the sibling to attach with link_role=sibling', async () => {
    setupDb({ campaign: SIBLING_CAMPAIGN, linkedRole: 'sibling' });

    const res = await DirectorySeedCampaignLinkService.linkCampaign(
      'seed-1',
      'camp-sibling',
      'sibling',
    );

    expect(mockExecuteRaw).toHaveBeenCalled();
    expect(res.link.campaignId).toBe('camp-sibling');
  });

  it('allows primary role for the primary sibling', async () => {
    setupDb({ campaign: PRIMARY_CAMPAIGN });

    const res = await DirectorySeedCampaignLinkService.linkCampaign(
      'seed-1',
      'camp-primary',
      'primary',
    );

    expect(mockExecuteRaw).toHaveBeenCalled();
    expect(res.link.campaignId).toBe('camp-primary');
  });

  it('allows primary role for a legacy solo campaign (null prospect)', async () => {
    setupDb({ campaign: LEGACY_CAMPAIGN });

    const res = await DirectorySeedCampaignLinkService.linkCampaign(
      'seed-1',
      'camp-legacy',
      'primary',
    );

    expect(mockExecuteRaw).toHaveBeenCalled();
    expect(res.link.campaignId).toBe('camp-legacy');
  });
});
