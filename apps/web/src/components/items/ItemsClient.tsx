"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { Modal, ModalFooter, Button, Input, Alert, ConfirmDialog } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';
import SubscriptionStateBanner from '@/components/subscription/SubscriptionStateBanner';

// Hooks
import { useItemsData } from '@/hooks/useItemsData';
import { useItemsFilters } from '@/hooks/useItemsFilters';
import { useItemsModals } from '@/hooks/useItemsModals';
import { useItemsActions } from '@/hooks/useItemsActions';
import { useItemsForm } from '@/hooks/useItemsForm';
import { useItemsViewMode } from '@/hooks/useItemsViewMode';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

// Components
import ItemsHeader from './ItemsHeader';
import ItemsFilters from './ItemsFilters';
import ItemsCreateForm from './ItemsCreateForm';
import ItemsGrid from './ItemsGrid';
import ItemsList from './ItemsList';
import ItemsPagination from './ItemsPagination';
import ItemsGuide from './ItemsGuide';
import EditItemModal from './EditItemModal';
import { QRCodeModal } from './QRCodeModal';
import BulkUploadModal from './BulkUploadModal';
import ItemPhotoGallery from './ItemPhotoGallery';
import CategoryAssignmentModal from './CategoryAssignmentModal';
import PropagateModal from './PropagateModal';

// Guides & Helpers
import QuickStartEmptyState from './QuickStartEmptyState';
import ProductEnrichmentBanner from '@/components/ProductEnrichmentBanner';
import POSIntegrationBanner from './POSIntegrationBanner';
import SyncStatusIndicator from './SyncStatusIndicator';

// Types
import { Item } from '@/services/itemsDataService';

interface ItemsClientProps {
  initialItems?: Item[];
  initialTenantId?: string;
}

/**
 * ItemsClient - Refactored inventory management component
 * 
 * Clean orchestration of:
 * - 2 services (business logic)
 * - 6 hooks (state management)
 * - 6 sub-components (UI)
 * - 6 modals (interactions)
 * 
 * Down from 1,586 lines to ~300 lines of clean code
 */
export default function ItemsClient({
  initialItems = [],
  initialTenantId = '',
}: ItemsClientProps) {
  const searchParams = useSearchParams();

  // Tier AND Role Access - Check feature permissions
  const { canAccess } = useTenantTier(initialTenantId);
  const canPropagate = canAccess('propagation', 'canManage'); // MANAGER+ only
  const canScan = canAccess('barcode_scan', 'canEdit'); // MEMBER+ only

  // Data & Loading
  const {
    items,
    loading,
    error: loadError,
    pagination,
    stats,
    refresh,
    loadPage,
    setPageSize,
  } = useItemsData({
    tenantId: initialTenantId,
    initialItems,
    autoLoad: true,
  });

  // Filters
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    visibilityFilter,
    setVisibilityFilter,
    categoryFilter,
    setCategoryFilter,
    clearFilters,
    applyClientFilters,
    hasActiveFilters,
  } = useItemsFilters();

  // Modals
  const {
    editingItem,
    showEditModal,
    openEditModal,
    closeEditModal,
    qrItem,
    showQRModal,
    openQRModal,
    closeQRModal,
    showBulkUpload,
    openBulkUpload,
    closeBulkUpload,
    galleryItem,
    showPhotoGallery,
    openPhotoGallery,
    closePhotoGallery,
    categoryItem,
    showCategoryModal,
    openCategoryModal,
    closeCategoryModal,
    propagateItem,
    showPropagateModal,
    openPropagateModal,
    closePropagateModal,
  } = useItemsModals();

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'warning' });

  // Actions
  const {
    createItem,
    creating,
    updateItem,
    updating,
    deleteItem,
    deleting,
    uploadPhotos,
  } = useItemsActions({
    tenantId: initialTenantId,
    onSuccess: refresh,
  });

  // Form
  const {
    formData,
    updateField,
    resetForm,
    isValid: formIsValid,
    showForm,
    openForm,
    closeForm,
  } = useItemsForm();

  // View Mode
  const { viewMode, toggleViewMode } = useItemsViewMode();

  // Check URL params for auto-open create form
  useEffect(() => {
    const createParam = searchParams?.get('create');
    if (createParam === 'true') {
      openForm();
    }
  }, [searchParams, openForm]);

  // Apply client-side filters
  const filteredItems = applyClientFilters(items);

  // Handlers
  const handleCreate = async () => {
    try {
      await createItem({
        sku: formData.sku,
        name: formData.name,
        price: Math.round(parseFloat(formData.price) * 100), // Convert to cents
        stock: parseInt(formData.stock),
        description: formData.description,
      });
      resetForm();
      closeForm();
    } catch (error) {
      console.error('[ItemsClient] Create failed:', error);
    }
  };

  const handleUpdate = async (itemId: string, data: Partial<Item>) => {
    try {
      await updateItem(itemId, data);
      closeEditModal();
    } catch (error) {
      console.error('[ItemsClient] Update failed:', error);
    }
  };

  const handleDelete = (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteItem(item.id);
        } catch (error) {
          console.error('[ItemsClient] Delete failed:', error);
        }
      },
    });
  };

  const handlePhotoUpload = async (itemId: string, files: File[]) => {
    try {
      await uploadPhotos(itemId, files);
    } catch (error) {
      console.error('[ItemsClient] Photo upload failed:', error);
    }
  };

  const handleCategoryAssign = async (itemId: string, categoryId: string, categoryPath: string[]) => {
    try {
      // Update the item with the new category path
      await updateItem(itemId, { categoryPath });

      closeCategoryModal();
      refresh(); // Refresh the items list
    } catch (error) {
      console.error('[ItemsClient] Category assignment failed:', error);
      // Show error to user
      alert(error instanceof Error ? error.message : 'Failed to assign category');
    }
  };

  const handlePropagate = async (itemId: string, targetTenants: string[]) => {
    try {
      // TODO: Implement propagation API call
      console.log('[ItemsClient] Propagate:', { itemId, targetTenants });
      closePropagateModal();
    } catch (error) {
      console.error('[ItemsClient] Propagation failed:', error);
    }
  };

  const handleVisibilityToggle = (item: Item) => {
    const newVisibility = item.visibility === 'public' ? 'private' : 'public';
    
    // Only confirm when making private (blocks sync)
    if (newVisibility === 'private') {
      setConfirmDialog({
        isOpen: true,
        title: 'Make Item Private',
        message: `Making "${item.name}" private will prevent it from syncing to Google Merchant Center. Continue?`,
        variant: 'warning',
        onConfirm: async () => {
          try {
            console.log('[ItemsClient] Toggling visibility:', {
              itemId: item.id,
              itemName: item.name,
              from: item.visibility,
              to: newVisibility,
            });
            
            await updateItem(item.id, { visibility: newVisibility });
            
            console.log('[ItemsClient] Visibility updated successfully:', {
              itemId: item.id,
              newVisibility,
            });
          } catch (error) {
            console.error('[ItemsClient] Visibility toggle failed:', error);
          }
        },
      });
    } else {
      // Making public - no confirmation needed
      (async () => {
        try {
          console.log('[ItemsClient] Toggling visibility:', {
            itemId: item.id,
            itemName: item.name,
            from: item.visibility,
            to: newVisibility,
          });
          
          await updateItem(item.id, { visibility: newVisibility });
          
          console.log('[ItemsClient] Visibility updated successfully:', {
            itemId: item.id,
            newVisibility,
          });
        } catch (error) {
          console.error('[ItemsClient] Visibility toggle failed:', error);
        }
      })();
    }
  };

  const handleStatusToggle = (item: Item) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    
    // Only confirm when making inactive (blocks sync)
    if (newStatus === 'inactive') {
      setConfirmDialog({
        isOpen: true,
        title: 'Deactivate Item',
        message: `Making "${item.name}" inactive will prevent it from syncing to Google Merchant Center. Continue?`,
        variant: 'warning',
        onConfirm: async () => {
          try {
            console.log('[ItemsClient] Toggling status:', {
              itemId: item.id,
              itemName: item.name,
              from: item.status,
              to: newStatus,
            });
            
            await updateItem(item.id, { itemStatus: newStatus });
            
            console.log('[ItemsClient] Status updated successfully:', {
              itemId: item.id,
              newStatus,
            });
          } catch (error) {
            console.error('[ItemsClient] Status toggle failed:', error);
          }
        },
      });
    } else {
      // Making active - no confirmation needed
      (async () => {
        try {
          console.log('[ItemsClient] Toggling status:', {
            itemId: item.id,
            itemName: item.name,
            from: item.status,
            to: newStatus,
          });
          
          await updateItem(item.id, { itemStatus: newStatus });
          
          console.log('[ItemsClient] Status updated successfully:', {
            itemId: item.id,
            newStatus,
          });
        } catch (error) {
          console.error('[ItemsClient] Status toggle failed:', error);
        }
      })();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900" suppressHydrationWarning>
      <PageHeader
        title="Inventory"
        description="Manage what's on your shelf and make it visible online"
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Subscription State Banner (Maintenance/Freeze) */}
        <SubscriptionStateBanner tenantId={initialTenantId} className="mb-6" />

        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        <SubscriptionStatusGuide />

        {/* Header with Stats */}
        <ItemsHeader
          stats={stats}
          onCreateClick={openForm}
          onBulkUploadClick={openBulkUpload}
          tenantId={initialTenantId}
        />

        {/* Product Enrichment Banner */}
        <ProductEnrichmentBanner tenantId={initialTenantId} />

        {/* POS Integration Banner */}
        <POSIntegrationBanner 
          tenantId={initialTenantId} 
          itemCount={stats.total}
        />

        {/* Filters */}
        <ItemsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          visibilityFilter={visibilityFilter}
          onVisibilityChange={setVisibilityFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          viewMode={viewMode}
          onViewModeToggle={toggleViewMode}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        {/* Create Form */}
        {showForm && (
          <ItemsCreateForm
            formData={formData}
            onFieldChange={updateField}
            onSubmit={handleCreate}
            onCancel={closeForm}
            isValid={formIsValid}
            creating={creating}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">Loading items...</p>
          </div>
        )}

        {/* Error State */}
        {loadError && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error">
            {loadError}
          </div>
        )}

        {/* Empty State - Show Quick Start when no items exist */}
        {!loading && !loadError && stats.total === 0 && (
          <QuickStartEmptyState tenantId={initialTenantId} />
        )}

        {/* Items Grid or List */}
        {!loading && !loadError && stats.total > 0 && (
          <>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-neutral-500">No items match your filters.</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <ItemsGrid
                    items={filteredItems}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onQRCode={openQRModal}
                    onPhotos={openPhotoGallery}
                    onCategory={openCategoryModal}
                    onPropagate={canPropagate ? openPropagateModal : undefined}
                    onVisibilityToggle={handleVisibilityToggle}
                    onStatusToggle={handleStatusToggle}
                    tenantId={initialTenantId}
                  />
                ) : (
                  <ItemsList
                    items={filteredItems}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onQRCode={openQRModal}
                    onPhotos={openPhotoGallery}
                    onCategory={openCategoryModal}
                    onPropagate={canPropagate ? openPropagateModal : undefined}
                    onVisibilityToggle={handleVisibilityToggle}
                    onStatusToggle={handleStatusToggle}
                    tenantId={initialTenantId}
                  />
                )}

                {/* Pagination */}
                <ItemsPagination
                  pagination={pagination}
                  onPageChange={loadPage}
                  onPageSizeChange={setPageSize}
                />

                {/* Quick Start Guide */}
                <ItemsGuide />
              </>
            )}
          </>
        )}
      </div>

      {/* Modals */}
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
          productUrl={`/tenant/${initialTenantId}/product/${qrItem.id}`}
          productName={qrItem.name}
          onClose={closeQRModal}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          tenantId={initialTenantId}
          onClose={closeBulkUpload}
          onSuccess={refresh}
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
            tenantId={initialTenantId}
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

      {showPropagateModal && propagateItem && (
        <PropagateModal
          item={propagateItem}
          onPropagate={handlePropagate}
          onClose={closePropagateModal}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.variant === 'danger' ? 'Delete' : 'Continue'}
      />
    </div>
  );
}
