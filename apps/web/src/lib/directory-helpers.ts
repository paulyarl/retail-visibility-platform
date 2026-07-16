/**
 * Directory Helpers
 *
 * Pure, environment-agnostic helpers for directory API calls.
 * Safe to use in middleware, SSR, and client code.
 */

import { api } from './api';
import { clientLogger } from '@/lib/client-logger';

export interface TenantDirectorySlugResponse {
  slug: string | null;
  tenantId?: string;
  identifierType?: string;
  hasDirectoryListing?: boolean;
}

/**
 * Resolve a tenantId to its directory slug via the public API.
 * Returns the slug string, or null if the tenant has no published listing.
 */
export async function fetchTenantDirectorySlug(
  tenantId: string,
  apiBaseUrl: string
): Promise<string | null> {
  try {
    const res = await api.get(`${apiBaseUrl}/api/directory/tenant/${tenantId}`, {
      skipAuthRedirect: true,
    });

    if (!res.ok) {
      clientLogger.warn(`[fetchTenantDirectorySlug] HTTP ${res.status} for tenant ${tenantId}`);
      return null;
    }

    const data: TenantDirectorySlugResponse = await res.json();

    if (data.slug === null || data.slug === undefined) {
      return null;
    }

    return data.slug;
  } catch (err) {
    clientLogger.warn(`[fetchTenantDirectorySlug] Error for tenant ${tenantId}:`, { detail: err });
    return null;
  }
}
