/**
 * getComposedEnrichment / resetEnrichment — campaign-aware composed packet.
 *
 * A seed with a primary campaign link composes through the CAMPAIGN packet
 * path (composeCampaignSeoPacket — latest non-stub business_analysis audit +
 * reachable cat-id audit), so the "Composed enrichment" panel and
 * "Reset to composed" carry the analyst narrative instead of the audit: null
 * market template. Unlinked seeds keep the market lane. Reset stamps the
 * lane the packet actually came from so the market sweep's campaign-content
 * guard still protects it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCampaignsList,
  mockAuditsList,
  mockProvenance,
  mockQueryRaw,
  mockExecuteRaw,
  mockAudit,
} = vi.hoisted(() => ({
  mockCampaignsList: { findUnique: vi.fn() },
  mockAuditsList: { findMany: vi.fn(), findFirst: vi.fn() },
  mockProvenance: { findFirst: vi.fn() },
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaignsList,
    mkt_audits_list: mockAuditsList,
    directory_field_provenance: mockProvenance,
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

// Market-lane dependencies resolve to null so the campaign lane is isolated
// and the unlinked fallback degrades to the Tier A template.
vi.mock('../intelligence/IntelligenceProfileService', () => ({
  __esModule: true,
  default: {
    resolve: vi.fn(async () => null),
    resolveGoldStandard: vi.fn(async () => null),
  },
  normalizeCategoryKey: (s: string) => (s ?? '').toLowerCase().trim(),
  normalizeReferenceCity: (s: string) => s,
  normalizeReferenceState: (s: string) => s,
}));

import DirectoryPresenceSeedService from '../DirectoryPresenceSeedService';

const CAMPAIGN = {
  id: 'camp-1',
  display_id: 'C-1001',
  category: 'Halal Grocery Store',
  business_name: 'Zabiha Organic Meat & Grocery',
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

const SEED_ROW = {
  id: 'seed-1',
  tenant_id: 'ten-1',
  listing_id: 'list-1',
  business_name: 'Zabiha Organic Meat & Grocery',
  primary_category: 'Halal Grocery Store',
  category: 'Halal Grocery Store',
  city: 'Milwaukee',
  state: 'WI',
  description: 'old description',
  keywords: [],
};

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

/** Dispatcher: dscl link query → link rows; seed join query → seed row. */
function wireQueryRaw(seedRow: any, links: any[]) {
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const q = sqlText(strings);
    if (q.includes('directory_seed_campaign_links')) return links;
    if (q.includes('directory_presence_seeds')) return [seedRow];
    return [];
  });
}

const callsMatching = (fragment: string) =>
  mockExecuteRaw.mock.calls.filter((c) => sqlText(c[0]).includes(fragment));

describe('getComposedEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
    mockAuditsList.findMany.mockResolvedValue([BA_AUDIT]);
    mockAuditsList.findFirst.mockResolvedValue(null); // no cat-id audit
    mockProvenance.findFirst.mockResolvedValue(null);
  });

  it('composes through the campaign packet for a primary-linked seed (audit narrative)', async () => {
    wireQueryRaw(SEED_ROW, [{ campaign_id: 'camp-1' }]);

    const res = await DirectoryPresenceSeedService.getComposedEnrichment('seed-1');

    expect(res.sourceName).toBe('business_analysis_audit');
    expect(res.packet.description).toContain('certified halal grocer');
    expect(res.packet.description).toContain('Listed on VisibleShelf');
    expect(res.packet.inputs.auditId).toBe('ba-1');
  });

  it('falls back to the market template for an unlinked seed', async () => {
    wireQueryRaw(SEED_ROW, []);

    const res = await DirectoryPresenceSeedService.getComposedEnrichment('seed-1');

    expect(res.packet.description).toContain('Zabiha Organic Meat & Grocery is a');
    expect(res.packet.description).not.toContain('certified halal grocer');
    expect(res.sourceName).toBe('none');
  });
});

describe('resetEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.findUnique.mockResolvedValue(CAMPAIGN);
    mockAuditsList.findMany.mockResolvedValue([BA_AUDIT]);
    mockAuditsList.findFirst.mockResolvedValue(null);
    mockProvenance.findFirst.mockResolvedValue(null);
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('writes the campaign packet and stamps campaign provenance on a linked seed', async () => {
    wireQueryRaw(SEED_ROW, [{ campaign_id: 'camp-1' }]);

    await DirectoryPresenceSeedService.resetEnrichment('seed-1', { actorType: 'user' });

    // The listing write carries the narrative packet, not the template.
    const listingUpdate = callsMatching('UPDATE directory_listings_list')[0];
    expect(
      listingUpdate.slice(1).some((v) => String(v).includes('certified halal grocer')),
    ).toBe(true);

    // Provenance upserts stamp the audit lane — never market_enrichment — so
    // the market sweep's campaign-content guard keeps protecting the seed.
    const provInserts = callsMatching('INSERT INTO directory_field_provenance');
    expect(provInserts).toHaveLength(2);
    for (const c of provInserts) {
      expect(c.slice(1).some((v) => v === 'business_analysis_audit')).toBe(true);
      expect(c.slice(1).some((v) => v === 'market_enrichment')).toBe(false);
    }

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'directory_enrichment.operator_reset' }),
    );
  });
});
