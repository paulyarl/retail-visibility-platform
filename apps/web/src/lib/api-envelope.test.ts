import { describe, it, expect } from 'vitest';
import { unwrapApiBody } from './api-envelope';

// Regression coverage for the subdomain settings page reading one envelope level
// too shallow. `makeDefaultRequest` returns the *parsed body* as `ApiResult.data`,
// and API handlers wrap payloads as `{ success, data }` — so a tenant lookup is
// ApiResult → body → body.data. The page read `result?.data?.subdomain`, which
// landed on the envelope (`{ success, data: tenant }`), leaving the "Current
// Subdomain" banner blank and the picker unseeded.
describe('unwrapApiBody', () => {
  it('unwraps the { success, data } envelope returned by API handlers', () => {
    const result = {
      success: true,
      data: { success: true, data: { id: 'tid-8622qs2t', name: 'Ivoire African Market', subdomain: 'ivoire-african-market' } },
    };
    expect(unwrapApiBody(result)).toEqual({
      id: 'tid-8622qs2t',
      name: 'Ivoire African Market',
      subdomain: 'ivoire-african-market',
    });
  });

  it('returns the body itself when the handler payload has no data key', () => {
    const result = {
      success: true,
      data: { success: true, subdomains: [{ tenantId: 'tid-8622qs2t', subdomain: 'ivoire-african-market' }], total: 1 },
    };
    expect(unwrapApiBody(result)).toEqual({
      success: true,
      subdomains: [{ tenantId: 'tid-8622qs2t', subdomain: 'ivoire-african-market' }],
      total: 1,
    });
  });

  it('accepts an already-unwrapped payload', () => {
    expect(unwrapApiBody({ id: 'tid-8622qs2t', subdomain: 'ivoire-african-market' })).toEqual({
      id: 'tid-8622qs2t',
      subdomain: 'ivoire-african-market',
    });
  });

  it('returns null for an unsuccessful request', () => {
    expect(unwrapApiBody({ success: false, error: { status: 404, message: 'Tenant not found', code: 'NOT_FOUND' } })).toBeNull();
  });

  it('returns null for a nullish result', () => {
    expect(unwrapApiBody(null)).toBeNull();
    expect(unwrapApiBody(undefined)).toBeNull();
  });
});
