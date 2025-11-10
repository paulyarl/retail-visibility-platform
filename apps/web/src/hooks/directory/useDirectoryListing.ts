'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DirectoryListing {
  id: string;
  tenantId: string;
  isPublished: boolean;
  seoDescription?: string;
  seoKeywords?: string[];
  primaryCategory?: string;
  secondaryCategories?: string[];
  isFeatured: boolean;
  featuredUntil?: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
  businessProfile?: {
    businessName: string;
    city?: string;
    state?: string;
    logoUrl?: string;
  };
}

export interface DirectoryListingHook {
  listing: DirectoryListing | null;
  loading: boolean;
  error: string | null;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  updateSettings: (updates: Partial<DirectoryListing>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDirectoryListing(tenantId: string): DirectoryListingHook {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListing = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/tenants/${tenantId}/directory/listing`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch directory listing');
      }

      const data = await response.json();
      setListing(data);
    } catch (err) {
      console.error('Error fetching directory listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const publish = useCallback(async () => {
    if (!tenantId) return;

    try {
      setError(null);
      
      const response = await fetch(`/api/tenants/${tenantId}/directory/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to publish listing');
      }

      await fetchListing();
    } catch (err) {
      console.error('Error publishing listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish');
      throw err;
    }
  }, [tenantId, fetchListing]);

  const unpublish = useCallback(async () => {
    if (!tenantId) return;

    try {
      setError(null);
      
      const response = await fetch(`/api/tenants/${tenantId}/directory/unpublish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to unpublish listing');
      }

      await fetchListing();
    } catch (err) {
      console.error('Error unpublishing listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to unpublish');
      throw err;
    }
  }, [tenantId, fetchListing]);

  const updateSettings = useCallback(async (updates: Partial<DirectoryListing>) => {
    if (!tenantId) return;

    try {
      setError(null);
      
      const response = await fetch(`/api/tenants/${tenantId}/directory/listing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          seo_description: updates.seoDescription,
          seo_keywords: updates.seoKeywords,
          primary_category: updates.primaryCategory,
          secondary_categories: updates.secondaryCategories,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update listing');
      }

      await fetchListing();
    } catch (err) {
      console.error('Error updating listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
      throw err;
    }
  }, [tenantId, fetchListing]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  return {
    listing,
    loading,
    error,
    publish,
    unpublish,
    updateSettings,
    refresh: fetchListing,
  };
}
