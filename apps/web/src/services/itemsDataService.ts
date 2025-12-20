import { api } from '@/lib/api';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  condition?: 'new' | 'used' | 'refurbished';
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
  itemStatus?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed'; // Backend field name
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
  category?: string; // Legacy: directory category slug
  categoryId?: string; // Filter by specific tenant category ID
  categoryFilter?: 'all' | 'assigned' | 'unassigned'; // Filter by category assignment status
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

export interface ItemStats {
  total: number;
  active: number;
  inactive: number;
  syncing: number;
  public: number;
  private: number;
  lowStock: number;
}

/**
 * Service for handling items/inventory data operations
 * Centralizes all API calls and data transformations
 */
export class ItemsDataService {
  /**
   * Fetch storewide aggregated stats for a tenant
   * Returns counts regardless of pagination/filters
   */
  async fetchStats(tenantId: string): Promise<ItemStats> {
    try {
      const response = await api.get(`/api/items/stats?tenant_id=${tenantId}`);
      
      if (!response.ok) {
        console.error('[fetchStats] API error:', response.status);
        // Return default stats on error
        return { total: 0, active: 0, inactive: 0, syncing: 0, public: 0, private: 0, lowStock: 0 };
      }

      return await response.json();
    } catch (error) {
      console.error('[fetchStats] Error:', error);
      return { total: 0, active: 0, inactive: 0, syncing: 0, public: 0, private: 0, lowStock: 0 };
    }
  }

  /**
   * Fetch items with filters and pagination
   * Category filtering is now done server-side via categoryFilter param
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
      
      // Category filters - now server-side
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.categoryFilter && filters.categoryFilter !== 'all') {
        params.append('categoryFilter', filters.categoryFilter);
      }

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
        condition: item.condition === 'brand_new' ? 'new' : item.condition,
      });

      // Handle both paginated and non-paginated responses
      let items: Item[];
      let paginationResult: ItemsResponse['pagination'];
      
      if (data.items && data.pagination) {
        items = data.items.map(normalizeItem);
        paginationResult = data.pagination;
      } else if (Array.isArray(data)) {
        items = data.map(normalizeItem);
        paginationResult = {
          page: 1,
          limit: data.length,
          totalItems: data.length,
          totalPages: 1,
          hasMore: false,
        };
      } else {
        items = [];
        paginationResult = {
          page: 1,
          limit: 25,
          totalItems: 0,
          totalPages: 0,
          hasMore: false,
        };
      }
      
      // Category filtering is now done server-side via categoryFilter param
      
      return { items, pagination: paginationResult };
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
        condition: result.condition === 'brand_new' ? 'new' : result.condition,
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
        condition: result.condition === 'brand_new' ? 'new' : result.condition,
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
   * An item "has category" if ANY category field is set:
   * - tenantCategoryId (assigned tenant category)
   * - tenantCategory (category object)
   * - categoryPath (enrichment data)
   * - metadata.googleCategoryId (Google category from enrichment)
   */
  applyCategoryFilter(items: Item[], categoryFilter: string): Item[] {
    if (categoryFilter === 'all') return items;
    
    const hasCategory = (item: Item): boolean => {
      if (item.tenantCategoryId) return true;
      if (item.tenantCategory?.id) return true;
      if (item.categoryPath && item.categoryPath.length > 0) return true;
      if (item.metadata?.googleCategoryId) return true;
      return false;
    };
    
    if (categoryFilter === 'assigned') {
      return items.filter(hasCategory);
    }
    if (categoryFilter === 'unassigned') {
      return items.filter(item => !hasCategory(item));
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
