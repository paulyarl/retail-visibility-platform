import { describe, expect, it } from 'vitest';
import {
  isPlatformSubdomain,
  isStorefrontPath,
  isCandidateCustomHost,
  managePathSuffix,
  tenantHostCanonicalPath,
  isTenantHostName,
  storefrontPath,
  surfaceClassForPath,
  SURFACE_RULES,
  STOREFRONT_PASSTHROUGH_ROOTS,
  canonicalStorefrontOrigin,
  canonicalStorefrontHome,
  canonicalSurfaceUrl,
  platformOrigin,
  platformApexHost,
} from './storefront-routing';

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

describe('tenantHostCanonicalPath (custom-domain canonicalization)', () => {
  const TID = 'tid-8622qs2t';

  // On a tenant host "/" IS the storefront — the platform-internal
  // /tenant/{id} must canonicalize to host-relative paths.
  it.each([
    ['/tenant/tid-8622qs2t', '/'],
    ['/tenant/tid-8622qs2t/', '/'],
    ['/tenant/tid-8622qs2t/policies', '/policies'],
    ['/tenant/tid-8622qs2t/policies/return_policy', '/policies/return_policy'],
    ['/tenant/tid-8622qs2t/services', '/services'],
    ['/tenant/tid-8622qs2t/services/delivery', '/services/delivery'],
  ])('maps %s → %s for the resolved tenant', (input, expected) => {
    expect(tenantHostCanonicalPath(input, TID)).toEqual({ kind: 'self', path: expected });
  });

  // Cross-tenant leak: a different tenant's internal path on this host must
  // bounce to the platform origin, not render under this domain.
  it('flags foreign tenant paths', () => {
    expect(tenantHostCanonicalPath('/tenant/tid-r6cccpag', TID)).toEqual({ kind: 'foreign', tenantId: 'tid-r6cccpag' });
    expect(tenantHostCanonicalPath('/tenant/tid-r6cccpag/policies/privacy_policy', TID)).toEqual({ kind: 'foreign', tenantId: 'tid-r6cccpag' });
  });

  it('passes through unknown subpaths of the resolved tenant (app 404s)', () => {
    expect(tenantHostCanonicalPath('/tenant/tid-8622qs2t/junk', TID)).toBeNull();
    expect(tenantHostCanonicalPath('/tenant/tid-8622qs2t/cart', TID)).toBeNull();
  });

  it('ignores non-/tenant paths and bare /tenant/', () => {
    expect(tenantHostCanonicalPath('/', TID)).toBeNull();
    expect(tenantHostCanonicalPath('/products/p1', TID)).toBeNull();
    expect(tenantHostCanonicalPath('/tenant', TID)).toBeNull();
    expect(tenantHostCanonicalPath('/tenant/', TID)).toBeNull();
  });
});

describe('isTenantHostName (storefront URL delegate)', () => {
  it.each(['ivoire.visibleshelf.com', 'ivoire.visibleshelf.store', 'placeshelf.store', 'www.placeshelf.store', 'dev.localhost'])(
    'accepts tenant host %s',
    (host) => expect(isTenantHostName(host)).toBe(true),
  );

  it.each(['visibleshelf.com', 'www.visibleshelf.com', 'visibleshelf.store', 'localhost', '127.0.0.1', 'rvp-web.vercel.app', ''])(
    'rejects platform/non-tenant host %s',
    (host) => expect(isTenantHostName(host)).toBe(false),
  );

  it('strips ports before classifying', () => {
    expect(isTenantHostName('dev.localhost:3000')).toBe(true);
    expect(isTenantHostName('localhost:3000')).toBe(false);
  });
});

describe('storefrontPath (URL delegate mapping)', () => {
  const TID = 'tid-8622qs2t';

  it('emits host-relative paths on a tenant host', () => {
    expect(storefrontPath(true, TID, '/')).toBe('/');
    expect(storefrontPath(true, TID, '')).toBe('/');
    expect(storefrontPath(true, TID, '/policies/return_policy')).toBe('/policies/return_policy');
    expect(storefrontPath(true, TID, '/services')).toBe('/services');
  });

  it('emits /tenant/{id}-prefixed paths on the platform app', () => {
    expect(storefrontPath(false, TID, '/')).toBe(`/tenant/${TID}`);
    expect(storefrontPath(false, TID, '')).toBe(`/tenant/${TID}`);
    expect(storefrontPath(false, TID, '/policies/return_policy')).toBe(`/tenant/${TID}/policies/return_policy`);
  });

  it('preserves query strings and hashes on both surfaces', () => {
    expect(storefrontPath(true, TID, '?category=books')).toBe('/?category=books');
    expect(storefrontPath(true, TID, '/?category=books')).toBe('/?category=books');
    expect(storefrontPath(true, TID, '/?x=1#catalog')).toBe('/?x=1#catalog');
    expect(storefrontPath(false, TID, '?category=books')).toBe(`/tenant/${TID}?category=books`);
    expect(storefrontPath(false, TID, '/?category=books')).toBe(`/tenant/${TID}?category=books`);
  });

  it('accepts a slug as the tenant key for platform paths', () => {
    expect(storefrontPath(false, 'ivoire-market', '/')).toBe('/tenant/ivoire-market');
  });
});

describe('surface classes (the shared inventory)', () => {
  it('classifies the roots the delegate and the proxy ask about', () => {
    expect(surfaceClassForPath('/')).toBeNull();
    expect(surfaceClassForPath('/products/p1')).toBe('product');
    expect(surfaceClassForPath('/directory/acme')).toBe('directory');
    expect(surfaceClassForPath('/place/acme')).toBe('directory');
    expect(surfaceClassForPath('/shops/acme')).toBe('directory');
    expect(surfaceClassForPath('/tenant/abc/policies/x')).toBe('storefront');
    expect(surfaceClassForPath('/services')).toBe('storefront');
    expect(surfaceClassForPath('/cart')).toBe('storefront');
    expect(surfaceClassForPath('/preview/tok')).toBe('public');
    expect(surfaceClassForPath('/seed-report/seed-1')).toBe('public');
    expect(surfaceClassForPath('/place/claim/tok')).toBe('directory');
  });

  it('derives the B1 allowlist from the class rules', () => {
    for (const root of STOREFRONT_PASSTHROUGH_ROOTS) {
      expect(isStorefrontPath(root), `${root} should be reachable`).toBe(true);
    }
    // Classified, but never served under tenant DNS.
    for (const root of ['/admin', '/settings', '/t', '/recovery', '/marketing', '/api']) {
      expect(surfaceClassForPath(root), root).toBe('tenant-scope');
      expect(SURFACE_RULES['tenant-scope'].reachableOnTenantHost).toBe(false);
      expect(isStorefrontPath(root), root).toBe(false);
    }
  });

  // Every short-code redirector root is a platform-hosted public surface — the
  // proxy must let it through, and its TARGET is resolved by the redirector
  // (see shortcode-redirect-targets.test.ts).
  it('every short-code redirector root is a reachable public surface', () => {
    const roots = [
      '/s', '/c', '/g', '/i', '/q', '/qr', '/qe', '/qs', '/qw',
      '/r', '/re', '/rb', '/rp', '/rs', '/rt',
    ];
    for (const root of roots) {
      expect(surfaceClassForPath(root), root).toBe('public');
      expect(isStorefrontPath(root), root).toBe(true);
    }
  });
});

describe('canonical ladder helpers', () => {
  const ORIGIN = platformOrigin();
  const APEX = platformApexHost();

  it('maps an active custom domain to its own origin', () => {
    expect(canonicalStorefrontOrigin({ kind: 'custom', host: 'mybrand.com' })).toBe('https://mybrand.com');
    expect(canonicalStorefrontHome({ kind: 'custom', host: 'mybrand.com' }, 'tid-1')).toBe('https://mybrand.com/');
  });

  it('maps a platform subdomain to {host}.{apex}', () => {
    expect(canonicalStorefrontOrigin({ kind: 'subdomain', host: 'baraka' })).toBe(`https://baraka.${APEX}`);
    expect(canonicalStorefrontHome({ kind: 'subdomain', host: 'baraka' }, 'tid-1')).toBe(`https://baraka.${APEX}/`);
  });

  it('maps a path tenant to the platform app', () => {
    expect(canonicalStorefrontOrigin({ kind: 'path', tenantId: 'tid-1' })).toBe(ORIGIN);
    expect(canonicalStorefrontHome({ kind: 'path', tenantId: 'tid-1' }, 'tid-1')).toBe(`${ORIGIN}/tenant/tid-1`);
  });

  it('falls back to the platform path when the lookup failed or is incomplete', () => {
    expect(canonicalStorefrontOrigin(null)).toBe(ORIGIN);
    expect(canonicalStorefrontHome(null, 'tid-1')).toBe(`${ORIGIN}/tenant/tid-1`);
    expect(canonicalStorefrontOrigin({ kind: 'custom', host: null })).toBe(ORIGIN);
    expect(canonicalStorefrontHome({ kind: 'subdomain', host: null }, 'tid-1')).toBe(`${ORIGIN}/tenant/tid-1`);
  });
});

describe('canonicalSurfaceUrl (inactive-host bounce target)', () => {
  const ORIGIN = platformOrigin();
  const APEX = platformApexHost();

  it('keeps paths verbatim on a custom-domain canonical', () => {
    expect(canonicalSurfaceUrl({ kind: 'custom', host: 'mybrand.com' }, 'tid-1', '/')).toBe('https://mybrand.com/');
    expect(canonicalSurfaceUrl({ kind: 'custom', host: 'mybrand.com' }, 'tid-1', '/products/pid-1', '?x=1')).toBe('https://mybrand.com/products/pid-1?x=1');
  });

  it('keeps paths verbatim on a subdomain canonical (receiving proxy canonicalizes)', () => {
    expect(canonicalSurfaceUrl({ kind: 'subdomain', host: 'baraka' }, 'tid-1', '/')).toBe(`https://baraka.${APEX}/`);
    expect(canonicalSurfaceUrl({ kind: 'subdomain', host: 'baraka' }, 'tid-1', '/policies/refund')).toBe(`https://baraka.${APEX}/policies/refund`);
  });

  it('prefixes the storefront home and prefix roots on a path-tier canonical', () => {
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/')).toBe(`${ORIGIN}/tenant/tid-1`);
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/services/delivery')).toBe(`${ORIGIN}/tenant/tid-1/services/delivery`);
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/policies/refund')).toBe(`${ORIGIN}/tenant/tid-1/policies/refund`);
  });

  it('keeps passthrough roots verbatim on the platform origin', () => {
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/products/pid-1')).toBe(`${ORIGIN}/products/pid-1`);
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/directory/x')).toBe(`${ORIGIN}/directory/x`);
    expect(canonicalSurfaceUrl({ kind: 'path', tenantId: 'tid-1' }, 'tid-1', '/tenant/tid-1')).toBe(`${ORIGIN}/tenant/tid-1`);
  });

  it('falls back to the path mapping when the canonical is missing', () => {
    expect(canonicalSurfaceUrl(null, 'tid-1', '/')).toBe(`${ORIGIN}/tenant/tid-1`);
    expect(canonicalSurfaceUrl({ kind: 'custom', host: null }, 'tid-1', '/')).toBe(`${ORIGIN}/tenant/tid-1`);
  });
});
