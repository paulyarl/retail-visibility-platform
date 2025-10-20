export default async function ItemsPage() {
  const res = await fetch('http://localhost:3000/api/items?tenantId=demo-tenant', { cache: 'no-store' });
  const data = await res.json();
  const items: Array<{ id: string; sku: string; name: string; priceCents?: number; stock?: number }> = data.items ?? [];
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Items</h1>
      <ul className="list-disc pl-6">
        {items.map((i) => (
          <li key={i.id}>
            <span className="font-medium">{i.sku}</span>
            <span className="ml-2">{i.name}</span>
            {typeof i.priceCents === 'number' && (
              <span className="ml-2 text-sm opacity-80">${(i.priceCents / 100).toFixed(2)}</span>
            )}
            {typeof i.stock === 'number' && (
              <span className="ml-2 text-sm opacity-80">stock: {i.stock}</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
