/**
 * PlatformHomeSingletonService — Google status reads.
 *
 * Regression guard for the "frontend appears blind" report: the Google
 * Integrations Overview showed **"Not Connected" / "Not configured" /
 * "NaN% healthy"** while the API was returning `{"isConnected":true}` and
 * `{"hasGMCConnection":true}`.
 *
 * These three methods returned the *envelope* (`result.data`) or the whole
 * `ApiResult` (`result`) instead of the payload, so every field a caller read —
 * `isConnected`, `hasGMCConnection`, `hasGoogleAccount` — was `undefined`.
 *
 * `unwrapApiBody` was already imported into this file and used elsewhere; the
 * Google methods simply hadn't adopted it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { platformHomeService } from './PlatformHomeSingletonService';

const service = platformHomeService as unknown as { makeDefaultRequest: unknown };
const original = service.makeDefaultRequest;

/** Stub the transport with the real double-wrapped envelope. */
const stubTransport = (result: unknown) => {
  service.makeDefaultRequest = vi.fn().mockResolvedValue(result);
};

afterEach(() => {
  service.makeDefaultRequest = original;
  vi.restoreAllMocks();
});

describe('Google status reads return the payload, not the envelope', () => {
  it('getGoogleGBPStatus surfaces isConnected (the Business Profile card)', async () => {
    stubTransport({
      success: true,
      data: {
        success: true,
        data: { isConnected: true, hasAccessToken: true, hasRefreshToken: true },
      },
    });

    await expect(platformHomeService.getGoogleGBPStatus('tid-1')).resolves.toEqual({
      isConnected: true,
      hasAccessToken: true,
      hasRefreshToken: true,
    });
  });

  it('getGoogleMerchantSyncStatus surfaces its fields (the Merchant Center card)', async () => {
    stubTransport({
      success: true,
      data: {
        success: true,
        data: { hasGMCConnection: true, fulfillmentMode: 'standard', syncableProducts: 34 },
      },
    });

    await expect(platformHomeService.getGoogleMerchantSyncStatus('tid-1')).resolves.toEqual({
      hasGMCConnection: true,
      fulfillmentMode: 'standard',
      syncableProducts: 34,
    });
  });

  it('getGoogleFeedJobsSetupStatus surfaces hasGoogleAccount (the setup steps)', async () => {
    stubTransport({
      success: true,
      data: {
        success: true,
        data: { isReady: false, hasGoogleAccount: true, hasOAuthTokens: true, hasMerchantLink: false },
      },
    });

    await expect(platformHomeService.getGoogleFeedJobsSetupStatus('tid-1')).resolves.toEqual({
      isReady: false,
      hasGoogleAccount: true,
      hasOAuthTokens: true,
      hasMerchantLink: false,
    });
  });

  it('never returns the envelope itself', async () => {
    stubTransport({ success: true, data: { success: true, data: { isConnected: true } } });

    const status = (await platformHomeService.getGoogleGBPStatus('tid-1')) as unknown as Record<
      string,
      unknown
    >;
    expect(status).not.toHaveProperty('success');
    expect(status).not.toHaveProperty('data');
  });

  it('mutation methods return the response body, so success/message/data all resolve', async () => {
    // Mutation consumers read `res.success`, `res.message` AND `res.data.*`
    // (e.g. `syncResult.data.syncedFields`), so these must return the body —
    // not the ApiResult, and not the payload.
    stubTransport({
      success: true,
      data: { success: true, message: 'Synced 2 fields', data: { syncedFields: ['name', 'hours'] } },
    });

    const res = await platformHomeService.syncGoogleBusiness('tid-1');

    expect(res.success).toBe(true);
    expect(res.message).toBe('Synced 2 fields');
    expect(res.data.syncedFields).toEqual(['name', 'hours']);
  });

  it('returns null when the transport failed', async () => {
    stubTransport({ success: false, error: { status: 500, message: 'boom', code: 'ERR' } });

    await expect(platformHomeService.getGoogleGBPStatus('tid-1')).resolves.toBeNull();
    await expect(platformHomeService.getGoogleMerchantSyncStatus('tid-1')).resolves.toBeNull();
  });
});
