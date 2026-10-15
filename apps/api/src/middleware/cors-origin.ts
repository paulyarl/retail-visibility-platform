/**
 * CORS origin resolution — data-driven for tenant-owned custom domains.
 *
 * The storefront serves on three surfaces: the platform app, platform
 * subdomains, and tenant-owned custom domains (level 3). The browser calls the
 * API on its own origin (NEXT_PUBLIC_API_BASE_URL), so every surface is a
 * cross-origin caller and must be allowed here.
 *
 * Platform hosts are a code-owned allowlist (D8). Custom domains are not:
 * tenants attach and detach them continuously, so the allowlist has to be read
 * from persistence. A host is allowed exactly when it resolves to an `active`
 * `custom_domains` row — the same gate the storefront proxy resolves against —
 * so CORS can never allow a host the proxy would fail closed on.
 *
 * `cors` 2.8.x resolves the origin synchronously, so the (async) decision is
 * made here and handed to the package as an options delegate: an allowed origin
 * is appended to the platform patterns and the package reflects it verbatim; a
 * denied origin matches nothing, so no `Access-Control-Allow-Origin` is emitted.
 */

import type { CorsOptions } from 'cors';
import { customDomainService } from '../services/CustomDomainService';
import { normalizeHostForResolve } from '../lib/custom-domain';
import { logger } from '../logger';

/** Platform-owned origins — code-owned allowlist, never tenant input (D8). */
export const PLATFORM_CORS_ORIGINS: (string | RegExp)[] = [
  /localhost:\d+$/,
  /\.vercel\.app$/,
  /vercel\.app$/,
  /www\.visibleshelf\.com$/,
  /visibleshelf\.com$/,
  /\.visibleshelf\.com$/,
  /visibleshelf\.store$/,
  /\.visibleshelf\.store$/,
];

export const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

export const CORS_ALLOWED_HEADERS = [
  'content-type', 'authorization', 'x-csrf-token', 'x-tenant-id', 'x-no-retry', 'x-device-info',
  'x-admin-request', 'x-tenant-request', 'x-request-group', 'x-request-groups', 'x-require-all',
  'x-admin-roles', 'x-audit-id', 'x-request-context', 'x-organization-id', 'x-organization-validation',
  'x-audit-operation', 'x-audit-reason', 'x-service', 'x-service-key', 'x-auth0-email', 'x-auth0-id',
  'x-session-id', 'x-customer-id', 'x-customer-email', 'x-correlation-id', 'cache-control',
  'x-platform-cache', 'x-service-admin',
];

/**
 * Per-isolate TTL cache. The lookup runs on every request from a tenant host
 * (preflights included); a domain's active state changes rarely. Negative
 * results are cached too — an unresolved host is already fail-closed, so a
 * short-lived miss only delays a just-activated domain by up to the TTL.
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 1000;
const resolvedOriginCache = new Map<string, { allowed: boolean; expires: number }>();

/** True when the origin is one of ours — no persistence read needed. */
export function isPlatformCorsOrigin(origin: string): boolean {
  return PLATFORM_CORS_ORIGINS.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(origin) : pattern === origin,
  );
}

/**
 * Logical root of an Origin header value — lowercase, www- and port-stripped
 * (shared with the resolve path so the cache keys on the same root the
 * storefront proxy resolves). Null when it isn't a parseable URL.
 */
function originHostname(origin: string): string | null {
  try {
    return normalizeHostForResolve(new URL(origin).hostname) || null;
  } catch {
    return null;
  }
}

/**
 * True when `origin` belongs to a tenant-owned custom domain with an `active`
 * row. Fails closed on lookup errors — a transient DB fault must never widen
 * the allowlist.
 */
export async function isAllowedCustomOrigin(origin: string): Promise<boolean> {
  const host = originHostname(origin);
  if (!host) return false;

  const cached = resolvedOriginCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.allowed;

  let allowed: boolean;
  try {
    allowed = (await customDomainService.resolveHostToTenant(host)) !== null;
  } catch (error: any) {
    // Do not cache a transient failure — the next request retries live.
    logger.warn('[CORS] Custom-domain origin lookup failed — denying origin', undefined, {
      origin,
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    return false;
  }

  rememberResolvedOrigin(host, allowed);
  return allowed;
}

function rememberResolvedOrigin(host: string, allowed: boolean): void {
  if (resolvedOriginCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = resolvedOriginCache.keys().next().value;
    if (oldest !== undefined) resolvedOriginCache.delete(oldest);
  }
  resolvedOriginCache.set(host, { allowed, expires: Date.now() + CACHE_TTL_MS });
}

/** Test seam — drop every cached resolution. */
export function clearCorsOriginCache(): void {
  resolvedOriginCache.clear();
}

/** CORS options carrying the code-owned platform allowlist only. */
export function platformOnlyCorsOptions(): CorsOptions {
  return {
    origin: PLATFORM_CORS_ORIGINS,
    credentials: true,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
  };
}

/**
 * CORS options for a request's Origin header. An allowed custom origin is
 * appended to the platform patterns so `cors` reflects it verbatim; a denied
 * one matches nothing and the header is withheld.
 */
export async function resolveCorsOptions(origin: string | undefined): Promise<CorsOptions> {
  const base = platformOnlyCorsOptions();
  if (!origin || isPlatformCorsOrigin(origin)) return base;
  const allowed = await isAllowedCustomOrigin(origin);
  return allowed ? { ...base, origin: [...PLATFORM_CORS_ORIGINS, origin] } : base;
}
