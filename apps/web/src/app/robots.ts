import type { MetadataRoute } from 'next';

/**
 * robots.txt for the platform apex AND every tenant host.
 *
 * The proxy passes any path containing `.` straight through on tenant hosts
 * (`proxy.ts`), so this route serves on `{tenant}.visibleshelf.com` and on
 * custom domains with no extra routing. The `Sitemap:` line must stay
 * PLATFORM-ABSOLUTE on every host: that reference is exactly what authorizes
 * the sitemap's cross-host <loc>s for tenant storefronts and products
 * (spec §4.10).
 *
 * Do NOT add `Disallow: /place`, `/directory`, `/tenant`, `/shops`, or
 * `/products` — and never `/_next/` (Google needs the bundles to render).
 * `Disallow: /shops` would also stop crawlers reading the canonical that
 * suppresses the shop profile (spec §4.9).
 */
export const dynamic = 'force-dynamic';

const BASE = (
  process.env.NEXT_PUBLIC_WEB_URL ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  process.env.WEB_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/account',
          '/t/',
          '/c/',
          '/cart',
          '/carts',
          '/checkout',
          '/orders',
          '/my-orders',
          '/customerlogin',
          '/login',
          '/logout',
          '/signup',
          '/register',
          '/auth/',
          '/recovery',
          '/preview/',
          '/marketing/',
          '/prospect-report/',
          '/seed-report/',
          '/retail/',
          '/items',
          '/debug/',
          '/settings',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
