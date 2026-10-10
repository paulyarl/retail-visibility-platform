/**
 * Tenant subdomain helper — the single place subdomain rules live.
 *
 * Model (agreed 2026-10-10):
 *   - A tenant's subdomain mirrors its slug:  subdomain IS NULL OR subdomain = slug.
 *     Setting a subdomain sets the slug through the platform-standard
 *     SlugSingletonService (which syncs directory_settings_list + directory_listings_list),
 *     so the two namespaces never diverge.
 *   - Subdomains are opt-in: a tenant may have a slug without a subdomain.
 *   - Reserved names are refused; availability is checked across BOTH namespaces
 *     (`tenants.subdomain`, `tenants.slug`, `directory_settings_list.slug`) so one
 *     tenant's slug can never be another tenant's subdomain.
 *
 * Callers: PUT /api/tenants/:id/subdomain (self-service) and the admin
 * /api/admin/subdomains routes. See docs/SLUG_API_RETIREMENT.md.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

/** Infrastructure / platform names a tenant must never claim as a subdomain. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'email', 'cdn', 'static', 'assets',
  'status', 'support', 'help', 'docs', 'blog', 'dashboard', 'account',
  'billing', 'pay', 'checkout', 'store', 'shop', 'dev', 'staging', 'test',
  'ftp', 'smtp', 'ns1', 'ns2', 'localhost', 'internal', 'system', 'visibleshelf',
]);

// Same format the platform already enforces for tenant subdomains.
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]$/;

export function normalizeSubdomain(input: string | null | undefined): string {
  return (input ?? '').trim().toLowerCase();
}

export function isValidSubdomainFormat(subdomain: string): boolean {
  return SUBDOMAIN_REGEX.test(subdomain);
}

export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain);
}

export type SubdomainFailureCode =
  | 'invalid_subdomain'
  | 'reserved_subdomain'
  | 'subdomain_taken'
  | 'tenant_not_found';

export interface SubdomainAvailability {
  available: boolean;
  code?: SubdomainFailureCode;
  takenBy?: { tenantId: string; tenantName: string | null };
}

/**
 * Availability across both namespaces. Excludes `excludeTenantId` (the tenant
 * being renamed) so re-selecting your own value reads as available.
 */
export async function checkSubdomainAvailability(
  rawValue: string,
  excludeTenantId?: string,
): Promise<SubdomainAvailability> {
  const subdomain = normalizeSubdomain(rawValue);

  if (!isValidSubdomainFormat(subdomain)) {
    return { available: false, code: 'invalid_subdomain' };
  }
  if (isReservedSubdomain(subdomain)) {
    return { available: false, code: 'reserved_subdomain' };
  }

  const tenant = await prisma.tenants.findFirst({
    where: {
      OR: [{ subdomain }, { slug: subdomain }],
      ...(excludeTenantId ? { id: { not: excludeTenantId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (tenant) {
    return { available: false, code: 'subdomain_taken', takenBy: { tenantId: tenant.id, tenantName: tenant.name } };
  }

  const settings = await prisma.directory_settings_list.findFirst({
    where: {
      slug: subdomain,
      ...(excludeTenantId ? { tenant_id: { not: excludeTenantId } } : {}),
    },
    select: { tenant_id: true },
  });
  if (settings) {
    return { available: false, code: 'subdomain_taken' };
  }

  return { available: true };
}

export interface SubdomainState {
  slug: string | null;
  subdomain: string | null;
}

export type AssignSubdomainResult =
  | { ok: true; before: SubdomainState; after: SubdomainState }
  | { ok: false; code: SubdomainFailureCode };

/**
 * Assign or rename a tenant's subdomain. Mirrors the slug via
 * SlugSingletonService, then stamps `tenants.subdomain`.
 */
export async function assignSubdomain(tenantId: string, rawValue: string): Promise<AssignSubdomainResult> {
  const availability = await checkSubdomainAvailability(rawValue, tenantId);
  if (!availability.available) {
    return { ok: false, code: availability.code ?? 'invalid_subdomain' };
  }

  const subdomain = normalizeSubdomain(rawValue);

  const before = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { slug: true, subdomain: true },
  });
  if (!before) {
    return { ok: false, code: 'tenant_not_found' };
  }

  const slugSingletonService = (await import('../services/SlugSingletonService')).default;
  try {
    // Platform-standard slug write: syncs directory_settings_list + tenants.slug
    // + directory_listings_list so the public surfaces follow.
    await slugSingletonService.updateSlug(tenantId, subdomain);
  } catch (error: any) {
    // updateSlug re-checks uniqueness against directory_settings_list (TOCTOU race).
    if (typeof error?.message === 'string' && error.message.includes('already taken')) {
      return { ok: false, code: 'subdomain_taken' };
    }
    throw error;
  }

  await prisma.tenants.update({ where: { id: tenantId }, data: { subdomain } });

  return { ok: true, before, after: { slug: subdomain, subdomain } };
}

export type ClearSubdomainResult =
  | { ok: true; before: SubdomainState; after: SubdomainState }
  | { ok: false; code: SubdomainFailureCode };

/**
 * Remove a tenant's subdomain. Clears `subdomain` only — the slug (and the
 * tenant's public slug URLs) is intentionally left intact.
 */
export async function clearSubdomain(tenantId: string): Promise<ClearSubdomainResult> {
  const before = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { slug: true, subdomain: true },
  });
  if (!before) {
    return { ok: false, code: 'tenant_not_found' };
  }

  await prisma.tenants.update({ where: { id: tenantId }, data: { subdomain: null } });
  logger.info(`[Subdomain] Cleared subdomain for tenant ${tenantId} (slug retained: ${before.slug ?? 'none'})`);

  return { ok: true, before, after: { slug: before.slug, subdomain: null } };
}
