/**
 * resharpenSeedsForCampaign — post-audit sharpen.
 *
 * Fires when a real narrative-bearing audit (business_analysis or
 * category_identification) lands on a campaign. Live primary-linked seeds
 * on the campaign AND its derived children are recomposed through the
 * CAMPAIGN packet path (composeCampaignSeoPacket — the same path seeds are
 * born with), upgrading them from the partial/discovery packet to the
 * audit packet. Claimed/suppressed seeds and seeds with an operator
 * override on the rewritten fields are skipped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockAuditsList, mockQueryRaw, mockExecuteRaw, mockAudit } =
  vi.hoisted(() => ({
    mockCampaignsList: { findUnique: vi.fn() },
    mockAuditsList: { findMany: vi.fn(), findFirst: vi.fn() },
    mockQueryRaw: vi.fn(),
    mockExecuteRaw: vi.fn(),
    mockAudit: vi.fn(),
  }));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/marketing-audits', () => ({
  isStubBusinessAnalysisAudit: () => false,
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const CAMPAIGN = {
  id: 'camp-1',
  display_id: 'C-1001',
  category: 'Halal Grocery Store',
  secondary_categories: ['Middle Eastern Grocery Store'],
  business_name: 'Zabiha Organic Meat & Grocery',
  address_line1: '123 N Water St',
  address_city: 'Milwaukee',
  address_state: 'WI',
};

const BA_AUDIT = {
  id: 'ba-1',
  audit_data: {
    audit_metadata: { identity_status: 'confirmed' },
    public_narrative: 'A certified halal grocer serving the north side.',
    platforms: { google: { profile_url: 'https://maps.google.com/?cid=zabiha' } },
  },
};

const LIVE_SEEDS = [
  { seed_id: 'seed-1', campaign_id: 'camp-1', listing_id: 'list-1', tenant_id: 'ten-1' },
  { seed_id: 'seed-2', campaign_id: 'camp-1', listing_id: 'list-2', tenant_id: 'ten-2' },
];

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

/** Dispatcher: dscl query → seed rows; provenance EXISTS → per-test flag. */
function wireQueryRaw(seeds: any[], overridden: boolean) {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    if (q.includes('directory_field_provenance')) return [{ overridden }];
    if (q.includes('directory_seed_campaign_links')) return seeds;
    return [];
  });
}

const callsMatching = (fragment: string) =>
  mockExecuteRaw.mock.calls.filter((c) => sqlText(c[0]).includes(fragment));

describe('resharpenSeedsForCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
    mockAuditsList.findMany.mockResolvedValue([BA_AUDIT]);
    mockAuditsList.findFirst.mockResolvedValue(null); // no cat-id audit
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('recomposes every live primary-linked seed with the audit packet', async () => {
    wireQueryRaw(LIVE_SEEDS, false);

    const res = await DirectoryPresenceSeedService.resharpenSeedsForCampaign('camp-1', {
      actorType: 'system',
    });

    expect(res.sharpened).toEqual(['seed-1', 'seed-2']);
    expect(res.skipped).toEqual([]);

    // Each seed gets a listing write + a seed write + 3 provenance upserts.
    expect(callsMatching('UPDATE directory_listings_list')).toHaveLength(2);
    expect(callsMatching('UPDATE directory_presence_seeds')).toHaveLength(2);
    expect(callsMatching('INSERT INTO directory_field_provenance')).toHaveLength(6);

    // The full-lane packet lands: BA public_narrative → description.
    const listingUpdate = callsMatching('UPDATE directory_listings_list')[0];
    expect(listingUpdate.slice(1).some((v) => String(v).includes('certified halal grocer'))).toBe(
      true,
    );

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_presence_seed.resharpen' }),
    );
  });

  it('skips a seed whose rewritten fields carry an operator override', async () => {
    wireQueryRaw(LIVE_SEEDS, true);

    const res = await DirectoryPresenceSeedService.resharpenSeedsForCampaign('camp-1');

    expect(res.sharpened).toEqual([]);
    expect(res.skipped).toEqual(['seed-1', 'seed-2']);
    expect(callsMatching('UPDATE directory_listings_list')).toHaveLength(0);
  });

  it('no-ops when the campaign has no live primary-linked seeds', async () => {
    wireQueryRaw([], false);

    const res = await DirectoryPresenceSeedService.resharpenSeedsForCampaign('camp-1');

    expect(res).toEqual({ sharpened: [], skipped: [] });
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
