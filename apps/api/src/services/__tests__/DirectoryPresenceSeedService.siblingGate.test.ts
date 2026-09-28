/**
 * createFromCampaign — one seed per prospect (sibling gate).
 *
 * Sibling campaigns share a business_prospect_id; only the PRIMARY sibling
 * may graduate to a seed. A non-primary sibling's shelf coverage rides the
 * primary's seed via secondary_categories (cat-id Promote expansion), and
 * the sibling attaches to that seed with link_role='sibling' — a second
 * seed would duplicate the business's listing and split the claim surface.
 *
 * The gate fires before any audit/NAP evaluation and carries the resolved
 * primary campaign id so the route can deep-link the operator there.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockAuditsList,
  mockQueryRaw,
  mockLinkCampaign,
  mockGetPrimarySibling,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn() },
  mockAuditsList: { findMany: vi.fn(), findFirst: vi.fn() },
  mockQueryRaw: vi.fn(),
  mockLinkCampaign: vi.fn(),
  mockGetPrimarySibling: vi.fn(),
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

vi.mock('../BusinessProspectService', () => ({
  BusinessProspectService: {
    getInstance: () => ({ getPrimarySibling: mockGetPrimarySibling }),
  },
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const BASE_CAMPAIGN = {
  display_id: 'C-1001',
  scope: 'business',
  category: 'Halal Grocery Store',
  secondary_categories: ['Butcher Shop'],
  business_name: 'Zabiha Organic Meat & Grocery',
  address_line1: '123 N Water St',
  address_city: 'Milwaukee',
  address_state: 'WI',
  address_zip: '53202',
  phone: '4145550100',
};

const PRIMARY_CAMPAIGN = {
  ...BASE_CAMPAIGN,
  id: 'camp-primary',
  business_prospect_id: 'bp-1',
  is_primary_sibling: true,
};

const SIBLING_CAMPAIGN = {
  ...BASE_CAMPAIGN,
  id: 'camp-sibling',
  display_id: 'C-1002',
  business_prospect_id: 'bp-1',
  is_primary_sibling: false,
};

// Pre-sibling-model campaign: legacy rows have no prospect id and an
// unflagged primary marker — each is its own group and may seed freely.
const LEGACY_CAMPAIGN = {
  ...BASE_CAMPAIGN,
  id: 'camp-legacy',
  business_prospect_id: null,
  is_primary_sibling: false,
};

const BA_AUDIT = {
  id: 'ba-1',
  audit_data: {
    audit_metadata: { identity_status: 'confirmed' },
    summary: 'Certified halal grocer and butcher.',
  },
};

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

// Existing live primary-linked seed covering the campaign's current
// primary — the cheap short-circuit so the "allowed" tests don't have to
// exercise seed creation itself.
function coveringSeed() {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    if (q.includes('directory_seed_campaign_links')) {
      return [{
        seed_id: 'seed-1',
        listing_id: 'list-1',
        tenant_id: 'ten-1',
        slug: 'seed-slug',
        is_published: false,
        primary_category: 'Halal Grocery Store',
      }];
    }
    return [];
  });
}

describe('createFromCampaign — one seed per prospect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditsList.findMany.mockResolvedValue([BA_AUDIT]);
    mockAuditsList.findFirst.mockResolvedValue(null);
    mockGetPrimarySibling.mockResolvedValue({ id: 'camp-primary', display_id: 'C-1001' });
    mockLinkCampaign.mockResolvedValue(undefined);
  });

  it('rejects a non-primary sibling with non_primary_sibling + the resolved primary campaign', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(SIBLING_CAMPAIGN);

    const err = await DirectoryPresenceSeedService
      .createFromCampaign('camp-sibling', {}, undefined)
      .catch((e) => e);

    expect(err.message).toBe('non_primary_sibling');
    expect(err.primaryCampaignId).toBe('camp-primary');
    expect(err.primaryCampaignDisplayId).toBe('C-1001');
    // The gate precedes audit evaluation and seed/link writes.
    expect(mockAuditsList.findMany).not.toHaveBeenCalled();
    expect(mockLinkCampaign).not.toHaveBeenCalled();
  });

  it('still rejects when no primary sibling can be resolved', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(SIBLING_CAMPAIGN);
    mockGetPrimarySibling.mockResolvedValue(null);

    const err = await DirectoryPresenceSeedService
      .createFromCampaign('camp-sibling', {}, undefined)
      .catch((e) => e);

    expect(err.message).toBe('non_primary_sibling');
    expect(err.primaryCampaignId).toBeNull();
  });

  it('rejects on the guarded lane too — the sibling gate precedes the seed gate', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(SIBLING_CAMPAIGN);

    await expect(
      DirectoryPresenceSeedService.createFromCampaign('camp-sibling', { lane: 'guarded' }, undefined),
    ).rejects.toThrow('non_primary_sibling');
  });

  it('allows the primary sibling', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(PRIMARY_CAMPAIGN);
    coveringSeed();

    const res = await DirectoryPresenceSeedService.createFromCampaign('camp-primary', {}, undefined);

    expect(res.created).toBe(false);
    expect(res.seedId).toBe('seed-1');
  });

  it('allows a legacy solo campaign (null prospect, unflagged primary marker)', async () => {
    mockCampaignsList.findUnique.mockResolvedValue(LEGACY_CAMPAIGN);
    coveringSeed();

    const res = await DirectoryPresenceSeedService.createFromCampaign('camp-legacy', {}, undefined);

    expect(res.created).toBe(false);
    expect(res.seedId).toBe('seed-1');
    expect(mockGetPrimarySibling).not.toHaveBeenCalled();
  });
});
