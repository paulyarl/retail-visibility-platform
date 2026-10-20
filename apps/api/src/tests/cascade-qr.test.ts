/**
 * Cascade tagged short-link route tests (Phase 3).
 *
 * GET /api/public/cascade/scan/:code
 *   - resolves a gallery/confirm short code
 *   - records the requested cascade surface with product_id = prospect/campaign
 *   - returns the destination URL for /cf/[code]
 *   - a confirm-page scan is `cascade_confirm`, not `cascade_gallery`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockQueryRaw,
  mockTrackQrScanEvent,
  mockResolveShortCode,
  mockLogger,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockTrackQrScanEvent: vi.fn(),
  mockResolveShortCode: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock('../services/QrAnalyticsService', () => ({
  trackQrScanEvent: mockTrackQrScanEvent,
}));

vi.mock('../services/MarketingDeliverableService', () => ({
  MarketingDeliverableService: {
    getInstance: () => ({ resolveShortCode: mockResolveShortCode }),
  },
}));

vi.mock('../services/ProspectReportService', () => ({ default: {} }));
vi.mock('../logger', () => ({ logger: mockLogger }));

import prospectReportPublicRoutes from '../routes/prospect-report-public';

const app = express();
app.use('/api/public', prospectReportPublicRoutes);

beforeEach(() => {
  vi.clearAllMocks();
  mockTrackQrScanEvent.mockResolvedValue(undefined);
});

describe('GET /api/public/cascade/scan/:code', () => {
  it('records cascade_postcard with the prospect id and returns the gallery URL', async () => {
    mockResolveShortCode.mockResolvedValue({ token: 'TOK1', tokenType: 'diagnostic_gallery' });
    mockQueryRaw.mockResolvedValueOnce([{
      token: 'TOK1',
      token_type: 'diagnostic_gallery',
      campaign_id: 'camp-1',
      tenant_id: 'tenant-1',
      metadata: { business_prospect_id: 'prospect-1' },
      expires_at: new Date('2026-11-15'),
    }]);

    const res = await request(app)
      .get('/api/public/cascade/scan/SHORT1?surface=cascade_postcard')
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      url: '/preview/TOK1',
      surface: 'cascade_postcard',
      productId: 'prospect-1',
    });
    expect(mockTrackQrScanEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        surface: 'cascade_postcard',
        productId: 'prospect-1',
        source: 'cascade_qr',
      }),
    );
  });

  it('records cascade_gallery for the act-3 gate surface', async () => {
    mockResolveShortCode.mockResolvedValue({ token: 'TOK1', tokenType: 'diagnostic_gallery' });
    mockQueryRaw.mockResolvedValueOnce([{
      token: 'TOK1',
      token_type: 'diagnostic_gallery',
      campaign_id: 'camp-1',
      tenant_id: 'tenant-1',
      metadata: {},
      expires_at: new Date('2026-11-15'),
    }]);

    const res = await request(app)
      .get('/api/public/cascade/scan/SHORT1?surface=cascade_gallery')
      .expect(200);

    expect(res.body.surface).toBe('cascade_gallery');
    expect(mockTrackQrScanEvent).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'cascade_gallery', productId: 'camp-1' }),
    );
  });

  it('returns /confirm/<token> for a confirm_page token', async () => {
    mockResolveShortCode.mockResolvedValue({ token: 'CONF1', tokenType: 'confirm_page' });
    mockQueryRaw.mockResolvedValueOnce([{
      token: 'CONF1',
      token_type: 'confirm_page',
      campaign_id: 'camp-1',
      tenant_id: 'tenant-1',
      metadata: { business_prospect_id: 'prospect-1' },
      expires_at: new Date('2026-11-15'),
    }]);

    const res = await request(app)
      .get('/api/public/cascade/scan/SHORT1?surface=cascade_confirm')
      .expect(200);

    expect(res.body.url).toBe('/confirm/CONF1');
    expect(res.body.surface).toBe('cascade_confirm');
  });

  it('404s an unknown code without recording a scan', async () => {
    mockResolveShortCode.mockResolvedValue(null);

    await request(app).get('/api/public/cascade/scan/NOPE').expect(404);
    expect(mockTrackQrScanEvent).not.toHaveBeenCalled();
  });
});
