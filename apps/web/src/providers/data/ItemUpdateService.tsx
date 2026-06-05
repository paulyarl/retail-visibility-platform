'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import ItemUpdateService, { ItemUpdateData, ItemUpdateResult } from '@/lib/singletons/ItemUpdateService';

// ====================
// CONTEXT
// ====================

interface ItemUpdateServiceContextValue {
  service: ItemUpdateService | null;
  actions: {
    updateItem: (itemId: string, data: ItemUpdateData) => Promise<ItemUpdateResult>;
    createItem: (data: ItemUpdateData) => Promise<ItemUpdateResult>;
    deleteItem: (itemId: string) => Promise<ItemUpdateResult>;
    restoreItem: (itemId: string) => Promise<ItemUpdateResult>;
    getMetrics: () => any;
    resetMetrics: () => void;
  };
}

const ItemUpdateServiceContext = createContext<ItemUpdateServiceContextValue | undefined>(undefined);

// ====================
// PROVIDER
// ====================

export function ItemUpdateServiceProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const tenantId = params?.tenantId as string | undefined;
  const [service, setService] = useState<ItemUpdateService | null>(null);

  useEffect(() => {
    if (tenantId) {
      const instance = ItemUpdateService.getInstance(tenantId);
      setService(instance);

      return () => {
        // Cleanup on unmount if needed
        // ItemUpdateService.destroyInstance(tenantId);
      };
    }
  }, [tenantId]);

  const actions = {
    updateItem: async (itemId: string, data: ItemUpdateData) => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.updateItem(itemId, data);
    },
    createItem: async (data: ItemUpdateData) => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.createItem(data);
    },
    deleteItem: async (itemId: string) => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.deleteItem(itemId);
    },
    restoreItem: async (itemId: string) => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.restoreItem(itemId);
    },
    getMetrics: () => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.getMetrics();
    },
    resetMetrics: () => {
      if (!service) throw new Error('ItemUpdateService not initialized');
      return service.resetMetrics();
    },
  };

  return (
    <ItemUpdateServiceContext.Provider value={{ service, actions }}>
      {children}
    </ItemUpdateServiceContext.Provider>
  );
}

// ====================
// HOOK
// ====================

export function useItemUpdateService() {
  const context = useContext(ItemUpdateServiceContext);
  if (!context) {
    throw new Error('useItemUpdateService must be used within ItemUpdateServiceProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOK FOR ITEM UPDATES
// ====================

export function useItemUpdate(itemId: string | undefined) {
  const { actions } = useItemUpdateService();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = async (data: ItemUpdateData) => {
    if (!itemId) throw new Error('No item ID provided');
    
    setUpdating(true);
    setError(null);

    try {
      const result = await actions.updateItem(itemId, data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update item');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  const deleteItem = async () => {
    if (!itemId) throw new Error('No item ID provided');
    
    setUpdating(true);
    setError(null);

    try {
      const result = await actions.deleteItem(itemId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete item');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      setError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  const restoreItem = async () => {
    if (!itemId) throw new Error('No item ID provided');
    
    setUpdating(true);
    setError(null);

    try {
      const result = await actions.restoreItem(itemId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to restore item');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore item';
      setError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    updateItem,
    deleteItem,
    restoreItem,
    updating,
    error,
  };
}
