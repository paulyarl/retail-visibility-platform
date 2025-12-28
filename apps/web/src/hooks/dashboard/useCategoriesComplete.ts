import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Consolidated response from /api/v1/tenants/:tenantId/categories/complete
interface CategoriesCompleteResponse {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    googleCategoryId: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
  alignmentStatus: {
    total: number;
    mapped: number;
    unmapped: number;
    mappingCoverage: number;
    isCompliant: boolean;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    organizationId: string | null;
    isHeroLocation: boolean;
    stats: {
      productCount: number;
      userCount: number;
    };
  };
  organization: {
    id: string;
    name: string;
    tenants: Array<{
      id: string;
      name: string;
      isHero: boolean;
    }>;
  } | null;
  _timestamp: string;
}

export interface UseCategoriesCompleteReturn {
  // Categories data (from /api/v1/tenants/:id/categories)
  categories: CategoriesCompleteResponse['categories'];

  // Alignment status (from /api/v1/tenants/:id/categories-alignment-status)
  alignmentStatus: CategoriesCompleteResponse['alignmentStatus'];

  // Tenant info (from /api/tenants/:id)
  tenant: CategoriesCompleteResponse['tenant'];

  // Organization info (for propagation)
  organization: CategoriesCompleteResponse['organization'];

  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Advanced hook that fetches complete categories data in a single consolidated API call
 * Replaces 3 separate API calls with 1 consolidated call
 * Pattern: API Consolidation for Frontend Optimization
 */
export function useCategoriesComplete(tenantId: string | null): UseCategoriesCompleteReturn {
  const { data: completeData, isLoading, error, refetch } = useQuery({
    queryKey: ['categories', 'complete', tenantId],
    queryFn: async (): Promise<CategoriesCompleteResponse> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      console.log('[useCategoriesComplete] Fetching consolidated categories data for:', tenantId);

      const response = await api.get(`/api/v1/tenants/${encodeURIComponent(tenantId)}/categories/complete`);

      if (!response.ok) {
        throw new Error(`Failed to fetch complete categories data: ${response.status}`);
      }

      const data = await response.json();
      console.log('[useCategoriesComplete] Received consolidated data:', {
        categoriesCount: data.categories?.length,
        alignmentCoverage: data.alignmentStatus?.mappingCoverage,
        hasOrganization: !!data.organization,
      });

      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - categories change more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    enabled: !!tenantId, // Only run when tenantId available
    retry: 2,
  });

  // Extract data from consolidated response
  const categories = completeData?.categories || [];
  const alignmentStatus = completeData?.alignmentStatus || {
    total: 0,
    mapped: 0,
    unmapped: 0,
    mappingCoverage: 0,
    isCompliant: false,
    status: 'unknown'
  };
  const tenant = completeData?.tenant || {
    id: '',
    name: '',
    organizationId: null,
    isHeroLocation: false,
    stats: { productCount: 0, userCount: 0 }
  };
  const organization = completeData?.organization || null;
  const loading = isLoading;
  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  return {
    categories,
    alignmentStatus,
    tenant,
    organization,
    loading,
    error: queryError,
    refresh: async () => { await refetch(); },
  };
}
