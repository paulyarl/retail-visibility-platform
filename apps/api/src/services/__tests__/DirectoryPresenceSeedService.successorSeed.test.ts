/**
 * createFromCampaign — successor-seed birth after a cat-id Promote swap.
 *
 * A seed is a child of the campaign, and the child relationship is per
 * shelf filing. The idempotency check is SHELF-AWARE: a primary-linked
 * seed only short-circuits the create when its listing is already filed
 * under the campaign's CURRENT primary. When Promote moved the primary,
 * this call births the SUCCESSOR seed for the new shelf — the act route
 * then suppresses the prior child so exactly one seed per campaign is
 * live (retire-and-replace: single claim source, no co-visible siblings).
 *
 * The successor's secondaries mirror the campaign's list verbatim — the
 * demoted incumbent primary sits among them, so the one visible seed
 * still covers BOTH shelves.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignsList, mockAuditsList, mockQueryRaw, mockLinkCampaign } = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn() },
  mockAuditsList: { findMany: vi.fn(), findFirst: vi.fn() },
  mockQueryRaw: vi.fn(),
  mockLinkCampaign: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/marketing-audits', () => ({
  isStubBusinessAnalysisAudit: () => false,
}));

vi.mock('../DirectorySeedCampaignLinkService', () => ({
  default: { linkCampaign: mockLinkCampaign },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const CAMPAIGN = {
  id: 'camp-1',
  display_id: 'C-1001',
  // Post-swap campaign state: Promote made the cat-id recommendation the
  // primary and demoted the discovery-inherited primary to secondary.
  category: 'Halal Grocery Store',
  secondary_categories: ['Middle Eastern Grocery Store', 'Butcher Shop'],
  business_name: 'Zabiha Organic Meat & Grocery',
  address_line1: '123 N Water St',
  address_city: 'Milwaukee',
  address_state: 'WI',
  address_zip: '53202',
  phone: '4145550100',
  website_url: 'https://zabiha.example.com',
};

const BA_AUDIT = {
  id: 'ba-1',
  audit_data: {
    audit_metadata: { identity_status: 'confirmed' },
    summary: 'Certified halal grocer and butcher.',
  },
};

const CAT_ID_AUDIT = {
  id: 'cat-1',
  audit_data: {
    public_narrative: 'A certified halal grocer serving the north side.',
    candidate_categories: [{ category: 'Halal Grocery Store' }],
  },
};

// The prior seed — filed pre-swap under the OLD primary. The act route
// suppresses it after the successor is born; this method only births.
const RETAINED_SEED = {
  seed_id: 'seed-old',
  listing_id: 'list-old',
  tenant_id: 'ten-old',
  slug: 'old-seed-slug',
  is_published: true,
  primary_category: 'Middle Eastern Grocery Store',
};

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

function seedLinkedRows(rows: any[]) {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    if (q.includes('directory_seed_campaign_links')) return rows;
    if (q.includes('directory_listings_list')) return [{ slug: 'new-sibling-slug' }];
    return [];
  });
}

describe('createFromCampaign — shelf-aware idempotency + successor seeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
    mockAuditsList.findMany.mockResolvedValue([BA_AUDIT]);
    mockAuditsList.findFirst.mockResolvedValue(CAT_ID_AUDIT);
    mockLinkCampaign.mockResolvedValue(undefined);
  });

  it('returns the covering seed unchanged when a linked listing already holds the current primary', async () => {
    seedLinkedRows([{ ...RETAINED_SEED, primary_category: 'Halal Grocery Store' }]);
    const createSeed = vi.spyOn(DirectoryPresenceSeedService as any, 'createSeed');

    const res = await DirectoryPresenceSeedService.createFromCampaign('camp-1', {}, undefined);

    expect(res.created).toBe(false);
    expect(res.seedId).toBe('seed-old');
    expect(createSeed).not.toHaveBeenCalled();
    expect(mockLinkCampaign).not.toHaveBeenCalled();
  });

  it('births a successor seed when the linked seed files a different shelf (post-swap)', async () => {
    seedLinkedRows([RETAINED_SEED]);
    const createSeed = vi
      .spyOn(DirectoryPresenceSeedService as any, 'createSeed')
      .mockResolvedValue({ id: 'seed-new', listingId: 'list-new', tenantId: 'ten-new' } as any);

    const res = await DirectoryPresenceSeedService.createFromCampaign(
      'camp-1',
      {},
      { actorType: 'user', actorId: 'op-1' },
    );

    expect(res.created).toBe(true);
    expect(res.seedId).toBe('seed-new');
    expect(res.publicUrl).toBe('/place/new-sibling-slug');

    // The successor is born under the campaign's CURRENT primary…
    const input = createSeed.mock.calls[0][0] as any;
    expect(input.primaryCategory).toBe('Halal Grocery Store');
    // …and mirrors the campaign's full secondary list — the demoted
    // incumbent sits among them, so the single visible seed still covers
    // BOTH shelves (rearranged, not lost).
    expect(input.secondaryCategories).toEqual([
      'Middle Eastern Grocery Store',
      'Butcher Shop',
    ]);
    // …and the partial/full SEO lanes still compose for the new child.
    expect(input.description).toContain('certified halal grocer');

    // Both children share the campaign's primary link — the audit trail
    // survives suppression (the route retires the prior child).
    expect(mockLinkCampaign).toHaveBeenCalledWith(
      'seed-new',
      'camp-1',
      'primary',
      expect.anything(),
    );
  });

  it('seeds normally when the campaign has no linked seeds at all', async () => {
    seedLinkedRows([]);
    const createSeed = vi
      .spyOn(DirectoryPresenceSeedService as any, 'createSeed')
      .mockResolvedValue({ id: 'seed-new', listingId: 'list-new', tenantId: 'ten-new' } as any);

    const res = await DirectoryPresenceSeedService.createFromCampaign('camp-1', {}, undefined);

    expect(res.created).toBe(true);
    // No siblings — secondaries mirror the campaign list verbatim.
    const input = createSeed.mock.calls[0][0] as any;
    expect(input.secondaryCategories).toEqual([
      'Middle Eastern Grocery Store',
      'Butcher Shop',
    ]);
  });
});
