/**
 * DirectorySeedCleanupService.backfillEnrichment — hours lane.
 *
 * Scan-born seeds are linked to the discovery scan campaign, which never
 * carries `business_hours`; the scan records hours per candidate inside its
 * audit. The backfill used to read only the prospect-queue snapshot, so
 * "hours" stayed permanently in the completeness report's missing list.
 * This pins the campaign fallback: campaign record → campaign audits →
 * the seed's own scan candidate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockExecuteRaw, mockFindAudits, mockComposed } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockFindAudits: vi.fn(),
  mockComposed: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    mkt_audits_list: { findMany: mockFindAudits },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: vi.fn() }));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: vi.fn(() => 'dfp-test'),
}));

vi.mock('../DirectoryPresenceSeedService', () => ({
  default: { getComposedEnrichment: mockComposed },
}));

vi.mock('../ProvingGroundDedupService', () => ({ default: {} }));
vi.mock('../DirectoryChainService', () => ({
  default: {},
  computeChainSignals: vi.fn(() => null),
}));
vi.mock('../directory/listingAttributes', () => ({
  normalizeAttributeEntry: vi.fn((a: any) => a),
}));
vi.mock('../directory/SeedSeoComposer', () => ({
  buildSeoEnrichmentJson: vi.fn(() => ({})),
}));

import DirectorySeedCleanupService from '../DirectorySeedCleanupService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

const CANDIDATE_HOURS = {
  monday: { open: '10:00', close: '18:00', closed: false },
  timezone: 'America/Chicago',
};

const SEED_ROW = {
  id: 'seed-1',
  tenant_id: 'ten-1',
  listing_id: 'list-1',
  status: 'published',
  identity_confidence: 'high',
  seo_enrichment: { present: true },
  business_name: 'Adom African Market',
  address: '8084 N 76th St',
  phone: null,
  website: null,
  city: 'Milwaukee',
  primary_category: 'African Grocery Store',
  secondary_categories: [],
  business_hours: null,
  attributes: [{ key: 'x' }],
  description: 'desc',
  keywords: ['kw'],
  same_as: ['https://example.com'],
  primary_campaign_id: 'mcamp-scan',
  primary_campaign_hours: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(1);
  mockComposed.mockResolvedValue({
    packet: { description: 'desc', keywords: ['kw'], sameAs: [] },
    sourceName: 'campaign_audit',
  });
});

describe('backfillEnrichment — hours from the linked campaign audit', () => {
  it('fills a scan-born seed hours from its discovery candidate record', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([SEED_ROW]) // seeds
      .mockResolvedValueOnce([]) // queue snapshots
      .mockResolvedValueOnce([]); // existing provenance
    mockFindAudits.mockImplementation(async ({ where }: any) =>
      where?.platform === 'intelligence_discovery'
        ? [
            {
              audit_data: {
                discovered_businesses: [
                  { business_name: 'Adom African Market', city: 'Milwaukee', hours: CANDIDATE_HOURS },
                ],
              },
            },
          ]
        : [],
    );

    const out = await DirectorySeedCleanupService.backfillEnrichment({ seedIds: ['seed-1'] });

    expect(out.results[0].hoursWritten).toBe(true);

    const hoursUpdate = mockExecuteRaw.mock.calls.find(
      (c) => sqlText(c[0]).includes('UPDATE directory_listings_list') && sqlText(c[0]).includes('business_hours'),
    );
    expect(hoursUpdate).toBeTruthy();
    expect(hoursUpdate!.slice(1)).toContain(JSON.stringify(CANDIDATE_HOURS));

    const hoursProv = mockExecuteRaw.mock.calls.find(
      (c) => sqlText(c[0]).includes('directory_field_provenance') && sqlText(c[0]).includes("'hours'"),
    );
    expect(hoursProv).toBeTruthy();
    expect(hoursProv!.slice(1)).toContain('linked_campaign');
  });

  it('prefers the queue snapshot when it carries verified hours', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([SEED_ROW])
      .mockResolvedValueOnce([
        {
          seed_id: 'seed-1',
          business_snapshot: {
            verified_nap: { hours: { tuesday: { open: '09:00', close: '17:00', closed: false } } },
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const out = await DirectorySeedCleanupService.backfillEnrichment({ seedIds: ['seed-1'] });

    expect(out.results[0].hoursWritten).toBe(true);
    expect(mockFindAudits).not.toHaveBeenCalled();
    const hoursProv = mockExecuteRaw.mock.calls.find(
      (c) => sqlText(c[0]).includes('directory_field_provenance') && sqlText(c[0]).includes("'hours'"),
    );
    expect(hoursProv!.slice(1)).toContain('verification_call');
  });

  it('leaves hours alone when the listing already has a grid', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ ...SEED_ROW, business_hours: CANDIDATE_HOURS }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const out = await DirectorySeedCleanupService.backfillEnrichment({ seedIds: ['seed-1'] });

    expect(out.results[0].hoursWritten).toBeFalsy();
    expect(
      mockExecuteRaw.mock.calls.some(
        (c) => sqlText(c[0]).includes('UPDATE directory_listings_list') && sqlText(c[0]).includes('business_hours'),
      ),
    ).toBe(false);
  });
});
