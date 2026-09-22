/**
 * Unit tests for MarketingPromptService.persistIntelligenceProfileDraft —
 * the §10 post-import hook (GAP-P8), extracted for the national layer sprint.
 *
 * Covers the national ('__all__') sentinel seam:
 *   - A '__all__' establishment campaign imports the draft with
 *     reference_city = NULL (the resolver's national slot), never the literal
 *     '__All__' that normalizeReferenceCity would produce.
 *   - The geography-grid cache upsert is skipped for national campaigns —
 *     '__all__|__ALL__|' is not a real market key.
 *   - City-scoped campaigns are unchanged: literal city, grid upsert runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaigns, mockImportAsDraft, mockUpsertGrid } = vi.hoisted(() => ({
  mockCampaigns: { findUnique: vi.fn(), update: vi.fn() },
  mockImportAsDraft: vi.fn(async () => ({ id: 'mip-test-1', version: 1, category_key: 'african grocery store' })),
  mockUpsertGrid: vi.fn(async () => undefined),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: mockCampaigns,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { marketingOpsHotProspectAutoSyncOnImport: false },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: {},
}));

// The hook dynamic-imports these two — the mocks intercept the same module id.
vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: {
    getInstance: () => ({ importAsDraft: mockImportAsDraft }),
  },
}));

vi.mock('../intelligence/GeographyGridService', () => ({
  GeographyGridService: {
    getInstance: () => ({ upsertGrid: mockUpsertGrid }),
  },
}));

import { MarketingPromptService } from '../MarketingPromptService';

const service = MarketingPromptService.getInstance();

const parsedJson = {
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  specialized_sources: [{ name: 'SNAP retailer list', type: 'other', url: 'https://example.com', priority: 1, capabilities: ['x'], limitations: ['y'] }],
  prohibited_inferences: ['absence is not inactivity'],
  category_signals: ['INT_LOW_VISIBILITY'],
  geography_grid: { city: 'Indianapolis', state: 'IN', zips: ['46268'] },
};

const callHook = (campaignId: string) =>
  (service as any).persistIntelligenceProfileDraft(campaignId, parsedJson);

describe('persistIntelligenceProfileDraft — national (__all__) sentinel seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps __all__ to referenceCity null (the national slot) and skips the grid cache', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      intelligence_focus: 'emerging',
      city: '__all__',
      state: '__all__',
      intelligence_platform: null,
      intelligence_zip_codes: null,
    });

    await callHook('mcamp-national-1');

    expect(mockImportAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryKey: 'african grocery store',
        intelligenceFocus: 'emerging',
        referenceCity: null,
        referencePlatform: null,
      }),
      undefined,
    );
    // No catchment for a national profile — the sentinel must never land as
    // a '__all__|__ALL__|' geography-grid cache row.
    expect(mockUpsertGrid).not.toHaveBeenCalled();
    // Kind marking still runs.
    expect(mockCampaigns.update).toHaveBeenCalledWith({
      where: { id: 'mcamp-national-1' },
      data: { intelligence_campaign_kind: 'establishment' },
    });
  });

  it('treats the sentinel case-insensitively (__ALL__)', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      intelligence_focus: 'competitive',
      city: '__ALL__',
      state: '__ALL__',
      intelligence_platform: 'google',
      intelligence_zip_codes: null,
    });

    await callHook('mcamp-national-2');

    expect(mockImportAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCity: null, intelligenceFocus: 'competitive', referencePlatform: 'google' }),
      undefined,
    );
    expect(mockUpsertGrid).not.toHaveBeenCalled();
  });

  it('city-scoped campaign: literal referenceCity + grid upsert runs', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      intelligence_focus: 'emerging',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_platform: null,
      intelligence_zip_codes: '46268, 46214',
    });

    await callHook('mcamp-indy-1');

    expect(mockImportAsDraft).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCity: 'Indianapolis' }),
      undefined,
    );
    expect(mockUpsertGrid).toHaveBeenCalledTimes(1);
    expect(mockUpsertGrid).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Indianapolis', state: 'IN', sourceProfileId: 'mip-test-1' }),
      undefined,
    );
  });
});
