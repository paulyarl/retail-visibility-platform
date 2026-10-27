import { describe, it, expect } from 'vitest';
import { shouldTrackPath, sanitizeGaPath } from './GtagScript';

/**
 * Pins the GA4 scope gate: the tag measures the public acquisition funnel,
 * so authenticated tenant-ops surfaces must never send a page_view, and
 * token-bearing funnel paths must not leak secrets into page_path.
 */
describe('shouldTrackPath', () => {
  it('skips tenant ops routes under /t/*', () => {
    expect(shouldTrackPath('/t/tid-sud4ky1c/settings/tenant')).toBe(false);
    expect(shouldTrackPath('/t/tid-sud4ky1c/dashboard')).toBe(false);
    expect(shouldTrackPath('/t/tid-abc')).toBe(false);
    expect(shouldTrackPath('/t')).toBe(false);
  });

  it('keeps public surfaces tracked', () => {
    for (const path of [
      '/',
      '/directory',
      '/directory/some-store',
      '/place',
      '/place/grocery',
      '/place/claim', // bare claim entry (no token) is funnel traffic
      '/products',
      '/products/prod-abc123',
      '/shops',
      '/shops/some-store',
      '/shops/featured',
      '/features',
      '/contact',
      '/dashboard', // public PlatformDashboard, not tenant ops
      '/tenant/tid-25we5qgj', // public storefront — NOT the /t/* admin shell
      '/tenant/tid-25we5qgj/policies',
      '/g/abc123', // shared diagnostic-gallery shortcode
    ]) {
      expect(shouldTrackPath(path), path).toBe(true);
    }
  });

  it('skips other authenticated/internal surfaces', () => {
    for (const path of [
      '/tenants/tid-abc/users',
      '/settings/profile',
      '/settings/admin/crm/requests',
      '/account',
      '/orders',
      '/my-orders',
      '/cross-tenant',
      '/onboarding',
      '/accept-invitation',
      '/recovery',
      '/auth/login',
      '/auth/callback',
      '/debug',
      '/sentry-example-page',
      '/test-integration',
    ]) {
      expect(shouldTrackPath(path), path).toBe(false);
    }
  });

  it('does not over-match on shared prefixes', () => {
    // /tenant/* is public storefront; must not be caught by the /t/ rule
    expect(shouldTrackPath('/tenant')).toBe(true);
    expect(shouldTrackPath('/tenant/tid-abc')).toBe(true);
  });
});

describe('sanitizeGaPath', () => {
  it('strips claim tokens from the claim funnel path', () => {
    expect(sanitizeGaPath('/directory/claim/clmtok_secret123')).toBe('/directory/claim');
    expect(sanitizeGaPath('/directory/claim/clmtok_secret123/extra')).toBe('/directory/claim');
  });

  it('strips tokens from every token-bearing funnel path', () => {
    const cases: Array<[string, string]> = [
      ['/directory/claim/tok', '/directory/claim'],
      ['/directory/enrich/tok', '/directory/enrich'],
      ['/marketing/claim/tok', '/marketing/claim'],
      ['/place/claim/tok', '/place/claim'],
      ['/preview/tok', '/preview'],
      ['/confirm/tok', '/confirm'],
      ['/prospect-report/tok', '/prospect-report'],
      ['/seed-report/seed-1', '/seed-report'],
    ];
    for (const [input, expected] of cases) {
      expect(sanitizeGaPath(input), input).toBe(expected);
    }
  });

  it('keeps shareable shortcode identifiers in the path', () => {
    // Shortcodes are the public identifier — per-code analytics are useful
    // and nothing secret is exposed by recording them.
    expect(sanitizeGaPath('/g/abc123')).toBe('/g/abc123');
    expect(sanitizeGaPath('/cf/xyz')).toBe('/cf/xyz');
    expect(sanitizeGaPath('/flyer/fl-9')).toBe('/flyer/fl-9');
  });

  it('leaves ordinary paths untouched', () => {
    expect(sanitizeGaPath('/directory')).toBe('/directory');
    expect(sanitizeGaPath('/directory/claim')).toBe('/directory/claim');
    expect(sanitizeGaPath('/directory/claim-verify')).toBe('/directory/claim-verify');
    expect(sanitizeGaPath('/place/grocery')).toBe('/place/grocery');
  });
});
