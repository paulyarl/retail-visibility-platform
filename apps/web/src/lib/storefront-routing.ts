// Pure host/path classification for tenant storefront routing.
// Kept dependency-free so the rules are unit-testable without the proxy's
// auth0/service import chain. Used by `apps/web/src/proxy.ts` (B1 hotfix) and
// later by the custom-domain branch (custom-domains sprint plan 4.1/4.3).

// Platform domains that support subdomains
const PLATFORM_DOMAINS = ['visibleshelf.com', 'visibleshelf.store'];

// Paths a tenant storefront host is allowed to serve. The subdomain rewrite
// in the proxy returns before the /admin and /settings auth gates run, so
// every path not on this list must be refused — otherwise protected routes
// render on a tenant subdomain with no session check. Prefix roots get the
// /tenant/{id} prefix; pass-through roots serve as-is on the tenant host.
export const STOREFRONT_PREFIX_ROOTS = ['/services', '/policies'];
export const STOREFRONT_PASSTHROUGH_ROOTS = [
  '/tenant', '/products', '/cart', '/carts', '/checkout', '/orders', '/my-orders', '/compare',
  '/shops', '/directory', '/place', '/s', '/c', '/customerlogin',
  '/privacy', '/terms', '/legal', '/contact', '/faq', '/support', '/guides',
  '/features', '/solutions', '/retail', '/prospect-report', '/seed-report', '/preview',
  // Short-code redirectors — safe to pass: they bounce to their canonical target.
  '/g', '/i', '/q', '/qr', '/qe', '/qs', '/qw', '/r', '/re', '/rb', '/rp', '/rs', '/rt',
];

export function isPlatformSubdomain(hostname: string): { isSubdomain: boolean; subdomain: string; domain: string } | null {
  // Check production domains
  for (const domain of PLATFORM_DOMAINS) {
    if (hostname.endsWith(`.${domain}`) && hostname !== domain) {
      const subdomain = hostname.replace(`.${domain}`, '');
      // www is a platform host, not a tenant subdomain — it must reach the
      // normal platform routes, never the storefront resolver (which would
      // 404 it: 'www' is reserved and can never resolve to a tenant).
      if (subdomain === 'www') return null;
      return { isSubdomain: true, subdomain, domain };
    }
  }

  // Check localhost for development
  if (hostname.endsWith('.localhost') && hostname !== 'localhost') {
    const subdomain = hostname.replace('.localhost', '');
    if (subdomain === 'www') return null;
    return { isSubdomain: true, subdomain, domain: 'localhost' };
  }

  return null;
}

export function isStorefrontPath(pathname: string): boolean {
  if (pathname === '/') return true;
  const root = `/${pathname.split('/')[1]}`;
  return STOREFRONT_PREFIX_ROOTS.includes(root) || STOREFRONT_PASSTHROUGH_ROOTS.includes(root);
}
