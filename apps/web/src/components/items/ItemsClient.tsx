"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  sku: string;
  name: string;
  priceCents?: number;
  stock?: number;
};

export default function ItemsClient({
  initialItems,
  initialTenantId = "demo-tenant",
}: {
  initialItems: Item[];
  initialTenantId?: string;
}) {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [items, setItems] = useState<Item[]>(initialItems ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Create form state
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(""); // dollars as string; convert to cents
  const [stock, setStock] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) =>
      [i.sku, i.name].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [items, q]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/items?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If tenantId changed from initial, refresh list
    if (tenantId !== initialTenantId) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const priceCents = price ? Math.round(parseFloat(price) * 100) : 0;
      const body = {
        tenantId,
        sku: sku.trim(),
        name: name.trim(),
        priceCents,
        stock: stock ? parseInt(stock, 10) : 0,
      };
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || "Failed to create item";
        setError(msg);
        return;
      }
      // Optimistically prepend
      setItems((prev) => [data.item, ...prev]);
      setSku("");
      setName("");
      setPrice("");
      setStock("");
    } catch (e) {
      setError("Failed to create item");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm opacity-80">Tenant</label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="tenant id"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black flex-1 min-w-40"
            placeholder="Search by SKU or name"
          />
          <button onClick={refresh} disabled={loading}
            className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Create item</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="SKU"
            required
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="Name"
            required
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="Price (e.g. 12.99)"
            inputMode="decimal"
          />
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder="Stock"
            inputMode="numeric"
          />
          <button disabled={creating} className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Items</h2>
        {filtered.length === 0 ? (
          <p className="text-sm opacity-80">No items.</p>
        ) : (
          <ul className="divide-y divide-white/10 border rounded">
            {filtered.map((i) => (
              <li key={i.id} className="p-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{i.sku}</span>
                <span className="font-medium">{i.name}</span>
                {typeof i.priceCents === "number" && (
                  <span className="ml-auto text-sm opacity-80">
                    ${(i.priceCents / 100).toFixed(2)}
                  </span>
                )}
                {typeof i.stock === "number" && (
                  <span className="text-sm opacity-80">stock: {i.stock}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
