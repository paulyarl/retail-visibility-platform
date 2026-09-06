/**
 * directory-claim-qr route tests (sprint plan W10)
 *
 * Verifies the claim-invite QR redirect:
 *  1. Valid token → records scan event with surface='claim_invite' + 302 redirect
 *  2. Invalid token → still records scan (best-effort, platform tenant) + 302 redirect
 *  3. Scan tracking failure → still 302 redirects (best-effort, never blocks claim)
 *  4. Redirect target uses the secret `token` string, not the row `id`
 *  5. Token lookup queries by `t.token`, not `t.id`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

const { mockQueryRaw, mockTrackQrScanEvent, mockLogger } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockTrackQrScanEvent: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// prisma.$queryRaw is a tagged-template function — mock it as a callable
vi.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../services/QrAnalyticsService', () => ({
  trackQrScanEvent: mockTrackQrScanEvent,
}));

vi.mock('../logger', () => ({ logger: mockLogger }));

import directoryClaimQrRoutes from '../routes/directory-claim-qr';

const app = express();
app.use('/api/public', directoryClaimQrRoutes);

const SECRET_TOKEN = 'claim-secret-abc123';

beforeEach(() => {
  vi.clearAllMocks();
  mockTrackQrScanEvent.mockResolvedValue(undefined);
});

describe('GET /api/public/qr/claim/:token — claim-invite QR redirect (W10)', () => {
  it('records a claim_invite scan event and 302-redirects to /place/claim/:token', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ tenant_id: 'tenant-xyz' }]);

    const res = await request(app).get(`/api/public/qr/claim/${SECRET_TOKEN}`).expect(302);

    // Redirect target uses the secret token, not a row id
    expect(res.headers.location).toContain(`/place/claim/${SECRET_TOKEN}`);

    // Scan event recorded with the correct surface + consumer
    expect(mockTrackQrScanEvent).toHaveBeenCalledTimes(1);
    const scanInput = mockTrackQrScanEvent.mock.calls[0][0];
    expect(scanInput.surface).toBe('claim_invite');
    expect(scanInput.consumer).toBe('merchant');
    expect(scanInput.tenantId).toBe('tenant-xyz');
  });

  it('looks up the token by t.token (secret string), not t.id (row uuid)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ tenant_id: 'tenant-xyz' }]);

    await request(app).get(`/api/public/qr/claim/${SECRET_TOKEN}`);

    // $queryRaw tagged template: first arg is the SQL array, rest are interpolated values
    const sqlFragments = mockQueryRaw.mock.calls[0][0] as readonly string[];
    const interpolated = mockQueryRaw.mock.calls[0].slice(1);
    const sql = sqlFragments.join('?');
    expect(sql).toContain('t.token =');
    expect(sql).not.toContain('t.id =');
    expect(interpolated).toContain(SECRET_TOKEN);
  });

  it('records the scan with platform tenant and still redirects when token lookup fails', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('db_error'));

    const res = await request(app).get(`/api/public/qr/claim/invalid-token`).expect(302);

    expect(res.headers.location).toContain('/place/claim/invalid-token');
    expect(mockTrackQrScanEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackQrScanEvent.mock.calls[0][0].tenantId).toBe('platform');
  });

  it('records the scan with platform tenant when no matching token row is found', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const res = await request(app).get(`/api/public/qr/claim/no-such-token`).expect(302);

    expect(res.headers.location).toContain('/place/claim/no-such-token');
    expect(mockTrackQrScanEvent.mock.calls[0][0].tenantId).toBe('platform');
  });

  it('still 302-redirects when scan tracking itself throws (best-effort, never blocks claim)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ tenant_id: 'tenant-xyz' }]);
    mockTrackQrScanEvent.mockRejectedValueOnce(new Error('analytics_down'));

    const res = await request(app).get(`/api/public/qr/claim/${SECRET_TOKEN}`).expect(302);

    expect(res.headers.location).toContain(`/place/claim/${SECRET_TOKEN}`);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
