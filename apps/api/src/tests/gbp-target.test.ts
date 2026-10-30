/**
 * GBP target resolver tests (Sprint D1)
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §3.2 / §9 gate #2
 * Pins: tenant vs explicit-location scopes, token resolution per granted_via
 * (oauth → owning account; invitation/platform_claim → owning account, which
 * is the platform's row), fail-closed when no token exists, and the
 * platform_account_id → google_account_id → row-id precedence for API paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLocationFindUnique = vi.fn();
const mockLocationFindFirst = vi.fn();
const mockAccountFindUnique = vi.fn();
const mockTenantsFindUnique = vi.fn();
const mockFindGoogleToken = vi.fn();
const mockResolveAccessToken = vi.fn();

vi.mock('../prisma', () => ({
  prisma: {
    gbp_locations_list: {
      findUnique: (...a: any[]) => mockLocationFindUnique(...a),
      findFirst: (...a: any[]) => mockLocationFindFirst(...a),
    },
    google_oauth_accounts_list: { findUnique: (...a: any[]) => mockAccountFindUnique(...a) },
    tenants: { findUnique: (...a: any[]) => mockTenantsFindUnique(...a) },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/google/token-store', () => ({
  findGoogleToken: (...a: any[]) => mockFindGoogleToken(...a),
  resolveGoogleAccessToken: (...a: any[]) => mockResolveAccessToken(...a),
}));

const {
  resolveGbpLocation,
  resolveGbpApiAccountId,
  resolveGbpToken,
  resolveGbpTarget,
} = await import('../lib/google/gbp-target');

const diyLocation = {
  id: 'loc1',
  account_id: 'acct-merchant',
  location_id: '456',
  location_name: 'Shop',
  tenant_id: 't1',
  managed_by: 'self',
  granted_via: 'oauth',
  delegated_surfaces: null,
  platform_account_id: null,
  updated_at: new Date(),
};

const managedLocation = {
  ...diyLocation,
  id: 'loc2',
  account_id: 'acct-platform',
  managed_by: 'platform',
  granted_via: 'platform_claim',
  platform_account_id: 'accounts/777',
};

describe('resolveGbpLocation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads gbp_locations_list by tenant_id (no oauth-account join)', async () => {
    mockLocationFindFirst.mockResolvedValue(diyLocation);
    const loc = await resolveGbpLocation({ tenantId: 't1' });
    expect(mockLocationFindFirst).toHaveBeenCalledWith({
      where: { tenant_id: 't1' },
      orderBy: { updated_at: 'desc' },
    });
    expect(loc?.id).toBe('loc1');
  });

  it('resolves an explicit location row for DFY scope', async () => {
    mockLocationFindUnique.mockResolvedValue(managedLocation);
    const loc = await resolveGbpLocation({ gbpLocationId: 'loc2' });
    expect(loc?.granted_via).toBe('platform_claim');
  });
});

describe('resolveGbpToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves via the location owning account for oauth (DIY)', async () => {
    mockFindGoogleToken.mockResolvedValue({ id: 'tok' });
    mockResolveAccessToken.mockResolvedValue('ya.merchant');
    const token = await resolveGbpToken(diyLocation as any);
    expect(mockFindGoogleToken).toHaveBeenCalledWith('gbp', { accountId: 'acct-merchant' });
    expect(token).toBe('ya.merchant');
  });

  it('resolves via the platform account for platform_claim (never the tenant)', async () => {
    mockFindGoogleToken.mockResolvedValue({ id: 'tok' });
    mockResolveAccessToken.mockResolvedValue('ya.platform');
    const token = await resolveGbpToken(managedLocation as any);
    expect(mockFindGoogleToken).toHaveBeenCalledWith('gbp', { accountId: 'acct-platform' });
    expect(token).toBe('ya.platform');
  });

  it('fails closed — no token row + non-oauth means no legacy fallback', async () => {
    mockFindGoogleToken.mockResolvedValue(null);
    const token = await resolveGbpToken(managedLocation as any);
    expect(mockTenantsFindUnique).not.toHaveBeenCalled();
    expect(token).toBeNull();
  });

  it('allows the legacy tenant-column fallback for oauth locations', async () => {
    mockFindGoogleToken.mockResolvedValue(null);
    mockTenantsFindUnique.mockResolvedValue({ google_business_access_token: 'legacy-tok' });
    const token = await resolveGbpToken(diyLocation as any);
    expect(token).toBe('legacy-tok');
  });
});

describe('resolveGbpApiAccountId / resolveGbpTarget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefers platform_account_id for managed locations', async () => {
    const id = await resolveGbpApiAccountId(managedLocation as any);
    expect(id).toBe('accounts/777');
  });

  it('falls back to google_account_id then the row id', async () => {
    mockAccountFindUnique.mockResolvedValue({ id: 'acct-merchant', google_account_id: 'accounts/123' });
    expect(await resolveGbpApiAccountId(diyLocation as any)).toBe('accounts/123');

    mockAccountFindUnique.mockResolvedValue({ id: 'acct-merchant', google_account_id: null });
    expect(await resolveGbpApiAccountId(diyLocation as any)).toBe('acct-merchant');
  });

  it('resolveGbpTarget returns apiAccountId + locationId + row', async () => {
    mockLocationFindFirst.mockResolvedValue(managedLocation);
    const target = await resolveGbpTarget({ tenantId: 't1' });
    expect(target).toMatchObject({ apiAccountId: 'accounts/777', locationId: '456' });
  });
});
