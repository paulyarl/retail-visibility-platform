import { useState, useCallback } from 'react';
import { itemsDataService, Item, CreateItemData } from '@/services/itemsDataService';
import ItemUpdateService from '@/lib/singletons/ItemUpdateService';
import PhotoSingleton from '@/lib/singletons/PhotoSingleton';

interface UseItemsActionsOptions {
  tenantId: string;
  onSuccess?: () => void;
}

interface UseItemsActionsReturn {
  // Create
  createItem: (data: CreateItemData) => Promise<Item>;
  creating: boolean;
  createError: string | null;
  
  // Update
  updateItem: (itemId: string, data: Partial<Item>) => Promise<Item>;
  updating: boolean;
  updateError: string | null;
  
  // Delete
  deleteItem: (itemId: string) => Promise<void>;
  deleting: boolean;
  deleteError: string | null;
  
  // Upload photos
  uploadPhotos: (itemId: string, files: File[]) => Promise<string[]>;
  uploading: boolean;
  uploadError: string | null;
  
  // Combined loading state
  isProcessing: boolean;
}

/**
 * Hook for managing items CRUD operations
 * Handles create, update, delete, and photo uploads
 */
export function useItemsActions({
  tenantId,
  onSuccess,
}: UseItemsActionsOptions): UseItemsActionsReturn {
  // Create state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Update state
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const createItem = useCallback(async (data: CreateItemData): Promise<Item> => {
    setCreating(true);
    setCreateError(null);

    try {
      const item = await itemsDataService.createItem(tenantId, data);
      
      if (onSuccess) {
        onSuccess();
      }
      
      return item;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item';
      setCreateError(errorMessage);
      throw err;
    } finally {
      setCreating(false);
    }
  }, [tenantId, onSuccess]);

  const updateItem = useCallback(async (itemId: string, data: Partial<Item>): Promise<Item> => {
    setUpdating(true);
    setUpdateError(null);

    try {
      // Use ItemUpdateService for automatic cache invalidation
      const itemUpdateService = ItemUpdateService.getInstance(tenantId);
      const result = await itemUpdateService.updateItem(itemId, data as any);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update item');
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result.item as Item;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setUpdateError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [tenantId, onSuccess]);

  const deleteItem = useCallback(async (itemId: string): Promise<void> => {
    setDeleting(true);
    setDeleteError(null);

    try {
      // Use ItemUpdateService for automatic cache invalidation
      const itemUpdateService = ItemUpdateService.getInstance(tenantId);
      const result = await itemUpdateService.deleteItem(itemId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete item');
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      setDeleteError(errorMessage);
      throw err;
    } finally {
      setDeleting(false);
    }
  }, [tenantId, onSuccess]);

  const uploadPhotos = useCallback(async (itemId: string, files: File[]): Promise<string[]> => {
    setUploading(true);
    setUploadError(null);

    try {
      // Use PhotoSingleton for automatic cache invalidation
      const photoSingleton = PhotoSingleton.getInstance(tenantId);
      const urls: string[] = [];
      
      for (const file of files) {
        const result = await photoSingleton.uploadItemPhoto(itemId, file, files.indexOf(file) === 0);
        if (result.success && result.photo) {
          urls.push(result.photo.url);
        }
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      return urls;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload photos';
      setUploadError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [tenantId, onSuccess]);

  const isProcessing = creating || updating || deleting || uploading;

  return {
    createItem,
    creating,
    createError,
    updateItem,
    updating,
    updateError,
    deleteItem,
    deleting,
    deleteError,
    uploadPhotos,
    uploading,
    uploadError,
    isProcessing,
  };
}
