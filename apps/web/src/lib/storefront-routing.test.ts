import { describe, expect, it } from 'vitest';
import { isPlatformSubdomain, isStorefrontPath, isCandidateCustomHost, managePathSuffix } from './storefront-routing';

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

describe('isCandidateCustomHost (custom-domains sprint 4.1)', () => {
  // Everything that can't be ours is a candidate — the proxy resolves it
  // against the API and fails closed on a miss.
  it.each(['mybrand.com', 'www.mybrand.com', 'shop.mybrand.com', 'mybrand.co.uk', 'www.mybrand.co.uk'])(
    'accepts candidate tenant-owned host %s',
    (host) => {
      expect(isCandidateCustomHost(host)).toBe(true);
    },
  );

  it.each([
    'visibleshelf.com',
    'www.visibleshelf.com',
    'visibleshelf.store',
    'www.visibleshelf.store',
    'baraka.visibleshelf.com', // platform subdomain — the subdomain branch owns it
    'localhost',
    'dev.localhost',
    '127.0.0.1',
    '::1',
    'rvp-web-git-main.vercel.app', // deployment/preview host
    '',                            // empty
    'barename',                    // not DNS-shaped
  ])('rejects %s', (host) => {
    expect(isCandidateCustomHost(host)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isCandidateCustomHost('MyBrand.COM')).toBe(true);
    expect(isCandidateCustomHost('Baraka.VisibleShelf.com')).toBe(false);
  });
});

describe('managePathSuffix (D13 workspace entry)', () => {
  it('maps /manage to the workspace root', () => {
    expect(managePathSuffix('/manage')).toBe('');
    expect(managePathSuffix('/manage/')).toBe('');
  });

  it('maps /manage/<rest> to the /t/{id} suffix', () => {
    expect(managePathSuffix('/manage/items')).toBe('/items');
    expect(managePathSuffix('/manage/settings/tenant')).toBe('/settings/tenant');
  });

  it('returns null for non-manage paths', () => {
    expect(managePathSuffix('/')).toBeNull();
    expect(managePathSuffix('/manager')).toBeNull(); // prefix must be exact
    expect(managePathSuffix('/manage-extra')).toBeNull();
    expect(managePathSuffix('/admin')).toBeNull();
    expect(managePathSuffix('/products/1')).toBeNull();
  });
});
