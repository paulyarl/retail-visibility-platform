import ItemsClient from "@/components/items/ItemsClient";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: { tenantId?: string };
}) {
  const tenantId = searchParams?.tenantId ?? "demo-tenant";
  const res = await fetch(`http://localhost:3000/api/items?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
  const data = await res.json();
  const items: Array<{ id: string; sku: string; name: string; priceCents?: number; stock?: number }> = data.items ?? [];
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Items</h1>
      <ItemsClient initialItems={items} initialTenantId={tenantId} />
    </main>
  );
}
