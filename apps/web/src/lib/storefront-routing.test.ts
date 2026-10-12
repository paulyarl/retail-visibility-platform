import { describe, expect, it } from 'vitest';
import { isPlatformSubdomain, isStorefrontPath } from './storefront-routing';

describe('isPlatformSubdomain', () => {
  it('detects tenant subdomains on platform domains', () => {
    expect(isPlatformSubdomain('baraka.visibleshelf.com')).toEqual({
      isSubdomain: true,
      subdomain: 'baraka',
      domain: 'visibleshelf.com',
    });
    expect(isPlatformSubdomain('shop.visibleshelf.store')?.subdomain).toBe('shop');
    expect(isPlatformSubdomain('dev.localhost')?.subdomain).toBe('dev');
  });

  it('excludes apex hosts', () => {
    expect(isPlatformSubdomain('visibleshelf.com')).toBeNull();
    expect(isPlatformSubdomain('visibleshelf.store')).toBeNull();
    expect(isPlatformSubdomain('localhost')).toBeNull();
  });

  // M11 regression: www is a platform host — resolving it as a tenant
  // subdomain 404s the marketing site (it can never resolve to a tenant).
  it('excludes www — a platform host, never a tenant subdomain', () => {
    expect(isPlatformSubdomain('www.visibleshelf.com')).toBeNull();
    expect(isPlatformSubdomain('www.visibleshelf.store')).toBeNull();
    expect(isPlatformSubdomain('www.localhost')).toBeNull();
  });

  it('ignores foreign hosts', () => {
    expect(isPlatformSubdomain('shop.mybrand.com')).toBeNull();
    expect(isPlatformSubdomain('notvisibleshelf.com')).toBeNull();
  });
});

describe('isStorefrontPath (B1 allowlist)', () => {
  it.each(['/', '/services', '/services/x', '/policies', '/tenant/abc', '/products/p1', '/cart', '/carts', '/checkout', '/shops', '/place', '/c/ABC123', '/privacy/ccpa', '/preview/tok'])(
    'allows %s',
    (path) => {
      expect(isStorefrontPath(path)).toBe(true);
    },
  );

  // The vulnerability: these returned through the rewrite before the /admin
  // auth gate ran — every one must be refused on a tenant host.
  it.each(['/admin', '/settings/admin', '/settings/tenant', '/dashboard', '/t/t1/items', '/account', '/debug', '/items', '/register', '/login', '/recovery', '/api/x'])(
    'refuses %s (auth-gated or app-internal)',
    (path) => {
      expect(isStorefrontPath(path)).toBe(false);
    },
  );

  it('matches on the first segment only', () => {
    expect(isStorefrontPath('/products-deep/1')).toBe(false);
    expect(isStorefrontPath('/admin')).toBe(false);
    expect(isStorefrontPath('/adminxyz')).toBe(false);
  });
});
