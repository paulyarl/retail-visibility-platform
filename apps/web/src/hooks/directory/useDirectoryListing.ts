'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';

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
  console.log('[useDirectoryListing] Hook called for tenantId:', tenantId);
  
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListing = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await tenantDirectoryManagementService.getDirectoryListing(tenantId);
      
      if (!response) {
        throw new Error('Failed to fetch directory listing');
      }
      
      setListing(response);
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
      
      await tenantDirectoryManagementService.publishDirectoryListing(tenantId);
      
      await fetchListing();
    } catch (err) {
      console.error('Error publishing listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish');
    }
  }, [tenantId, fetchListing]);

  const unpublish = useCallback(async () => {
    if (!tenantId) return;

    try {
      setError(null);
      
      await tenantDirectoryManagementService.unpublishDirectoryListing(tenantId);
      
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
      
      // Convert camelCase to snake_case for API
      const requestData = {
        seo_description: updates.seoDescription,
        seo_keywords: updates.seoKeywords,
        primary_category: updates.primaryCategory || undefined,
        secondary_categories: updates.secondaryCategories,
      };
      
      const updatedListing = await tenantDirectoryManagementService.updateDirectoryListing(tenantId, requestData);

      if (updatedListing) {
        setListing(updatedListing);
      }
    } catch (err) {
      console.error('Error updating listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
      throw err;
    }
  }, [tenantId, setListing]);

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
