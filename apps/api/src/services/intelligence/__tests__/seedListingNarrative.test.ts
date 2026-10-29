/**
 * resolveSeedListingNarrative — precedence for the public listing copy.
 *
 * `directory_listings_list.description` is a CAT surface, so the order is:
 *   1. category_identification public_narrative (top dog)
 *   2. business_analysis narrative on the linked campaign
 *   3. discovery scan on the campaign
 *   4. discovery scan on its parent
 *   5. null — the caller falls back to the composed packet
 *
 * Lane 4 is load-bearing: a campaign derived from a discovery scan has no
 * discovery audit of its own, so the parent climb is the only route to the
 * analyst narrative.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSeedListingNarrative } from '../auditPublicNarrative';

const CAMPAIGN = 'mcamp-child';
const PARENT = 'mcamp-parent';
const BUSINESS = 'Juba Food Market Llc';

function makePrisma() {
  return {
    mkt_campaigns_list: { findUnique: vi.fn() },
    mkt_audits_list: { findFirst: vi.fn(), findMany: vi.fn() },
  };
}

function wire(
  prisma: ReturnType<typeof makePrisma>,
  opts: {
    parent?: string | null;
    catId?: string | null;
    business?: string[];
    scans?: Array<{ business_name: string; description?: string }>;
  },
) {
  prisma.mkt_campaigns_list.findUnique.mockResolvedValue({
    parent_campaign_id: opts.parent ?? null,
  });
  prisma.mkt_audits_list.findFirst.mockResolvedValue(
    opts.catId ? { id: 'audit-catid', audit_data: { public_narrative: opts.catId } } : null,
  );
  prisma.mkt_audits_list.findMany.mockImplementation(async ({ where }: any) => {
    if (where?.platform === 'business_analysis') {
      return (opts.business ?? []).map((narrative, i) => ({
        id: `audit-biz-${i}`,
        audit_data: { public_narrative: narrative },
      }));
    }
    if (where?.platform === 'intelligence_discovery') {
      return [{ id: 'audit-scan', audit_data: { discovered_businesses: opts.scans ?? [] } }];
    }
    return [];
  });
}

describe('resolveSeedListingNarrative', () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('prefers the category_identification narrative over every other lane', async () => {
    wire(prisma, {
      parent: PARENT,
      catId: 'Cat-id narrative: filed onto the African grocery shelf.',
      business: ['Business analysis narrative.'],
      scans: [{ business_name: BUSINESS, description: 'Discovery blurb.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out).toEqual({
      narrative: 'Cat-id narrative: filed onto the African grocery shelf.',
      source: 'category_identification',
    });
    // Cat-id short-circuits: no business or discovery lookup runs.
    expect(prisma.mkt_audits_list.findMany).not.toHaveBeenCalled();
  });

  it('falls back to the business analysis when no cat-id audit exists', async () => {
    wire(prisma, {
      parent: PARENT,
      catId: null,
      business: ['Business analysis narrative.'],
      scans: [{ business_name: BUSINESS, description: 'Discovery blurb.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out).toEqual({ narrative: 'Business analysis narrative.', source: 'business_analysis' });
  });

  it('skips a stub business analysis (no narrative) and uses the discovery scan', async () => {
    wire(prisma, {
      parent: PARENT,
      catId: null,
      business: [],
      scans: [{ business_name: BUSINESS, description: 'Discovery blurb from the scan.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out).toEqual({ narrative: 'Discovery blurb from the scan.', source: 'discovery_scan' });
  });

  it('climbs to the parent campaign when the child has no discovery audit of its own', async () => {
    wire(prisma, {
      parent: PARENT,
      catId: null,
      business: [],
      scans: [{ business_name: BUSINESS, description: 'Parent discovery narrative.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out?.source).toBe('discovery_scan');
    expect(out?.narrative).toBe('Parent discovery narrative.');
    // The scan lookup must span the campaign AND its parent.
    const scanCall = prisma.mkt_audits_list.findMany.mock.calls.find(
      (c: any) => c[0]?.where?.platform === 'intelligence_discovery',
    );
    expect(scanCall[0].where.campaign_id.in).toEqual([CAMPAIGN, PARENT]);
  });

  it('matches the discovery candidate case-insensitively by business name', async () => {
    wire(prisma, {
      parent: null,
      catId: null,
      business: [],
      scans: [
        { business_name: 'Someone Else', description: 'Wrong business.' },
        { business_name: '  juba food market llc ', description: 'Right business.' },
      ],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out).toEqual({ narrative: 'Right business.', source: 'discovery_scan' });
  });

  it('matches a re-typeset name (Zam Zam vs ZamZam)', async () => {
    wire(prisma, {
      parent: null,
      catId: null,
      business: [],
      scans: [{ business_name: 'Zam Zam Halal Grocery', description: 'Re-typeset match.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: 'ZamZam Halal Grocery',
    });

    expect(out).toEqual({ narrative: 'Re-typeset match.', source: 'discovery_scan' });
  });

  it('matches an ampersand variant (C & G vs C and G)', async () => {
    wire(prisma, {
      parent: null,
      catId: null,
      business: [],
      scans: [{ business_name: 'C and G African Caribbean Market', description: 'Ampersand match.' }],
    });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: 'C & G African Caribbean Market',
    });

    expect(out).toEqual({ narrative: 'Ampersand match.', source: 'discovery_scan' });
  });

  it('returns null when no lane has a narrative (caller composes)', async () => {
    wire(prisma, { parent: null, catId: null, business: [], scans: [] });

    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: CAMPAIGN,
      businessName: BUSINESS,
    });

    expect(out).toBeNull();
  });

  it('returns null without touching the database when there is no campaign', async () => {
    const out = await resolveSeedListingNarrative(prisma, {
      campaignId: null,
      businessName: BUSINESS,
    });

    expect(out).toBeNull();
    expect(prisma.mkt_campaigns_list.findUnique).not.toHaveBeenCalled();
  });
});
