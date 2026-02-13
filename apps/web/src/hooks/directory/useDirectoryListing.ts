'use client';

import { useState, useEffect, useCallback } from 'react';
import { directoryListingService } from '@/services/DirectoryListingSingletonService';

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
      
      const response = await directoryListingService.getDirectoryListing(tenantId);
      
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
      
      await directoryListingService.publishDirectoryListing(tenantId);
      
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
      
      await directoryListingService.unpublishDirectoryListing(tenantId);
      
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
      
      // Convert empty strings to undefined for API
      const requestData = {
        seo_description: updates.seoDescription,
        seo_keywords: updates.seoKeywords,
        primary_category: updates.primaryCategory || undefined,
        secondary_categories: updates.secondaryCategories,
      };
      console.log('[updateSettings] Sending data:', requestData);
      
      const updatedListing = await directoryListingService.updateDirectoryListing(tenantId, updates);

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
