"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from "@/components/ui";

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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">{t('inventory.title', 'Inventory')}</h1>
              <p className="text-neutral-600 mt-1">Manage your product catalog</p>
            </div>
            <Button onClick={refresh} disabled={loading} variant="secondary">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? t('common.loading', 'Loading…') : t('common.refresh', 'Refresh')}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Tenant</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="" disabled>Select a tenant…</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('inventory.searchPlaceholder', 'Search by SKU or name')}
                label="Search"
              />
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Item Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('inventory.createItem', 'Create New Item')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t('inventory.sku', 'SKU')}
                  label="SKU"
                  required
                />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('inventory.name', 'Name')}
                  label="Name"
                  required
                />
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t('inventory.pricePlaceholder', 'Price (e.g. 12.99)')}
                  label="Price"
                  type="number"
                  step="0.01"
                />
                <Input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder={t('inventory.stock', 'Stock')}
                  label="Stock"
                  type="number"
                />
              </div>
              <Button type="submit" disabled={creating} loading={creating}>
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {creating ? t('common.creating', 'Creating…') : t('common.create', 'Create Item')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('inventory.title', 'Items')} ({filtered.length})</CardTitle>
              {filtered.length > 0 && (
                <Badge variant="info">{filtered.length} items</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900">{t('inventory.noItems', 'No items')}</h3>
                <p className="mt-1 text-sm text-neutral-500">Get started by creating a new item.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {filtered.map((i) => (
                  <div key={i.id} className="py-4 flex items-center gap-4">
                    {/* Image */}
                    <div className="flex-shrink-0">
                      {i.imageUrl ? (
                        <img src={i.imageUrl} alt={i.name} className="h-16 w-16 object-cover rounded-lg border border-neutral-200" />
                      ) : (
                        <div className="h-16 w-16 bg-neutral-100 rounded-lg flex items-center justify-center">
                          <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 truncate">{i.name}</p>
                        <Badge variant="default">{i.sku}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-neutral-500">
                        {typeof i.priceCents === "number" && (
                          <span className="font-medium text-neutral-900">${(i.priceCents / 100).toFixed(2)}</span>
                        )}
                        {typeof i.stock === "number" && (
                          <span>Stock: {i.stock}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          // TODO: Open edit modal or navigate to edit page
                          console.log('Edit item:', i);
                          alert(`Edit functionality coming soon!\n\nItem: ${i.name}\nSKU: ${i.sku}`);
                        }}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 px-3 py-1.5 text-sm bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            if (f) onUpload(i, f);
                            e.currentTarget.value = "";
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
