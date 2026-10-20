/**
 * SeedAnnounceService tests — Four-Act cascade announce markers + queue.
 *
 * The queue must read explicit `announce_delivered` markers, not
 * `outreach_state` (owner_contacted also covers voicemail/no-answer).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockQueryRaw,
  mockAddTouch,
  mockSetState,
  mockResolveClaimUrlForSeed,
  mockLoadBranding,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockAddTouch: vi.fn(),
  mockSetState: vi.fn(),
  mockResolveClaimUrlForSeed: vi.fn(),
  mockLoadBranding: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../DirectoryPresenceSeedService.js', () => ({
  default: {
    addOutreachTouch: mockAddTouch,
    setOutreachState: mockSetState,
  },
}));

vi.mock('../outreach-openers/outreach-link-vars', () => ({
  resolveClaimUrlForSeed: mockResolveClaimUrlForSeed,
}));

vi.mock('../PlatformBrandingService', () => ({
  loadAnnounceBranding: mockLoadBranding,
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: {
    frontendUrl: 'https://example.com',
    webUrl: 'https://example.com',
  },
}));

vi.mock('../../audit', () => ({
  audit: vi.fn(),
}));

import announceService from '../SeedAnnounceService';

const seedRow = {
  id: 'seed-001',
  tenant_id: 'tenant-001',
  status: 'published',
  owner_phone: '317-555-0100',
  owner_email: 'owner@example.com',
  published_at: new Date('2026-10-01T00:00:00Z'),
  business_name: 'Maria’s Market',
  listing_phone: '317-555-0100',
  listing_email: null,
  slug: 'marias-market',
  category: 'grocery',
  city: 'Indianapolis',
  state: 'IN',
};

function branding(overrides: Record<string, any> = {}) {
  return {
    platformName: 'VisibleShelf',
    contactEmail: 'hello@visibleshelf.store',
    contactPhone: '(913) 703-6157',
    contactAddress: '913 Main St',
    contactWebsite: 'https://visibleshelf.store',
    socials: [{ platform: 'instagram', handle: '@visibleshelf' }],
    snapshotDate: '2026-10-19',
    source: 'platform_settings' as const,
    missingRequired: [] as string[],
    missingSocial: false,
    ...overrides,
  };
}

function sqlText(sql: any): string {
  return Array.isArray(sql) ? sql.join('?') : String(sql);
}

function queryResult(sql: any): any[] {
  const s = sqlText(sql);
  if (s.includes('JOIN LATERAL')) return [{
    seed_id: 'seed-001',
    tenant_id: 'tenant-001',
    status: 'published',
    category: 'grocery',
    city: 'Indianapolis',
    state: 'IN',
    published_at: new Date(Date.now() - 5 * 86_400_000),
    owner_phone: '317-555-0100',
    owner_email: null,
    business_name: 'Maria’s Market',
    listing_phone: '317-555-0100',
    listing_email: null,
    announce_scheduled_at: new Date(),
    channel: 'call',
    claim_url: 'https://example.com/place/claim/TOKEN',
    place_url: 'https://example.com/place/marias-market',
  }];
  if (s.includes('WHERE dps.id =')) return [seedRow];
  if (s.includes("outcome IN ('announce_scheduled', 'announce_delivered')")) return [];
  if (s.includes("outcome = 'announce_delivered'")) return [];
  if (s.includes('SELECT outreach_state')) return [{ outreach_state: 'outreach_scheduled' }];
  return [];
}

describe('SeedAnnounceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockImplementation((sql: any) => Promise.resolve(queryResult(sql)));
    mockAddTouch.mockResolvedValue({ id: 'touch-001' });
    mockSetState.mockResolvedValue(undefined);
    mockResolveClaimUrlForSeed.mockResolvedValue('https://example.com/place/claim/TOKEN');
    mockLoadBranding.mockResolvedValue(branding());
  });

  describe('scheduleForSeed', () => {
    it('writes announce_scheduled and sets outreach_scheduled', async () => {
      const result = await announceService.scheduleForSeed('seed-001');

      expect(result.scheduled).toBe(true);
      expect(result.channel).toBe('call');
      expect(mockAddTouch).toHaveBeenCalledWith(
        'seed-001',
        expect.objectContaining({
          channel: 'call',
          outcome: 'announce_scheduled',
        }),
        expect.anything(),
      );
      expect(mockSetState).toHaveBeenCalledWith(
        'seed-001',
        'outreach_scheduled',
        expect.anything(),
      );
      const metadata = mockAddTouch.mock.calls[0][1].metadata;
      expect(metadata.claim_url).toBe('https://example.com/place/claim/TOKEN');
      expect(metadata.identification.contact_phone).toBe('(913) 703-6157');
      expect(metadata.identification_snapshot_date).toBe('2026-10-19');
    });

    it('is idempotent when a marker already exists', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('WHERE dps.id =')) return Promise.resolve([seedRow]);
        if (s.includes("outcome IN ('announce_scheduled', 'announce_delivered')")) {
          return Promise.resolve([{ outcome: 'announce_scheduled' }]);
        }
        return Promise.resolve([]);
      });

      const result = await announceService.scheduleForSeed('seed-001');
      expect(result).toEqual({ scheduled: false, reason: 'already_scheduled' });
      expect(mockAddTouch).not.toHaveBeenCalled();
    });

    it('blocks when required identification is missing', async () => {
      mockLoadBranding.mockResolvedValue(
        branding({ missingRequired: ['contact_phone'] }),
      );

      const result = await announceService.scheduleForSeed('seed-001');
      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe('branding_incomplete');
      expect(result.missingRequired).toEqual(['contact_phone']);
      expect(mockAddTouch).not.toHaveBeenCalled();
    });

    it('does not schedule a draft seed', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('WHERE dps.id =')) {
          return Promise.resolve([{ ...seedRow, status: 'draft' }]);
        }
        return Promise.resolve([]);
      });

      const result = await announceService.scheduleForSeed('seed-001');
      expect(result).toEqual({ scheduled: false, reason: 'seed_not_public' });
    });
  });

  describe('markDelivered', () => {
    it('writes announce_delivered and sets owner_contacted', async () => {
      const result = await announceService.markDelivered('seed-001', {
        channel: 'call',
        verificationResults: [{ type: 'pain_confirmed' }],
      });

      expect(result).toEqual({ delivered: true, channel: 'call' });
      expect(mockAddTouch).toHaveBeenCalledWith(
        'seed-001',
        expect.objectContaining({
          channel: 'call',
          outcome: 'announce_delivered',
        }),
        expect.anything(),
      );
      const metadata = mockAddTouch.mock.calls[0][1].metadata;
      expect(metadata.verification_results).toEqual([{ type: 'pain_confirmed' }]);
      expect(mockSetState).toHaveBeenCalledWith(
        'seed-001',
        'owner_contacted',
        expect.anything(),
      );
    });

    it('is idempotent', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('WHERE dps.id =')) return Promise.resolve([seedRow]);
        if (s.includes("outcome = 'announce_delivered'")) return Promise.resolve([{ '?column?': 1 }]);
        return Promise.resolve([]);
      });

      const result = await announceService.markDelivered('seed-001');
      expect(result).toEqual({ delivered: false, reason: 'already_delivered' });
      expect(mockAddTouch).not.toHaveBeenCalled();
    });

    it('does not regress freshness_verified', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('WHERE dps.id =')) return Promise.resolve([seedRow]);
        if (s.includes('SELECT outreach_state')) {
          return Promise.resolve([{ outreach_state: 'freshness_verified' }]);
        }
        return Promise.resolve([]);
      });

      const result = await announceService.markDelivered('seed-001');
      expect(result.delivered).toBe(true);
      expect(mockSetState).not.toHaveBeenCalled();
    });
  });

  describe('listQueue', () => {
    it('maps the queue row and computes age', async () => {
      const rows = await announceService.listQueue();
      expect(rows).toHaveLength(1);
      expect(rows[0].seedId).toBe('seed-001');
      expect(rows[0].channel).toBe('call');
      expect(rows[0].claimUrl).toBe('https://example.com/place/claim/TOKEN');
      expect(rows[0].ageDays).toBeGreaterThanOrEqual(4);
    });

    it('uses LEFT JOIN so published seeds without a scheduled marker are included', async () => {
      await announceService.listQueue();
      const sqls = mockQueryRaw.mock.calls.map((call) =>
        Array.isArray(call[0]) ? call[0].join('?') : String(call[0]),
      );
      expect(sqls.some((s) => s.includes('LEFT JOIN LATERAL'))).toBe(true);
    });
  });

  describe('isAnnounced', () => {
    it('returns false without a delivered marker', async () => {
      await expect(announceService.isAnnounced('seed-001')).resolves.toBe(false);
    });

    it('returns true with a delivered marker', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes("outcome = 'announce_delivered'")) return Promise.resolve([{ '?column?': 1 }]);
        return Promise.resolve([]);
      });
      await expect(announceService.isAnnounced('seed-001')).resolves.toBe(true);
    });
  });

  describe('markDeliveredForCampaign', () => {
    it('resolves the primary seed and marks it delivered', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('FROM directory_seed_campaign_links')) {
          return Promise.resolve([{ seed_id: 'seed-001' }]);
        }
        if (s.includes('WHERE dps.id =')) return Promise.resolve([seedRow]);
        return Promise.resolve([]);
      });

      const result = await announceService.markDeliveredForCampaign('camp-001', {
        channel: 'call',
      });

      expect(result).toEqual({ delivered: true, channel: 'call' });
      expect(mockAddTouch).toHaveBeenCalledWith(
        'seed-001',
        expect.objectContaining({ outcome: 'announce_delivered' }),
        expect.anything(),
      );
    });

    it('returns no_primary_seed when the campaign has no primary link', async () => {
      mockQueryRaw.mockImplementation((sql: any) => {
        const s = sqlText(sql);
        if (s.includes('FROM directory_seed_campaign_links')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await announceService.markDeliveredForCampaign('camp-001');
      expect(result).toEqual({ delivered: false, reason: 'no_primary_seed' });
      expect(mockAddTouch).not.toHaveBeenCalled();
    });
  });
});
