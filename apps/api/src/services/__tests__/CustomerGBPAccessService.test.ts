/**
 * CustomerGBPAccessService tests
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §10 quality gate #1
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE0.md Task 10a
 *
 * Verifies:
 * 1. resolveTenant — returns tenantId when bridge link exists
 * 2. resolveTenant — throws GbpLinkNotFoundError (404) when no bridge link exists
 * 3. resolveTenant — throws GbpLinkNotFoundError for foreign customer (cross-customer isolation)
 * 4. resolveLocations — returns locations for linked tenant
 * 5. resolveLocations — reconciles tenant_id drift
 * 6. resolveLocation — returns single location when exactly 1 exists
 * 7. resolveLocation — throws GbpLocationNotFoundError when 0 locations exist
 * 8. resolveLocation — throws MultipleGbpLocationsError when >1 locations exist
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockGbpLinksFindFirst,
  mockGbpLocationsFindMany,
  mockGbpLocationsUpdateMany,
  mockOauthAccountsFindFirst,
  mockGbpLinksUpsert,
} = vi.hoisted(() => ({
  mockGbpLinksFindFirst: vi.fn(),
  mockGbpLocationsFindMany: vi.fn(),
  mockGbpLocationsUpdateMany: vi.fn(),
  mockOauthAccountsFindFirst: vi.fn(),
  mockGbpLinksUpsert: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    mkt_customer_gbp_links: {
      findFirst: mockGbpLinksFindFirst,
      upsert: mockGbpLinksUpsert,
    },
    gbp_locations_list: {
      findMany: mockGbpLocationsFindMany,
      updateMany: mockGbpLocationsUpdateMany,
    },
    google_oauth_accounts_list: {
      findFirst: mockOauthAccountsFindFirst,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock id-generator (used by provisionLink)
vi.mock('../lib/id-generator', () => ({
  generateQuickStart: vi.fn().mockReturnValue('gbpl-TEST1234'),
}));

import { CustomerGBPAccessService, GbpLinkNotFoundError, GbpLocationNotFoundError, MultipleGbpLocationsError } from '../services/CustomerGBPAccessService';

// ── Test data ────────────────────────────────────────────────────────────

const CUSTOMER_A = 'cust_a_001';
const CUSTOMER_B = 'cust_b_001';
const TENANT_A = 'tenant_a_001';
const TENANT_B = 'tenant_b_001';
const LINK_ID = 'gbpl-link-001';

const mockLocation = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'loc-001',
  location_id: 'google-loc-001',
  location_name: 'Test Business',
  business_name: null,
  tenant_id: TENANT_A,
  verification_state: 'UNVERIFIED',
  cached_average_rating: null,
  cached_review_count: null,
  rating_cache_updated: null,
  address: '123 Main St',
  phone: '555-0100',
  website_url: 'https://example.com',
  category: 'restaurant',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockOauthAccountsFindFirst.mockResolvedValue(null);
  mockGbpLocationsUpdateMany.mockResolvedValue({ count: 0 });
});

// ── resolveTenant tests ──────────────────────────────────────────────────

describe('CustomerGBPAccessService.resolveTenant', () => {
  it('returns tenantId when bridge link exists', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });

    const svc = CustomerGBPAccessService.getInstance();
    const result = await svc.resolveTenant(CUSTOMER_A);

    expect(result.tenantId).toBe(TENANT_A);
    expect(result.linkId).toBe(LINK_ID);
  });

  it('throws GbpLinkNotFoundError when no bridge link exists', async () => {
    mockGbpLinksFindFirst.mockResolvedValue(null);

    const svc = CustomerGBPAccessService.getInstance();
    await expect(svc.resolveTenant(CUSTOMER_A)).rejects.toThrow(GbpLinkNotFoundError);
  });

  it('throws GbpLinkNotFoundError for foreign customer (cross-customer isolation)', async () => {
    // Customer B has no link — even if customer A's link exists, B can't resolve A's tenant
    mockGbpLinksFindFirst.mockResolvedValue(null);

    const svc = CustomerGBPAccessService.getInstance();
    await expect(svc.resolveTenant(CUSTOMER_B)).rejects.toThrow(GbpLinkNotFoundError);

    // Verify the query was scoped to customer B, not customer A
    expect(mockGbpLinksFindFirst).toHaveBeenCalledWith({
      where: { customer_id: CUSTOMER_B },
      orderBy: { created_at: 'asc' },
    });
  });
});

// ── resolveLocations tests ───────────────────────────────────────────────

describe('CustomerGBPAccessService.resolveLocations', () => {
  it('returns locations for linked tenant', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });
    mockGbpLocationsFindMany.mockResolvedValue([mockLocation()]);

    const svc = CustomerGBPAccessService.getInstance();
    const locations = await svc.resolveLocations(CUSTOMER_A);

    expect(locations).toHaveLength(1);
    expect(locations[0].locationName).toBe('Test Business');
    expect(locations[0].tenantId).toBe(TENANT_A);
  });

  it('reconciles tenant_id drift on gbp_locations_list', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });
    // OAuth account exists for the tenant
    mockOauthAccountsFindFirst.mockResolvedValue({
      id: 'oauth-001',
      tenant_id: TENANT_A,
    });
    // Drift detected: some locations have wrong tenant_id
    mockGbpLocationsUpdateMany.mockResolvedValue({ count: 2 });
    mockGbpLocationsFindMany.mockResolvedValue([mockLocation()]);

    const svc = CustomerGBPAccessService.getInstance();
    await svc.resolveLocations(CUSTOMER_A);

    // Verify drift reconciliation was called
    expect(mockGbpLocationsUpdateMany).toHaveBeenCalledWith({
      where: {
        account_id: 'oauth-001',
        tenant_id: { not: TENANT_A },
      },
      data: { tenant_id: TENANT_A },
    });
  });
});

// ── resolveLocation (v1 single-location convenience) tests ───────────────

describe('CustomerGBPAccessService.resolveLocation', () => {
  it('returns single location when exactly 1 exists', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });
    mockGbpLocationsFindMany.mockResolvedValue([mockLocation()]);

    const svc = CustomerGBPAccessService.getInstance();
    const location = await svc.resolveLocation(CUSTOMER_A);

    expect(location.locationName).toBe('Test Business');
  });

  it('throws GbpLocationNotFoundError when 0 locations exist', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });
    mockGbpLocationsFindMany.mockResolvedValue([]);

    const svc = CustomerGBPAccessService.getInstance();
    await expect(svc.resolveLocation(CUSTOMER_A)).rejects.toThrow(GbpLocationNotFoundError);
  });

  it('throws MultipleGbpLocationsError when >1 locations exist', async () => {
    mockGbpLinksFindFirst.mockResolvedValue({
      id: LINK_ID,
      customer_id: CUSTOMER_A,
      tenant_id: TENANT_A,
    });
    mockGbpLocationsFindMany.mockResolvedValue([
      mockLocation({ id: 'loc-001' }),
      mockLocation({ id: 'loc-002', location_name: 'Second Location' }),
    ]);

    const svc = CustomerGBPAccessService.getInstance();
    await expect(svc.resolveLocation(CUSTOMER_A)).rejects.toThrow(MultipleGbpLocationsError);
  });
});
