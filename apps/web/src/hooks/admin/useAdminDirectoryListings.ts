'use client';

import { useState, useEffect, useCallback } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

export interface AdminDirectoryListing {
  id: string;
  tenant_id: string;
  is_published: boolean;
  is_featured: boolean;
  primaryCategory?: string;
  secondaryCategories?: string[];
  slug?: string;
  updatedAt: string;
  qualityScore: number;
  itemCount: number;
  businessName: string;
  tenant: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
}

export interface DirectoryFilters {
  status?: 'published' | 'draft' | 'featured';
  tier?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminDirectoryListingsHook {
  listings: AdminDirectoryListing[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  featureListing: (tenantId: string, until: Date, priority?: number) => Promise<void>;
  unfeatureListing: (tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
  setFilters: (filters: DirectoryFilters) => void;
}

export function useAdminDirectoryListings(initialFilters?: DirectoryFilters): AdminDirectoryListingsHook {
  const [listings, setListings] = useState<AdminDirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DirectoryFilters>(initialFilters || {});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await platformHomeService.getAdminDirectoryListings(filters);
      
      if (data) {
        // Transform listings to match expected format
        const transformedListings = data.listings.map((listing: any) => ({
          ...listing,
          tenantId: listing.tenant_id,
          isPublished: listing.is_published,
          isFeatured: listing.is_featured,
          primaryCategory: listing.primaryCategory,
          secondaryCategories: listing.secondaryCategories,
          updatedAt: listing.updatedAt,
          qualityScore: listing.qualityScore,
          itemCount: listing.itemCount,
          businessName: listing.businessName,
        }));

        setListings(transformedListings);
        setPagination(data.pagination);
      } else {
        setListings([]);
        setPagination(pagination);
      }
    } catch (err) {
      console.error('Error fetching admin directory listings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const featureListing = useCallback(async (tenantId: string, until: Date, priority: number = 5) => {
    try {
      setError(null);

      await platformHomeService.featureDirectoryListing(tenantId, until, priority);

      await fetchListings();
    } catch (err) {
      console.error('Error featuring listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to feature listing');
      throw err;
    }
  }, [fetchListings]);

  const unfeatureListing = useCallback(async (tenantId: string) => {
    try {
      setError(null);

      await platformHomeService.unfeatureDirectoryListing(tenantId);

      await fetchListings();
    } catch (err) {
      console.error('Error unfeaturing listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to unfeature listing');
      throw err;
    }
  }, [fetchListings]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return {
    listings,
    loading,
    error,
    pagination,
    featureListing,
    unfeatureListing,
    refresh: fetchListings,
    setFilters,
  };
}
