/**
 * Tenant storefront URL resolution — the API-side canonical ladder.
 *
 * Level 3 (active custom domain) → level 2 (platform subdomain) → platform
 * path. One module for the API consumers that need it:
 *   - GET /api/tenants/storefront-canonical/:id — the web delegate's data source
 *   - GMCProductSync — writes the product link into Google Merchant Center
 *
 * Cross-runtime counterpart: `apps/web/src/lib/storefront-routing.ts`
 * (`canonicalStorefrontOrigin` / `canonicalStorefrontHome`) maps the same
 * ladder on the browser/SSR side. Keep the two in step — `StorefrontCanonical`
 * is the contract between them.
 */

import { prisma } from '../prisma';
import { unifiedConfig } from '../config/unifiedConfig';

export interface StorefrontCanonical {
  kind: 'custom' | 'subdomain' | 'path';
  /** Domain root for 'custom', subdomain label for 'subdomain', null for 'path'. */
  host: string | null;
  tenantId: string;
  /** The tenant's platform subdomain, whichever level wins the ladder. */
  subdomain: string | null;
}

/**
 * Platform apex host, derived from config — never a hardcoded literal (staging
 * serves on `visibleshelf.store`, prod on `visibleshelf.com`).
 */
export function platformApex(): string {
  const raw =
    unifiedConfig.frontendUrl ||
    unifiedConfig.webUrl ||
    unifiedConfig.get('WEB_URL') ||
    unifiedConfig.get('NEXT_PUBLIC_WEB_URL') ||
    'https://visibleshelf.com';
  try {
    return new URL(raw).hostname;
  } catch {
    return 'visibleshelf.com';
  }
}

/**
 * Resolve a tenant's canonical surface by id OR slug. Null when no tenant
 * matches. An `active` custom domain wins over the platform subdomain; a
 * `pending_verification`/`disabled` row never does (the proxy would fail closed
 * on it, so links must not point there either).
 */
export async function resolveStorefrontCanonical(
  idOrSlug: string,
): Promise<StorefrontCanonical | null> {
  const tenant = await prisma.tenants.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, subdomain: true },
  });
  if (!tenant) return null;

  const domain = await prisma.custom_domains.findFirst({
    where: { tenant_id: tenant.id, status: 'active' },
    orderBy: { is_primary: 'desc' },
    select: { domain: true },
  });
  if (domain) return { kind: 'custom', host: domain.domain, tenantId: tenant.id, subdomain: tenant.subdomain };
  if (tenant.subdomain) return { kind: 'subdomain', host: tenant.subdomain, tenantId: tenant.id, subdomain: tenant.subdomain };
  return { kind: 'path', host: null, tenantId: tenant.id, subdomain: null };
}

/**
 * Absolute base URL of a tenant's canonical storefront, or null when the tenant
 * serves on the platform path only — i.e. it has no DNS-shaped host of its own.
 * Callers that require a merchant-controlled domain (Google Merchant Center)
 * must treat null as "not published" rather than falling back to the platform
 * path.
 */
export function canonicalStorefrontBaseUrl(canon: StorefrontCanonical | null): string | null {
  if (!canon) return null;
  if (canon.kind === 'custom' && canon.host) return `https://${canon.host}`;
  if (canon.kind === 'subdomain' && canon.host) return `https://${canon.host}.${platformApex()}`;
  return null;
}
