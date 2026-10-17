/**
 * listMerchantAccounts — the "Link Merchant Center" picker's data source.
 *
 * Regression guard. The function used to swallow every failure into `[]`:
 *
 *   if (!response.ok) { ...; return []; }
 *   } catch { ...; return []; }
 *
 * and the route wrapped that as `success: true`. So a Google API error was
 * indistinguishable from "this Google account has no Merchant Center account" —
 * which sent us investigating the account itself, when a Merchant Center account
 * (6311349) was linked to the Business Manager the whole time.
 *
 * These tests pin the two halves: failures must surface with the status and
 * body, and a successful response must still map to the picker's shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock('../../../prisma', () => ({
  prisma: { google_oauth_tokens_list: { findUnique: mockFindUnique } },
}));

vi.mock('../oauth', () => ({
  decryptToken: (v: string) => `decrypted:${v}`,
  encryptToken: (v: string) => `enc:${v}`,
  refreshAccessToken: vi.fn(),
}));

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { listMerchantAccounts } from '../gmc';

const TOKEN_ROW = {
  access_token_encrypted: 'access-token',
  refresh_token_encrypted: 'refresh-token',
  expires_at: new Date(Date.now() + 60 * 60 * 1000),
  scopes: [],
};

const originalFetch = globalThis.fetch;

const stubFetch = (response: unknown) => {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn().mockResolvedValue(response);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(TOKEN_ROW);
});

afterEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
});

describe('listMerchantAccounts', () => {
  it('throws with the Google status and body instead of returning an empty list', async () => {
    stubFetch({
      ok: false,
      status: 403,
      text: async () => '{"error":{"status":"PERMISSION_DENIED","message":"Content API not enabled"}}',
    });

    await expect(listMerchantAccounts('goa-1')).rejects.toThrow(/merchant_accounts_failed: 403/);
    await expect(listMerchantAccounts('goa-1')).rejects.toThrow(/PERMISSION_DENIED/);
  });

  it('maps authinfo accountIdentifiers into the picker shape', async () => {
    stubFetch({
      ok: true,
      json: async () => ({ accountIdentifiers: [{ merchantId: '6311349' }, { aggregatorId: '999' }] }),
    });

    await expect(listMerchantAccounts('goa-1')).resolves.toEqual([
      { accountId: '6311349', name: 'Merchant 6311349', accountName: 'Merchant Account 6311349' },
      { accountId: '999', name: 'Merchant 999', accountName: 'Merchant Account 999' },
    ]);
  });

  it('returns an empty list only when Google genuinely reported none', async () => {
    stubFetch({ ok: true, json: async () => ({ accountIdentifiers: [] }) });

    await expect(listMerchantAccounts('goa-1')).resolves.toEqual([]);
  });

  it('throws when there is no valid access token', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(listMerchantAccounts('goa-1')).rejects.toThrow(/no valid access token/);
  });
});
