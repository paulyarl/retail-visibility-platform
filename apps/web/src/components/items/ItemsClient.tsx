"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/featureFlags';
import PageHeader, { Icons } from '@/components/PageHeader';

// Hooks
import { useItemsData } from '@/hooks/useItemsData';
import { useItemsFilters } from '@/hooks/useItemsFilters';
import { useItemsModals } from '@/hooks/useItemsModals';
import { useItemsActions } from '@/hooks/useItemsActions';
import { useItemsForm } from '@/hooks/useItemsForm';
import { useItemsViewMode } from '@/hooks/useItemsViewMode';

// Components
import ItemsHeader from './ItemsHeader';
import ItemsFilters from './ItemsFilters';
import ItemsCreateForm from './ItemsCreateForm';
import ItemsGrid from './ItemsGrid';
import ItemsList from './ItemsList';
import ItemsPagination from './ItemsPagination';

// Modals
import EditItemModal from './EditItemModal';
import { QRCodeModal } from './QRCodeModal';
import BulkUploadModal from './BulkUploadModal';
import ItemPhotoGallery from './ItemPhotoGallery';
import CategoryAssignmentModal from './CategoryAssignmentModal';
import PropagateModal from './PropagateModal';

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

  // Data & Loading
  const {
    items,
    loading,
    error: loadError,
    pagination,
    stats,
    refresh,
    loadPage,
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

  const handleDelete = async (item: Item) => {
    try {
      await deleteItem(item.id);
    } catch (error) {
      console.error('[ItemsClient] Delete failed:', error);
    }
  };

  const handlePhotoUpload = async (itemId: string, files: File[]) => {
    try {
      await uploadPhotos(itemId, files);
    } catch (error) {
      console.error('[ItemsClient] Photo upload failed:', error);
    }
  };

  const handleCategoryAssign = async (itemId: string, categoryPath: string[]) => {
    try {
      await updateItem(itemId, { categoryPath });
      closeCategoryModal();
    } catch (error) {
      console.error('[ItemsClient] Category assignment failed:', error);
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900" suppressHydrationWarning>
      <PageHeader
        title="Inventory"
        description="Manage your catalog and stock levels"
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Stats */}
        <ItemsHeader
          stats={stats}
          onCreateClick={openForm}
          onBulkUploadClick={openBulkUpload}
          tenantId={initialTenantId}
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

        {/* Items Grid or List */}
        {!loading && !loadError && (
          <>
            {viewMode === 'grid' ? (
              <ItemsGrid
                items={filteredItems}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onQRCode={openQRModal}
                onPhotos={openPhotoGallery}
                onCategory={openCategoryModal}
                onPropagate={openPropagateModal}
              />
            ) : (
              <ItemsList
                items={filteredItems}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            )}

            {/* Pagination */}
            <ItemsPagination
              pagination={pagination}
              onPageChange={loadPage}
            />
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
        <ItemPhotoGallery
          item={galleryItem}
          tenantId={initialTenantId}
          onUpdate={refresh}
        />
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
    </div>
  );
}
