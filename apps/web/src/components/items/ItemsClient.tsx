"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge, Pagination, AdvancedSearchableSelect, type SelectOption } from "@/components/ui";
import EditItemModal from "./EditItemModal";
import { QRCodeModal } from "./QRCodeModal";
import BulkUploadModal from "./BulkUploadModal";
import ItemPhotoGallery from "./ItemPhotoGallery";
import PageHeader, { Icons } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/featureFlags";
import ItemsGridV2 from "./ItemsGridV2";
import AssignCategoryModal from "./AssignCategoryModal";

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
    logo_url?: string;
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
  categoryPath?: string[];
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
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [totalItems, setTotalItems] = useState(initialItems?.length || 0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Calculate quick stats
  const quickStats = useMemo(() => {
    const allItems = Array.isArray(items) ? items : [];
    const activeCount = allItems.filter(i => i.itemStatus === 'active').length;
    const inactiveCount = allItems.filter(i => i.itemStatus === 'inactive').length;
    const lowStockCount = allItems.filter(i => i.stock !== undefined && i.stock < 10).length;
    const totalValue = allItems.reduce((sum, i) => sum + (i.priceCents || 0), 0) / 100;
    
    return {
      total: totalItems,
      active: activeCount,
      inactive: inactiveCount,
      lowStock: lowStockCount,
      totalValue,
    };
  }, [items, totalItems]);
  
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

  // Check URL params for create=true and tenantId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setShowCreateForm(true);
    }
    // If URL has tenantId and it's different from current, update it
    const urlTenantId = params.get('tenantId');
    if (urlTenantId && urlTenantId !== tenantId) {
      setTenantId(urlTenantId);
    }
  }, []);

  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrItem, setQRItem] = useState<Item | null>(null);

  // Bulk upload modal state
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Photo gallery modal state
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [galleryItem, setGalleryItem] = useState<Item | null>(null);

  // Category assignment modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryItem, setCategoryItem] = useState<Item | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Apply client-side category filter (since API doesn't support it yet)
  const paginatedItems = useMemo(() => {
    const itemsArray = Array.isArray(items) ? items : [];
    if (categoryFilter === 'all') return itemsArray;
    if (categoryFilter === 'assigned') {
      return itemsArray.filter(item => item.categoryPath && item.categoryPath.length > 0);
    }
    if (categoryFilter === 'unassigned') {
      return itemsArray.filter(item => !item.categoryPath || item.categoryPath.length === 0);
    }
    return itemsArray;
  }, [items, categoryFilter]);

  const [isV2, setIsV2] = useState(false);
  
  useEffect(() => {
    // Evaluate feature flag on client only to avoid hydration mismatch
    setIsV2(isFeatureEnabled('FF_ITEMS_V2_GRID', tenantId));
  }, [tenantId]);

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
      
      // Build query params for paginated API
      const params = new URLSearchParams({
        tenantId: encodeURIComponent(tenantId),
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      
      // Add search if present
      if (q.trim()) {
        params.append('search', q.trim());
      }
      
      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      // Add visibility filter if not 'all'
      if (visibilityFilter !== 'all') {
        params.append('visibility', visibilityFilter);
      }
      
      const res = await api.get(`/api/items?${params.toString()}`);
      const data = await res.json();
      console.log('[ItemsClient] Refresh response:', data);
      console.log('[ItemsClient] data.items:', data.items);
      console.log('[ItemsClient] data.pagination:', data.pagination);
      
      // Handle paginated response
      if (data.items && data.pagination) {
        console.log('[ItemsClient] Using paginated format, setting items:', data.items.length);
        setItems(data.items);
        setTotalItems(data.pagination.totalItems);
        setTotalPages(data.pagination.totalPages);
      } else {
        // Fallback for old API format (backward compatibility)
        console.log('[ItemsClient] Using fallback format');
        const itemsArray = Array.isArray(data) ? data : [];
        setItems(itemsArray);
        setTotalItems(itemsArray.length);
        setTotalPages(1);
      }
      console.log('[ItemsClient] After setting, items state:', items.length);
    } catch (e) {
      console.error('[ItemsClient] Refresh error:', e);
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  // Load tenants and initialize tenantId (priority: initialTenantId > URL param > localStorage > first tenant)
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await api.get("/api/tenants");
        const list: Tenant[] = await res.json();
        setTenants(Array.isArray(list) ? list : []);
        
        // Only set tenantId if not already set by initialTenantId or URL param
        if (!tenantId) {
          const saved = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
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
    // Refresh items when tenantId, page, search, or filter changes
    if (tenantId) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, currentPage, q, statusFilter, visibilityFilter]);

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
      const res = await api.post("/api/items", body);
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
      setItems((prev) => [data, ...(Array.isArray(prev) ? prev : [])]);
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
      const res = await api.put(`/api/items/${encodeURIComponent(updatedItem.id)}`, updatedItem);
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || "Failed to update item";
        throw new Error(msg);
      }
      // Update local state
      setItems((prev) => (Array.isArray(prev) ? prev : []).map((item) => (item.id === updatedItem.id ? data : item)));
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
      // Use PATCH for partial updates (only itemStatus)
      const res = await api.patch(`/api/items/${encodeURIComponent(item.id)}`, { itemStatus: newStatus });

      if (!res.ok) {
        const error = await res.json();
        console.error('Failed to update status:', error);
        throw new Error('Failed to update status');
      }

      // Refresh from server to get correct filtered results
      await refresh();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update item status');
    }
  };

  const handleVisibilityToggle = async (item: Item) => {
    const newVisibility = item.visibility === 'public' ? 'private' : 'public';
    try {
      // Use PATCH for partial updates (only visibility)
      const res = await api.patch(`/api/items/${encodeURIComponent(item.id)}`, { visibility: newVisibility });

      if (!res.ok) {
        const error = await res.json();
        console.error('Failed to update visibility:', error);
        throw new Error('Failed to update visibility');
      }

      // Refresh from server to get correct filtered results
      await refresh();
    } catch (error) {
      console.error('Failed to update visibility:', error);
      alert('Failed to update item visibility');
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
      
      const res = await api.post(`/api/items/${encodeURIComponent(item.id)}/photos`, { tenantId, dataUrl, contentType: "image/jpeg" });
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
      setItems((prev) => (Array.isArray(prev) ? prev : []).map((it) => (it.id === item.id ? { ...it, imageUrl: uploadedUrl } : it)));
      
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
        title="Inventory"
        description="Manage your catalog and stock levels"
        icon={Icons.Inventory}
        actions={
          <div className="flex gap-3">
            {tenantId && (
              <Button 
                onClick={() => window.open(`/tenant/${tenantId}`, '_blank')} 
                variant="secondary"
                title="Preview your storefront in a new tab"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview Storefront
              </Button>
            )}
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
        {/* Quick Stats Dashboard */}
        {!loading && totalItems > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total Products</p>
                  <p className="text-2xl font-bold text-neutral-900">{quickStats.total}</p>
                </div>
                <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total Value</p>
                  <p className="text-2xl font-bold text-neutral-900">${quickStats.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Active</p>
                  <p className="text-2xl font-bold text-neutral-900">{quickStats.active}</p>
                </div>
                <div className="h-12 w-12 bg-info rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className={`p-4 ${quickStats.inactive > 0 ? 'bg-neutral-50 border-neutral-300' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Inactive</p>
                  <p className={`text-2xl font-bold ${quickStats.inactive > 0 ? 'text-neutral-700' : 'text-neutral-900'}`}>
                    {quickStats.inactive}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${quickStats.inactive > 0 ? 'bg-neutral-400' : 'bg-neutral-200'}`}>
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className={`p-4 ${quickStats.lowStock > 0 ? 'bg-warning-50 border-warning-200' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Low Stock</p>
                  <p className={`text-2xl font-bold ${quickStats.lowStock > 0 ? 'text-warning' : 'text-neutral-900'}`}>
                    {quickStats.lowStock}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${quickStats.lowStock > 0 ? 'bg-warning' : 'bg-neutral-200'}`}>
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Category Organization CTA */}
        <Card>
          <CardHeader>
            <CardTitle>Category Organization</CardTitle>
            <CardDescription>Organize your products with categories for better feed quality and search performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div className="text-sm text-neutral-600">
                  Create and align categories, then assign them to your products
                </div>
              </div>
              {tenantId && (
                <Button
                  variant="primary"
                  onClick={() => window.location.href = `/t/${tenantId}/categories`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Manage Categories
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tenant Logo */}
        {currentTenant?.metadata?.logo_url && (
          <Card>
            <CardContent className="pt-6 flex justify-center">
              <img 
                src={currentTenant.metadata.logo_url} 
                alt={`${currentTenant.name} logo`}
                className="max-h-32 object-contain"
              />
            </CardContent>
          </Card>
        )}

        {/* Tenant Selector (if not in URL) */}
        {!initialTenantId && (
          <Card>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
        )}

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
                {creating ? t('common.creating', 'Creating…') : t('common.create', 'Add Product')}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        {/* Badge Legends */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status Badge Guide */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Status Badge Guide</h4>
                    <div className="grid grid-cols-1 gap-2 text-xs text-blue-800">
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs">Active</Badge>
                        <span>Product is active and syncs to Google</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="text-xs">Inactive</Badge>
                        <span>Product is paused, won't sync</span>
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

            {/* Category Guide */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-purple-900 mb-2">Category Guide</h4>
                    <div className="grid grid-cols-1 gap-2 text-xs text-purple-800">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 border-blue-200">Electronics</Badge>
                        <span>Product has a category assigned</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="text-xs">Unassigned</Badge>
                        <span>Product needs a category</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-700 text-xs font-medium">💡 Tip:</span>
                        <span>Use filters to find unassigned products</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-700 text-xs font-medium">⚡ Quick:</span>
                        <span>Click "Assign" or "Change" on any product</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Items List */}
        {isV2 ? (
          <ItemsGridV2 
            items={items as any}
            onEdit={handleEditClick}
            onStatusToggle={handleStatusToggle}
            onVisibilityToggle={handleVisibilityToggle}
            onViewPhotos={(item) => {
              setGalleryItem(item);
              setShowPhotoGallery(true);
            }}
          />
        ) : (
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>{t('inventory.title', 'Inventory')}</CardTitle>
              <Badge variant="info">
                Showing {items.length} of {totalItems} products
              </Badge>
            </div>
            
            {/* Search and Filters */}
            <div className="space-y-4">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('inventory.searchPlaceholder', 'Search products by SKU or name')}
                label="Search"
              />
              
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive
                </Button>
                <Button
                  variant={statusFilter === 'syncing' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('syncing')}
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Syncing to Google
                </Button>
              </div>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-neutral-600 self-center mr-2">Category:</span>
                <Button
                  variant={categoryFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={categoryFilter === 'assigned' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter('assigned')}
                >
                  Assigned
                </Button>
                <Button
                  variant={categoryFilter === 'unassigned' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter('unassigned')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Unassigned
                </Button>
              </div>
              
              {/* Visibility Filter */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-neutral-600 self-center mr-2">Visibility:</span>
                <Button
                  variant={visibilityFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setVisibilityFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={visibilityFilter === 'public' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setVisibilityFilter('public')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Public
                </Button>
                <Button
                  variant={visibilityFilter === 'private' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setVisibilityFilter('private')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Private
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="p-4 border border-neutral-200 rounded-lg bg-white animate-pulse">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="h-20 w-20 bg-neutral-200 rounded-lg"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                        <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                        <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-neutral-100 flex gap-2">
                      <div className="h-8 bg-neutral-200 rounded w-20"></div>
                      <div className="h-8 bg-neutral-200 rounded w-20"></div>
                      <div className="h-8 bg-neutral-200 rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">{t('inventory.noItems', 'No items')}</h3>
                <p className="mt-1 text-sm text-neutral-500">Get started by creating a new item.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {paginatedItems.map((i) => (
                  <div key={i.id} className="p-4 border border-neutral-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                    <div className="flex items-start gap-4 mb-3">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {i.imageUrl ? (
                          <img src={i.imageUrl} alt={i.name} className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                        ) : (
                          <div className="h-20 w-20 bg-neutral-100 rounded-lg flex items-center justify-center">
                            <svg className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                          <p className="text-sm font-bold text-primary-900 dark:text-primary-100">{i.name}</p>
                        </div>
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
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">${(i.priceCents / 100).toFixed(2)}</span>
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
                    </div>

                    {/* Category Badge */}
                    <div className="mt-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-xs font-medium text-gray-600">Category:</span>
                          {i.categoryPath && i.categoryPath.length > 0 ? (
                            <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                              {i.categoryPath.join(' > ')}
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs">Unassigned</Badge>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setCategoryItem(i);
                            setShowCategoryModal(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {i.categoryPath && i.categoryPath.length > 0 ? 'Change' : 'Assign'}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-neutral-100">
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
                        title={i.itemStatus === 'active' ? 'Pause (stop Google sync)' : 'Resume (enable Google sync)'}
                      >
                        {i.itemStatus === 'active' ? (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pause
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Resume
                          </>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={i.visibility === 'public' ? 'secondary' : 'ghost'}
                        onClick={() => handleVisibilityToggle(i)}
                        title={i.visibility === 'public' ? 'Make Private (hide from storefront)' : 'Make Public (show on storefront)'}
                      >
                        {i.visibility === 'public' ? (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Public
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            Private
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
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          setGalleryItem(i);
                          setShowPhotoGallery(true);
                        }}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Gallery
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {items.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
          </Card>
        )}

        {/* Quick Actions Area */}
        {!loading && tenantId && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Add products individually or in bulk</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {showCreateForm ? 'Hide Form' : 'Add New Product'}
                </Button>
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
                <Button
                  variant="ghost"
                  disabled={true}
                  title="Coming soon: Scan barcodes to add items"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Scan Barcodes
                  <span className="ml-2 text-xs bg-neutral-200 px-2 py-0.5 rounded">Coming Soon</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
              const res = await api.get(`/api/items?tenantId=${tenantId}`);
              const data = await res.json();
              setItems(Array.isArray(data) ? data : []);
            } catch (error) {
              console.error('Failed to reload items:', error);
            }
            setShowBulkUpload(false);
          }}
        />
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && galleryItem && tenantId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Photo Gallery</h2>
                <p className="text-sm text-neutral-600">{galleryItem.name} ({galleryItem.sku})</p>
              </div>
              <button
                onClick={() => {
                  setShowPhotoGallery(false);
                  setGalleryItem(null);
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ItemPhotoGallery
                item={galleryItem}
                tenantId={tenantId}
                onUpdate={() => {
                  // Refresh items list to update primary image
                  refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Assignment Modal */}
      {showCategoryModal && categoryItem && (
        <AssignCategoryModal
          tenantId={tenantId}
          itemId={categoryItem.id}
          itemName={categoryItem.name}
          currentCategory={categoryItem.categoryPath?.[0]}
          onClose={() => {
            setShowCategoryModal(false);
            setCategoryItem(null);
          }}
          onSave={() => {
            refresh();
          }}
        />
      )}
    </div>
  );
}
