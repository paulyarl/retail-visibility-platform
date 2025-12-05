import { api } from '@/lib/api';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing';
  itemStatus?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing'; // Backend field name
  visibility: 'public' | 'private';
  categoryPath?: string[];
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
  imageUrl?: string; // Primary photo URL from backend
  images?: string[]; // Legacy field, may be deprecated
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemFilters {
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'syncing';
  visibility?: 'all' | 'public' | 'private';
  category?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface CreateItemData {
  sku: string;
  name: string;
  price: number;
  stock: number;
  description?: string;
}

/**
 * Service for handling items/inventory data operations
 * Centralizes all API calls and data transformations
 */
export class ItemsDataService {
  /**
   * Fetch items with filters and pagination
   */
  async fetchItems(
    tenantId: string,
    filters: ItemFilters = {},
    pagination: PaginationParams = { page: 1, limit: 25 }
  ): Promise<ItemsResponse> {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.q) params.append('q', filters.q);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.visibility && filters.visibility !== 'all') params.append('visibility', filters.visibility);

      // Add tenant identifier (snake_case as expected by backend)
      params.append('tenant_id', tenantId);
      
      const response = await api.get(`/api/items?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[fetchItems] API error:', response.status, response.statusText, errorData);
        throw new Error(`Failed to fetch items: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Normalize itemStatus to status for all items
      const normalizeItem = (item: any): Item => ({
        ...item,
        status: item.itemStatus || item.item_status || item.status || 'active',
        itemStatus: item.itemStatus || item.item_status || item.status || 'active',
      });

      // Handle both paginated and non-paginated responses
      if (data.items && data.pagination) {
        return {
          items: data.items.map(normalizeItem),
          pagination: data.pagination,
        };
      } else if (Array.isArray(data)) {
        return {
          items: data.map(normalizeItem),
          pagination: {
            page: 1,
            limit: data.length,
            totalItems: data.length,
            totalPages: 1,
            hasMore: false,
          },
        };
      } else {
        return {
          items: [],
          pagination: {
            page: 1,
            limit: 25,
            totalItems: 0,
            totalPages: 0,
            hasMore: false,
          },
        };
      }
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Create a new item
   */
  async createItem(tenantId: string, data: CreateItemData): Promise<Item> {
    try {
      const response = await api.post('api/items', {
        tenantId: tenantId,
        ...data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to create item');
      }

      const result = await response.json();
      
      // Normalize status fields from API response
      return {
        ...result,
        status: result.itemStatus || result.item_status || result.status || 'active',
        itemStatus: result.itemStatus || result.item_status || result.status || 'active',
      };
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Update an existing item
   */
  async updateItem(itemId: string, data: Partial<Item>): Promise<Item> {
    try {
      console.log('[updateItem] Sending data:', { itemId, data });
      const response = await api.put(`/api/items/${itemId}`, data);
      console.log('[updateItem] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[updateItem] API error response:', response.status, errorData);
        throw new Error(errorData?.error || `Failed to update item (${response.status})`);
      }

      const result = await response.json();
      console.log('[updateItem] Result:', result);
      
      // Normalize status fields from API response
      return {
        ...result,
        status: result.itemStatus || result.item_status || result.status || 'active',
        itemStatus: result.itemStatus || result.item_status || result.status || 'active',
      };
    } catch (error) {
      console.error('[updateItem] Error:', error);
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<void> {
    try {
      const response = await api.delete(`/api/items/${itemId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to delete item');
      }
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Upload photos for an item
   */
  async uploadPhotos(itemId: string, files: File[]): Promise<string[]> {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));

      const response = await api.post(`/api/items/${itemId}/photos`, formData);

      if (!response.ok) {
        throw new Error('Failed to upload photos');
      }

      const data = await response.json();
      return data.urls || [];
    } catch (error) {
      // Error will be caught and displayed in UI
      throw error;
    }
  }

  /**
   * Apply client-side category filter
   * (Used until API supports category filtering)
   */
  applyCategoryFilter(items: Item[], categoryFilter: string): Item[] {
    if (categoryFilter === 'all') return items;
    if (categoryFilter === 'assigned') {
      return items.filter(item => item.categoryPath && item.categoryPath.length > 0);
    }
    if (categoryFilter === 'unassigned') {
      return items.filter(item => !item.categoryPath || item.categoryPath.length === 0);
    }
    return items;
  }

  /**
   * Calculate quick stats from items
   */
  calculateStats(items: Item[]) {
    return {
      total: items.length,
      active: items.filter(i => i.status === 'active').length,
      inactive: items.filter(i => i.status === 'inactive').length,
      syncing: items.filter(i => i.status === 'syncing').length,
      public: items.filter(i => i.visibility === 'public').length,
      private: items.filter(i => i.visibility === 'private').length,
      lowStock: items.filter(i => i.stock < 10).length,
    };
  }
}

// Export singleton instance
export const itemsDataService = new ItemsDataService();
