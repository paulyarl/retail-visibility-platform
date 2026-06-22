"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, Input, Modal, ModalFooter, ConfirmDialog } from "@/components/ui";
// Replace separate hook with consolidated hook
import { useItemsComplete } from "@/hooks/useItemsComplete";
import { useItemsViewMode } from "@/hooks/useItemsViewMode";
import { useItemsModals } from "@/hooks/useItemsModals";
import { useItemsActions } from "@/hooks/useItemsActions";
import { useAccessControl, AccessPresets } from "@/lib/auth/useAccessControl";
import { useProductOptionsCapability } from "@/hooks/tenant-access/useCapabilityAccess";
import StoreInventoryHeader from "@/components/items/StoreInventoryHeader";
import ItemsPagination from "@/components/items/ItemsPagination";
import ItemsGrid from "@/components/items/ItemsGrid";
import ItemsList from "@/components/items/ItemsList";
import EditItemModal from "@/components/items/EditItemModal";
import { QRCodeModal } from "@/components/items/QRCodeModal";
import ItemPhotoGallery from "@/components/items/ItemPhotoGallery";
import CategoryAssignmentModal from "@/components/items/CategoryAssignmentModal";
import BulkUploadModal from "@/components/items/BulkUploadModal";
import PropagationModal from '@/components/items/PropagationModal';
import BulkPropagationModal from '@/components/items/BulkPropagationModal';
import QuickStartEmptyState from "@/components/items/QuickStartEmptyState";
import { Item } from "@/services/itemsDataService";
import { itemsService } from '@/services/ItemsService';
import { itemsSingletonService } from '@/services/ItemsSingletonService';
import { toast } from '@/hooks/use-toast';

interface ItemsPageClientProps {
  tenantId: string;
}



export default function ItemsPageClient({ tenantId }: ItemsPageClientProps) {
  const {
    items,
    loading,
    error,
    stats,
    page,
    pageSize,
    totalItems,
    totalPages,
    status,
    visibility,
    search,
    category,
    setStatus,
    setVisibility,
    setSearch,
    setCategory,
    setPage,
    setPageSize,
    refresh,
    updateItem: updateLocalItem,
  } = useItemsComplete({
    tenantId,
    initialPage: 1,
    initialPageSize: 25,
    initialStatus: "all",
    initialVisibility: "all",
    initialSearch: "",
    initialCategory: null
  });

  const { viewMode, setViewMode } = useItemsViewMode();

  const {
    showCreateModal,
    openCreateModal,
    closeCreateModal,
    editingItem,
    showEditModal,
    openEditModal,
    closeEditModal,
    qrItem,
    showQRModal,
    openQRModal,
    closeQRModal,
    galleryItem,
    showPhotoGallery,
    openPhotoGallery,
    closePhotoGallery,
    categoryItem,
    showCategoryModal,
    openCategoryModal,
    closeCategoryModal,
    showBulkUpload,
    openBulkUpload,
    closeBulkUpload,
  } = useItemsModals();

  const { updateItem, deleteItem } = useItemsActions({
    tenantId,
    onSuccess: refresh,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "warning",
  });

  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Tenant access control for item operations
  useAccessControl(
    tenantId,
    AccessPresets.TENANT_MEMBER,
    false // Don't fetch organization data for tenant-level operations
  );

  // Organization access control for propagation (enabled to check button state)
  const {
    hasAccess: hasOrganizationAccess,
    organizationData,
  } = useAccessControl(
    tenantId,
    AccessPresets.ORGANIZATION_MEMBER,
    true // Enable organization data loading to check button state
  );

  const [propagateItem, setPropagateItem] = useState<Item | null>(null);
  const [showPropagateModal, setShowPropagateModal] = useState(false);
  const [showBulkPropagateModal, setShowBulkPropagateModal] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkActionsExpanded, setBulkActionsExpanded] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);
  
  // Category dropdown state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [allTenantCategories, setAllTenantCategories] = useState<Array<{id: string, name: string}>>([]);
  
  // Build categories from actual items (only relevant categories for product filtering)
  const categoriesFromItems = useRef<Map<string, string>>(new Map());
  
  useEffect(() => {
    // For inventory management, ONLY use product categories from actual items
    // Store categories are completely irrelevant for filtering products
    if (categoriesFromItems.current.size > 0) {
      const cats = Array.from(categoriesFromItems.current.entries()).map(([id, name]) => ({ id, name }));
      setAllTenantCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [tenantId]);
  
  // Collect categories from items as they load (builds up over time)
  useEffect(() => {
    let hasNewCategories = false;
    
    items.forEach(item => {
      if (item.tenantCategory?.id && (typeof item.tenantCategory === 'object' ? item.tenantCategory.name : item.tenantCategory)) {
        const categoryName = typeof item.tenantCategory === 'object' ? item.tenantCategory.name : item.tenantCategory;
        if (!categoriesFromItems.current.has(item.tenantCategory.id)) {
          categoriesFromItems.current.set(item.tenantCategory.id, categoryName);
          hasNewCategories = true;
        }
      }
    });
    
    // Update categories when new ones are found
    if (hasNewCategories) {
      const cats = Array.from(categoriesFromItems.current.entries()).map(([id, name]) => ({ id, name }));
      setAllTenantCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [items]);
  
  // Click outside handlers for dropdowns
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const visibilityDropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (visibilityDropdownRef.current && !visibilityDropdownRef.current.contains(event.target as Node)) {
        setVisibilityDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check URL params for create=true to auto-open create modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    /* console.log('[ItemsPageClient] Checking URL params:', {
      search: window.location.search,
      createParam: params.get('create'),
      shouldOpenModal: params.get('create') === 'true'
    }); */
    if (params.get('create') === 'true' && isProductEnabled) {
      openCreateModal();
    }
  }, [openCreateModal]);

  // Debug: Monitor modal state changes
 /*  useEffect(() => {
    console.log('[ItemsPageClient] Create modal state changed:', showCreateModal);
  }, [showCreateModal]);
 */
  const hasGlobalEmptyState =
    !loading &&
    !error &&
    totalItems === 0 &&
    !search &&
    status === "all" &&
    visibility === "all";

  const hasItems = totalItems > 0;

  const handleUpdate = async (itemId: string, data: Partial<Item>) => {
    try {
      const updatedItem = await updateItem(itemId, data);
      // Instantly update local state with the response
      updateLocalItem(itemId, updatedItem);
      closeEditModal();
      return updatedItem; // Return the updated item
    } catch (error) {
      throw error; // Re-throw to handle in modal
    }
  };

  const handleCreate = async (data: Partial<Item>) => {
    try {
      // Use ItemsSingletonService to create a new item
      const itemData = {
        ...data,
        tenantId,
      };
      const newItem = await itemsSingletonService.createItem(itemData, tenantId);
      
      if (!newItem) {
        throw new Error('Failed to create item');
      }

      closeCreateModal();
      refresh();
      return newItem; // Return the created item
    } catch (error) {
      throw error; // Re-throw to handle in modal
    }
  };

  const handleDelete = (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Item",
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        try {
          const updatedItem = await deleteItem(item.id);
          
          // Update local state instantly with the returned item data
          updateLocalItem(updatedItem.id, updatedItem);
          
          toast({ title: 'Item moved to trash', description: `"${updatedItem.name}" has been moved to trash. You can restore it from the trash bin.`, variant: 'success' });
        } catch (error) {
          // Handle specific error types
          if (error && typeof error === 'object' && 'error' in error) {
            const errorObj = error as any;
            if (errorObj.error === 'trash_capacity_exceeded') {
              toast({ title: 'Cannot delete item', description: `Trash bin is full (${errorObj.current}/${errorObj.capacity} items). Please purge some items from trash first.`, variant: 'warning' });
              return;
            }
          }
          
          // Generic error handling
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete item';
          toast({ title: 'Delete failed', description: errorMessage, variant: 'destructive' });
        }
      },
    });
  };

  const handleRestore = async (item: Item) => {
    try {
      await itemsSingletonService.restoreItem(item.id);
      refresh();
    } catch {
      // Restore failed — non-critical
    }
  };

  const handlePurge = (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: "Permanently Delete Item",
      message: `Are you sure you want to permanently delete "${item.name}"? This action CANNOT be undone.`,
      variant: "danger",
      onConfirm: async () => {
        try {
          await itemsSingletonService.purgeItem(item.id);
          refresh();
        } catch {
          // Purge failed — non-critical
        }
      },
    });
  };

  const handleCategoryAssign = async (itemId: string, categoryId: string) => {
    try {
      const updateData = { tenantCategoryId: categoryId };
      
      // Update the item with the tenant category ID
      await updateItem(itemId, updateData);
      
      closeCategoryModal();
      refresh();
    } catch {
      // Category assignment failed — non-critical
    }
  };

  // Bulk selection handlers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(items.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setBulkMode(false);
  };

  const handleBulkCategoryAssign = async (categoryId: string) => {
    const itemIds = Array.from(selectedItems);
    if (itemIds.length === 0) return;

    try {
      // Update all selected items
      await Promise.all(
        itemIds.map(itemId => updateItem(itemId, { tenantCategoryId: categoryId }))
      );

      closeCategoryModal();
      clearSelection();
      refresh();
      
      toast({ title: 'Category assigned', description: `Successfully assigned category to ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}.`, variant: 'success' });
    } catch {
      // Bulk category assign failed — non-critical
    }
  };

  const handleVisibilityToggle = (item: Item) => {
    const newVisibility = item.visibility === "public" ? "private" : "public";

    if (newVisibility === "private") {
      setConfirmDialog({
        isOpen: true,
        title: "Make Item Private",
        message: `Making "${item.name}" private will prevent it from syncing to Google Merchant Center. Continue?`,
        variant: "warning",
        onConfirm: async () => {
          try {
            await updateItem(item.id, { visibility: newVisibility });
          } catch {
            // Visibility toggle failed — non-critical
          }
        },
      });
    } else {
      (async () => {
        try {
          await updateItem(item.id, { visibility: newVisibility });
        } catch {
          // Visibility toggle failed — non-critical
        }
      })();
    }
  };

  const handleStatusToggle = (item: Item) => {
    // Fix: Use itemStatus instead of status (correct field name)
    const currentStatus = item.itemStatus || item.status || "active";
    const newStatus = currentStatus === "active" ? "archived" : "active";

    if (newStatus === "archived") {
      setConfirmDialog({
        isOpen: true,
        title: "Archive Item",
        message: `Archiving "${item.name}" will prevent it from syncing to Google Merchant Center. Continue?`,
        variant: "warning",
        onConfirm: async () => {
          try {
            await updateItem(item.id, { itemStatus: newStatus });
            refresh(); // Refresh the list after update
          } catch {
            // Status toggle failed — non-critical
          }
        },
      });
    } else {
      (async () => {
        try {
          await updateItem(item.id, { itemStatus: newStatus });
          refresh();
        } catch {
          // Status toggle failed — non-critical
        }
      })();
    }
  };

  // Product options capability gating
  const productOptionsCap = useProductOptionsCapability(tenantId);
  const isProductEnabled = productOptionsCap.data?.enabled ?? true;

  const handleCreateClick = () => {
    if (!isProductEnabled) return;
    window.location.href = `/t/${tenantId}/items?create=true`;
  };

  const handleBulkUploadClick = () => {
    openBulkUpload();
  };

  const handleClone = async (item: Item) => {
    try {
      const result = await itemsService.cloneProduct({
        productId: item.id,
        tenantId: tenantId,
      });
      
      toast({ title: 'Product cloned', description: `${result.product.name} (SKU: ${result.product.sku}) has been created as a draft.`, variant: 'success' });
      
      // Refresh the list to show the new product
      refresh();
    } catch {
      // Clone failed — non-critical
    }
  };

  const handlePropagate = async (item: Item) => {
    // Check if user has organization access
    if (!hasOrganizationAccess) {
      toast({ title: 'Propagation unavailable', description: 'Propagation is only available for organization members. Upgrade to an organization plan to enable multi-location management.', variant: 'warning' });
      return;
    }

    // Check if organization data is loaded
    if (!organizationData) {
      toast({ title: 'Loading', description: 'Organization data is still loading. Please try again in a moment.', variant: 'info' });
      return;
    }

    // Check if organization has multiple locations
    if (organizationData.tenants.length <= 1) {
      toast({ title: 'Propagation unavailable', description: 'Propagation requires multiple locations. Your organization currently has only one location.', variant: 'warning' });
      return;
    }

    setPropagateItem(item);
    setShowPropagateModal(true);
  };

  const handleStockUpdate = async (itemId: string, newStock: number) => {
    /* console.log('[handleStockUpdate] CALLED with:', { itemId, newStock, type: typeof newStock });
    console.log('[handleStockUpdate] updateItem function:', typeof updateItem); */
    try {
      // Ensure stock is a number, not a string
      const stockNumber = typeof newStock === 'string' ? parseInt(newStock) : newStock;
      /* console.log(`[ItemsPageClient] Updating stock for item ${itemId} to ${stockNumber} (type: ${typeof stockNumber})`); */
      const result = await updateItem(itemId, { stock: stockNumber });
      /* console.log(`[ItemsPageClient] Stock updated successfully:`, result); */
      /* console.log(`[ItemsPageClient] Refreshing list...`); */
      // Refresh is called automatically by updateItem's onSuccess callback
    } catch (error) {
      throw error; // Re-throw so the inline editor can handle it
    }
  };

  /* console.log('[ItemsPageClient] Render - state:', {
    tenantId,
    loading,
    error,
    totalItems,
    hasItems,
    itemsLength: items.length,
    page,
    pageSize,
    status,
    visibility,
    search,
    category
  });
 */
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <StoreInventoryHeader
        stats={stats}
        onCreateClick={handleCreateClick}
        onBulkUploadClick={handleBulkUploadClick}
        tenantId={tenantId}
        isProductEnabled={isProductEnabled}
      />

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 space-y-3">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            className="flex-shrink-0"
          >
            {loading && (
              <svg className="animate-spin h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
              </svg>
            )}
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Status + Visibility filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-500 mr-1">Status:</span>
          <Button size="sm" variant={status === "all" ? "primary" : "ghost"} onClick={() => setStatus("all")}>All</Button>
          <Button size="sm" variant={status === "active" ? "primary" : "ghost"} onClick={() => setStatus("active")}>Active</Button>
          <Button size="sm" variant={status === "inactive" ? "primary" : "ghost"} onClick={() => setStatus("inactive")}>Inactive</Button>
          <Button size="sm" variant={status === "syncing" ? "primary" : "ghost"} onClick={() => setStatus("syncing")}>Syncing</Button>
          <Button size="sm" variant={status === "trashed" ? "danger" : "ghost"} onClick={() => setStatus("trashed")}>Trashed</Button>
          <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-2" />
          <span className="text-xs font-medium text-neutral-500 mr-1">Visibility:</span>
          <Button size="sm" variant={visibility === "all" ? "primary" : "ghost"} onClick={() => setVisibility("all")}>All</Button>
          <Button size="sm" variant={visibility === "public" ? "primary" : "ghost"} onClick={() => setVisibility("public")}>Public</Button>
          <Button size="sm" variant={visibility === "private" ? "primary" : "ghost"} onClick={() => setVisibility("private")}>Private</Button>
        </div>

        {/* Category + View Mode filters */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <span className="text-xs font-medium text-neutral-500">Category:</span>
          <Button size="sm" variant={category === null ? "primary" : "ghost"} onClick={() => setCategory(null)}>All</Button>
          <Button size="sm" variant={category === "assigned" ? "primary" : "ghost"} onClick={() => setCategory("assigned")}>Has Category</Button>
          <Button size="sm" variant={category === "unassigned" ? "primary" : "ghost"} onClick={() => setCategory("unassigned")}>No Category</Button>
          
          {/* Category Dropdown */}
          <div className="relative" ref={categoryDropdownRef}>
            <Button
              size="sm"
              variant={category && category !== 'assigned' && category !== 'unassigned' ? "primary" : "secondary"}
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="min-w-[140px] justify-between"
            >
              <span className="truncate">
                {category && category !== 'assigned' && category !== 'unassigned' 
                  ? allTenantCategories.find((c) => c.id === category)?.name || 'Select...'
                  : 'Select Category'}
              </span>
              <svg className="w-3 h-3 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 max-h-64 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50">
                {allTenantCategories.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-neutral-500">No categories found</div>
                ) : (
                  allTenantCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 ${
                        category === cat.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-2" />
          <span className="text-xs font-medium text-neutral-500">View:</span>
          <Button size="sm" variant={viewMode === "grid" ? "primary" : "ghost"} onClick={() => setViewMode("grid")}>Grid</Button>
          <Button size="sm" variant={viewMode === "list" ? "primary" : "ghost"} onClick={() => setViewMode("list")}>List</Button>
        </div>

        {/* Bulk Actions Bar - Collapsible */}
        {items.length > 0 && (
          <div className={`rounded-xl border transition-colors ${
            bulkMode 
              ? 'border-primary-500' 
              : 'border-neutral-200 dark:border-neutral-700'
          }`}>
            {/* Header - Always Visible */}
            <button
              onClick={() => setBulkActionsExpanded(!bulkActionsExpanded)}
              className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                  bulkMode 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Bulk Actions
                  </span>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {bulkMode ? `${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} selected` : 'Select multiple items to edit in bulk'}
                  </p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-neutral-400 transition-transform ${bulkActionsExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expandable Content */}
            {bulkActionsExpanded && (
              <div className="p-3 pt-2 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 rounded-b-xl">
                {/* Select Items Button */}
                <Button
                  size="sm"
                  variant={bulkMode ? "primary" : "secondary"}
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) clearSelection();
                  }}
                >
                  {bulkMode ? "Exit Select Mode" : "Select Items"}
                </Button>

                {bulkMode && (
                  <div className="flex items-center gap-4 mt-3">
                  
                  <div className="flex items-center gap-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40">
                        <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
                          {selectedItems.size}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        selected
                      </span>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={selectAllItems}
                      disabled={selectedItems.size === items.length}
                      className="text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Select All ({items.length})
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                      disabled={selectedItems.size === 0}
                      className="text-neutral-600 dark:text-neutral-400"
                    >
                      Clear
                    </Button>
                  </div>

                  {selectedItems.size > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-right mr-2">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Bulk actions for</p>
                    <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                      {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  {/* Category */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      openCategoryModal({ id: 'bulk', name: 'Multiple Items' } as Item);
                    }}
                    className="font-semibold shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Category
                  </Button>
                  
                  {/* Status Dropdown */}
                  <div className="relative" ref={statusDropdownRef}>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="font-semibold"
                      onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Status
                      <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                    {statusDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={async () => {
                          try {
                            const itemIds = Array.from(selectedItems);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'active' })));
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            toast({ title: 'Status updated', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} set to Active.`, variant: 'success' });
                          } catch {
                            // Bulk status update failed
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Active
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const itemIds = Array.from(selectedItems);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'inactive' })));
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            toast({ title: 'Status updated', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} set to Inactive.`, variant: 'success' });
                          } catch {
                            // Bulk status update failed
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full bg-neutral-400" />
                        Inactive
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const itemIds = Array.from(selectedItems);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'archived' })));
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            toast({ title: 'Status updated', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} archived.`, variant: 'success' });
                          } catch {
                            // Bulk status update failed
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-300 flex items-center gap-2 rounded-b-lg"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Archive
                      </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Visibility Dropdown */}
                  <div className="relative" ref={visibilityDropdownRef}>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="font-semibold"
                      onClick={() => setVisibilityDropdownOpen(!visibilityDropdownOpen)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Visibility
                      <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                    {visibilityDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={async () => {
                          const itemIds = Array.from(selectedItems);
                          await Promise.all(itemIds.map(id => updateItem(id, { visibility: 'public' })));
                          clearSelection();
                          refresh();
                          setVisibilityDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 flex items-center gap-2 rounded-t-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Public
                      </button>
                      <button
                        onClick={async () => {
                          const itemIds = Array.from(selectedItems);
                          await Promise.all(itemIds.map(id => updateItem(id, { visibility: 'private' })));
                          clearSelection();
                          refresh();
                          setVisibilityDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300 flex items-center gap-2 rounded-b-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Private
                      </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Propagate - opens bulk propagation modal */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      // Check if user has organization access
                      if (!hasOrganizationAccess) {
                        toast({ title: 'Propagation unavailable', description: 'Propagation is only available for organization members.', variant: 'warning' });
                        return;
                      }
                      if (!organizationData) {
                        toast({ title: 'Loading', description: 'Organization data is still loading. Please try again.', variant: 'info' });
                        return;
                      }
                      if (organizationData.tenants.length <= 1) {
                        toast({ title: 'Propagation unavailable', description: 'Propagation requires multiple locations.', variant: 'warning' });
                        return;
                      }
                      setShowBulkPropagateModal(true);
                    }}
                    disabled={!hasOrganizationAccess || !organizationData || organizationData.tenants.length <= 1}
                    className="font-semibold"
                    title={
                      !hasOrganizationAccess
                        ? 'Propagation requires organization membership'
                        : !organizationData
                        ? 'Loading organization data...'
                        : organizationData?.tenants.length <= 1
                        ? 'Propagation requires multiple locations'
                        : 'Propagate selected items to other locations'
                    }
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Propagate
                    {(!hasOrganizationAccess || !organizationData || (organizationData.tenants?.length ?? 0) <= 1) && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-semibold">
                        {!hasOrganizationAccess ? 'ORG' : (organizationData?.tenants?.length ?? 0) <= 1 ? '1 LOC' : 'LOAD'}
                      </span>
                    )}
                  </Button>
                  
                  {/* Trash / Restore / Purge - conditional based on current filter */}
                  {status !== 'trashed' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: "Move to Trash",
                          message: `Are you sure you want to move ${selectedItems.size} item(s) to trash? You can restore them later from the trash bin.`,
                          variant: "warning",
                          onConfirm: async () => {
                            try {
                              const itemIds = Array.from(selectedItems);
                              await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'trashed' })));
                              clearSelection();
                              refresh();
                              toast({ title: 'Items moved to trash', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} moved to trash.`, variant: 'success' });
                            } catch (error) {
                              if (error && typeof error === 'object' && 'error' in error) {
                                const errorObj = error as any;
                                if (errorObj.error === 'trash_capacity_exceeded') {
                                  toast({ title: 'Cannot move to trash', description: `Trash bin is full (${errorObj.current}/${errorObj.capacity} items). Please purge some items first.`, variant: 'warning' });
                                  return;
                                }
                              }
                              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                              toast({ title: 'Error', description: `Failed to move items to trash: ${errorMessage}`, variant: 'destructive' });
                            }
                          },
                        });
                      }}
                      className="font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Trash
                    </Button>
                  ) : (
                    <>
                      {/* Restore - only shown when viewing trashed items */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            const itemIds = Array.from(selectedItems);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'active' })));
                            clearSelection();
                            refresh();
                            toast({ title: 'Items restored', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} restored from trash.`, variant: 'success' });
                          } catch {
                            // Bulk restore failed
                          }
                        }}
                        className="font-semibold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Restore
                      </Button>
                      {/* Purge - only shown when viewing trashed items */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: "Permanently Delete Items",
                            message: `Are you sure you want to permanently delete ${selectedItems.size} item(s)? This action CANNOT be undone.`,
                            variant: "danger",
                            onConfirm: async () => {
                              try {
                                const itemIds = Array.from(selectedItems);
                                await itemsSingletonService.emptyTrash(tenantId, itemIds);
                                clearSelection();
                                refresh();
                                toast({ title: 'Items purged', description: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} permanently deleted.`, variant: 'success' });
                              } catch {
                                // Bulk purge failed
                              }
                            },
                          });
                        }}
                        className="font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Purge
                      </Button>
                    </>
                  )}
                </div>
                  )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* List + pagination */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-800 rounded">
            {error}
          </div>
        )}
        {hasGlobalEmptyState ? (
          <QuickStartEmptyState tenantId={tenantId} />
        ) : (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-neutral-600 dark:text-neutral-300">
                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75" />
                </svg>
                Loading items…
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">No items found.</p>
                {(search || status !== "all" || visibility !== "all" || category !== null) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                      setVisibility("all");
                      setCategory(null);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={handleCreateClick} disabled={!isProductEnabled}>
                    Create your first item
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <ItemsGrid
                items={items}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onQRCode={openQRModal}
                onPhotos={openPhotoGallery}
                onCategory={openCategoryModal}
                onClone={handleClone}
                onPropagate={handlePropagate}
                onVisibilityToggle={handleVisibilityToggle}
                onStatusToggle={handleStatusToggle}
                onStockUpdate={handleStockUpdate}
                onRestore={handleRestore}
                onPurge={handlePurge}
                tenantId={tenantId}
                bulkMode={bulkMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
                hasOrganizationAccess={hasOrganizationAccess}
                organizationData={organizationData}
              />
            ) : (
              <ItemsList
                items={items}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onQRCode={openQRModal}
                onPhotos={openPhotoGallery}
                onCategory={openCategoryModal}
                onClone={handleClone}
                onPropagate={handlePropagate}
                onVisibilityToggle={handleVisibilityToggle}
                onStatusToggle={handleStatusToggle}
                onStockUpdate={handleStockUpdate}
                onRestore={handleRestore}
                onPurge={handlePurge}
                tenantId={tenantId}
                bulkMode={bulkMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
                hasOrganizationAccess={hasOrganizationAccess}
                organizationData={organizationData}
              />
            )}

            <ItemsPagination
              pagination={{
                page,
                limit: pageSize,
                totalItems,
                totalPages,
                hasMore: page < totalPages,
              }}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {/* Modals for item actions */}
      {/* Create Item Modal */}
      <EditItemModal
        isOpen={showCreateModal}
        item={null}
        onSave={handleCreate}
        onClose={closeCreateModal}
      />

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={showEditModal}
        item={editingItem}
        onSave={async (data) => {
          if (editingItem) {
            return await handleUpdate(editingItem.id, data);
          }
          throw new Error('No item being edited');
        }}
        onClose={closeEditModal}
        onItemUpdated={refresh}
      />

      {showQRModal && qrItem && (
        <QRCodeModal
          isOpen={showQRModal}
          tenantId={tenantId}
          productUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tenant/${tenantId}/product/${qrItem.id}`}
          productName={qrItem.name}
          onClose={closeQRModal}
        />
      )}

      {showPhotoGallery && galleryItem && (
        <Modal
          isOpen={showPhotoGallery}
          onClose={closePhotoGallery}
          title={`Photos - ${galleryItem.name}`}
          size="xl"
        >
          <ItemPhotoGallery
            item={galleryItem}
            tenantId={tenantId}
            onUpdate={refresh}
          />
          <ModalFooter>
            <Button variant="ghost" onClick={closePhotoGallery}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {showCategoryModal && categoryItem && (
        <CategoryAssignmentModal
          item={categoryItem}
          onSave={async (itemId, categoryId) => {
            // If in bulk mode, use bulk handler, otherwise use single item handler
            if (bulkMode && selectedItems.size > 0) {
              await handleBulkCategoryAssign(categoryId);
            } else {
              await handleCategoryAssign(itemId, categoryId);
            }
          }}
          onClose={closeCategoryModal}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          tenantId={tenantId}
          onClose={closeBulkUpload}
          onSuccess={refresh}
        />
      )}

      {showPropagateModal && propagateItem && organizationData && (
        <PropagationModal
          isOpen={showPropagateModal}
          onClose={() => {
            setShowPropagateModal(false);
            setPropagateItem(null);
          }}
          itemId={propagateItem.id}
          itemName={propagateItem.name}
          currentTenantId={tenantId}
          organizationId={organizationData.id}
          onSuccess={() => {
            refresh();
          }}
        />
      )}

      {showBulkPropagateModal && organizationData && (
        <BulkPropagationModal
          isOpen={showBulkPropagateModal}
          onClose={() => setShowBulkPropagateModal(false)}
          itemIds={Array.from(selectedItems)}
          itemNames={items.filter(item => selectedItems.has(item.id)).map(item => item.name)}
          currentTenantId={tenantId}
          organizationId={organizationData.id}
          onSuccess={() => {
            clearSelection();
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={
          confirmDialog.variant === "danger" ? "Delete" : "Continue"
        }
      />
    </div>
  );
}
