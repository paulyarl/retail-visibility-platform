/**
 * Directory Service
 * 
 * Extends AdminApiSingleton to provide directory management
 * Handles directory listings, stats, and featuring operations with admin privileges
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface DirectoryStats {
  totalListings: number;
  featuredListings: number;
  activeListings: number;
  pendingListings: number;
  categories: number;
  regions: number;
  lastUpdated: string;
}

export interface DirectoryFilters {
  status?: 'active' | 'pending' | 'inactive';
  featured?: boolean;
  category?: string;
  region?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'featured';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminDirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  category?: string;
  subcategory?: string;
  region?: string;
  status: 'active' | 'pending' | 'inactive';
  featured: boolean;
  featuredUntil?: string;
  featuredPriority?: number;
  logoUrl?: string;
  images?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
}

export interface DirectoryListingsResponse {
  listings: AdminDirectoryListing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: DirectoryFilters;
}

/**
 * Service for managing directory operations
 * Handles directory listings, stats, and featuring operations
 */
export class DirectoryService extends AdminApiSingleton {
  private static instance: DirectoryService;

  private constructor() {
    super('directory-service', {
      ttl: 15 * 60 * 1000 // 15 minutes for directory data
    });
  }

  static getInstance(): DirectoryService {
    if (!DirectoryService.instance) {
      DirectoryService.instance = new DirectoryService();
    }
    return DirectoryService.instance;
  }

  /**
   * Get admin directory stats
   */
  async getAdminDirectoryStats(): Promise<DirectoryStats | null> {
    const response = await this.makeDefaultRequest<DirectoryStats>(
      '/api/admin/directory/stats',
      {},
      'directory-stats',
      10 * 60 * 1000 // 10 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Get admin directory listings
   */
  async getAdminDirectoryListings(filters: DirectoryFilters = {}): Promise<DirectoryListingsResponse | null> {
    // Build query string from filters
    const queryParams = new URLSearchParams();
    
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.featured !== undefined) queryParams.append('featured', filters.featured.toString());
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.region) queryParams.append('region', filters.region);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/api/admin/directory/listings${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeDefaultRequest<DirectoryListingsResponse>(
      endpoint,
      {},
      `directory-listings-${queryString}`,
      5 * 60 * 1000 // 5 minutes cache for listings
    );

    return response?.data || null;
  }

  /**
   * Feature directory listing
   */
  async featureDirectoryListing(
    tenantId: string, 
    until: Date, 
    priority?: number
  ): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/directory/listings/${tenantId}/feature`,
      {
        method: 'POST',
        body: JSON.stringify({
          featuredUntil: until.toISOString(),
          featuredPriority: priority || 1
        }),
      },
      `feature-listing-${tenantId}`,
      0 // No cache for featuring
    );

    // Invalidate directory cache
    this.invalidateCache('directory-stats');
    this.invalidateCache('directory-listings');
  }

  /**
   * Unfeature directory listing
   */
  async unfeatureDirectoryListing(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/directory/listings/${tenantId}/unfeature`,
      {
        method: 'POST',
      },
      `unfeature-listing-${tenantId}`,
      0 // No cache for unfeaturing
    );

    // Invalidate directory cache
    this.invalidateCache('directory-stats');
    this.invalidateCache('directory-listings');
  }

  /**
   * Update directory listing status
   */
  async updateListingStatus(tenantId: string, status: 'active' | 'pending' | 'inactive'): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/directory/listings/${tenantId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      },
      `update-listing-status-${tenantId}`,
      0 // No cache for status updates
    );

    // Invalidate directory cache
    this.invalidateCache('directory-stats');
    this.invalidateCache('directory-listings');
  }

  /**
   * Get directory listing by tenant ID
   */
  async getDirectoryListing(tenantId: string): Promise<AdminDirectoryListing | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<AdminDirectoryListing>(
      `/api/admin/directory/listings/${tenantId}`,
      {},
      `directory-listing-${tenantId}`,
      15 * 60 * 1000 // 15 minutes cache
    );

    return response?.data || null;
  }

  /**
   * Update directory listing
   */
  async updateDirectoryListing(
    tenantId: string, 
    updates: Partial<AdminDirectoryListing>
  ): Promise<AdminDirectoryListing | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<AdminDirectoryListing>(
      `/api/admin/directory/listings/${tenantId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      `update-listing-${tenantId}`,
      0 // No cache for updates
    );

    // Invalidate directory cache
    this.invalidateCache('directory-stats');
    this.invalidateCache('directory-listings');
    this.invalidateCache(`directory-listing-${tenantId}`);

    return response?.data || null;
  }

  /**
   * Bulk update listing statuses
   */
  async bulkUpdateListingStatuses(
    tenantIds: string[], 
    status: 'active' | 'pending' | 'inactive'
  ): Promise<void> {
    await this.makeDefaultRequest<void>(
      '/api/admin/directory/listings/bulk-status',
      {
        method: 'PUT',
        body: JSON.stringify({ tenantIds, status }),
      },
      'bulk-update-statuses',
      0 // No cache for bulk updates
    );

    // Invalidate directory cache
    this.invalidateCache('directory-stats');
    this.invalidateCache('directory-listings');
  }

  /**
   * Get featured listings that are expiring soon
   */
  async getExpiringFeaturedListings(daysAhead: number = 7): Promise<AdminDirectoryListing[] | null> {
    const response = await this.makeDefaultRequest<{ listings: AdminDirectoryListing[] }>(
      `/api/admin/directory/featured/expiring?days=${daysAhead}`,
      {},
      `expiring-featured-${daysAhead}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    return response?.data?.listings || null;
  }

  /**
   * Refresh directory search index
   */
  async refreshSearchIndex(): Promise<void> {
    await this.makeDefaultRequest<void>(
      '/api/admin/directory/search/refresh',
      {
        method: 'POST',
      },
      'refresh-search-index',
      0 // No cache for refresh operations
    );

    // Invalidate directory cache
    this.invalidateCache('directory-listings');
  }

  /**
   * Get featured stats by type
   */
  async getFeaturedStats(type: string): Promise<{ count: number; diversity?: number; avgScore?: number; avgRating?: number; totalSales?: number; topProduct: string }> {
    const response = await this.makeDefaultRequest<{ count: number; diversity?: number; avgScore?: number; avgRating?: number; totalSales?: number; topProduct: string }>(
      `/api/directory/featured-stats?type=${type}`,
      {},
      `directory-featured-stats-${type}`,
      5 * 60 * 1000 // 5 minutes cache
    );

    if (!response.success) {
      clientLogger.error('[DirectoryService] Failed to get featured stats:', { detail: response.error });
      // Return appropriate default based on type
      const defaults: Record<string, any> = {
        trending: { count: 0, avgScore: 0, topProduct: 'N/A' },
        recommended: { count: 0, avgRating: 0, topProduct: 'N/A' },
        bestseller: { count: 0, totalSales: 0, topProduct: 'N/A' },
        random_featured: { count: 0, diversity: 0, topProduct: 'N/A' }
      };
      return defaults[type] || { count: 0, topProduct: 'N/A' };
    }

    return response.data || { count: 0, topProduct: 'N/A' };
  }

  /**
   * Get premium featured products
   */
  async getPremiumFeaturedProducts(limit: number = 20): Promise<{ products: any[] }> {
    const response = await this.makeDefaultRequest<{ products: any[] }>(
      `/api/directory/premium-featured-products?limit=${limit}`,
      {},
      'directory-premium-featured-products',
      10 * 60 * 1000 // 10 minutes cache
    );

    if (!response.success) {
      clientLogger.error('[DirectoryService] Failed to get premium featured products:', { detail: response.error });
      return { products: [] };
    }

    return response.data || { products: [] };
  }
}

// Export singleton instance
export const directoryService = DirectoryService.getInstance();
