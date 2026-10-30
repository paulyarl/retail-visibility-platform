/**
 * GBP location + token resolver — the single place that answers
 * "which Google location and which access token does this call use?"
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §3.2 (Sprint D1)
 *
 * Two scopes:
 *   { tenantId }       — DIY convenience: the tenant's first location row
 *                        (matches the old getLinkedLocation behavior).
 *   { gbpLocationId }  — DFY portfolio: an explicit gbp_locations_list.id.
 *
 * Token rule (§3.2): the token follows the location's OWNING oauth account
 * row — `gbp_locations_list.account_id` points at the merchant's row for
 * granted_via='oauth' and at the platform's row for 'invitation' /
 * 'platform_claim'. findGoogleToken('gbp', {accountId}) resolves the right
 * row for both with no cross-lookup — a platform-managed location can never
 * silently pick up the merchant's token (or vice versa), because the token
 * is keyed by the account row, not by tenant.
 *
 * API account id: `platform_account_id` when set (real GBP account id for
 * managed locations), else `account.google_account_id` (preserves the
 * pre-refactor convention), else the local account row id.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { findGoogleToken, resolveGoogleAccessToken, type GoogleTokenRow } from './token-store';

export type GbpGrantedVia = 'oauth' | 'invitation' | 'platform_claim';
export type GbpManagedBy = 'self' | 'platform';

export interface GbpLocation {
  id: string;
  account_id: string;
  location_id: string;
  location_name: string;
  tenant_id: string | null;
  business_name: string | null;
  category: string | null;
  managed_by: GbpManagedBy;
  granted_via: GbpGrantedVia;
  delegated_surfaces: unknown;
  platform_account_id: string | null;
  updated_at: Date | null;
}

export type GbpLocationScope = { tenantId: string } | { gbpLocationId: string };

export interface GbpTarget {
  /** Account segment for GBP API paths (`/accounts/{accountId}/locations/{locationId}`). */
  apiAccountId: string;
  /** Google-side location id for GBP API paths. */
  locationId: string;
  /** The resolved location row. */
  location: GbpLocation;
}

/**
 * Resolve a GBP location row. Reads `gbp_locations_list` directly — it does
 * NOT join through the oauth account, which is what made the old
 * `getLinkedLocation(tenantId)` return null for platform-managed locations
 * (the merchant has no oauth account row under model B).
 */
export async function resolveGbpLocation(scope: GbpLocationScope): Promise<GbpLocation | null> {
  try {
    if ('gbpLocationId' in scope) {
      return (await prisma.gbp_locations_list.findUnique({
        where: { id: scope.gbpLocationId },
      })) as GbpLocation | null;
    }

    return (await prisma.gbp_locations_list.findFirst({
      where: { tenant_id: scope.tenantId },
      orderBy: { updated_at: 'desc' },
    })) as GbpLocation | null;
  } catch (error) {
    logger.error('[GbpTarget] resolveGbpLocation failed', undefined, {
      scope: JSON.stringify(scope),
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    return null;
  }
}

/**
 * Resolve the Google-side account id for API paths — the real GBP account
 * id for platform-managed locations (`platform_account_id`), else the oauth
 * account's stored `google_account_id` / row id (pre-refactor convention).
 */
export async function resolveGbpApiAccountId(location: GbpLocation): Promise<string> {
  if (location.platform_account_id) return location.platform_account_id;

  const account = await prisma.google_oauth_accounts_list.findUnique({
    where: { id: location.account_id },
    select: { id: true, google_account_id: true },
  });

  return account?.google_account_id || account?.id || location.account_id;
}

/**
 * Resolve a usable access token for a location row.
 *
 * The token is read from the location's owning oauth account row — the same
 * row for every granted_via — so there is no wrong-account path to fall
 * into. The legacy `tenants.google_business_*` columns are consulted ONLY
 * when the location is oauth-managed (DIY / model A) — they would be the
 * merchant's own credentials, which must never serve a platform-managed
 * location. Every attempt is logged by path so a missing row is diagnosable.
 */
export async function resolveGbpToken(location: GbpLocation): Promise<string | null> {
  const path = `granted_via=${location.granted_via} managed_by=${location.managed_by} location=${location.id}`;

  const tokenRecord = (await findGoogleToken('gbp', { accountId: location.account_id })) as GoogleTokenRow | null;
  if (tokenRecord) {
    const token = await resolveGoogleAccessToken('gbp', tokenRecord);
    if (token) return token;
    logger.error(`[GbpTarget] token refresh failed (${path})`, undefined);
    return null;
  }

  // Legacy tenant-column fallback — only valid for oauth-managed locations
  // (the tenant's own credentials). Fail closed for anything else.
  if (location.granted_via !== 'oauth' || !location.tenant_id) {
    logger.warn(`[GbpTarget] no 'gbp' token on owning account and fallback not allowed (${path})`, undefined);
    return null;
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: location.tenant_id },
    select: {
      google_business_access_token: true,
      google_business_refresh_token: true,
      google_business_token_expiry: true,
    },
  });

  if (tenant?.google_business_access_token) {
    logger.info(`[GbpTarget] resolved token via legacy tenant columns (${path})`, undefined);
    return tenant.google_business_access_token;
  }

  logger.warn(`[GbpTarget] no token resolvable (${path})`, undefined);
  return null;
}

/**
 * Full target resolution: location row + API account id. Token is left to
 * `resolveGbpToken` so callers that only need the path don't pay the lookup.
 */
export async function resolveGbpTarget(scope: GbpLocationScope): Promise<GbpTarget | null> {
  const location = await resolveGbpLocation(scope);
  if (!location) return null;

  const apiAccountId = await resolveGbpApiAccountId(location);
  return { apiAccountId, locationId: location.location_id, location };
}
