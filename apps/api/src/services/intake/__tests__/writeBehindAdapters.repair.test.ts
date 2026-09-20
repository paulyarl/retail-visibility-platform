import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockCampaigns, prismaMock } = vi.hoisted(() => {
  const mockCampaigns = { findUnique: vi.fn(), update: vi.fn() };
  const prismaMock: any = {
    mkt_campaigns_list: mockCampaigns,
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return { mockCampaigns, prismaMock };
});

vi.mock('../../../prisma', () => ({ prisma: prismaMock }));

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: (tenantId: string) => `dfp-${tenantId}-001`,
}));

import { executeFieldMappings } from '../writeBehindAdapters';

// ====================
// FIXTURES
// ====================

const ADAPTER_CTX = {
  intakeId: 'mdint-access-1',
  campaignId: 'mcamp-track-a',
  tenantId: 'tid-1',
};

// Profile Repair Fulfillment Sprint (W3) — the profile_repair_access intake
// carries these two field_mappings:
//   platform_access → repair_fulfillment_write
//   canonical_nap   → repair_canonical_nap_write

describe('repair_fulfillment_write adapter', () => {
  const mappings = [{ field: 'platform_access', adapter: 'repair_fulfillment_write' }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps access answers to platform_status and stamps access metadata', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-track-a',
      repair_fulfillment: { sla_hours: 48 },
    });
    mockCampaigns.update.mockResolvedValue({});

    await executeFieldMappings(mappings, {
      platform_access: {
        google_gbp: 'granted',
        yelp: 'cannot_grant',
        bbb: 'not_applicable',
        facebook_page: 'pending',
      },
    }, ADAPTER_CTX);

    const rf = mockCampaigns.update.mock.calls[0][0].data.repair_fulfillment;
    expect(rf.platform_status.google.status).toBe('access_granted');
    expect(rf.platform_status.yelp.status).toBe('blocked');
    expect(rf.platform_status.bbb.status).toBe('not_applicable');
    expect(rf.platform_status.facebook.status).toBe('awaiting_access');
    expect(rf.access_intake_id).toBe('mdint-access-1');
    expect(rf.access_collected_at).toBeTruthy();
  });

  it('starts the SLA clock only when at least one grant exists', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-track-a',
      repair_fulfillment: { sla_hours: 48 },
    });
    mockCampaigns.update.mockResolvedValue({});

    const before = Date.now();
    await executeFieldMappings(mappings, {
      platform_access: { google_gbp: 'granted' },
    }, ADAPTER_CTX);

    const rf = mockCampaigns.update.mock.calls[0][0].data.repair_fulfillment;
    expect(rf.sla_due_at).toBeTruthy();
    const due = new Date(rf.sla_due_at).getTime();
    // 48h ± a few seconds of test runtime
    expect(due).toBeGreaterThan(before + 47 * 60 * 60 * 1000);
    expect(due).toBeLessThan(before + 49 * 60 * 60 * 1000);
  });

  it('does not set sla_due_at when no platform was granted', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-track-a',
      repair_fulfillment: { sla_hours: 48 },
    });
    mockCampaigns.update.mockResolvedValue({});

    await executeFieldMappings(mappings, {
      platform_access: { google_gbp: 'cannot_grant', yelp: 'pending' },
    }, ADAPTER_CTX);

    const rf = mockCampaigns.update.mock.calls[0][0].data.repair_fulfillment;
    expect(rf.sla_due_at).toBeUndefined();
  });

  it('preserves existing repair_fulfillment keys (deep-merge)', async () => {
    mockCampaigns.findUnique.mockResolvedValue({
      id: 'mcamp-track-a',
      repair_fulfillment: {
        tier: 'standard',
        mode: 'dfy',
        canonical_nap: { business_name: 'Joe\'s' },
        platform_status: { google: { status: 'verified', verified_at: 'x' } },
      },
    });
    mockCampaigns.update.mockResolvedValue({});

    await executeFieldMappings(mappings, {
      platform_access: { yelp: 'granted' },
    }, ADAPTER_CTX);

    const rf = mockCampaigns.update.mock.calls[0][0].data.repair_fulfillment;
    expect(rf.tier).toBe('standard');
    expect(rf.canonical_nap).toEqual({ business_name: 'Joe\'s' });
    // Existing google entry untouched — yelp merged alongside
    expect(rf.platform_status.google.status).toBe('verified');
    expect(rf.platform_status.yelp.status).toBe('access_granted');
  });

  it('skips silently when the campaign is gone (payload-only)', async () => {
    mockCampaigns.findUnique.mockResolvedValue(null);

    await executeFieldMappings(mappings, {
      platform_access: { google_gbp: 'granted' },
    }, ADAPTER_CTX);

    expect(mockCampaigns.update).not.toHaveBeenCalled();
  });
});

describe('repair_canonical_nap_write adapter', () => {
  const mappings = [{ field: 'canonical_nap', adapter: 'repair_canonical_nap_write' }];
  const nap = {
    business_name: 'Joe\'s Plumbing',
    address: '100 Main St',
    phone: '512-555-0100',
    website: 'https://joesplumbing.example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaigns.findUnique.mockResolvedValue({ id: 'mcamp-track-a', repair_fulfillment: {} });
    mockCampaigns.update.mockResolvedValue({});
  });

  it('always stores canonical_nap on the campaign', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // no seed link
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // no tenant seed

    await executeFieldMappings(mappings, { canonical_nap: nap }, ADAPTER_CTX);

    expect(mockCampaigns.update).toHaveBeenCalledWith({
      where: { id: 'mcamp-track-a' },
      data: { repair_fulfillment: expect.objectContaining({ canonical_nap: nap }) },
    });
  });

  it('writes owner-confirmed provenance for all four fields on the primary seed link', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ seed_id: 'seed-1', tenant_id: 'tid-1' }]);
    prismaMock.$executeRaw.mockResolvedValue(1);

    await executeFieldMappings(mappings, { canonical_nap: nap }, ADAPTER_CTX);

    // business_name, address, phone, website → 4 upserts
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(4);

    // Inspect the tagged-template args of the first call
    const [strings, ...params] = prismaMock.$executeRaw.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toContain("'owner_intake'");
    expect(sql).toContain("'high'");
    expect(sql).toContain("'owner_confirmed'");
    expect(sql).toContain('ON CONFLICT (seed_id, field_key) DO UPDATE');
    expect(params).toContain('seed-1');
    expect(params).toContain('tid-1');
    expect(params).toContain('business_name');
    expect(params).toContain('Joe\'s Plumbing');
  });

  it('falls back to the tenant\'s first seed when no campaign link exists', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([]) // no campaign link
      .mockResolvedValueOnce([{ id: 'seed-tenant-1' }]); // tenant fallback
    prismaMock.$executeRaw.mockResolvedValue(1);

    await executeFieldMappings(mappings, { canonical_nap: nap }, ADAPTER_CTX);

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(4);
    const [, ...params] = prismaMock.$executeRaw.mock.calls[0];
    expect(params).toContain('seed-tenant-1');
  });

  it('keeps canonical_nap on the campaign but skips provenance when no seed resolves', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await executeFieldMappings(mappings, { canonical_nap: nap }, ADAPTER_CTX);

    expect(mockCampaigns.update).toHaveBeenCalled();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });

  it('skips null/missing fields — only writes provided values', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ seed_id: 'seed-1', tenant_id: 'tid-1' }]);
    prismaMock.$executeRaw.mockResolvedValue(1);

    await executeFieldMappings(mappings, {
      canonical_nap: { business_name: 'Joe\'s Plumbing', phone: '512-555-0100' },
    }, ADAPTER_CTX);

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
