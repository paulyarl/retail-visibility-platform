'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import PhotoSingleton, { Photo, PhotoUploadResult, PhotoDeleteResult } from '@/lib/singletons/PhotoSingleton';

// ====================
// CONTEXT
// ====================

interface PhotoSingletonContextValue {
  singleton: PhotoSingleton | null;
  actions: {
    fetchItemPhotos: (itemId: string) => Promise<Photo[]>;
    fetchVariantPhotos: (variantId: string) => Promise<Photo[]>;
    uploadItemPhoto: (itemId: string, file: File, isPrimary?: boolean) => Promise<PhotoUploadResult>;
    deletePhoto: (photoId: string, itemId: string) => Promise<PhotoDeleteResult>;
    reorderPhotos: (itemId: string, photoIds: string[]) => Promise<boolean>;
    setPrimaryPhoto: (photoId: string, itemId: string) => Promise<boolean>;
    invalidateItemCache: (itemId: string) => Promise<void>;
    invalidateVariantCache: (variantId: string) => Promise<void>;
    clearAllCache: () => Promise<void>;
    getMetrics: () => any;
    resetMetrics: () => void;
  };
}

const PhotoSingletonContext = createContext<PhotoSingletonContextValue | undefined>(undefined);

// ====================
// PROVIDER
// ====================

export function PhotoSingletonProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const tenantId = params?.tenantId as string | undefined;
  const [singleton, setSingleton] = useState<PhotoSingleton | null>(null);

  useEffect(() => {
    if (tenantId) {
      const instance = PhotoSingleton.getInstance(tenantId);
      setSingleton(instance);

      return () => {
        // Cleanup on unmount if needed
        // PhotoSingleton.destroyInstance(tenantId);
      };
    }
  }, [tenantId]);

  const actions = {
    fetchItemPhotos: async (itemId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.fetchItemPhotos(itemId);
    },
    fetchVariantPhotos: async (variantId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.fetchVariantPhotos(variantId);
    },
    uploadItemPhoto: async (itemId: string, file: File, isPrimary: boolean = false) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.uploadItemPhoto(itemId, file, isPrimary);
    },
    deletePhoto: async (photoId: string, itemId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.deletePhoto(photoId, itemId);
    },
    reorderPhotos: async (itemId: string, photoIds: string[]) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.reorderPhotos(itemId, photoIds);
    },
    setPrimaryPhoto: async (photoId: string, itemId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.setPrimaryPhoto(photoId, itemId);
    },
    invalidateItemCache: async (itemId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.invalidateItemCache(itemId);
    },
    invalidateVariantCache: async (variantId: string) => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.invalidateVariantCache(variantId);
    },
    clearAllCache: async () => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.clearAllCache();
    },
    getMetrics: () => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.getMetrics();
    },
    resetMetrics: () => {
      if (!singleton) throw new Error('PhotoSingleton not initialized');
      return singleton.resetMetrics();
    },
  };

  return (
    <PhotoSingletonContext.Provider value={{ singleton, actions }}>
      {children}
    </PhotoSingletonContext.Provider>
  );
}

// ====================
// HOOK
// ====================

export function usePhotoSingleton() {
  const context = useContext(PhotoSingletonContext);
  if (!context) {
    throw new Error('usePhotoSingleton must be used within PhotoSingletonProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOK FOR ITEM PHOTOS
// ====================

export function useItemPhotos(itemId: string | undefined) {
  const { actions } = usePhotoSingleton();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = async () => {
    if (!itemId) {
      setPhotos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedPhotos = await actions.fetchItemPhotos(itemId);
      setPhotos(fetchedPhotos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
      console.error('[useItemPhotos] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [itemId]);

  return {
    photos,
    loading,
    error,
    refresh: loadPhotos,
    uploadPhoto: async (file: File, isPrimary: boolean = false) => {
      if (!itemId) throw new Error('No item ID provided');
      const result = await actions.uploadItemPhoto(itemId, file, isPrimary);
      if (result.success) {
        await loadPhotos(); // Refresh photos after upload
      }
      return result;
    },
    deletePhoto: async (photoId: string) => {
      if (!itemId) throw new Error('No item ID provided');
      const result = await actions.deletePhoto(photoId, itemId);
      if (result.success) {
        await loadPhotos(); // Refresh photos after delete
      }
      return result;
    },
    reorderPhotos: async (photoIds: string[]) => {
      if (!itemId) throw new Error('No item ID provided');
      const success = await actions.reorderPhotos(itemId, photoIds);
      if (success) {
        await loadPhotos(); // Refresh photos after reorder
      }
      return success;
    },
    setPrimaryPhoto: async (photoId: string) => {
      if (!itemId) throw new Error('No item ID provided');
      const success = await actions.setPrimaryPhoto(photoId, itemId);
      if (success) {
        await loadPhotos(); // Refresh photos after setting primary
      }
      return success;
    },
  };
}

// ====================
// CONVENIENCE HOOK FOR VARIANT PHOTOS
// ====================

export function useVariantPhotos(variantId: string | undefined) {
  const { actions } = usePhotoSingleton();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = async () => {
    if (!variantId) {
      setPhotos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedPhotos = await actions.fetchVariantPhotos(variantId);
      setPhotos(fetchedPhotos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch variant photos');
      console.error('[useVariantPhotos] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [variantId]);

  return {
    photos,
    loading,
    error,
    refresh: loadPhotos,
  };
}
