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
  
  // Fetch directly from Railway API in SSR to avoid Vercel deployment protection
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  
  const res = await fetch(`${apiBaseUrl}/items?tenantId=${encodeURIComponent(tenantId as string)}`, { cache: 'no-store' });
  const data = await res.json();
  const items: Array<{ id: string; sku: string; name: string; priceCents?: number; stock?: number }> = data ?? [];
  return <ItemsClient initialItems={items} initialTenantId={tenantId} />;
}
