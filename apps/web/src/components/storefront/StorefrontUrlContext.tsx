'use client';

/**
 * Storefront URL delegate — the shared resolution layer for every link,
 * redirect, and share URL a storefront emits.
 *
 * On a tenant host (platform subdomain or tenant-owned custom domain) the
 * storefront IS the origin, so paths are host-relative: '/', '/policies/x',
 * '?category=y'. On the platform app they need the /tenant/{id} prefix.
 * `storefrontPath()` in lib/storefront-routing holds the pure mapping; this
 * context carries the server-computed host flag into client components so
 * SSR and hydration emit identical hrefs.
 *
 * Usage:
 *   const sp = useStorefrontPath(tenantId);        // tenantId arg = fallback outside provider
 *   <Link href={sp('/policies/return_policy')} />
 *   router.push(sp(`?${params}`));
 *   <StorefrontLink to="/policies/terms_of_service">Terms</StorefrontLink>
 *   const url = useStorefrontUrl(); url('')        // absolute share URL
 */

import React, { createContext, useContext } from 'react';
import Link, { type LinkProps } from 'next/link';
import { storefrontPath, platformOrigin } from '@/lib/storefront-routing';

export interface StorefrontUrlValue {
  tenantId: string;
  /** True when rendering on a platform subdomain or tenant custom domain. */
  tenantHost: boolean;
  /** Absolute origin of the storefront — the tenant host's origin when
   *  tenantHost, else the platform origin. Deterministic SSR=CSR because the
   *  server component computes it from the request Host header. */
  origin: string;
}

const StorefrontUrlContext = createContext<StorefrontUrlValue | null>(null);

export function StorefrontUrlProvider({
  tenantId,
  tenantHost,
  origin,
  children,
}: StorefrontUrlValue & { children: React.ReactNode }) {
  return (
    <StorefrontUrlContext.Provider value={{ tenantId, tenantHost, origin }}>
      {children}
    </StorefrontUrlContext.Provider>
  );
}

/**
 * Returns a resolver: storefront-relative path → href.
 * `fallbackTenantId` keeps the resolver correct when no provider is mounted
 * (e.g. a page that forgot to wrap) — it resolves to the platform-prefixed
 * path, which is always valid.
 */
export function useStorefrontPath(fallbackTenantId?: string): (path?: string) => string {
  const ctx = useContext(StorefrontUrlContext);
  // `||` not `??` — a provider mounted over a non-tenant segment (e.g.
  // /products/[id]) may supply an empty tenantId; the call-site arg then wins.
  const tenantId = ctx?.tenantId || fallbackTenantId || '';
  const tenantHost = ctx?.tenantHost ?? false;
  return (path = '') => storefrontPath(tenantHost, tenantId, path);
}

/** Absolute URL resolver for share links / QR codes. */
export function useStorefrontUrl(fallbackTenantId?: string): (path?: string) => string {
  const ctx = useContext(StorefrontUrlContext);
  const origin = ctx?.origin ?? platformOrigin();
  const sp = useStorefrontPath(fallbackTenantId);
  return (path = '') => `${origin}${sp(path)}`;
}

interface StorefrontLinkProps extends Omit<LinkProps, 'href'> {
  /** Storefront-relative path: '/', '/policies/x', '?category=x' */
  to: string;
  fallbackTenantId?: string;
  children?: React.ReactNode;
}

export function StorefrontLink({ to, fallbackTenantId, children, ...props }: StorefrontLinkProps) {
  const sp = useStorefrontPath(fallbackTenantId);
  return (
    <Link href={sp(to)} {...props}>
      {children}
    </Link>
  );
}
