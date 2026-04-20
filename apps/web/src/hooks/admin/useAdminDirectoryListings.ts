'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

export interface AdminDirectoryListing {
  id: string;
  tenant_id: string;
  is_published: boolean;
  is_featured: boolean;
  primary_category?: string;
  secondary_categories?: string[];
  slug?: string;
  updated_at: string;
  qualityScore: number;
  itemCount: number;
  businessName: string;
  tenants?: {
    id: string;
    name: string;
    subscription_tier: string;
  };
  tenant?: {
    id: string;
    name: string;
    subscriptionTier: string;
  };
}

export interface DirectoryFilters {
  status?: 'published' | 'draft' | 'featured';
  tier?: 'google_only' | 'starter'| 'discovery' | 'storefront' | 'commitment' | 'professional' | 'enterprise' | 'chain_starter' | 'chain_pro' | 'chain_enterprise';
  quality?: 'low' | 'medium' | 'high';
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
}

export function useAdminDirectoryListings(initialFilters?: DirectoryFilters): AdminDirectoryListingsHook {
  const [allListings, setAllListings] = useState<AdminDirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use the passed-in filters directly, not internal state
  const filters = initialFilters || {};
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch all listings once on mount
  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all listings without filters to get the full dataset
      const data = await platformHomeService.getAdminDirectoryListings({});
      
      if (data) {
        // Transform listings to match expected format
        const transformedListings = data.listings.map((listing: any) => ({
          ...listing,
          tenantId: listing.tenant_id,
          isPublished: listing.is_published,
          isFeatured: listing.is_featured,
          primaryCategory: listing.primary_category,
          secondaryCategories: listing.secondary_categories,
          updatedAt: listing.updated_at,
          qualityScore: listing.qualityScore,
          itemCount: listing.itemCount,
          businessName: listing.businessName,
          tenant: listing.tenants ? {
            id: listing.tenants.id,
            name: listing.tenants.name,
            subscriptionTier: listing.tenants.subscription_tier
          } : listing.tenant
        }));

        setAllListings(transformedListings);
        setPagination(data.pagination);
      } else {
        setAllListings([]);
        setPagination(pagination);
      }
    } catch (err) {
      console.error('Error fetching admin directory listings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Client-side filtering using useMemo - instant filtering
  const listings = useMemo(() => {
    let filtered = allListings;

    // Status filter
    if (filters.status === 'published') {
      filtered = filtered.filter(l => l.is_published);
    } else if (filters.status === 'draft') {
      filtered = filtered.filter(l => !l.is_published);
    } else if (filters.status === 'featured') {
      filtered = filtered.filter(l => l.is_featured);
    }

    // Tier filter
    if (filters.tier) {
      filtered = filtered.filter(l => 
        l.tenant?.subscriptionTier === filters.tier || 
        l.tenants?.subscription_tier === filters.tier
      );
    }

    // Quality filter
    if (filters.quality) {
      if (filters.quality === 'low') {
        filtered = filtered.filter(l => l.qualityScore <= 50);
      } else if (filters.quality === 'medium') {
        filtered = filtered.filter(l => l.qualityScore > 50 && l.qualityScore <= 100);
      } else if (filters.quality === 'high') {
        filtered = filtered.filter(l => l.qualityScore > 100);
      }
    }

    // Search filter
    if (filters.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      filtered = filtered.filter(l => 
        l.businessName?.toLowerCase().includes(query) ||
        l.tenant?.name?.toLowerCase().includes(query) ||
        l.primary_category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allListings, filters]);

  // Update pagination based on filtered results
  const filteredPagination = useMemo(() => ({
    ...pagination,
    total: listings.length,
    totalPages: Math.ceil(listings.length / (pagination.limit || 50)),
  }), [listings, pagination]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

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

  return {
    listings,
    loading,
    error,
    pagination: filteredPagination,
    featureListing,
    unfeatureListing,
    refresh: fetchListings,
  };
}
