/**
 * Items Singleton Service
 *
 * Extends UniversalSingletonClient to provide cached items operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  condition?: 'new' | 'used' | 'refurbished';
  price: number | null;
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
  visibility: 'public' | 'private';
  categoryPath?: string[];
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
  imageUrl?: string;
  images?: string[];
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemsStats {
  total: number;
  active: number;
  inactive: number;
  syncing: number;
  public: number;
  private: number;
  lowStock: number;
}

export interface ItemsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ItemsCompleteResponse {
  items: Item[];
  stats: ItemsStats;
  pagination: ItemsPagination;
  _timestamp: string;
}

export interface ItemsCompleteParams {
  tenant_id: string;
  page?: number;
  limit?: number;
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'syncing';
  visibility?: 'all' | 'public' | 'private';
  categoryId?: string;
  categoryFilter?: 'assigned' | 'unassigned';
}

class ItemsSingletonService {
  private static instance: ItemsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with items-specific settings
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 15 * 60 * 1000, // 15 minutes for items data (moderate cache)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): ItemsSingletonService {
    if (!ItemsSingletonService.instance) {
      ItemsSingletonService.instance = new ItemsSingletonService();
    }
    return ItemsSingletonService.instance;
  }

  /**
   * Get complete items data with caching
   * Uses the /api/items/complete endpoint
   */
  async getItemsComplete(params: ItemsCompleteParams): Promise<ItemsCompleteResponse | null> {
    try {
      // Build query string
      const queryParams = new URLSearchParams();
      queryParams.append('tenant_id', params.tenant_id);
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.q) queryParams.append('q', params.q);
      if (params.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params.visibility && params.visibility !== 'all') queryParams.append('visibility', params.visibility);
      if (params.categoryId) queryParams.append('categoryId', params.categoryId);
      if (params.categoryFilter) queryParams.append('categoryFilter', params.categoryFilter);

      const endpoint = `/api/items/complete?${queryParams.toString()}`;
      
      const result = await this.client.makeRequest<ItemsCompleteResponse>(endpoint);

      const data = result as unknown as ItemsCompleteResponse;
      console.log('[ItemsSingleton] getItemsComplete API response:', {
        endpoint,
        hasData: !!data,
        itemsCount: data?.items?.length || 0,
        totalItems: data?.stats?.total || 0
      });

      // makeRequest returns data directly, not wrapped in ApiResponse
      return data;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get items complete:', error);
      return null;
    }
  }

  /**
   * Get items by ID with caching
   */
  async getItem(itemId: string): Promise<Item | null> {
    try {
      const result = await this.client.makeRequest<Item>(`/api/items/${itemId}`);

      // makeRequest returns data directly, not wrapped in ApiResponse
      return result as unknown as Item;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get item:', error);
      return null;
    }
  }

  /**
   * Create new item
   * Note: This will invalidate relevant cache entries
   */
  async createItem(itemData: Partial<Item>): Promise<Item | null> {
    try {
      const result = await this.client.makeRequest<Item>(
        '/api/items',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        }
      );

      // makeRequest returns data directly, not wrapped in ApiResponse
      return result as unknown as Item;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to create item:', error);
      return null;
    }
  }

  /**
   * Update existing item
   * Note: This will invalidate relevant cache entries
   */
  async updateItem(itemId: string, itemData: Partial<Item>): Promise<Item | null> {
    try {
      const result = await this.client.makeRequest<Item>(
        `/api/items/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(itemData),
        }
      );

      // makeRequest returns data directly, not wrapped in ApiResponse
      return result as unknown as Item;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to update item:', error);
      return null;
    }
  }

  /**
   * Delete item
   * Note: This will invalidate relevant cache entries
   */
  async deleteItem(itemId: string): Promise<boolean> {
    try {
      const result = await this.client.makeRequest<{ success: boolean }>(
        `/api/items/${itemId}`,
        {
          method: 'DELETE',
        }
      );

      // makeRequest returns data directly, not wrapped in ApiResponse
      return (result as unknown as { success: boolean }).success || false;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to delete item:', error);
      return false;
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const itemsService = ItemsSingletonService.getInstance();
