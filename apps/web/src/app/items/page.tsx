import ItemsClient from "@/components/items/ItemsClient";
import { headers } from 'next/headers';

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }> | { tenantId?: string };
}) {
  const sp = typeof (searchParams as any)?.then === "function" ? await (searchParams as Promise<{ tenantId?: string }>) : (searchParams as { tenantId?: string } | undefined);
  const tenantId = sp?.tenantId;
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
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Items</h1>
      <ItemsClient initialItems={items} initialTenantId={tenantId} />
    </main>
  );
}
