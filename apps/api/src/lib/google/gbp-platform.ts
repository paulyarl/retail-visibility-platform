/**
 * Platform GBP ops — model B access acquisition + lifecycle (Sprint D7).
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §3.3
 *
 * Everything here runs under the PLATFORM's own GBP token — the 'gbp'
 * provider token on the VisibleShelf internal tenant's oauth account row
 * (GBP_PLATFORM_TENANT_ID). The merchant never touches OAuth.
 *
 *   searchGoogleLocations   → googleLocations.search (intake step 1)
 *   claimLocation           → accounts.locations.create (unclaimed path)
 *   listLocationAdmins      → locations.admins.list (drift + handoff)
 *   inviteLocationAdmin     → locations.admins.create (handoff / cooperative)
 *   removeLocationAdmin     → locations.admins.delete (offboard)
 *   patchLocationAdminRole  → locations.admins.patch (PRIMARY_OWNER attempt)
 *   fetchVerificationOptions→ locations.fetchVerificationOptions (post-claim)
 *
 * All calls go through gbpFetch — fixture/record modes apply to every one.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';
import { findGoogleToken, resolveGoogleAccessToken } from './token-store';
import {
  gbpFetch,
  GBP_ACCOUNT_MANAGEMENT_BASE,
  GBP_BUSINESS_INFORMATION_BASE,
} from './gbp-transport';
import type { GbpLocation } from './gbp-target';

export interface PlatformGbpIdentity {
  /** Local google_oauth_accounts_list.id — what managed rows store in account_id. */
  oauthAccountId: string;
  /** Bearer token for API calls. */
  token: string;
  /** 'accounts/{id}' resource name of the platform's GBP account. */
  apiAccountName: string;
}

/**
 * Resolve the platform's GBP identity. Fails closed — a missing config or
 * token means model B is simply unavailable, and we say so loudly.
 */
export async function resolvePlatformGbpIdentity(): Promise<PlatformGbpIdentity | null> {
  const platformTenantId = unifiedConfig.gbpPlatformTenantId;
  if (!platformTenantId) {
    logger.warn('[GbpPlatform] GBP_PLATFORM_TENANT_ID not configured', undefined);
    return null;
  }

  const account = await prisma.google_oauth_accounts_list.findFirst({
    where: { tenant_id: platformTenantId },
  });
  if (!account) {
    logger.warn('[GbpPlatform] no oauth account row on platform tenant', undefined, { platformTenantId });
    return null;
  }

  const tokenRecord = await findGoogleToken('gbp', { accountId: account.id });
  if (!tokenRecord) {
    logger.warn('[GbpPlatform] no gbp token on platform oauth account', undefined, { accountId: account.id });
    return null;
  }
  const token = await resolveGoogleAccessToken('gbp', tokenRecord);
  if (!token) {
    logger.error('[GbpPlatform] platform gbp token refresh failed', undefined);
    return null;
  }

  // The GBP account resource name ('accounts/{id}') — read live; the oauth
  // row's google_account_id may still be a placeholder.
  const accountsRes = await gbpFetch(`${GBP_ACCOUNT_MANAGEMENT_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!accountsRes.ok) {
    logger.error('[GbpPlatform] accounts.list failed', undefined, { status: accountsRes.status });
    return null;
  }
  const accountsData = (await accountsRes.json()) as { accounts?: Array<{ name?: string }> };
  const apiAccountName = accountsData.accounts?.[0]?.name;
  if (!apiAccountName) {
    logger.error('[GbpPlatform] platform token sees no GBP accounts', undefined);
    return null;
  }

  return { oauthAccountId: account.id, token, apiAccountName };
}

// ── googleLocations.search ────────────────────────────────────────────────

export interface GoogleLocationCandidate {
  /** 'locations/{id}' resource name when Google knows the listing. */
  locationName: string | null;
  title: string | null;
  address: string | null;
  /** Present → the listing is claimed; submitting it requests admin rights. */
  requestAdminRightsUri: string | null;
  /** Present on some results — direct claim URI for unclaimed listings. */
  requestOwnershipUri: string | null;
}

export async function searchGoogleLocations(
  identity: PlatformGbpIdentity,
  query: string
): Promise<{ success: boolean; candidates: GoogleLocationCandidate[]; error?: string }> {
  const res = await gbpFetch(`${GBP_BUSINESS_INFORMATION_BASE}/googleLocations:search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, candidates: [], error: `search failed: ${res.status} ${text.slice(0, 200)}` };
  }
  const data = (await res.json()) as { googleLocations?: any[] };
  const candidates = (data.googleLocations ?? []).map((g) => ({
    locationName: g.location?.name ?? null,
    title: g.location?.title ?? null,
    address: g.location?.storefrontAddress
      ? [
          g.location.storefrontAddress.addressLines?.join(' '),
          g.location.storefrontAddress.locality,
          g.location.storefrontAddress.administrativeArea,
          g.location.storefrontAddress.postalCode,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
    requestAdminRightsUri: g.requestAdminRightsUri ?? null,
    requestOwnershipUri: g.requestOwnershipUri ?? null,
  }));
  return { success: true, candidates };
}

// ── Claim (unclaimed path — platform becomes owner) ───────────────────────

export async function claimLocation(
  identity: PlatformGbpIdentity,
  location: { title: string; storefrontAddress: unknown; categories?: unknown; phoneNumbers?: unknown; websiteUri?: string }
): Promise<{ success: boolean; locationName?: string; error?: string }> {
  const res = await gbpFetch(
    `${GBP_BUSINESS_INFORMATION_BASE}/${identity.apiAccountName}/locations`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `locations.create failed: ${res.status} ${text.slice(0, 200)}` };
  }
  const created = (await res.json()) as { name?: string };
  return { success: true, locationName: created.name };
}

// ── Admins (drift check + handoff) ────────────────────────────────────────

export interface LocationAdmin {
  /** 'locations/{id}/admins/{adminId}' */
  name: string;
  admin: string | null; // email
  account: string | null; // 'accounts/{id}'
  role: string | null;
  pendingInvitation: boolean;
}

export async function listLocationAdmins(
  identity: PlatformGbpIdentity,
  locationId: string
): Promise<{ success: boolean; admins: LocationAdmin[]; error?: string }> {
  const res = await gbpFetch(`${GBP_ACCOUNT_MANAGEMENT_BASE}/locations/${locationId}/admins`, {
    headers: { Authorization: `Bearer ${identity.token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, admins: [], error: `admins.list failed: ${res.status} ${text.slice(0, 200)}` };
  }
  const data = (await res.json()) as { locationAdmins?: any[] };
  const admins = (data.locationAdmins ?? []).map((a) => ({
    name: a.name,
    admin: a.admin ?? null,
    account: a.account ?? null,
    role: a.role ?? null,
    pendingInvitation: !!a.pendingInvitation,
  }));
  return { success: true, admins };
}

/** True when the platform still holds an admin row on the location. */
export async function platformHasAccess(
  identity: PlatformGbpIdentity,
  locationId: string
): Promise<boolean> {
  const { success, admins } = await listLocationAdmins(identity, locationId);
  if (!success) return false;
  return admins.some((a) => a.account === identity.apiAccountName && !a.pendingInvitation);
}

export async function inviteLocationAdmin(
  identity: PlatformGbpIdentity,
  locationId: string,
  email: string,
  role: 'OWNER' | 'MANAGER'
): Promise<{ success: boolean; error?: string }> {
  const res = await gbpFetch(`${GBP_ACCOUNT_MANAGEMENT_BASE}/locations/${locationId}/admins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin: email, role }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `admins.create failed: ${res.status} ${text.slice(0, 200)}` };
  }
  return { success: true };
}

/** Attempt to set PRIMARY_OWNER — API support is in-flight-verified (D7.5). */
export async function patchLocationAdminRole(
  identity: PlatformGbpIdentity,
  adminName: string,
  role: 'PRIMARY_OWNER' | 'OWNER' | 'MANAGER'
): Promise<{ success: boolean; error?: string }> {
  const res = await gbpFetch(`${GBP_ACCOUNT_MANAGEMENT_BASE}/${adminName}?updateMask=role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `admins.patch failed: ${res.status} ${text.slice(0, 200)}` };
  }
  return { success: true };
}

export async function removeLocationAdmin(
  identity: PlatformGbpIdentity,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  const res = await gbpFetch(`${GBP_ACCOUNT_MANAGEMENT_BASE}/${adminName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${identity.token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `admins.delete failed: ${res.status} ${text.slice(0, 200)}` };
  }
  return { success: true };
}

// ── Drift sweep ───────────────────────────────────────────────────────────

export interface DriftResult {
  gbpLocationId: string;
  tenantId: string | null;
  ok: boolean;
  /** 'revoked' when our admin row vanished, 'check_failed' on API error. */
  outcome: 'ok' | 'revoked' | 'check_failed' | 'skipped';
  note?: string;
}

/**
 * Sweep managed locations: confirm the platform's admin row still exists.
 * Revocations flip claim_state and surface in the ops queue — callers write
 * the alerts/events.
 */
export async function checkDrift(
  identity: PlatformGbpIdentity,
  locations: Pick<GbpLocation, 'id' | 'tenant_id' | 'location_id' | 'granted_via'>[]
): Promise<DriftResult[]> {
  const results: DriftResult[] = [];
  for (const loc of locations) {
    try {
      const hasAccess = await platformHasAccess(identity, loc.location_id);
      results.push({
        gbpLocationId: loc.id,
        tenantId: loc.tenant_id,
        ok: hasAccess,
        outcome: hasAccess ? 'ok' : 'revoked',
      });
    } catch (error: any) {
      results.push({
        gbpLocationId: loc.id,
        tenantId: loc.tenant_id,
        ok: false,
        outcome: 'check_failed',
        note: error?.message,
      });
    }
  }
  return results;
}
