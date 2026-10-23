/**
 * Canonical URLs for the host-scoped surfaces (spec §4.9).
 *
 * `/tenant/{slug}`, `/shops/{slug}` and `/products/{id}` all describe a tenant,
 * and the tenant's canonical ladder decides where the equity belongs:
 * active custom domain → platform subdomain → platform path. Never derive these
 * from the request host — the same product renders on the platform apex and on
 * every tenant host, and the request host changes which one wins.
 *
 * The ladder itself lives in `storefront-routing.ts`; this module only composes
 * it with the surface path so both the metadata and the JSON-LD use one value.
 */

import {
  canonicalStorefrontHome,
  canonicalStorefrontOrigin,
  type StorefrontCanonical,
} from './storefront-routing';

/**
 * Shape returned by `TenantPublicService.getStorefrontCanonical` — the ladder
 * resolved by the API. Looser than `StorefrontCanonical` (host/tenantId are
 * optional on the wire), so callers can pass the service result directly.
 */
export interface CanonicalLookup {
  kind: 'custom' | 'subdomain' | 'path';
  host?: string | null;
  tenantId?: string | null;
}

function asStorefrontCanonical(
  canonical: CanonicalLookup | null | undefined,
): StorefrontCanonical | null {
  if (!canonical) return null;
  return {
    kind: canonical.kind,
    host: canonical.host ?? null,
    tenantId: canonical.tenantId ?? '',
  };
}

/** Canonical URL of a product page on its OWNING tenant's canonical surface. */
export function productCanonicalUrl(
  canonical: CanonicalLookup | null | undefined,
  productId: string,
): string {
  return `${canonicalStorefrontOrigin(asStorefrontCanonical(canonical))}/products/${encodeURIComponent(productId)}`;
}

/**
 * Canonical URL of a shop profile — the storefront home. `/shops/{slug}` is the
 * same storefront as `/tenant/{slug}` with a weaker SSR payload, so it is
 * suppressed from the index by canonicalizing here, not by `noindex` (spec §4.9).
 */
export function shopProfileCanonicalUrl(
  canonical: CanonicalLookup | null | undefined,
  tenantIdOrSlug: string,
): string {
  return canonicalStorefrontHome(asStorefrontCanonical(canonical), tenantIdOrSlug);
}
