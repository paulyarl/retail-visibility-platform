"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Pagination, AdvancedSearchableSelect, type SelectOption } from "@/components/ui";
import EditItemModal from "./EditItemModal";
import { QRCodeModal } from "./QRCodeModal";
import BulkUploadModal from "./BulkUploadModal";
import PageHeader, { Icons } from "@/components/PageHeader";

type Tenant = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  region?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  metadata?: {
    city?: string;
    state?: string;
    country_code?: string;
    address_line1?: string;
    postal_code?: string;
    subscriptionTier?: string;
  };
};

type Item = {
  id: string;
  sku: string;
  name: string;
  priceCents?: number;
  stock?: number;
  imageUrl?: string;
  itemStatus?: 'active' | 'inactive' | 'archived';
  visibility?: 'public' | 'private';
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'syncing'>('all');
  
  // Get current tenant's subscription tier
  const currentTenant = tenants.find(t => t.id === tenantId);
  const subscriptionTier = currentTenant?.subscriptionTier || currentTenant?.metadata?.subscriptionTier || 'trial';

  // Create form state
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(""); // dollars as string; convert to cents
  const [stock, setStock] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create form visibility
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Check URL params for create=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setShowCreateForm(true);
    }
  }, []);

  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrItem, setQRItem] = useState<Item | null>(null);

  // Bulk upload modal state
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    // Ensure items is always an array
    let itemsArray = Array.isArray(items) ? items : [];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      itemsArray = itemsArray.filter((i) => {
        if (statusFilter === 'active') return i.itemStatus === 'active' || !i.itemStatus;
        if (statusFilter === 'inactive') return i.itemStatus === 'inactive';
        if (statusFilter === 'syncing') return (i.itemStatus === 'active' || !i.itemStatus) && (i.visibility === 'public' || !i.visibility);
        return true;
      });
    }
    
    // Apply search filter
    const term = q.trim().toLowerCase();
    if (!term) return itemsArray;
    return itemsArray.filter((i) =>
      i.sku?.toLowerCase().includes(term) || i.name?.toLowerCase().includes(term)
    );
  }, [items, q, statusFilter]);

  const paginatedItems = useMemo(() => {
    // Ensure filtered is always an array before slicing
    const filteredArray = Array.isArray(filtered) ? filtered : [];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredArray.slice(startIndex, endIndex);
  }, [filtered, currentPage, pageSize]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [q]);

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
      console.log('[ItemsClient] Refresh response:', data);
      // Ensure data is an array before processing
      const itemsArray = Array.isArray(data) ? data : [];
      console.log('[ItemsClient] Image URLs in response:', itemsArray.map((item: any) => ({ id: item.id, imageUrl: item.imageUrl })));
      setItems(itemsArray);
    } catch (e) {
      console.error('[ItemsClient] Refresh error:', e);
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
        // Provide user-friendly error messages
        const errorCode = data?.error || "unknown_error";
        const errorMessages: Record<string, string> = {
          duplicate_sku: `Item with SKU "${sku}" already exists for this tenant`,
          invalid_payload: "Invalid item data. Please check all fields.",
          failed_to_create_item: "Failed to create item. Please try again.",
        };
        const msg = errorMessages[errorCode] || `Error: ${errorCode}`;
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

  const onUpdate = async (updatedItem: Item) => {
    setError(null);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(updatedItem.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || "Failed to update item";
        throw new Error(msg);
      }
      // Update local state
      setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? data : item)));
    } catch (e) {
      throw e; // Re-throw to be caught by modal
    }
  };

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleStatusToggle = async (item: Item) => {
    const newStatus = item.itemStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/items/${item.id}?tenantId=${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemStatus: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Update local state
      setItems(items.map(i => i.id === item.id ? { ...i, itemStatus: newStatus } : i));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update item status');
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
      
      console.log('[ItemsClient] Photo upload response:', payload);
      
      // payload is the created photoAsset
      const photoAsset = payload;
      const uploadedUrl = photoAsset.url || photoAsset.publicUrl || photoAsset.signedUrl;
      
      if (!uploadedUrl) {
        console.error('[ItemsClient] No URL in upload response:', payload);
        setError("Upload succeeded but no URL returned");
        return;
      }
      
      console.log('[ItemsClient] Setting imageUrl to:', uploadedUrl);
      
      // Optimistic update so user sees the image immediately
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, imageUrl: uploadedUrl } : it)));
      
      // Refresh from API to pick up any server-side persistence (e.g., Supabase signed/public URL)
      console.log('[ItemsClient] Refreshing items after upload...');
      await refresh();
      
      console.log('[ItemsClient] Items after refresh:', items.find(it => it.id === item.id));
    } catch (_e) {
      console.error('[ItemsClient] Upload error:', _e);
      setError("Upload failed");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title={t('inventory.title', 'Inventory')}
        description="Manage your product catalog"
        icon={Icons.Inventory}
        actions={
          <div className="flex gap-3">
            <Button onClick={() => setShowCreateForm(!showCreateForm)} variant="primary">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showCreateForm ? 'Hide Form' : 'Add New Product'}
            </Button>
            <Button onClick={refresh} disabled={loading} variant="secondary">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? t('common.loading', 'Loading…') : t('common.refresh', 'Refresh')}
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdvancedSearchableSelect
                label="Tenant"
                value={tenantId}
                onChange={(value) => setTenantId(value as string)}
                options={tenants.map(t => ({ 
                  value: t.id, 
                  label: t.name,
                  metadata: {
                    city: t.metadata?.city || t.city,
                    state: t.metadata?.state || t.state,
                    region: t.region,
                  }
                }))}
                placeholder="Select a tenant…"
                showRecent={true}
                showFavorites={true}
                groupBy="state"
                storageKey="tenant-selector"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('inventory.searchPlaceholder', 'Search by SKU or name')}
                label="Search"
              />
              
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All ({items.length})
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Active ({items.filter(i => i.itemStatus === 'active' || !i.itemStatus).length})
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive ({items.filter(i => i.itemStatus === 'inactive').length})
                </Button>
                <Button
                  variant={statusFilter === 'syncing' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('syncing')}
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Syncing to Google ({items.filter(i => (i.itemStatus === 'active' || !i.itemStatus) && (i.visibility === 'public' || !i.visibility)).length})
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowBulkUpload(true)}
                  disabled={!tenantId}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Bulk Upload CSV
                </Button>
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Item Form */}
        {showCreateForm && (
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
        )}

        {/* Badge Legend */}
        {filtered.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Status Badge Guide</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-800">
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="text-xs">Active</Badge>
                      <span>Item is active and can sync to Google</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="text-xs">Inactive</Badge>
                      <span>Item is paused, won't sync to Google</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs bg-amber-100 text-amber-800">Private</Badge>
                      <span>Not visible publicly, won't sync</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-xs flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Syncs to Google
                      </span>
                      <span>Active + Public items only</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('inventory.title', 'Items')}</CardTitle>
              <div className="flex items-center gap-2">
                {statusFilter !== 'all' || q ? (
                  <Badge variant="info">
                    Showing {filtered.length} of {items.length} items
                  </Badge>
                ) : (
                  <Badge variant="info">{items.length} items</Badge>
                )}
              </div>
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
                {paginatedItems.map((i) => (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-neutral-900 truncate">{i.name}</p>
                        <Badge variant="default">{i.sku}</Badge>
                        {/* Status Badges */}
                        <Badge 
                          variant={i.itemStatus === 'active' ? 'success' : i.itemStatus === 'inactive' ? 'warning' : 'error'}
                          className="text-xs"
                        >
                          {i.itemStatus || 'active'}
                        </Badge>
                        {i.visibility === 'private' && (
                          <Badge variant="default" className="text-xs bg-amber-100 text-amber-800">
                            Private
                          </Badge>
                        )}
                        {i.availability === 'out_of_stock' && (
                          <Badge variant="error" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-neutral-500">
                        {typeof i.priceCents === "number" && (
                          <span className="font-medium text-neutral-900">${(i.priceCents / 100).toFixed(2)}</span>
                        )}
                        {typeof i.stock === "number" && (
                          <span>Stock: {i.stock}</span>
                        )}
                        {/* Google Sync Status */}
                        {i.itemStatus === 'active' && i.visibility === 'public' ? (
                          <span className="text-green-600 text-xs flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Syncs to Google
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">Not syncing</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          const url = `${window.location.origin}/products/${i.id}`;
                          window.open(url, '_blank');
                        }}
                        title="View public product page"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          const url = `${window.location.origin}/products/${i.id}`;
                          navigator.clipboard.writeText(url);
                          alert('Product URL copied to clipboard!');
                        }}
                        title="Copy product URL"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setQRItem(i);
                          setShowQRModal(true);
                        }}
                        title="Generate QR code"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </Button>
                      <Button 
                        size="sm" 
                        variant={i.itemStatus === 'active' ? 'secondary' : 'primary'}
                        onClick={() => handleStatusToggle(i)}
                        title={i.itemStatus === 'active' ? 'Deactivate (stop Google sync)' : 'Activate (enable Google sync)'}
                      >
                        {i.itemStatus === 'active' ? (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Deactivate
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Activate
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleEditClick(i)}
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
                        Photo
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
          {filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </Card>
      </div>

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={showEditModal}
        onClose={handleEditClose}
        item={editingItem}
        onSave={onUpdate}
      />

      {/* QR Code Modal */}
      {qrItem && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            setQRItem(null);
          }}
          productUrl={`${window.location.origin}/products/${qrItem.id}`}
          productName={qrItem.name}
          tier={subscriptionTier}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && tenantId && (
        <BulkUploadModal
          tenantId={tenantId}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={async () => {
            // Reload items after successful upload
            try {
              const res = await fetch(`/api/items?tenantId=${tenantId}`);
              const data = await res.json();
              setItems(Array.isArray(data) ? data : []);
            } catch (error) {
              console.error('Failed to reload items:', error);
            }
            setShowBulkUpload(false);
          }}
        />
      )}
    </div>
  );
}
