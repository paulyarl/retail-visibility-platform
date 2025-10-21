"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";

type Tenant = {
  id: string;
  name: string;
};

type Item = {
  id: string;
  sku: string;
  name: string;
  priceCents?: number;
  stock?: number;
  imageUrl?: string;
};

export default function ItemsClient({
  initialItems,
  initialTenantId,
}: {
  initialItems: Item[];
  initialTenantId?: string;
}) {
  const { t } = useTranslation();
  const [tenantId, setTenantId] = useState(initialTenantId || "");
  const [tenants, setTenants] = useState<Tenant[]>([]);
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
      if (!tenantId) {
        setItems([]);
        return;
      }
      const res = await fetch(`/api/items?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  // Load tenants and initialize tenantId (from localStorage or first tenant)
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await fetch("/api/tenants");
        const list: Tenant[] = await res.json();
        setTenants(Array.isArray(list) ? list : []);
        const saved = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
        if (!tenantId) {
          if (saved && list.some(t => t.id === saved)) {
            setTenantId(saved);
          } else if (list.length > 0) {
            setTenantId(list[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tenantId
  useEffect(() => {
    if (tenantId && typeof window !== "undefined") {
      localStorage.setItem("tenantId", tenantId);
    }
  }, [tenantId]);

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
      setItems((prev) => [data, ...prev]);
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

  const compressImage = async (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        
        // Resize if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_failed"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with compression
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      
      img.onerror = () => reject(new Error("image_load_failed"));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  };

  const onUpload = async (item: Item, file: File) => {
    try {
      if (!tenantId) {
        setError("Select a tenant first");
        return;
      }
      
      // Compress image before upload
      const dataUrl = await compressImage(file);
      
      const body = JSON.stringify({ tenantId, dataUrl, contentType: "image/jpeg" });
      
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Upload failed");
        return;
      }
      // payload is the created photoAsset, not an item
      const photoAsset = payload;
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, imageUrl: photoAsset.url } : it)));
    } catch (_e) {
      setError("Upload failed");
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm opacity-80">Tenant</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black min-w-48"
          >
            <option value="" disabled>Select a tenant…</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black flex-1 min-w-40"
            placeholder={t('inventory.searchPlaceholder', 'Search by SKU or name')}
          />
          <button onClick={refresh} disabled={loading}
            className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {loading ? t('common.loading', 'Loading…') : t('common.refresh', 'Refresh')}
          </button>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t('inventory.createItem', 'Create item')}</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder={t('inventory.sku', 'SKU')}
            required
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder={t('inventory.name', 'Name')}
            required
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder={t('inventory.pricePlaceholder', 'Price (e.g. 12.99)')}
            inputMode="decimal"
          />
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="px-3 py-2 border rounded bg-white text-black"
            placeholder={t('inventory.stock', 'Stock')}
            inputMode="numeric"
          />
          <button disabled={creating} className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {creating ? t('common.creating', 'Creating…') : t('common.create', 'Create')}
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t('inventory.title', 'Items')}</h2>
        {filtered.length === 0 ? (
          <p className="text-sm opacity-80">{t('inventory.noItems', 'No items.')}</p>
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
                {i.imageUrl && (
                  <img src={i.imageUrl} alt="" className="h-10 w-10 object-cover rounded border" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) onUpload(i, f);
                    e.currentTarget.value = "";
                  }}
                  className="text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
