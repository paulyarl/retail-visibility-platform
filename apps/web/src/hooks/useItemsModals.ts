import { useState, useCallback } from 'react';
import { Item } from '@/services/itemsDataService';

interface UseItemsModalsReturn {
  // Create modal
  showCreateModal: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  
  // Edit modal
  editingItem: Item | null;
  showEditModal: boolean;
  openEditModal: (item: Item) => void;
  closeEditModal: () => void;
  
  // QR modal
  qrItem: Item | null;
  showQRModal: boolean;
  openQRModal: (item: Item) => void;
  closeQRModal: () => void;
  
  // Bulk upload modal
  showBulkUpload: boolean;
  openBulkUpload: () => void;
  closeBulkUpload: () => void;
  
  // Photo gallery modal
  galleryItem: Item | null;
  showPhotoGallery: boolean;
  openPhotoGallery: (item: Item) => void;
  closePhotoGallery: () => void;
  
  // Category assignment modal
  categoryItem: Item | null;
  showCategoryModal: boolean;
  openCategoryModal: (item: Item) => void;
  closeCategoryModal: () => void;
  
  // Propagate modal
  propagateItem: Item | null;
  showPropagateModal: boolean;
  openPropagateModal: (item: Item) => void;
  closePropagateModal: () => void;
  
  // Utility
  closeAllModals: () => void;
}

/**
 * Hook for managing all items-related modals
 * Centralizes modal state management
 */
export function useItemsModals(): UseItemsModalsReturn {
  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Edit modal
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // QR modal
  const [qrItem, setQRItem] = useState<Item | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Bulk upload modal
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  
  // Photo gallery modal
  const [galleryItem, setGalleryItem] = useState<Item | null>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  
  // Category assignment modal
  const [categoryItem, setCategoryItem] = useState<Item | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Propagate modal
  const [propagateItem, setPropagateItem] = useState<Item | null>(null);
  const [showPropagateModal, setShowPropagateModal] = useState(false);

  // Create modal handlers
  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  // Edit modal handlers
  const openEditModal = useCallback((item: Item) => {
    setEditingItem(item);
    setShowEditModal(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingItem(null);
    setShowEditModal(false);
  }, []);

  // QR modal handlers
  const openQRModal = useCallback((item: Item) => {
    setQRItem(item);
    setShowQRModal(true);
  }, []);

  const closeQRModal = useCallback(() => {
    setQRItem(null);
    setShowQRModal(false);
  }, []);

  // Bulk upload handlers
  const openBulkUpload = useCallback(() => {
    setShowBulkUpload(true);
  }, []);

  const closeBulkUpload = useCallback(() => {
    setShowBulkUpload(false);
  }, []);

  // Photo gallery handlers
  const openPhotoGallery = useCallback((item: Item) => {
    setGalleryItem(item);
    setShowPhotoGallery(true);
  }, []);

  const closePhotoGallery = useCallback(() => {
    setGalleryItem(null);
    setShowPhotoGallery(false);
  }, []);

  // Category modal handlers
  const openCategoryModal = useCallback((item: Item) => {
    setCategoryItem(item);
    setShowCategoryModal(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setCategoryItem(null);
    setShowCategoryModal(false);
  }, []);

  // Propagate modal handlers
  const openPropagateModal = useCallback((item: Item) => {
    setPropagateItem(item);
    setShowPropagateModal(true);
  }, []);

  const closePropagateModal = useCallback(() => {
    setPropagateItem(null);
    setShowPropagateModal(false);
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    closeCreateModal();
    closeEditModal();
    closeQRModal();
    closeBulkUpload();
    closePhotoGallery();
    closeCategoryModal();
    closePropagateModal();
  }, [
    closeCreateModal,
    closeEditModal,
    closeQRModal,
    closeBulkUpload,
    closePhotoGallery,
    closeCategoryModal,
    closePropagateModal,
  ]);

  return {
    // Create modal
    showCreateModal,
    openCreateModal,
    closeCreateModal,
    
    // Edit modal
    editingItem,
    showEditModal,
    openEditModal,
    closeEditModal,
    
    // QR modal
    qrItem,
    showQRModal,
    openQRModal,
    closeQRModal,
    
    // Bulk upload
    showBulkUpload,
    openBulkUpload,
    closeBulkUpload,
    
    // Photo gallery
    galleryItem,
    showPhotoGallery,
    openPhotoGallery,
    closePhotoGallery,
    
    // Category
    categoryItem,
    showCategoryModal,
    openCategoryModal,
    closeCategoryModal,
    
    // Propagate
    propagateItem,
    showPropagateModal,
    openPropagateModal,
    closePropagateModal,
    
    // Utility
    closeAllModals,
  };
}
