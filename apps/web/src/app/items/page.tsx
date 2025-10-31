import ItemsClient from "@/components/items/ItemsClient";
import { headers } from 'next/headers';

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }> | { tenantId?: string };
}) {
  // Handle both async and sync searchParams (Next.js 15 compatibility)
  const resolvedParams = searchParams && typeof searchParams === 'object' && 'then' in searchParams 
    ? await searchParams 
    : searchParams;
  const tenantId = resolvedParams?.tenantId;
  if (!tenantId) {
    // Redirect to tenants page if no tenant selected
    const { redirect } = await import("next/navigation");
    redirect("/tenants");
  }
  
  // Skip SSR fetch - let client handle it with proper auth
  // This avoids double-fetching and auth issues
  return <ItemsClient initialItems={[]} initialTenantId={tenantId} />;
}
