// Pure host/path classification for tenant storefront routing.
// Kept dependency-free so the rules are unit-testable without the proxy's
// auth0/service import chain. Used by `apps/web/src/proxy.ts` (B1 hotfix) and
// later by the custom-domain branch (custom-domains sprint plan 4.1/4.3).

// Platform domains that support subdomains
const PLATFORM_DOMAINS = ['visibleshelf.com', 'visibleshelf.store'];

/**
 * Portal subdomains — platform hosts that serve the merchant WORKSPACE,
 * never tenant-candidate storefronts. `mystore.{apex}` is the shared
 * merchant portal door (NRS mystore.nrsplus.com parity): workspace/auth
 * paths render on the host, everything else canonicalizes to the apex.
 * The name is also in RESERVED_SUBDOMAINS (apps/api/src/lib/subdomain.ts)
 * so no tenant can claim it.
 */
export const PORTAL_SUBDOMAINS: ReadonlySet<string> = new Set(['mystore']);

/** True when the hostname is a workspace portal host (mystore.{apex}). */
export function isPortalSubdomainHost(hostname: string): boolean {
  const h = (hostname || '').split(':')[0].toLowerCase();
  if (!h) return false;
  for (const domain of PLATFORM_DOMAINS) {
    if (h.endsWith(`.${domain}`)) {
      return PORTAL_SUBDOMAINS.has(h.slice(0, h.length - domain.length - 1));
    }
  }
  if (h.endsWith('.localhost')) {
    return PORTAL_SUBDOMAINS.has(h.slice(0, -'.localhost'.length));
  }
  return false;
}

/**
 * Surface classes — the shared vocabulary for "what is this path, and where
 * must a link to it point". One table, two consumers: the proxy's B1 allowlist
 * (reachability) and the URL delegate (origin). The class names the surface;
 * the rule is the behaviour, and there are only two origins:
 *
 *   platform   — host-independent. Emitted absolute to `platformOrigin()` so a
 *                link never renders the platform under a tenant's domain.
 *   canonical  — host-scoped. On a tenant host the storefront IS the origin
 *                (host-relative); a cross-tenant link resolves the TARGET
 *                tenant's canonical ladder (custom → subdomain → /tenant/{id}).
 */
export type SurfaceClass = 'public' | 'directory' | 'tenant-scope' | 'storefront' | 'product';

export interface SurfaceRule {
  /** Served when the request host is a tenant storefront host. */
  reachableOnTenantHost: boolean;
  /** Where links to this surface must point. */
  origin: 'platform' | 'canonical';
}

export const SURFACE_RULES: Record<SurfaceClass, SurfaceRule> = {
  // Platform-owned public pages (marketing, legal, report/gallery/preview,
  // claim + the short-code redirectors). Reachable on a tenant host, but links
  // are always emitted platform-absolute.
  public: { reachableOnTenantHost: true, origin: 'platform' },
  // Directory entries — per-listing pages that live on the platform host and
  // may describe any business. Same rule as public; named because the
  // directory→storefront hop is its own delegate concern.
  directory: { reachableOnTenantHost: true, origin: 'platform' },
  // Platform-scoped surfaces that are NEVER addressable under tenant DNS: the
  // workspace, auth, app-internal paths, and platform-only token forms. The
  // rewrite returns before the /admin and /settings auth gates, so anything
  // off the reachable set must 404.
  'tenant-scope': { reachableOnTenantHost: false, origin: 'platform' },
  // The tenant's own storefront: the origin IS the storefront on a tenant
  // host, /tenant/{id} on the platform app.
  storefront: { reachableOnTenantHost: true, origin: 'canonical' },
  // Product pages — storefront-shaped, but the owning tenant is the product's,
  // not the host's (cross-tenant resolution).
  product: { reachableOnTenantHost: true, origin: 'canonical' },
};

/**
 * Root segment → surface class. THE inventory: the proxy allowlist and the
 * URL delegate both derive from it. Adding a public route means adding it here.
 */
const SURFACE_ROOTS: Record<string, SurfaceClass> = {
  // storefront (host-scoped)
  '/tenant': 'storefront',
  '/cart': 'storefront',
  '/carts': 'storefront',
  '/checkout': 'storefront',
  '/orders': 'storefront',
  '/my-orders': 'storefront',
  '/compare': 'storefront',
  '/customerlogin': 'storefront',
  '/services': 'storefront',
  '/policies': 'storefront',
  // product (host-scoped, cross-tenant)
  '/products': 'product',
  // directory (platform host)
  '/shops': 'directory',
  '/directory': 'directory',
  '/place': 'directory',
  // public (platform host)
  '/privacy': 'public',
  '/terms': 'public',
  '/legal': 'public',
  '/contact': 'public',
  '/faq': 'public',
  '/support': 'public',
  '/guides': 'public',
  '/features': 'public',
  '/solutions': 'public',
  '/retail': 'public',
  '/prospect-report': 'public',
  '/seed-report': 'public',
  '/preview': 'public',
  // Short-code redirectors — platform-hosted; each bounces to its target's own
  // surface class (see the resolve*AndRedirect helpers).
  '/s': 'public',
  '/c': 'public',
  '/g': 'public',
  '/i': 'public',
  '/q': 'public',
  '/qr': 'public',
  '/qe': 'public',
  '/qs': 'public',
  '/qw': 'public',
  '/r': 'public',
  '/re': 'public',
  '/rb': 'public',
  '/rp': 'public',
  '/rs': 'public',
  '/rt': 'public',
  // tenant-scope (never served on a tenant host)
  '/t': 'tenant-scope',
  '/tenants': 'tenant-scope',
  '/settings': 'tenant-scope',
  '/admin': 'tenant-scope',
  '/dashboard': 'tenant-scope',
  '/account': 'tenant-scope',
  '/debug': 'tenant-scope',
  '/items': 'tenant-scope',
  '/register': 'tenant-scope',
  '/login': 'tenant-scope',
  '/api': 'tenant-scope',
  // Platform-only token forms — reached via a platform-absolute short link,
  // never served under tenant DNS.
  '/recovery': 'tenant-scope',
  '/marketing': 'tenant-scope',
};

// Prefix roots get the /tenant/{id} prefix on a tenant host; pass-through
// roots serve as-is. Kept explicit — this is a rewrite mechanic, not a class.
export const STOREFRONT_PREFIX_ROOTS = ['/services', '/policies'];

/** Roots a tenant storefront host is allowed to serve (the B1 allowlist). */
export const STOREFRONT_PASSTHROUGH_ROOTS: readonly string[] = Object.entries(SURFACE_ROOTS)
  .filter(
    ([root, cls]) =>
      SURFACE_RULES[cls].reachableOnTenantHost && !STOREFRONT_PREFIX_ROOTS.includes(root),
  )
  .map(([root]) => root);

export function isPlatformSubdomain(hostname: string): { isSubdomain: boolean; subdomain: string; domain: string } | null {
  // Check production domains
  for (const domain of PLATFORM_DOMAINS) {
    if (hostname.endsWith(`.${domain}`) && hostname !== domain) {
      const subdomain = hostname.replace(`.${domain}`, '');
      // www is a platform host, not a tenant subdomain — it must reach the
      // normal platform routes, never the storefront resolver (which would
      // 404 it: 'www' is reserved and can never resolve to a tenant). Portal
      // names are platform hosts too — they take the workspace branch.
      if (subdomain === 'www' || PORTAL_SUBDOMAINS.has(subdomain)) return null;
      return { isSubdomain: true, subdomain, domain };
    }
  }

  // Check localhost for development
  if (hostname.endsWith('.localhost') && hostname !== 'localhost') {
    const subdomain = hostname.replace('.localhost', '');
    if (subdomain === 'www' || PORTAL_SUBDOMAINS.has(subdomain)) return null;
    return { isSubdomain: true, subdomain, domain: 'localhost' };
  }

  return null;
}

/** Surface class of a path's root segment, or null when it isn't a known root. */
export function surfaceClassForPath(pathname: string): SurfaceClass | null {
  return SURFACE_ROOTS[`/${pathname.split('/')[1]}`] ?? null;
}

export function isStorefrontPath(pathname: string): boolean {
  if (pathname === '/') return true;
  const cls = surfaceClassForPath(pathname);
  return cls !== null && SURFACE_RULES[cls].reachableOnTenantHost;
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
  if (isPortalSubdomainHost(h)) return false; // portal names are ours, not tenant candidates
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
 *    301s to it so the canonical URL is host-relative. The BARE /tenant root
 *    canonicalizes to '/' the same way — on a tenant host the root IS the
 *    storefront, so "/tenant" with no id means "this tenant".
 *  - { kind: 'foreign' } — another tenant's internal path; proxy redirects
 *    to the platform origin's canonical /tenant/{otherId}.
 *  - null — not a /tenant path, or a non-storefront subpath under the
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
  if (pathname === '/tenant' || pathname === '/tenant/') {
    return { kind: 'self', path: '/' };
  }
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

/**
 * Canonical ladder result — mirrors `GET /api/tenants/storefront-canonical/:id`.
 * The API resolves tenant STATE; this module maps it to a URL.
 */
export interface StorefrontCanonical {
  kind: 'custom' | 'subdomain' | 'path';
  host?: string | null;
  tenantId?: string | null;
}

/**
 * Origin of a tenant's canonical surface — for PASSTHROUGH paths that are valid
 * verbatim on every surface (`/products/{id}`, `/directory/{slug}`):
 *   custom    → https://{host}
 *   subdomain → https://{host}.{platformApexHost()}
 *   path      → {platformOrigin()}  (the platform app)
 *
 * The single ladder implementation — it used to be copy-pasted at every
 * consumer (cross-tenant links, Visit-Store, storefront metadata, the /s
 * coupon redirect).
 */
export function canonicalStorefrontOrigin(canon: StorefrontCanonical | null | undefined): string {
  if (canon?.kind === 'custom' && canon.host) return `https://${canon.host}`;
  if (canon?.kind === 'subdomain' && canon.host) return `https://${canon.host}.${platformApexHost()}`;
  return platformOrigin();
}

/**
 * Absolute URL of a tenant's canonical storefront HOME:
 *   custom    → https://{host}/
 *   subdomain → https://{host}.{platformApexHost()}/
 *   path      → {platformOrigin()}/tenant/{idOrSlug}
 *
 * Never host-relative: a share/QR/short-link target must be absolute so it
 * survives being emitted from any surface (platform apex, subdomain, or a
 * different tenant's custom domain).
 */
export function canonicalStorefrontHome(
  canon: StorefrontCanonical | null | undefined,
  idOrSlug: string,
): string {
  if (canon?.kind === 'custom' && canon.host) return `https://${canon.host}/`;
  if (canon?.kind === 'subdomain' && canon.host) return `https://${canon.host}.${platformApexHost()}/`;
  return `${platformOrigin()}/tenant/${idOrSlug}`;
}

/**
 * Absolute URL for a TENANT-HOST pathname on the tenant's canonical surface —
 * the redirect target when a known-but-inactive custom domain (pending /
 * verified / error / disabled) is requested and must bounce to the
 * next-highest active layer.
 *
 *   canon kind custom/subdomain → `https://{canonicalHost}{pathname}`
 *     (host-relative storefront paths are verbatim-valid there; the receiving
 *     proxy canonicalizes any `/tenant/{id}` leak itself)
 *   canon kind path             → platform origin; the storefront home and
 *     prefix roots take `/tenant/{id}` via storefrontPath, passthrough roots
 *     (`/products/{id}`, public/directory pages) are valid verbatim
 */
export function canonicalSurfaceUrl(
  canon: StorefrontCanonical | null | undefined,
  tenantId: string,
  pathname: string,
  search = '',
): string {
  const path = pathname || '/';
  if (canon?.kind === 'custom' && canon.host) {
    return `https://${canon.host}${path}${search}`;
  }
  if (canon?.kind === 'subdomain' && canon.host) {
    return `https://${canon.host}.${platformApexHost()}${path}${search}`;
  }
  const mapped =
    path === '/' || STOREFRONT_PREFIX_ROOTS.some((r) => path === r || path.startsWith(`${r}/`))
      ? storefrontPath(false, tenantId, path)
      : path;
  return `${platformOrigin()}${mapped}${search}`;
}
