"use server";
import { cookies, headers } from 'next/headers';

export type TenantContextShape = {
  tenantId: string | null;
  tenantSlug?: string | null;
  aud?: string | null;
};

/**
 * Read tcx cookie on the server and return request-scoped tenant context.
 * Fallbacks to x-tenant-id header when available.
 */
export async function getTenantContext(): Promise<TenantContextShape> {
  const cookieStore = await cookies();
  const hdrs = await headers();

  // Prefer tcx cookie set by middleware
  const raw = cookieStore.get('tcx')?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        tenantId: parsed?.tenant_id ?? null,
        tenantSlug: parsed?.tenant_slug ?? null,
        aud: parsed?.aud ?? null,
      };
    } catch {
      // ignore
    }
  }

  // Fallback: x-tenant-id header from API proxy/requests
  // console.log(`Getting tenant context from header: ${hdrs.get('x-tenant-id')}`);
  const fallbackTenant = hdrs.get('x-tenant-id');
  
  // console.log(`Returning tenant hdrs: ${JSON.stringify(hdrs)}`);
  // console.log(`Returning tenant context: ${fallbackTenant}`);
  return { tenantId: fallbackTenant, tenantSlug: null, aud: null };
}
