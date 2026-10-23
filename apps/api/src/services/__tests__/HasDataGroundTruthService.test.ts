/**
 * HasDataGroundTruthService tests — prospect-scoped packet persistence.
 *
 * The packet cache is written per (campaign_id, level) but read at
 * business_prospect_id scope: a sibling campaign's fresh packet serves
 * the whole prospect, and stale sibling rows supply place_id so
 * refreshes skip the paid /search call.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockFindCampaign,
  mockConfig,
  mockFetch,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockFindCampaign: vi.fn(),
  mockConfig: { hasdataApiKey: 'test-key' as string | undefined },
  mockFetch: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    mkt_campaigns_list: { findUnique: mockFindCampaign },
  },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: mockConfig,
}));

vi.mock('../../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { HasDataGroundTruthService } from '../HasDataGroundTruthService';

const CAMPAIGN = 'mcamp-s97mviop';

const PACKET = {
  business_name: 'Garaya African Market',
  rating: 4.7,
  review_count: 12,
  primary_type: 'African goods store',
  place_id: 'ChIJAeoFtD5Va4gR25FivnorQzM',
  data_id: '0x886b553eb405ea01:0x33432b7abe6291db',
  reviews: [],
  fetched_at: '2026-10-22T21:36:42.054Z',
  level: 'latest',
  credits_spent: 30,
};

const jsonRes = (body: any) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });

const CAMPAIGN_ROW = {
  business_name: 'Garaya African Market',
  address_line1: '4150 Lafayette Rd Ste C',
  address_city: 'Indianapolis',
  address_state: 'IN',
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 550-7793',
  website_url: null,
};

const PLACE_RES = {
  placeResults: {
    title: 'Garaya African Market',
    rating: 4.7,
    reviews: 12,
    type: 'African goods store',
    types: ['African goods store'],
    address: '4150 Lafayette Rd Ste C, Indianapolis, IN 46254',
    phone: '(317) 550-7793',
    website: null,
  },
};

function sqlText(call: any[]): string {
  // $queryRaw is a tagged template — first arg is the TemplateStringsArray.
  return (call[0] as TemplateStringsArray).join(' ');
}

const fetchUrls = () => mockFetch.mock.calls.map((c) => String(c[0]));

describe('HasDataGroundTruthService — prospect-scoped cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks leaves queued mockResolvedValueOnce values in place —
    // reset so one test's leftover row can't satisfy the next test's read.
    mockQueryRaw.mockReset();
    mockExecuteRaw.mockReset();
    mockFindCampaign.mockReset();
    mockFetch.mockReset();
    mockConfig.hasdataApiKey = 'test-key';
    mockFindCampaign.mockResolvedValue(CAMPAIGN_ROW);
    mockExecuteRaw.mockResolvedValue(1);
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves a fresh packet without any API call and queries at prospect scope', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'moi-1', packet: PACKET, place_id: PACKET.place_id, data_id: PACKET.data_id, fetched_at: PACKET.fetched_at },
    ]);

    const packet = await HasDataGroundTruthService.getInstance().getPacket(CAMPAIGN, 'latest');

    expect(packet?.place_id).toBe(PACKET.place_id);
    expect(mockFetch).not.toHaveBeenCalled();
    // Prospect scope must be present in the cache-read SQL — otherwise a
    // sibling's packet would never be found.
    expect(sqlText(mockQueryRaw.mock.calls[0])).toContain('business_prospect_id');
  });

  it('reuses a sibling packet place_id to skip the paid /search call', async () => {
    // readFreshPacket → empty; readAnyPacket → prior row carrying ids.
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'moi-old', place_id: PACKET.place_id, data_id: PACKET.data_id }]);

    mockFetch
      .mockResolvedValueOnce(jsonRes(PLACE_RES))
      .mockResolvedValueOnce(jsonRes({ topics: [], reviews: [] }));

    const packet = await HasDataGroundTruthService.getInstance().getPacket(CAMPAIGN, 'latest');

    expect(packet?.place_id).toBe(PACKET.place_id);
    // place + reviews only — no /search.
    expect(fetchUrls()).toHaveLength(2);
    expect(fetchUrls().some((u) => u.includes('/search'))).toBe(false);
    expect(fetchUrls()[0]).toContain('/place');
    expect(mockExecuteRaw).toHaveBeenCalledOnce(); // fetch persisted
  });

  it('runs search + place + reviews when the prospect has no prior packet', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    mockFetch
      .mockResolvedValueOnce(jsonRes({ placeResults: { placeId: PACKET.place_id, dataId: PACKET.data_id } }))
      .mockResolvedValueOnce(jsonRes(PLACE_RES))
      .mockResolvedValueOnce(jsonRes({ topics: [], reviews: [] }));

    const packet = await HasDataGroundTruthService.getInstance().getPacket(CAMPAIGN, 'latest');

    expect(packet?.place_id).toBe(PACKET.place_id);
    expect(fetchUrls()).toHaveLength(3);
    expect(fetchUrls()[0]).toContain('/search');
    // credits_spent reflects all three calls.
    // $executeRaw args: (sql, id, campaignId, placeId, dataId, level, packetJson, ...)
    const persisted = JSON.parse(String(mockExecuteRaw.mock.calls[0][6]));
    expect(persisted.credits_spent).toBe(30);
  });

  it('reports cached · 0 credits when a prospect-fresh packet exists', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'moi-1', packet: PACKET, place_id: PACKET.place_id, data_id: PACKET.data_id, fetched_at: PACKET.fetched_at },
    ]);

    const status = await HasDataGroundTruthService.getInstance().getPacketStatus(CAMPAIGN, 'latest');

    expect(status.cached).toBe(true);
    expect(status.est_credits).toBe(0);
    // The knob still needs a refresh price — place_id is on file, so a
    // forced refresh is details + reviews (2 calls), not 3.
    expect(status.refresh_credits).toBe(20);
    expect(status.configured).toBe(true);
  });

  it('latest_review_at is the max parsed date, not row order', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'moi-old', place_id: PACKET.place_id, data_id: PACKET.data_id },
    ]);

    mockFetch
      .mockResolvedValueOnce(jsonRes(PLACE_RES))
      .mockResolvedValueOnce(
        jsonRes({
          topics: [],
          reviews: [
            { rating: 5, isoDate: '2021-07-30T00:56:07.649Z', snippet: 'old first row' },
            { rating: 1, isoDate: '2025-09-30T22:02:23.855Z', snippet: 'Bad experience', response: { snippet: 'sorry' } },
          ],
        }),
      );

    const packet = await HasDataGroundTruthService.getInstance().getPacket(CAMPAIGN, 'latest');

    expect(packet?.latest_review_at).toBe('2025-09-30T22:02:23.855Z');
    expect(packet?.owner_response_rate_observable).toBe(0.5);
  });

  it('returns null without an API key and never reaches HasData', async () => {
    mockConfig.hasdataApiKey = undefined;

    const packet = await HasDataGroundTruthService.getInstance().getPacket(CAMPAIGN, 'latest');

    expect(packet).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('reports cached · 0 credits on a fetchPacket cache hit', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { id: 'moi-1', packet: PACKET, place_id: PACKET.place_id, data_id: PACKET.data_id, fetched_at: PACKET.fetched_at },
    ]);

    const result = await HasDataGroundTruthService.getInstance().fetchPacket(CAMPAIGN, 'latest');

    expect(result.cached).toBe(true);
    // The packet's own credits_spent (30) is historical — this call spent 0.
    expect(result.credits_spent).toBe(0);
    expect(result.packet?.place_id).toBe(PACKET.place_id);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reports the real spend on a fresh fetchPacket', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'moi-old', place_id: PACKET.place_id, data_id: PACKET.data_id }]);

    mockFetch
      .mockResolvedValueOnce(jsonRes(PLACE_RES))
      .mockResolvedValueOnce(jsonRes({ topics: [], reviews: [] }));

    const result = await HasDataGroundTruthService.getInstance().fetchPacket(CAMPAIGN, 'latest');

    expect(result.cached).toBe(false);
    // place + reviews only (place_id reused) = 2 calls.
    expect(result.credits_spent).toBe(20);
  });

  it('collapses concurrent renders for one prospect into a single paid fetch', async () => {
    // Every cache read misses, and the campaign carries no prospect id —
    // both calls therefore key on campaign scope and must share one fetch.
    mockQueryRaw.mockResolvedValue([]);

    mockFetch
      .mockResolvedValueOnce(jsonRes({ placeResults: { placeId: PACKET.place_id, dataId: PACKET.data_id } }))
      .mockResolvedValueOnce(jsonRes(PLACE_RES))
      .mockResolvedValueOnce(jsonRes({ topics: [], reviews: [] }));

    const service = HasDataGroundTruthService.getInstance();
    const [first, second] = await Promise.all([
      service.fetchPacket(CAMPAIGN, 'latest'),
      service.fetchPacket(CAMPAIGN, 'latest'),
    ]);

    // One search + place + reviews — not two of each.
    expect(fetchUrls()).toHaveLength(3);
    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(first.packet?.place_id).toBe(PACKET.place_id);
    expect(second.packet?.place_id).toBe(PACKET.place_id);
    // Only the leader reports the spend; the joined call reports 0.
    expect(first.credits_spent).toBe(30);
    expect(second.credits_spent).toBe(0);
  });
});
