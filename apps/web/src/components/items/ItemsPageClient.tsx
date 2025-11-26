"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Button, Input, Modal, ModalFooter, ConfirmDialog } from "@/components/ui";
import { useTenantItems } from "@/hooks/useTenantItems";
import { useItemsViewMode } from "@/hooks/useItemsViewMode";
import { useItemsModals } from "@/hooks/useItemsModals";
import { useItemsActions } from "@/hooks/useItemsActions";
import ItemsHeader from "@/components/items/ItemsHeader";
import ItemsPagination from "@/components/items/ItemsPagination";
import ItemsGrid from "@/components/items/ItemsGrid";
import ItemsList from "@/components/items/ItemsList";
import EditItemModal from "@/components/items/EditItemModal";
import { QRCodeModal } from "@/components/items/QRCodeModal";
import ItemPhotoGallery from "@/components/items/ItemPhotoGallery";
import CategoryAssignmentModal from "@/components/items/CategoryAssignmentModal";
import BulkUploadModal from "@/components/items/BulkUploadModal";
import QuickStartEmptyState from "@/components/items/QuickStartEmptyState";
import ItemsGuide from "@/components/items/ItemsGuide";
import { itemsDataService, Item } from "@/services/itemsDataService";

interface ItemsPageClientProps {
  tenantId: string;
}

export default function ItemsPageClient({ tenantId }: ItemsPageClientProps) {
  const {
    items,
    loading,
    error,
    page,
    pageSize,
    totalItems,
    totalPages,
    status,
    visibility,
    search,
    setStatus,
    setVisibility,
    setSearch,
    setPage,
    setPageSize,
    refresh,
  } = useTenantItems({ tenantId });

  const { viewMode, setViewMode } = useItemsViewMode();
  const stats = useMemo(() => itemsDataService.calculateStats(items), [items]);

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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkActionsExpanded, setBulkActionsExpanded] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);
  
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
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check URL params for create=true to auto-open create modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    console.log('[ItemsPageClient] Checking URL params:', {
      search: window.location.search,
      createParam: params.get('create'),
      shouldOpenModal: params.get('create') === 'true'
    });
    if (params.get('create') === 'true') {
      console.log('[ItemsPageClient] Opening create modal...');
      openCreateModal();
    }
  }, [openCreateModal]);

  // Debug: Monitor modal state changes
  useEffect(() => {
    console.log('[ItemsPageClient] Create modal state changed:', showCreateModal);
  }, [showCreateModal]);

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
      await updateItem(itemId, data);
      closeEditModal();
    } catch (error) {
      console.error("[ItemsPageClient] Update failed:", error);
    }
  };

  const handleCreate = async (data: Partial<Item>) => {
    try {
      console.log('[ItemsPageClient] Creating item with data:', data);
      console.log('[ItemsPageClient] Data keys:', Object.keys(data));
      
      // Use the items API to create a new item
      const payload = {
        ...data,
        tenantId,
      };
      console.log('[ItemsPageClient] Full payload:', payload);
      
      const response = await fetch(`/api/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ItemsPageClient] Response status:', response.status);
        console.error('[ItemsPageClient] Response body:', errorText);
        throw new Error('Failed to create item');
      }

      closeCreateModal();
      refresh();
    } catch (error) {
      console.error("[ItemsPageClient] Create failed:", error);
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
          await deleteItem(item.id);
        } catch (error) {
          console.error("[ItemsPageClient] Delete failed:", error);
        }
      },
    });
  };

  const handleCategoryAssign = async (itemId: string, categoryId: string) => {
    try {
      console.log('[handleCategoryAssign] Called with:', { itemId, categoryId });
      const updateData = { tenantCategoryId: categoryId };
      console.log('[handleCategoryAssign] Update data:', updateData);
      
      // Update the item with the tenant category ID
      await updateItem(itemId, updateData);
      
      closeCategoryModal();
      refresh();
    } catch (error) {
      console.error("[ItemsPageClient] Category assignment failed:", error);
      alert(error instanceof Error ? error.message : "Failed to assign category");
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
      console.log('[handleBulkCategoryAssign] Assigning category to items:', { categoryId, itemIds });
      
      // Update all selected items
      await Promise.all(
        itemIds.map(itemId => updateItem(itemId, { tenantCategoryId: categoryId }))
      );

      closeCategoryModal();
      clearSelection();
      refresh();
      
      alert(`Successfully assigned category to ${itemIds.length} item(s)`);
    } catch (error) {
      console.error('[handleBulkCategoryAssign] Failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign category to items');
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
          } catch (error) {
            console.error("[ItemsPageClient] Visibility toggle failed:", error);
          }
        },
      });
    } else {
      (async () => {
        try {
          await updateItem(item.id, { visibility: newVisibility });
        } catch (error) {
          console.error("[ItemsPageClient] Visibility toggle failed:", error);
        }
      })();
    }
  };

  const handleStatusToggle = (item: Item) => {
    const newStatus = item.status === "active" ? "archived" : "active";

    if (newStatus === "archived") {
      setConfirmDialog({
        isOpen: true,
        title: "Archive Item",
        message: `Archiving "${item.name}" will prevent it from syncing to Google Merchant Center. Continue?`,
        variant: "warning",
        onConfirm: async () => {
          try {
            await updateItem(item.id, { itemStatus: newStatus });
          } catch (error) {
            console.error("[ItemsPageClient] Status toggle failed:", error);
          }
        },
      });
    } else {
      (async () => {
        try {
          await updateItem(item.id, { itemStatus: newStatus });
        } catch (error) {
          console.error("[ItemsPageClient] Status toggle failed:", error);
        }
      })();
    }
  };

  const handleCreateClick = () => {
    window.location.href = `/t/${tenantId}/items?create=true`;
  };

  const handleBulkUploadClick = () => {
    openBulkUpload();
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Inventory</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Manage what's on your shelf and make it visible online
        </p>

        <div className="mt-6">
          <ItemsHeader
            stats={stats}
            onCreateClick={handleCreateClick}
            onBulkUploadClick={handleBulkUploadClick}
            tenantId={tenantId}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 space-y-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={status === "all" ? "primary" : "ghost"}
            onClick={() => setStatus("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={status === "active" ? "primary" : "ghost"}
            onClick={() => setStatus("active")}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={status === "inactive" ? "primary" : "ghost"}
            onClick={() => setStatus("inactive")}
          >
            Inactive
          </Button>
          <Button
            size="sm"
            variant={status === "syncing" ? "primary" : "ghost"}
            onClick={() => setStatus("syncing")}
          >
            Syncing
          </Button>

          <Button
            size="sm"
            variant={visibility === "all" ? "primary" : "ghost"}
            onClick={() => setVisibility("all")}
          >
            All Visibility
          </Button>
          <Button
            size="sm"
            variant={visibility === "public" ? "primary" : "ghost"}
            onClick={() => setVisibility("public")}
          >
            Public
          </Button>
          <Button
            size="sm"
            variant={visibility === "private" ? "primary" : "ghost"}
            onClick={() => setVisibility("private")}
          >
            Private
          </Button>
        </div>

        {/* Simple View Mode Toggle (preview-only) */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <span>View:</span>
          <Button
            size="sm"
            variant={viewMode === "grid" ? "primary" : "ghost"}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "primary" : "ghost"}
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>

        {/* Bulk Actions Bar - Collapsible */}
        {items.length > 0 && (
          <div className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
            bulkMode 
              ? 'border-primary-500 shadow-lg shadow-primary-500/20' 
              : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700'
          }`}>
            {/* Gradient Background */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${
              bulkMode 
                ? 'opacity-100 bg-gradient-to-r from-primary-50 via-blue-50 to-purple-50 dark:from-primary-900/20 dark:via-blue-900/20 dark:to-purple-900/20' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse'
            }`} />
            
            {/* Header - Always Visible */}
            <button
              onClick={() => setBulkActionsExpanded(!bulkActionsExpanded)}
              className="relative w-full flex items-center justify-between p-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                  bulkMode 
                    ? 'bg-primary-500 text-white shadow-lg' 
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Bulk Actions
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {bulkMode ? `${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} selected` : 'Click to select multiple items to edit category, status, visibility or propagation'}
                  </p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${bulkActionsExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expandable Content */}
            {bulkActionsExpanded && (
              <div className="relative p-4 pt-2 pb-32 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm overflow-visible border-t border-neutral-200 dark:border-neutral-700">
                {/* Select Items Button */}
                <Button
                  size="sm"
                  variant={bulkMode ? "primary" : "secondary"}
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) clearSelection();
                  }}
                  className="font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
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
                            console.log('[Bulk Status] Updating items to active:', itemIds);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'active' })));
                            console.log('[Bulk Status] Successfully updated items to active');
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            alert(`✅ Successfully updated ${itemIds.length} item(s) to Active`);
                          } catch (error) {
                            console.error('[Bulk Status] Error updating items:', error);
                            alert(`❌ Error updating items: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                            console.log('[Bulk Status] Updating items to inactive:', itemIds);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'inactive' })));
                            console.log('[Bulk Status] Successfully updated items to inactive');
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            alert(`✅ Successfully updated ${itemIds.length} item(s) to Inactive`);
                          } catch (error) {
                            console.error('[Bulk Status] Error updating items:', error);
                            alert(`❌ Error updating items: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                            console.log('[Bulk Status] Updating items to archived:', itemIds);
                            await Promise.all(itemIds.map(id => updateItem(id, { itemStatus: 'archived' })));
                            console.log('[Bulk Status] Successfully updated items to archived');
                            clearSelection();
                            refresh();
                            setStatusDropdownOpen(false);
                            alert(`✅ Successfully updated ${itemIds.length} item(s) to Archive`);
                          } catch (error) {
                            console.error('[Bulk Status] Error updating items:', error);
                            alert(`❌ Error updating items: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                  
                  {/* Propagate (if applicable) */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      alert('Propagate feature coming soon! This will sync selected items across locations.');
                    }}
                    className="font-semibold"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Propagate
                  </Button>
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
              <div className="text-sm text-neutral-600 dark:text-neutral-300">
                Loading items…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                No items found.
              </div>
            ) : viewMode === "grid" ? (
              <ItemsGrid
                items={items}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onQRCode={openQRModal}
                onPhotos={openPhotoGallery}
                onCategory={openCategoryModal}
                onPropagate={undefined}
                onVisibilityToggle={handleVisibilityToggle}
                onStatusToggle={handleStatusToggle}
                tenantId={tenantId}
                bulkMode={bulkMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
              />
            ) : (
              <ItemsList
                items={items}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onQRCode={openQRModal}
                onPhotos={openPhotoGallery}
                onCategory={openCategoryModal}
                onPropagate={undefined}
                onVisibilityToggle={handleVisibilityToggle}
                onStatusToggle={handleStatusToggle}
                tenantId={tenantId}
                bulkMode={bulkMode}
                selectedItems={selectedItems}
                onToggleSelection={toggleItemSelection}
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

            {hasItems && items.length > 0 && <ItemsGuide />}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
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
            await handleUpdate(editingItem.id, data);
          }
        }}
        onClose={closeEditModal}
      />

      {showQRModal && qrItem && (
        <QRCodeModal
          isOpen={showQRModal}
          productUrl={`/tenant/${tenantId}/product/${qrItem.id}`}
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
