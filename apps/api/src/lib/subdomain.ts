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
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { logger } from '../logger';

/** Infrastructure / platform names a tenant must never claim as a subdomain. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'email', 'cdn', 'static', 'assets',
  'status', 'support', 'help', 'docs', 'blog', 'dashboard', 'account',
  'billing', 'pay', 'checkout', 'store', 'shop', 'dev', 'staging', 'test',
  'ftp', 'smtp', 'ns1', 'ns2', 'localhost', 'internal', 'system', 'visibleshelf',
  // Portal/auth doors — reserved for the shared merchant-portal surface
  // (NRS-style mystore.nrsplus.com parity) and the /manage workspace entry.
  'portal', 'my', 'mystore', 'merchant', 'manage', 'login', 'auth',
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

/**
 * `tenants.metadata` key recording WHEN the subdomain was assigned.
 *
 * There is no dedicated column, and adoption analytics filtered on
 * `tenants.created_at` — which could only ever count brand-new tenants that
 * happened to have a subdomain, leaving a tenant created last year that adopts
 * one today invisible.
 *
 * `tenants.updated_at` is not the answer either: a `BEFORE UPDATE` trigger does
 * maintain it (see AGENTS.md — the trigger is not in the migrations), but that
 * makes it "last modified", not "subdomain assigned". It moves on unrelated
 * edits (name syncs, location_status / subscription_tier changes, metadata
 * writes), so a later edit would make an old adoption read as recent. The stamp
 * lives in metadata (no migration) and is the only source for the adoption date.
 */
export const SUBDOMAIN_ASSIGNED_AT_KEY = 'subdomainAssignedAt';

/** ISO timestamp from `tenants.metadata.subdomainAssignedAt`, or null when unrecorded. */
export function readSubdomainAssignedAt(metadata: unknown): string | null {
  const value = (metadata as Record<string, unknown> | null | undefined)?.[SUBDOMAIN_ASSIGNED_AT_KEY];
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** True when the subdomain was assigned at/after `since`. Unrecorded → false. */
export function wasSubdomainAssignedSince(metadata: unknown, since: Date): boolean {
  const assignedAt = readSubdomainAssignedAt(metadata);
  return assignedAt !== null && new Date(assignedAt) >= since;
}

/**
 * `metadata` with the assignment stamp set (or cleared when `assignedAt` is
 * null), preserving every other key — tenants.metadata also carries
 * `isHeroLocation`, `stripeSubscriptionId`, and operator-set flags.
 */
export function withSubdomainAssignedAt(metadata: unknown, assignedAt: string | null): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};

  if (assignedAt === null) delete base[SUBDOMAIN_ASSIGNED_AT_KEY];
  else base[SUBDOMAIN_ASSIGNED_AT_KEY] = assignedAt;

  return base;
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
    select: { slug: true, subdomain: true, metadata: true },
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

  await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      subdomain,
      metadata: withSubdomainAssignedAt(before.metadata, new Date().toISOString()) as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    before: { slug: before.slug, subdomain: before.subdomain },
    after: { slug: subdomain, subdomain },
  };
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
    select: { slug: true, subdomain: true, metadata: true },
  });
  if (!before) {
    return { ok: false, code: 'tenant_not_found' };
  }

  await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      subdomain: null,
      // Drop the stamp with the subdomain — a later re-assignment gets a fresh
      // one, so the adoption date never describes a removed subdomain.
      metadata: withSubdomainAssignedAt(before.metadata, null) as Prisma.InputJsonValue,
    },
  });
  logger.info(`[Subdomain] Cleared subdomain for tenant ${tenantId} (slug retained: ${before.slug ?? 'none'})`);

  return {
    ok: true,
    before: { slug: before.slug, subdomain: before.subdomain },
    after: { slug: before.slug, subdomain: null },
  };
}
