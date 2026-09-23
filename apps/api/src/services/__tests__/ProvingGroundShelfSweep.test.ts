/**
 * ProvingGroundShelfSweepService tests — PG shelf coverage sweep.
 *
 * The gap: category enrichment is one row per (category_key, city, state) and
 * every prior producer targeted a single market — the PG's own. Prospect
 * secondary categories never reached the pipeline, leaving their public shelf
 * pages unenriched. The sweep covers the PG's full declared + discovered
 * domain: deterministic enrichMarket where a profile exists, one residual
 * set campaign for the rest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError } from '../../middleware/errorHandler';

const {
  mockCampaignFindUnique,
  mockCampaignFindMany,
  mockCampaignUpdate,
  mockQueueFindMany,
  mockSeedFindMany,
  mockListingFindMany,
  mockEnrichmentFindMany,
  mockEnrichMarket,
  mockEnrichLocation,
  mockCreateCampaign,
} = vi.hoisted(() => ({
  mockCampaignFindUnique: vi.fn(),
  mockCampaignFindMany: vi.fn(),
  mockCampaignUpdate: vi.fn(),
  mockQueueFindMany: vi.fn(),
  mockSeedFindMany: vi.fn(),
  mockListingFindMany: vi.fn(),
  mockEnrichmentFindMany: vi.fn(),
  mockEnrichMarket: vi.fn(),
  mockEnrichLocation: vi.fn(),
  mockCreateCampaign: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: {
      findUnique: mockCampaignFindUnique,
      findMany: mockCampaignFindMany,
      update: mockCampaignUpdate,
    },
    mkt_prospect_queue: { findMany: mockQueueFindMany },
    directory_presence_seeds: { findMany: mockSeedFindMany },
    directory_listings_list: { findMany: mockListingFindMany },
    directory_category_enrichment: { findMany: mockEnrichmentFindMany },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../CategoryMarketEnrichmentService', () => ({
  default: { getInstance: () => ({ enrichMarket: mockEnrichMarket }) },
}));

vi.mock('../LocationMarketEnrichmentService', () => ({
  default: { enrichLocation: mockEnrichLocation },
}));

vi.mock('../MarketingCampaignService', () => ({
  MarketingCampaignService: { getInstance: () => ({ createCampaign: mockCreateCampaign }) },
  default: { createCampaign: mockCreateCampaign },
}));

import sweepService from '../ProvingGroundShelfSweepService';
import { categorySetEnrichmentSchema } from '../../validators/directory-enrichment.schema';

const PG = {
  id: 'pg-1',
  campaign_category: 'proving_ground',
  category: 'Halal Market',
  secondary_categories: ['Butcher Shop'],
  city: 'Fort Wayne',
  state: 'IN',
  member_geos: [{ city: 'Auburn', state: 'IN' }],
  title: 'Fort Wayne Halal PG',
};

const noProfile = { skipReasons: { no_active_profile: 1 }, listingsEnriched: 0 };
const enrichedOk = { skipReasons: {}, listingsEnriched: 2, categoryEnrichmentId: 'dce-1' };

/**
 * mockCampaignFindMany routes by where-clause:
 *  - {id: {in}}              → member campaigns (queue-linked)
 *  - {campaign_category}     → active enrichment campaigns (coverage check)
 *  - {parent_campaign_id}    → PG children (merge path)
 */
function routeCampaignFindMany(memberCampaigns: any[], enrichmentCampaigns: any[], pgChildren: any[]) {
  mockCampaignFindMany.mockImplementation(({ where }: any) => {
    if (where?.parent_campaign_id) return Promise.resolve(pgChildren);
    if (where?.campaign_category) return Promise.resolve(enrichmentCampaigns);
    if (where?.id?.in) return Promise.resolve(memberCampaigns);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaignFindUnique.mockResolvedValue(PG);
  mockQueueFindMany.mockResolvedValue([]);
  mockSeedFindMany.mockResolvedValue([]);
  mockListingFindMany.mockResolvedValue([]);
  mockEnrichmentFindMany.mockResolvedValue([]);
  mockEnrichMarket.mockResolvedValue(noProfile);
  mockEnrichLocation.mockResolvedValue({ id: 'dce-loc' });
  mockCreateCampaign.mockResolvedValue({ id: 'set-campaign-1' });
  mockCampaignUpdate.mockResolvedValue({});
  routeCampaignFindMany([], [], []);
});

describe('ProvingGroundShelfSweepService.sweep', () => {
  it('throws when the campaign is not a proving ground', async () => {
    mockCampaignFindUnique.mockResolvedValue({ ...PG, campaign_category: 'review_management' });
    await expect(sweepService.sweep('pg-1')).rejects.toThrow('not a proving ground');
  });

  it('sweeps the declared domain: categories × geos cartesian', async () => {
    const report = await sweepService.sweep('pg-1');

    // {Halal Market, Butcher Shop} × {Fort Wayne, Auburn} = 4 markets
    expect(report.categoryMarkets).toHaveLength(4);
    expect(report.needsAi).toHaveLength(4);
    const keys = report.needsAi.map((m) => `${m.category}|${m.city}`);
    expect(keys).toEqual(expect.arrayContaining([
      'Halal Market|Fort Wayne', 'Halal Market|Auburn',
      'Butcher Shop|Fort Wayne', 'Butcher Shop|Auburn',
    ]));
    expect(report.sweepCampaign).toEqual({ id: 'set-campaign-1', created: true, marketCount: 4 });
    expect(mockCreateCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'category',
        campaignCategory: 'directory_enrichment',
        parentCampaignId: 'pg-1',
        discoveryContext: expect.objectContaining({
          shelf_sweep: expect.objectContaining({ proving_ground_id: 'pg-1' }),
        }),
      }),
      undefined,
    );
  });

  it('discovers per-prospect secondaries from campaigns, listings, and snapshots', async () => {
    mockQueueFindMany.mockResolvedValue([
      {
        category: 'Halal Market',
        city: 'Fort Wayne',
        state: 'IN',
        seed_id: 'seed-1',
        processed_campaign_id: 'camp-biz-1',
        source_campaign_id: null,
        business_snapshot: { identified_category: 'Halal Market', secondary_categories: ['Kebab House'] },
      },
    ]);
    routeCampaignFindMany([
      { id: 'camp-biz-1', category: 'Halal Market', secondary_categories: ['Specialty Grocery'], city: 'Fort Wayne', state: 'IN' },
    ], [], []);
    mockSeedFindMany.mockResolvedValue([{ id: 'seed-1', category: 'Halal Market', listing_id: 'lst-1' }]);
    mockListingFindMany.mockResolvedValue([{ id: 'lst-1', secondary_categories: ['Deli Counter'] }]);

    const report = await sweepService.sweep('pg-1');
    const keys = report.needsAi.map((m) => `${m.category}|${m.city}`);

    // Declared 4 + prospect secondaries in the prospect's market.
    expect(keys).toEqual(expect.arrayContaining([
      'Specialty Grocery|Fort Wayne',
      'Deli Counter|Fort Wayne',
      'Kebab House|Fort Wayne',
    ]));
  });

  it('skips markets with a campaign-applied row (composer_version=2, never overwrites)', async () => {
    mockEnrichmentFindMany.mockResolvedValue([
      { category_key: 'halal market', city: 'Fort Wayne', state: 'IN', composer_version: 2 },
    ]);

    const report = await sweepService.sweep('pg-1');
    const covered = report.categoryMarkets.filter((m) => m.status === 'covered');
    expect(covered).toHaveLength(1);
    expect(covered[0].category).toBe('Halal Market');
    // AI-covered markets are neither re-enriched nor queued into the set campaign.
    const calledFor = mockEnrichMarket.mock.calls.map((c) => `${c[0]}|${c[1]}`);
    expect(calledFor).not.toContain('Halal Market|Fort Wayne');
    expect(report.needsAi.map((m) => `${m.category}|${m.city}`)).not.toContain('Halal Market|Fort Wayne');
  });

  it('queues deterministic baseline rows (composer_version<2) into the set campaign without overwriting', async () => {
    mockEnrichmentFindMany.mockResolvedValue([
      { category_key: 'halal market', city: 'Fort Wayne', state: 'IN', composer_version: 1 },
    ]);

    const report = await sweepService.sweep('pg-1');
    const baseline = report.categoryMarkets.filter((m) => m.status === 'baseline');
    expect(baseline).toHaveLength(1);
    expect(baseline[0].category).toBe('Halal Market');
    // The sweep never overwrites the baseline row itself — enrichMarket is
    // NOT called — but the market rides into the SET campaign payload.
    const calledFor = mockEnrichMarket.mock.calls.map((c) => `${c[0]}|${c[1]}`);
    expect(calledFor).not.toContain('Halal Market|Fort Wayne');
    expect(report.needsAi.map((m) => `${m.category}|${m.city}`)).toContain('Halal Market|Fort Wayne');
    expect(report.sweepCampaign).toEqual({ id: 'set-campaign-1', created: true, marketCount: 4 });
  });

  it('marks markets covered by an active enrichment campaign', async () => {
    routeCampaignFindMany([], [
      { id: 'ec-1', scope: 'category', category: 'Butcher Shop', city: 'Fort Wayne', state: 'IN', stage: 'seek', discovery_context: null },
    ], []);

    const report = await sweepService.sweep('pg-1');
    const flagged = report.categoryMarkets.filter((m) => m.status === 'campaign_exists');
    expect(flagged).toHaveLength(1);
    expect(flagged[0].category).toBe('Butcher Shop');
    // The residual set must NOT include campaign-covered markets.
    expect(report.needsAi.map((m) => `${m.category}|${m.city}`)).not.toContain('Butcher Shop|Fort Wayne');
  });

  it('counts a prior set campaign\'s shelf_sweep payload as coverage', async () => {
    routeCampaignFindMany([], [
      {
        id: 'ec-set', scope: 'category', category: 'Halal Market', city: 'Fort Wayne', state: 'IN', stage: 'seek',
        discovery_context: { shelf_sweep: { markets: [{ category: 'Butcher Shop', city: 'Auburn', state: 'IN' }] } },
      },
    ], []);

    const report = await sweepService.sweep('pg-1');
    expect(report.categoryMarkets.find((m) => m.category === 'Butcher Shop' && m.city === 'Auburn')?.status)
      .toBe('campaign_exists');
  });

  it('enriches deterministically when a profile exists (free path)', async () => {
    mockEnrichMarket.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'Halal Market' ? enrichedOk : noProfile),
    );

    const report = await sweepService.sweep('pg-1');
    const enriched = report.categoryMarkets.filter((m) => m.status === 'enriched');
    expect(enriched).toHaveLength(2); // Halal Market in both geos
    // Deterministic baselines still ride into the set campaign — the SET
    // prompt upgrades them to campaign-applied (composer_version=2) rows.
    expect(report.needsAi.map((m) => m.category)).toContain('Halal Market');
    expect(mockEnrichMarket).toHaveBeenCalledWith(
      'Halal Market', 'Fort Wayne', 'IN',
      expect.objectContaining({ triggerSource: 'pg_sweep' }),
      undefined,
    );
  });

  it('enriches uncovered location rows deterministically after the category pass', async () => {
    // All category markets AI-covered → enrichMarket never runs → the
    // __location__ rows are still missing → location pass fills them.
    mockEnrichmentFindMany.mockResolvedValue([
      { category_key: 'halal market', city: 'Fort Wayne', state: 'IN', composer_version: 2 },
      { category_key: 'halal market', city: 'Auburn', state: 'IN', composer_version: 2 },
      { category_key: 'butcher shop', city: 'Fort Wayne', state: 'IN', composer_version: 2 },
      { category_key: 'butcher shop', city: 'Auburn', state: 'IN', composer_version: 2 },
    ]);

    const report = await sweepService.sweep('pg-1');
    expect(report.locationMarkets).toHaveLength(2);
    expect(report.locationMarkets.every((m) => m.status === 'enriched')).toBe(true);
    expect(mockEnrichLocation).toHaveBeenCalledWith(
      'Fort Wayne', 'IN',
      expect.objectContaining({ triggerSource: 'pg_sweep' }),
      undefined,
    );
  });

  it('refreshes the national location row on every sweep', async () => {
    const report = await sweepService.sweep('pg-1');

    // The national refresh is separate from the per-city first-fill pass —
    // it runs unconditionally, even when no city row was written.
    expect(report.nationalLocation).toEqual(
      expect.objectContaining({ city: '__all__', state: '__all__', status: 'enriched' }),
    );
    expect(mockEnrichLocation).toHaveBeenCalledWith(
      '__all__', '__all__',
      expect.objectContaining({ triggerSource: 'pg_sweep' }),
      undefined,
    );
  });

  it('reports a national refresh error without failing the sweep', async () => {
    mockEnrichLocation.mockImplementation((city: string) =>
      city === '__all__' ? Promise.reject(new Error('boom')) : Promise.resolve({ id: 'dce-loc' }),
    );

    const report = await sweepService.sweep('pg-1');
    expect(report.nationalLocation?.status).toBe('error');
    expect(report.nationalLocation?.detail).toBe('boom');
  });

  it('merges residual markets into the existing set campaign on signature conflict', async () => {
    const conflict = new ConflictError('duplicate');
    (conflict as any).existingCampaignId = 'ec-set';
    mockCreateCampaign.mockRejectedValue(conflict);
    routeCampaignFindMany([], [], [
      {
        id: 'ec-set', stage: 'seek',
        discovery_context: { shelf_sweep: { markets: [{ category: 'Halal Market', city: 'Fort Wayne', state: 'IN' }] } },
      },
    ]);

    const report = await sweepService.sweep('pg-1');
    expect(report.sweepCampaign?.created).toBe(false);
    expect(report.sweepCampaign?.id).toBe('ec-set');
    // 4 needsAi markets minus the 1 already in the payload → 3 merged.
    expect(report.sweepCampaign?.mergedMarkets).toBe(3);
    expect(mockCampaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ec-set' },
        data: expect.objectContaining({
          discovery_context: expect.objectContaining({
            shelf_sweep: expect.objectContaining({
              markets: expect.arrayContaining([
                expect.objectContaining({ category: 'Butcher Shop', city: 'Auburn' }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it('respects createCampaign=false (preview mode)', async () => {
    const report = await sweepService.sweep('pg-1', { createCampaign: false });
    expect(report.sweepCampaign).toBeNull();
    expect(report.needsAi.length).toBeGreaterThan(0);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });
});

// ─── category_set_enrichment output schema ───────────────────────────────
// The set apply loop routes each markets[] entry on its own
// category_name/city/state — those fields are REQUIRED (unlike the
// single-market schema where the campaign fields are authoritative).

describe('categorySetEnrichmentSchema', () => {
  const packet = {
    category_name: 'Halal Market',
    city: 'Fort Wayne',
    state: 'IN',
    meta_title: 'Halal Markets in Fort Wayne, IN — VisibleShelf Places',
    description: 'Browse halal markets in Fort Wayne.',
    keywords: ['halal market'],
  };

  it('accepts a markets[] of valid packets', () => {
    const result = categorySetEnrichmentSchema.safeParse({ markets: [packet, { ...packet, category_name: 'Butcher Shop' }] });
    expect(result.success).toBe(true);
  });

  it('rejects a market entry missing its routing coordinates', () => {
    const { city: _c, ...noCity } = packet;
    expect(categorySetEnrichmentSchema.safeParse({ markets: [noCity] }).success).toBe(false);
    const { category_name: _cn, ...noCat } = packet;
    expect(categorySetEnrichmentSchema.safeParse({ markets: [noCat] }).success).toBe(false);
  });

  it('rejects an empty markets array', () => {
    expect(categorySetEnrichmentSchema.safeParse({ markets: [] }).success).toBe(false);
  });
});
