/**
 * getGoogleBusinessLocations — the Link Location picker's data source.
 *
 * Regression guard. `unwrapApiBody` returns null for a failed transport, so the
 * platform's own pending GBP API allowlist (`503 api_not_approved`) was
 * indistinguishable from "this account has no GBP locations" — the selector told
 * the merchant to set up a profile they already had, blaming them for a
 * platform-side gap.
 *
 * The API answers 503 `api_not_approved` with a tenant-facing `userMessage`;
 * this method must surface that as `unavailable` rather than an empty list.
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

describe('getGoogleBusinessLocations', () => {
  it('returns the location list from the double-wrapped envelope', async () => {
    stubTransport({
      success: true,
      data: {
        success: true,
        data: { locations: [{ locationId: 'loc-1', name: 'Baraka International Market' }] },
      },
    });

    await expect(platformHomeService.getGoogleBusinessLocations('tid-1')).resolves.toEqual({
      locations: [{ locationId: 'loc-1', name: 'Baraka International Market' }],
    });
  });

  it('reports a pending platform allowlist as unavailable, not as an empty list', async () => {
    stubTransport({
      success: false,
      data: null,
      error: {
        status: 503,
        code: 'api_not_approved',
        message: 'Google Business Profile API access is pending approval. This feature will be available soon.',
        userMessage:
          'GBP location linking is temporarily unavailable while we complete platform verification with Google. Please check back later.',
      },
    });

    await expect(platformHomeService.getGoogleBusinessLocations('tid-1')).resolves.toEqual({
      locations: [],
      unavailable: {
        code: 'api_not_approved',
        message:
          'GBP location linking is temporarily unavailable while we complete platform verification with Google. Please check back later.',
      },
    });
  });

  it('prefers the tenant-facing userMessage over the developer message', async () => {
    stubTransport({
      success: false,
      error: { status: 503, code: 'api_not_approved', message: 'developer copy', userMessage: 'tenant copy' },
    });

    const res = await platformHomeService.getGoogleBusinessLocations('tid-1');
    expect(res.unavailable?.message).toBe('tenant copy');
  });

  it('falls back to the developer message when no userMessage is supplied', async () => {
    stubTransport({
      success: false,
      error: { status: 500, code: 'api_error', message: 'Failed to fetch GBP accounts' },
    });

    const res = await platformHomeService.getGoogleBusinessLocations('tid-1');
    expect(res.unavailable?.message).toBe('Failed to fetch GBP accounts');
  });

  it('treats a genuinely empty location list as success, not a failure', async () => {
    stubTransport({ success: true, data: { success: true, data: { locations: [] } } });

    const res = await platformHomeService.getGoogleBusinessLocations('tid-1');
    expect(res.locations).toEqual([]);
    expect(res.unavailable).toBeUndefined();
  });

  it('never reports a failed transport as "no locations"', async () => {
    stubTransport({ success: false, error: { status: 500, message: 'boom', code: 'REQUEST_ERROR' } });

    const res = await platformHomeService.getGoogleBusinessLocations('tid-1');
    expect(res.locations).toEqual([]);
    expect(res.unavailable).toBeDefined();
  });
});
