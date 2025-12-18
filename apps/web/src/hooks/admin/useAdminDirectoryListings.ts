'use client';

import { useState, useEffect, useCallback } from 'react';

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

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.tier) params.append('tier', filters.tier);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/directory/listings?${params}`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }

      const data = await response.json();
      
      // Transform snake_case fields to camelCase
      const transformedListings = (data.listings || []).map((listing: any) => ({
        ...listing,
        primaryCategory: listing.primary_category,
        secondaryCategories: listing.secondary_categories,
        updatedAt: listing.updated_at,
      }));
      
      setListings(transformedListings);
      setPagination(data.pagination || pagination);
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

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/directory/feature/${tenantId}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          featured_until: until.toISOString(),
          placement_priority: priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to feature listing');
      }

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

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      const headers: HeadersInit = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/directory/unfeature/${tenantId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to unfeature listing');
      }

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
