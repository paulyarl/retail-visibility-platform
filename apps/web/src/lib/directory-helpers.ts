/**
 * Directory Helpers
 *
 * Pure, environment-agnostic helpers for directory API calls.
 * Safe to use in middleware, SSR, and client code.
 */

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
  const res = await fetch(`${apiBaseUrl}/api/directory/tenant/${tenantId}`);

  if (!res.ok) {
    console.warn(`[fetchTenantDirectorySlug] HTTP ${res.status} for tenant ${tenantId}`);
    return null;
  }

  const data: TenantDirectorySlugResponse = await res.json();

  if (data.slug === null || data.slug === undefined) {
    return null;
  }

  return data.slug;
}
