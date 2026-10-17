/**
 * ssrf-protection middleware.
 *
 * Regression guard for a real production failure: `ALLOWED_DOMAINS` was left
 * holding the scaffold placeholders (`api.example.com`, `cdn.example.com`), and
 * because the whitelist branch activates whenever that array is non-empty, every
 * URL-valued parameter not on it was rejected. The Google OAuth callbacks carry
 * `iss=https://accounts.google.com` and `scope=https://www.googleapis.com/...`,
 * so each one was answered `403 {"error":"Forbidden","message":"Access denied -
 * SSRF protection"}` — the token exchange never ran.
 *
 * The guard should reject internal/metadata hosts, non-HTTPS schemes and odd
 * ports. It should NOT restrict which external domains a client may name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ssrfProtection } from '../ssrf-protection';

const makeReq = (over: Record<string, unknown> = {}) => ({
  query: {},
  params: {},
  body: undefined,
  ip: '203.0.113.10',
  connection: { remoteAddress: '203.0.113.10' },
  ...over,
});

/** Run the middleware and report whether it blocked, and with what status. */
function run(req: Record<string, unknown>) {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();

  ssrfProtection(makeReq(req) as any, res, next);

  return {
    status: res.status.mock.calls[0]?.[0] as number | undefined,
    body: res.json.mock.calls[0]?.[0] as { message?: string } | undefined,
    passed: next.mock.calls.length === 1,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ssrfProtection — legitimate external URLs', () => {
  it('allows the Google OAuth callback params (the production failure)', () => {
    // Exactly the query string Google redirects back with.
    const { passed, status } = run({
      query: {
        state: '{"tenantId":"tid-m8ijkrnk"}',
        iss: 'https://accounts.google.com',
        code: '4/0AXlqoi4NU4k-O510F7QzWxrWLZUGSZkhjMBrQ3_ZzErTzAQrtIDrn1eApKBg0EDdYtkfJQ',
        scope: 'https://www.googleapis.com/auth/business.manage',
      },
    });

    expect(status).toBeUndefined();
    expect(passed).toBe(true);
  });

  it('allows any external https domain named in a parameter', () => {
    expect(run({ query: { url: 'https://www.googleapis.com/auth/business.manage' } }).passed).toBe(true);
    expect(run({ query: { iss: 'https://accounts.google.com' } }).passed).toBe(true);
    expect(run({ query: { redirect: 'https://example.org/path?x=1' } }).passed).toBe(true);
  });

  it('allows parameters that are not URLs at all', () => {
    expect(run({ query: { foo: 'bar' } }).passed).toBe(true);
  });
});

describe('ssrfProtection — genuine threats stay blocked', () => {
  it('blocks cloud metadata endpoints', () => {
    const { status, body } = run({ query: { url: 'http://169.254.169.254/latest/meta-data/' } });
    expect(status).toBe(403);
    expect(body?.message).toBe('Access denied - SSRF protection');
  });

  it('blocks internal hostnames', () => {
    expect(run({ query: { url: 'http://localhost:3000/admin' } }).status).toBe(403);
    expect(run({ query: { url: 'https://metadata.google.internal/x' } }).status).toBe(403);
    expect(run({ query: { url: 'http://host.docker.internal/x' } }).status).toBe(403);
  });

  it('blocks non-HTTPS schemes', () => {
    expect(run({ query: { url: 'http://example.com/x' } }).status).toBe(403);
  });

  it('blocks disallowed ports', () => {
    expect(run({ query: { url: 'https://example.com:8080/x' } }).status).toBe(403);
  });

  it('inspects the request body too', () => {
    expect(run({ body: { nested: { url: 'http://169.254.169.254/' } } }).status).toBe(403);
    expect(run({ body: { url: 'https://example.com/ok' } }).passed).toBe(true);
  });
});
