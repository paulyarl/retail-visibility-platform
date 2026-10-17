/**
 * Provider-scoped Google token store.
 *
 * Pins the two things migration 343 exists for:
 *   1. Each provider refreshes with the client that minted its tokens —
 *      Business Profile with its own credentials, Merchant Center with the
 *      default client. Refreshing with the wrong client fails silently and
 *      surfaced as "Connected but token expired" while every API call 404'd.
 *   2. A missing row and a dead refresh token are distinguishable, so routes can
 *      tell the merchant whether to connect or reconnect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTokenFindFirst, mockTokenUpdate, mockRefreshAccessToken } = vi.hoisted(() => ({
  mockTokenFindFirst: vi.fn(),
  mockTokenUpdate: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock('../../../prisma', () => ({
  prisma: {
    google_oauth_tokens_list: {
      findFirst: mockTokenFindFirst,
      update: mockTokenUpdate,
    },
  },
}));

vi.mock('../oauth', () => ({
  decryptToken: (v: string) => `decrypted:${v}`,
  encryptToken: (v: string) => `enc:${v}`,
  refreshAccessToken: mockRefreshAccessToken,
}));

vi.mock('../../../config/unifiedConfig', () => ({
  unifiedConfig: { googleBusinessClientId: 'bp-client', googleBusinessClientSecret: 'bp-secret' },
}));

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resolveGoogleTokenState } from '../token-store';

const EXPIRED = () => new Date(Date.now() - 60_000);
const VALID = () => new Date(Date.now() + 60 * 60 * 1000);

const row = (expires_at: Date) => ({
  id: 'got-1',
  account_id: 'goa-1',
  access_token_encrypted: 'access',
  refresh_token_encrypted: 'refresh',
  expires_at,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockTokenUpdate.mockResolvedValue({});
});

describe('resolveGoogleTokenState', () => {
  it('reports not_connected when the provider has never been authorized', async () => {
    mockTokenFindFirst.mockResolvedValue(null);

    await expect(resolveGoogleTokenState('gbp', { accountId: 'goa-1' })).resolves.toEqual({
      token: null,
      failure: 'not_connected',
    });
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('returns the decrypted token without refreshing while it is still valid', async () => {
    mockTokenFindFirst.mockResolvedValue(row(VALID()));

    await expect(resolveGoogleTokenState('gmc', { accountId: 'goa-1' })).resolves.toEqual({
      token: 'decrypted:access',
      failure: null,
    });
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockTokenUpdate).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and persists the new one', async () => {
    mockTokenFindFirst.mockResolvedValue(row(EXPIRED()));
    mockRefreshAccessToken.mockResolvedValue({ access_token: 'fresh', expires_in: 3600, scope: 's', token_type: 'Bearer' });

    await expect(resolveGoogleTokenState('gmc', { accountId: 'goa-1' })).resolves.toEqual({
      token: 'fresh',
      failure: null,
    });
    expect(mockTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'got-1' } }),
    );
  });

  it('reports refresh_failed when the refresh token is dead', async () => {
    mockTokenFindFirst.mockResolvedValue(row(EXPIRED()));
    mockRefreshAccessToken.mockResolvedValue(null);

    await expect(resolveGoogleTokenState('gmc', { accountId: 'goa-1' })).resolves.toEqual({
      token: null,
      failure: 'refresh_failed',
    });
  });

  it('refreshes Business Profile rows with the Business Profile client', async () => {
    mockTokenFindFirst.mockResolvedValue(row(EXPIRED()));
    mockRefreshAccessToken.mockResolvedValue({ access_token: 'fresh', expires_in: 3600, scope: 's', token_type: 'Bearer' });

    await resolveGoogleTokenState('gbp', { accountId: 'goa-1' });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('decrypted:refresh', {
      clientId: 'bp-client',
      clientSecret: 'bp-secret',
    });
  });

  it('refreshes Merchant Center rows with the default client', async () => {
    mockTokenFindFirst.mockResolvedValue(row(EXPIRED()));
    mockRefreshAccessToken.mockResolvedValue({ access_token: 'fresh', expires_in: 3600, scope: 's', token_type: 'Bearer' });

    await resolveGoogleTokenState('gmc', { accountId: 'goa-1' });

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('decrypted:refresh', {});
  });

  it('scopes the lookup to the provider, so one client cannot read the other row', async () => {
    mockTokenFindFirst.mockResolvedValue(null);

    await resolveGoogleTokenState('gbp', { accountId: 'goa-1' });

    expect(mockTokenFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { account_id: 'goa-1', provider: 'gbp' } }),
    );
  });
});
