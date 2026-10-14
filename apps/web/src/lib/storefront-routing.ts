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

// Platform apexes — the app itself. A host matching one of these is never a
// custom-domain candidate even when it fails every other exclusion.
const PLATFORM_APEXES = ['visibleshelf.com', 'visibleshelf.store'];

/**
 * Config-derived platform origin (D13: the /manage redirect target must come
 * from configuration — never the request host, never a literal in the
 * redirect line). Uses the codebase's existing origin chain — the same
 * fallback order every other absolute-URL site uses — then the prod apex.
 */
export function platformOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.WEB_URL ||
    'https://visibleshelf.com';
  return raw.replace(/\/+$/, '');
}

/** Hostname of platformOrigin() — used to build `{slug}.{apex}` canonicals. */
export function platformApexHost(): string {
  try {
    return new URL(platformOrigin()).hostname;
  } catch {
    return 'visibleshelf.com';
  }
}

/**
 * Custom-domain candidate classification (sprint plan 4.1). A host is a
 * candidate when it can't be one of ours: not a platform apex, not a
 * platform subdomain, not localhost/IP, not a Vercel deployment host.
 * Everything else MIGHT be a tenant-owned domain — the proxy resolves it
 * against /api/tenants/resolve-custom-domain and fails closed on a miss.
 */
export function isCandidateCustomHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (PLATFORM_APEXES.includes(h) || PLATFORM_APEXES.includes(h.replace(/^www\./, ''))) return false;
  if (h === 'localhost' || h.endsWith('.localhost')) return false;
  if (h === '::1' || h.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false; // IP literals
  if (h.endsWith('.vercel.app')) return false; // deployment/preview hosts
  if (isPlatformSubdomain(h)) return false;
  return h.includes('.'); // must at least look like a DNS name
}

/**
 * D13 workspace-entry mapping. `/manage` → workspace root, `/manage/<rest>`
 * → `/<rest>` suffix under /t/{tenantId}. Returns the suffix to append to
 * `/t/{tenantId}`, or null when the path isn't a manage path. The proxy
 * prefixes `/t/{tenantId}` and preserves the query string itself.
 */
export function managePathSuffix(pathname: string): string | null {
  if (pathname === '/manage' || pathname === '/manage/') return '';
  if (pathname.startsWith('/manage/')) return pathname.slice('/manage'.length);
  return null;
}

/**
 * Canonicalization of platform-internal /tenant/{id} paths on a tenant host
 * (subdomain or custom domain). On a tenant host the storefront IS "/" —
 * /tenant/{id} is the platform's internal path leaking into the tenant's URL
 * space, and /tenant/{otherId} would serve a DIFFERENT tenant's storefront
 * under this host (cross-tenant leak).
 *
 * Returns:
 *  - { kind: 'self', path } — strip the prefix: /tenant/{id} → '/',
 *    /tenant/{id}/policies/x → '/policies/x' (prefix roots only). The proxy
 *    301s to it so the canonical URL is host-relative.
 *  - { kind: 'foreign' } — another tenant's internal path; proxy redirects
 *    to the platform origin's canonical /tenant/{otherId}.
 *  - null — not a /tenant/ path, or a non-storefront subpath under the
 *    resolved tenant (e.g. /tenant/{id}/junk) — left to pass through and
 *    404 naturally in the app router.
 */
/**
 * True when the hostname is a tenant storefront host — a platform subdomain
 * or a tenant-owned custom domain. If a page renders on such a host it has
 * already survived the proxy's resolve-or-404 gate, so the host IS a tenant
 * host whenever this returns true.
 */
export function isTenantHostName(hostname: string): boolean {
  const h = (hostname || '').split(':')[0].toLowerCase();
  if (!h) return false;
  return !!isPlatformSubdomain(h) || isCandidateCustomHost(h);
}

/**
 * The storefront URL delegate — the single place that knows how a
 * storefront-relative path maps to an href.
 *
 * `path` is the tenant-host-canonical form:
 *   '' or '/'        → storefront home
 *   '/policies/x'    → a storefront prefix-root page
 *   '?category=x'    → storefront home with query
 *
 * On a tenant host the storefront IS the origin, so paths stay as-is.
 * On the platform app they need the /tenant/{id} prefix.
 */
export function storefrontPath(tenantHost: boolean, tenantId: string, path = ''): string {
  let p = path || '/';
  if (p.startsWith('/?')) p = p.slice(1); // '/?q' → '?q'
  if (tenantHost) {
    if (p === '/' || p === '') return '/';
    if (p.startsWith('?')) return `/${p}`;
    return p.startsWith('/') ? p : `/${p}`;
  }
  const base = `/tenant/${tenantId}`;
  if (p === '/' || p === '') return base;
  if (p.startsWith('?')) return `${base}${p}`;
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

export type TenantHostCanonical =
  | { kind: 'self'; path: string }
  | { kind: 'foreign'; tenantId: string };

export function tenantHostCanonicalPath(pathname: string, tenantId: string): TenantHostCanonical | null {
  const m = pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);
  if (!m) return null;
  const [, pathTenantId, rest = ''] = m;
  if (pathTenantId !== tenantId) return { kind: 'foreign', tenantId: pathTenantId };
  if (rest === '' || rest === '/') return { kind: 'self', path: '/' };
  if (STOREFRONT_PREFIX_ROOTS.some((r) => rest === r || rest.startsWith(`${r}/`))) {
    return { kind: 'self', path: rest };
  }
  return null;
}
