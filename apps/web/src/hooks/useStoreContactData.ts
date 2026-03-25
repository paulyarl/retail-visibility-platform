/**
 * Simple hook for store contact data (hours, contact info, map)
 * Shared between directory and tenant pages
 */

import { useState, useEffect } from 'react';
import { directoryService } from '@/services/DirectorySingletonService';
import { tenantDirectoryService } from '@/services/TenantDirectorySingletonService';

export interface StoreContactData {
  listing: {
    businessName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
    businessHours: any;
  } | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Simple hook to get store contact data
 * Uses slug for directory pages, tenantId for tenant pages
 */
export function useStoreContactData(params: { slug?: string; tenantId?: string }) {
  const [data, setData] = useState<StoreContactData>({
    listing: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchContactData() {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        let directoryData = null;
        console.log(`[useStoreContactData] params:`, params);

        // For directory pages: use slug directly
        if (params.slug) {
          directoryData = await directoryService.getDirectoryConsolidated(params.slug);
        }
       
        // For tenant pages: get slug from tenantId, then use slug
        else if (params.tenantId) {
           console.log(`[useStoreContactData] tenantId:`, params.tenantId);
          const tenantSlug = await tenantDirectoryService.getTenantSlug(params.tenantId);
          console.log(`[useStoreContactData] tenantSlug:`, tenantSlug);
          if (tenantSlug) {
            directoryData = await directoryService.getDirectoryConsolidated(tenantSlug);
          }
        }

        setData({
          listing: directoryData?.listing ? {
            businessName: directoryData.listing.businessName || directoryData.listing.business_name || '',
            phone: directoryData.listing.phone || '',
            email: directoryData.listing.email || '',
            address: directoryData.listing.address || '',
            city: directoryData.listing.city || '',
            state: directoryData.listing.state || '',
            zipCode: '', // Not available in directory data, using empty string
            latitude: 0, // Not available in directory data, using default
            longitude: 0, // Not available in directory data, using default
            businessHours: directoryData.listing.businessHours
          } : null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useStoreContactData] Failed to fetch contact data:', error);
        setData({
          listing: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load contact data',
        });
      }
    }

    fetchContactData();
  }, [params.slug, params.tenantId]);

  return data;
}

/**
 * Simple server-side function for static data fetching
 */
export async function getStoreContactDataStatic(params: { slug?: string; tenantId?: string }) {
  try {
    let directoryData = null;

    // For directory pages: use slug directly
    if (params.slug) {
      directoryData = await directoryService.getDirectoryConsolidated(params.slug);
    }
    // For tenant pages: this won't work during SSR (no auth), returns null
    // else if (params.tenantId) {
    //   // Skip during SSR - tenant slug lookup requires authentication
    //   console.log('[getStoreContactDataStatic] Skipping tenant slug fetch during SSR');
    // }

    return {
      listing: directoryData?.listing || null,
      isLoading: false,
      error: null,
    };
  } catch (error) {
    console.error('[getStoreContactDataStatic] Failed to fetch contact data:', error);
    return {
      listing: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to load contact data',
    };
  }
}
