/**
 * SeedReportDeliveryService tests — delivery-touch idempotency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteRaw } = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $executeRaw: mockExecuteRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    frontendUrl: 'https://app.example.com',
    webUrl: 'https://app.example.com',
    get: vi.fn(() => null),
  },
}));

vi.mock('../marketing/MarketingReceiptPdfService', () => ({
  loadPlatformBranding: vi.fn().mockResolvedValue({
    platformName: 'Visible Shelf',
    primaryColor: '#000000',
  }),
}));

vi.mock('qrcode', () => ({
  default: { toBuffer: vi.fn() },
}));

import SeedReportDeliveryService, {
  type ReportDeliveryKit,
} from '../intelligence/SeedReportDeliveryService';

const kit: ReportDeliveryKit = {
  seedId: 'seed-1',
  reportVersion: 4,
  reportStatus: 'complete',
  token: 'claim-token',
  shortCode: 'abc123',
  qrUrlPhone: 'https://app.example.com/rp/abc123',
  qrUrlEmail: 'https://app.example.com/re/abc123',
  qrUrlSocial: 'https://app.example.com/rs/abc123',
  qrUrlInPerson: 'https://app.example.com/r/abc123',
  qrUrlText: 'https://app.example.com/rt/abc123',
  reportPreviewUrl: 'https://app.example.com/seed-report/seed-1',
  claimUrl: 'https://app.example.com/place/claim/claim-token',
  businessName: 'Acme Market',
  expiresAt: null,
};

describe('SeedReportDeliveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('uses a UUID and idempotent seed-touch insert for report delivery', async () => {
    await SeedReportDeliveryService.recordDeliveryEvent(kit, 'email', 'operator-1');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const [strings] = mockExecuteRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toContain('INSERT INTO directory_seed_outreach_touches');
    expect(sql).toContain('::uuid');
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toContain("outcome = 'report_delivered'");
  });
});
