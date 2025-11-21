"use client";

import { useMemo, useState, useEffect } from "react";
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

  const handleCategoryAssign = async (
    itemId: string,
    _categoryId: string,
    categoryPath: string[],
  ) => {
    try {
      await updateItem(itemId, { categoryPath });
      closeCategoryModal();
      refresh();
    } catch (error) {
      console.error("[ItemsPageClient] Category assignment failed:", error);
      alert(error instanceof Error ? error.message : "Failed to assign category");
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
          onSave={handleCategoryAssign}
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
