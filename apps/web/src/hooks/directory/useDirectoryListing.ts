'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';
import { clientLogger } from '@/lib/client-logger';

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
  syncProfile: () => Promise<{ success: boolean; message?: string; syncedData?: { businessName?: string; logoUrl?: string } }>;
  refresh: () => Promise<void>;
}

export function useDirectoryListing(tenantId: string): DirectoryListingHook {
  // console.log('[useDirectoryListing] Hook called for tenantId:', tenantId);
  
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
      clientLogger.error('Error fetching directory listing:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const publish = useCallback(async () => {
    if (!tenantId) return;

    try {
      setError(null);
      
      const result = await tenantDirectoryManagementService.publishDirectoryListing(tenantId);
      
      if (!result.success) {
        // Set error message but don't throw - treat as validation
        setError(result.error || 'Failed to publish');
        return;
      }
      
      await fetchListing();
    } catch (err: any) {
      clientLogger.error('Error publishing listing:', { detail: err });
      
      // Extract the detailed error message
      const errorMessage = err?.message || err?.response?.data?.message || err?.response?.data?.error || 'Failed to publish';
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tenantId, fetchListing]);

  const unpublish = useCallback(async () => {
    if (!tenantId) return;

    try {
      setError(null);
      
      await tenantDirectoryManagementService.unpublishDirectoryListing(tenantId);
      
      await fetchListing();
    } catch (err) {
      clientLogger.error('Error unpublishing listing:', { detail: err });
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
      
      await tenantDirectoryManagementService.updateDirectoryListing(tenantId, requestData);

      // Refetch to get complete data including businessProfile
      await fetchListing();
    } catch (err) {
      clientLogger.error('Error updating listing:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to update');
      throw err;
    }
  }, [tenantId, fetchListing]);

  const syncProfile = useCallback(async () => {
    if (!tenantId) return { success: false, message: 'Tenant ID is required' };

    try {
      setError(null);
      
      const result = await tenantDirectoryManagementService.syncProfileToDirectory(tenantId);
      
      if (result.success) {
        // Refetch to get updated data
        await fetchListing();
      }
      
      return result;
    } catch (err) {
      clientLogger.error('Error syncing profile:', { detail: err });
      const message = err instanceof Error ? err.message : 'Failed to sync profile';
      setError(message);
      return { success: false, message };
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
    syncProfile,
    refresh: fetchListing,
  };
}
