'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

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
      
      const response = await api.get(`/api/tenants/${tenantId}/directory/listing`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to fetch directory listing (${response.status})`);
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.post(`${apiUrl}/api/tenants/${tenantId}/directory/publish`);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Failed to publish listing';
        setError(errorMessage);
        return;
      }

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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.post(`${apiUrl}/api/tenants/${tenantId}/directory/unpublish`);

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
      
      // Convert empty strings to undefined for API
      const requestData = {
        seo_description: updates.seoDescription,
        seo_keywords: updates.seoKeywords,
        primary_category: updates.primaryCategory || undefined,
        secondary_categories: updates.secondaryCategories,
      };
      console.log('[updateSettings] Sending data:', requestData);
      
      const response = await api.patch(`/api/tenants/${tenantId}/directory/listing`, requestData);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error', message: `HTTP ${response.status}` }));
        console.error('[updateSettings] Server error:', errorData);
        const errorMessage = errorData.message || errorData.error || `Failed to update listing (HTTP ${response.status})`;
        throw new Error(errorMessage);
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
