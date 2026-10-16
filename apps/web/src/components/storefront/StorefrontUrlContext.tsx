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

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link, { type LinkProps } from 'next/link';
import { storefrontPath, platformOrigin, canonicalStorefrontOrigin, canonicalStorefrontHome, isTenantHostName } from '@/lib/storefront-routing';
import { tenantPublicService } from '@/services/TenantPublicService';

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

/** True when rendering on a tenant storefront host (subdomain or custom
 *  domain). Provider value wins (SSR-deterministic); falls back to a
 *  post-mount hostname check for pages that never mounted the provider. */
export function useIsTenantHost(): boolean {
  const ctx = useContext(StorefrontUrlContext);
  const [tenantHost, setTenantHost] = useState(ctx?.tenantHost ?? false);
  useEffect(() => {
    if (!ctx) setTenantHost(isTenantHostName(window.location.hostname));
  }, [ctx]);
  return tenantHost;
}

/**
 * Cross-tenant URL resolver — the delegator's delegator.
 *
 * `useStorefrontPath` only knows the CURRENT host's tenant, so cards that
 * link to a DIFFERENT tenant's content (recommendations, recently viewed)
 * can't use it: on a tenant host a host-relative path stamps this
 * storefront's domain onto a foreign tenant's page. This hook resolves the
 * TARGET tenant's canonical surface (custom domain → platform subdomain →
 * platform path) via the public canonical API and prepends it to `path`.
 *
 * Use for PASSTHROUGH paths only — paths valid verbatim on every surface
 * (/products/{id}, /directory/{slug}, /shops/{slug}). For a tenant's
 * storefront HOME use `useTenantStorefrontUrl`, whose layer-1 path differs.
 *
 * Returns `path` unchanged when the current surface is the platform app or
 * the target IS this host's tenant (or resolves back to this host). While a
 * foreign target's canonical is still loading, emits the platform-origin URL
 * — never a foreign host-relative path.
 */
export function useCrossTenantUrl(targetTenantId: string | undefined, path: string): string {
  const ctx = useContext(StorefrontUrlContext);
  // '' = resolved back to this host (same tenant) — keep host-relative
  const [origin, setOrigin] = useState<string | null>(null);

  const tenantHost = ctx?.tenantHost ?? false;
  const foreign = !!targetTenantId && tenantHost && ctx?.tenantId !== targetTenantId;

  useEffect(() => {
    const host = ctx?.tenantHost ?? isTenantHostName(window.location.hostname);
    if (!targetTenantId || !host || ctx?.tenantId === targetTenantId) {
      setOrigin(null);
      return;
    }

    let cancelled = false;
    tenantPublicService
      .getStorefrontCanonical(targetTenantId)
      .then((canon) => {
        if (cancelled) return;
        const resolved = canonicalStorefrontOrigin(canon);
        // Canonical may land back on this host (same tenant, unknown to the
        // provider) — keep the href relative so client nav stays intact.
        const sameHost =
          new URL(resolved).host.toLowerCase() === window.location.host.toLowerCase();
        setOrigin(sameHost ? '' : resolved);
      })
      .catch(() => setOrigin(platformOrigin()));

    return () => { cancelled = true; };
  }, [ctx?.tenantHost, ctx?.tenantId, targetTenantId]);

  if (!foreign || origin === '') return path;
  return `${origin ?? platformOrigin()}${path}`;
}

/**
 * Storefront-surface URL for a tenant — the Visit-Store destination when the
 * journey starts on a storefront/products surface. Resolves the canonical
 * ladder: custom domain → platform subdomain → platform path.
 *   - platform host:        /tenant/{idOrSlug}   (relative)
 *   - tenant host, self:    /                    (the storefront IS this host)
 *   - tenant host, foreign: {canonical origin}/  (platform /tenant/{idOrSlug}
 *                           until the lookup lands, and for path-kind tenants)
 */
export function useTenantStorefrontUrl(idOrSlug: string | undefined): string {
  const ctx = useContext(StorefrontUrlContext);
  const pathHref = idOrSlug ? `/tenant/${idOrSlug}` : '/';
  const tenantHost = ctx?.tenantHost ?? false;
  const self = tenantHost && !!ctx?.tenantId && ctx.tenantId === idOrSlug;
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    const host = ctx?.tenantHost ?? isTenantHostName(window.location.hostname);
    if (!idOrSlug || !host || ctx?.tenantId === idOrSlug) {
      setResolved(null);
      return;
    }

    let cancelled = false;
    tenantPublicService
      .getStorefrontCanonical(idOrSlug)
      .then((canon) => {
        if (cancelled) return;
        const url = canonicalStorefrontHome(canon, idOrSlug);
        // Canonical landed back on this host → the storefront IS the host root.
        setResolved(
          new URL(url).host.toLowerCase() === window.location.host.toLowerCase() ? '/' : url
        );
      })
      .catch(() => setResolved(canonicalStorefrontHome(null, idOrSlug)));

    return () => { cancelled = true; };
  }, [ctx?.tenantHost, ctx?.tenantId, idOrSlug, pathHref]);

  if (!tenantHost) return pathHref;
  if (self) return '/';
  return resolved ?? `${platformOrigin()}${pathHref}`;
}

/**
 * Platform-surface URL resolver — for links to surfaces that live ONLY on
 * the platform host (directory entries, marketing pages). Emits the path
 * relative on the platform app (client nav intact) and platform-origin
 * absolute on a tenant host, where a host-relative /directory would render
 * the platform directory under the tenant's domain.
 */
export function usePlatformUrl(): (path: string) => string {
  const tenantHost = useIsTenantHost();
  return (path: string) => (tenantHost ? `${platformOrigin()}${path}` : path);
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
