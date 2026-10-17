/**
 * GoogleIntegrationService — the double-wrapped response envelope.
 *
 * A payload is wrapped twice on its way to this service:
 *
 *   fetch body             → `{ success, data: <payload> }`   (BaseController.handleSuccess)
 *   RequestExecutionUtility → `{ success, data: <parsed body> }` (ApiResult)
 *
 * so the payload lives at `result.data.data`. Reading `result.data` yields the
 * *envelope*, which is what made Connect Business Profile fail with "Failed to
 * get Google Business Profile OAuth URL" on a perfectly good `200` — and broke
 * Connect Google Account identically.
 *
 * The payloads below are the exact bodies the API returned in the failing
 * requests, so this is a regression test for the reported bug rather than a
 * restatement of the helper (that helper is covered by lib/api-envelope.test.ts).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { googleIntegrationService } from './GoogleIntegrationService';

const GBP_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?scope=business.manage&client_id=407743626849-14md.apps.googleusercontent.com';
const OAUTH_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?scope=content+business.manage&client_id=407743626849-l1na.apps.googleusercontent.com';

const service = googleIntegrationService as unknown as {
  makeDefaultRequest: unknown;
};
const original = service.makeDefaultRequest;

/** Stub the transport with the exact envelope shape the API returns. */
const stubTransport = (result: unknown) => {
  service.makeDefaultRequest = vi.fn().mockResolvedValue(result);
};

afterEach(() => {
  service.makeDefaultRequest = original;
  vi.restoreAllMocks();
});

describe('getGBPAuthorizeUrl', () => {
  it('resolves the authorize URL from the double-wrapped envelope', async () => {
    // The body from the failing "Connect Business Profile" request.
    stubTransport({ success: true, data: { success: true, data: { url: GBP_URL } } });

    await expect(googleIntegrationService.getGBPAuthorizeUrl('tid-m8ijkrnk')).resolves.toBe(GBP_URL);
  });

  it('still resolves when the route returns a bare payload', async () => {
    stubTransport({ success: true, data: { url: GBP_URL } });

    await expect(googleIntegrationService.getGBPAuthorizeUrl('tid-m8ijkrnk')).resolves.toBe(GBP_URL);
  });

  it('throws when the payload genuinely carries no url', async () => {
    stubTransport({ success: true, data: { success: true, data: {} } });

    await expect(googleIntegrationService.getGBPAuthorizeUrl('tid-m8ijkrnk')).rejects.toThrow(
      'Failed to get Google Business Profile OAuth URL',
    );
  });

  it('throws when the request itself failed', async () => {
    stubTransport({ success: false, error: { status: 500, message: 'boom', code: 'ERR' } });

    await expect(googleIntegrationService.getGBPAuthorizeUrl('tid-m8ijkrnk')).rejects.toThrow(
      'Failed to get Google Business Profile OAuth URL',
    );
  });
});

describe('getOAuthAuthorizeUrl', () => {
  it('resolves the Connect Google Account URL from the same envelope', async () => {
    stubTransport({ success: true, data: { success: true, data: { url: OAUTH_URL } } });

    await expect(googleIntegrationService.getOAuthAuthorizeUrl('tid-m8ijkrnk')).resolves.toBe(OAUTH_URL);
  });

  it('throws when the payload carries no url', async () => {
    stubTransport({ success: true, data: { success: true, data: null } });

    await expect(googleIntegrationService.getOAuthAuthorizeUrl('tid-m8ijkrnk')).rejects.toThrow(
      'Failed to get Google OAuth URL',
    );
  });
});

describe('getStatus', () => {
  it('reads connection state from the payload, not the envelope', async () => {
    // Regression: returning the envelope made `isConnected` undefined, so a
    // connected tenant rendered as "Not connected".
    stubTransport({
      success: true,
      data: { success: true, data: { isConnected: true, email: 'owner@example.com' } },
    });

    await expect(googleIntegrationService.getStatus('tid-m8ijkrnk')).resolves.toEqual({
      isConnected: true,
      email: 'owner@example.com',
    });
  });
});
