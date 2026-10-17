/**
 * getGoogleOAuthMerchants — the Link Merchant Center picker's data source.
 *
 * Regression guard. `unwrapApiBody` returns null for a failed transport, so a
 * dead Merchant Center authorization was indistinguishable from "this Google
 * account has no Merchant Center accounts" — the picker told the merchant to
 * create an account they already had, instead of reconnecting Google.
 *
 * The API answers 409 `gmc_not_connected` / `gmc_reconnect_required`; this
 * method must surface that as `unavailable` rather than an empty list.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { platformHomeService } from './PlatformHomeSingletonService';

const service = platformHomeService as unknown as { makeDefaultRequest: unknown };
const original = service.makeDefaultRequest;

const stubTransport = (result: unknown) => {
  service.makeDefaultRequest = vi.fn().mockResolvedValue(result);
};

afterEach(() => {
  service.makeDefaultRequest = original;
  vi.restoreAllMocks();
});

describe('getGoogleOAuthMerchants', () => {
  it('returns the merchant list from the double-wrapped envelope', async () => {
    stubTransport({
      success: true,
      data: {
        success: true,
        data: { merchants: [{ id: '6311349', name: 'Merchant Account 6311349' }], email: 'owner@example.com' },
      },
    });

    await expect(platformHomeService.getGoogleOAuthMerchants('tid-1')).resolves.toEqual({
      merchants: [{ id: '6311349', name: 'Merchant Account 6311349' }],
      email: 'owner@example.com',
    });
  });

  it('distinguishes a dead authorization from an empty account list', async () => {
    stubTransport({
      success: false,
      data: null,
      error: {
        status: 409,
        code: 'gmc_reconnect_required',
        message: 'Your Google authorization has expired. Reconnect your Google account, then try again.',
      },
    });

    await expect(platformHomeService.getGoogleOAuthMerchants('tid-1')).resolves.toEqual({
      merchants: [],
      unavailable: {
        code: 'gmc_reconnect_required',
        message: 'Your Google authorization has expired. Reconnect your Google account, then try again.',
      },
    });
  });

  it('reports a missing authorization as gmc_not_connected', async () => {
    stubTransport({
      success: false,
      error: { status: 409, code: 'gmc_not_connected', message: 'Connect your Google account.' },
    });

    const res = await platformHomeService.getGoogleOAuthMerchants('tid-1');
    expect(res.unavailable?.code).toBe('gmc_not_connected');
  });

  it('treats a genuinely empty account list as success, not a failure', async () => {
    stubTransport({ success: true, data: { success: true, data: { merchants: [], email: null } } });

    const res = await platformHomeService.getGoogleOAuthMerchants('tid-1');
    expect(res.merchants).toEqual([]);
    expect(res.unavailable).toBeUndefined();
  });

  it('never reports a failed transport as "no accounts"', async () => {
    stubTransport({ success: false, error: { status: 500, message: 'boom', code: 'REQUEST_ERROR' } });

    const res = await platformHomeService.getGoogleOAuthMerchants('tid-1');
    expect(res.unavailable).toBeDefined();
    expect(res.unavailable?.message).toBe('boom');
  });
});
