import Script from 'next/script';

/**
 * GA4 tag — loads gtag.js once sitewide when NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set; renders nothing otherwise (safe for dev/preview). Wired for the
 * GBP/Ads signal test: page views + key-driver events (see
 * docs/PLATFORM_GBP_GOOGLE_ADS_SPEC.md §5).
 *
 * Scope: the tag exists to measure the public acquisition funnel, so
 * `gtag('config')` is skipped on authenticated/internal surfaces (tenant
 * ops under /t/*, settings, account, auth, debug/test) — those hits would
 * pollute the funnel and GA property access is broadly shared. Public
 * tenant surfaces (/tenant/* storefronts, /directory, /place, /dashboard)
 * stay tracked. Token-bearing public funnel paths keep tracking but get
 * page_path rewritten to strip the secret so claim/preview tokens never
 * land in GA (claim_completed still fires on /directory/claim).
 */

// Private surfaces: no gtag config → no page_view, no enhanced measurement.
// Prefix-matched on segment boundaries. /tenant/* (public storefront) and
// /dashboard (public PlatformDashboard) are deliberately NOT listed.
const SKIP_PREFIXES = [
  '/t/',
  '/tenants',
  '/settings',
  '/account',
  '/orders',
  '/my-orders',
  '/cross-tenant',
  '/onboarding',
  '/accept-invitation',
  '/recovery',
  '/auth',
  '/debug',
  '/qe',
  '/sentry-example-page',
  '/test-featured-products',
  '/test-integration',
  '/test-phase1-2',
];

// Public funnel paths that carry a secret in the pathname: keep tracking
// (conversion events still fire) but strip everything past the prefix.
// Shareable shortcodes (/g, /cf, /flyer, /r/*) are deliberately NOT listed —
// they are the public identifier and per-code analytics are useful.
const SANITIZE_RULES: Array<[RegExp, string]> = [
  [/^\/directory\/claim\/.+/, '/directory/claim'],
  [/^\/directory\/enrich\/.+/, '/directory/enrich'],
  [/^\/marketing\/claim\/.+/, '/marketing/claim'],
  [/^\/place\/claim\/.+/, '/place/claim'],
  [/^\/preview\/.+/, '/preview'],
  [/^\/confirm\/.+/, '/confirm'],
  [/^\/prospect-report\/.+/, '/prospect-report'],
  [/^\/seed-report\/.+/, '/seed-report'],
];

export function shouldTrackPath(pathname: string): boolean {
  return !SKIP_PREFIXES.some((p) => {
    // Entries keep a trailing '/' to mean "prefix only"; '/t/' must match
    // '/t' and '/t/…' but never '/tenant…' — strip only a trailing slash,
    // never a real character ('/tenants'.slice(0,-1) would eat the 's').
    const exact = p.endsWith('/') ? p.slice(0, -1) : p;
    const prefix = p.endsWith('/') ? p : `${p}/`;
    return pathname === exact || pathname.startsWith(prefix);
  });
}

export function sanitizeGaPath(pathname: string): string {
  for (const [pattern, replacement] of SANITIZE_RULES) {
    if (pattern.test(pathname)) return replacement;
  }
  return pathname;
}

export function GtagScript() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  const skipJson = JSON.stringify(SKIP_PREFIXES);
  const sanitizeJson = JSON.stringify(SANITIZE_RULES.map(([re, rep]) => [re.source, rep]));

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          var __path = window.location.pathname;
          var __skip = ${skipJson}.some(function(p){
            return __path === p || __path === p.replace(/\\/$/, '') ||
              __path.indexOf(p.charAt(p.length-1) === '/' ? p : p + '/') === 0;
          });
          if (!__skip) {
            var __san = ${sanitizeJson}.reduce(function(acc, rule){
              return acc.replace(new RegExp(rule[0]), rule[1]);
            }, __path);
            gtag('js', new Date());
            gtag('config', '${id}', { page_path: __san });
          }
        `}
      </Script>
    </>
  );
}
