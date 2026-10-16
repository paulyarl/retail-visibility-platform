import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockTokensFindFirst } = vi.hoisted(() => ({
  mockTokensFindFirst: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_deliverable_preview_tokens: { findFirst: mockTokensFindFirst },
    mkt_campaigns_list: { findUnique: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { webUrl: 'http://localhost:3000' },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: { getCampaign: vi.fn() },
}));

vi.mock('../MarketingBrandingService', () => ({
  MarketingBrandingService: {
    getInstance: () => ({ getActiveConfig: vi.fn().mockResolvedValue(null) }),
    applyBrandingToDoc: vi.fn(),
    applyWatermark: vi.fn(),
  },
}));

import { MarketingDeliverableService } from '../MarketingDeliverableService';

// Gallery short-code resolution — token-aware redirect: the code→campaign
// mapping is permanent, so a dead encoded token resolves to the campaign's
// current live token of the same type (printed QRs survive reissue), and
// falls back to the dead token itself so /preview renders its expired
// re-activation hook rather than a bare 404.

const svc: any = MarketingDeliverableService.getInstance();

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

const tokenRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'mdpt-1',
  token: 'TOK_OLD',
  token_type: 'diagnostic_gallery',
  campaign_id: 'mcamp-1',
  expires_at: FUTURE,
  converted_at: null,
  paid_at: null,
  ...overrides,
});

describe('MarketingDeliverableService.resolveShortCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for an unknown code', async () => {
    mockTokensFindFirst.mockResolvedValue(null);
    expect(await svc.resolveShortCode('NOPE42')).toBeNull();
  });

  it('resolves a live token directly without a successor lookup', async () => {
    mockTokensFindFirst.mockResolvedValue(tokenRow());
    const result = await svc.resolveShortCode('ABC123');
    expect(result).toEqual({ token: 'TOK_OLD', tokenType: 'diagnostic_gallery' });
    expect(mockTokensFindFirst).toHaveBeenCalledTimes(1);
  });

  it('routes an expired code to the campaign’s current live token of the same type', async () => {
    mockTokensFindFirst
      .mockResolvedValueOnce(tokenRow({ expires_at: PAST }))
      .mockResolvedValueOnce({ token: 'TOK_NEW', token_type: 'diagnostic_gallery' });

    const result = await svc.resolveShortCode('ABC123');

    expect(result).toEqual({ token: 'TOK_NEW', tokenType: 'diagnostic_gallery' });
    expect(mockTokensFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign_id: 'mcamp-1',
          token_type: 'diagnostic_gallery',
          converted_at: null,
          paid_at: null,
        }),
      }),
    );
  });

  it('routes a superseded (converted) code to the live successor', async () => {
    mockTokensFindFirst
      .mockResolvedValueOnce(tokenRow({ converted_at: PAST }))
      .mockResolvedValueOnce({ token: 'TOK_NEW', token_type: 'diagnostic_gallery' });

    const result = await svc.resolveShortCode('ABC123');
    expect(result).toEqual({ token: 'TOK_NEW', tokenType: 'diagnostic_gallery' });
  });

  it('returns the dead token when no live successor exists (expired-hook render)', async () => {
    mockTokensFindFirst
      .mockResolvedValueOnce(tokenRow({ expires_at: PAST }))
      .mockResolvedValueOnce(null);

    const result = await svc.resolveShortCode('ABC123');
    expect(result).toEqual({ token: 'TOK_OLD', tokenType: 'diagnostic_gallery' });
  });
});
