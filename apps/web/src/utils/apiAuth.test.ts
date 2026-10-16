/**
 * apiAuth — the upstream Auth0 header bridge
 *
 * Regression: `authenticatedFetch` sent only `Authorization: Bearer`, which the
 * API stopped accepting in the Auth0 migration (docs/auth0-migration-plan.md
 * Phase 2 removed the legacy JWT path from both auth middlewares). Every
 * server-proxied call — the diagnostic screenshot render route, the tenant
 * logo/banner uploads, ~45 route handlers in total — came back
 * `401 authentication_required / "No Auth0 session provided"` and surfaced as a
 * 502 on the platform-fronted render URL.
 *
 * The API reads `x-auth0-id` / `x-auth0-email` (or the `auth0_email` cookie) —
 * the same headers AdminApiSingleton installs client-side. These tests pin that
 * bridge so a future refactor can't silently drop it again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('@/lib/auth0', () => ({ auth0: { getSession: mockGetSession } }));
vi.mock('@/services/AuthSyncService', () => ({
  default: { getInstance: () => ({ getUserByIdentifier: vi.fn() }) },
}));
vi.mock('@/lib/client-logger', () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { authenticatedFetch, createAuthHeaders } from '@/utils/apiAuth';

function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown) => {
      calls.push({ url: String(url), init: (init as RequestInit) ?? {} });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

describe('createAuthHeaders', () => {
  it('includes the Auth0 identity headers the API authenticates with', () => {
    const headers = createAuthHeaders(null, {
      auth0Id: 'google-oauth2|123',
      auth0Email: 'operator@example.com',
    }) as Record<string, string>;

    expect(headers['x-auth0-id']).toBe('google-oauth2|123');
    expect(headers['x-auth0-email']).toBe('operator@example.com');
  });

  it('omits identity headers when there is no session', () => {
    const headers = createAuthHeaders(null, { auth0Id: null, auth0Email: null }) as Record<string, string>;

    expect(headers['x-auth0-id']).toBeUndefined();
    expect(headers['x-auth0-email']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('authenticatedFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends x-auth0-id / x-auth0-email resolved from the Auth0 session', async () => {
    mockGetSession.mockResolvedValue({
      user: { sub: 'google-oauth2|101197082777619041667', email: 'operator@example.com' },
    });
    const calls = captureFetch();

    await authenticatedFetch('/api/admin/marketing-ops/mcamp-1/files/mfile-1/render', 'access-token-abc');

    expect(calls).toHaveLength(1);
    const headers = new Headers(calls[0].init.headers as HeadersInit);
    expect(headers.get('x-auth0-id')).toBe('google-oauth2|101197082777619041667');
    expect(headers.get('x-auth0-email')).toBe('operator@example.com');
    expect(headers.get('authorization')).toBe('Bearer access-token-abc');
  });

  it('omits the identity headers when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const calls = captureFetch();

    await authenticatedFetch('/api/admin/marketing-ops/mcamp-1/files/mfile-1/render', null);

    const headers = new Headers(calls[0].init.headers as HeadersInit);
    expect(headers.get('x-auth0-id')).toBeNull();
    expect(headers.get('x-auth0-email')).toBeNull();
  });

  it('still issues the request when the session read fails', async () => {
    mockGetSession.mockRejectedValue(new Error('no request context'));
    const calls = captureFetch();

    await expect(authenticatedFetch('/api/tenant/profile', null)).resolves.toBeInstanceOf(Response);

    expect(calls).toHaveLength(1);
    const headers = new Headers(calls[0].init.headers as HeadersInit);
    expect(headers.get('x-auth0-id')).toBeNull();
  });
});
