/**
 * useScopeUrlState Hook
 * Manages scope state synchronized with URL parameters
 * Phase 5 UI Implementation
 */

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { ScopeParams, ScopeType, CategoryType } from '@/types/scope';

export const useScopeUrlState = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  /**
   * Parse scope parameters from URL
   */
  const parseScopeFromUrl = useCallback((): ScopeParams => {
    const scope = (searchParams.get('scope') || 'global') as ScopeType;

    if (scope === 'category') {
      return {
        scope: 'category',
        category: {
          productName: searchParams.get('category[productName]') || undefined,
          productSlug: searchParams.get('category[productSlug]') || undefined,
          productId: searchParams.get('category[productId]') || undefined,
          googleProductId: searchParams.get('category[googleProductId]') || undefined,
          shopCategoryName: searchParams.get('category[shopCategoryName]') || undefined,
          shopCategoryId: searchParams.get('category[shopCategoryId]') || undefined,
          shopGoogleCategoryId: searchParams.get('category[shopGoogleCategoryId]') || undefined,
          categoryType: (searchParams.get('category[categoryType]') as CategoryType) || undefined,
        }
      };
    }

    if (scope === 'location') {
      const latitude = searchParams.get('location[latitude]');
      const longitude = searchParams.get('location[longitude]');
      const radius = searchParams.get('location[radius]');

      return {
        scope: 'location',
        location: {
          city: searchParams.get('location[city]') || undefined,
          state: searchParams.get('location[state]') || undefined,
          zip: searchParams.get('location[zip]') || undefined,
          country: searchParams.get('location[country]') || undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          radius: radius ? parseInt(radius) : undefined,
        }
      };
    }

    return { scope: 'global' };
  }, [searchParams]);

  /**
   * Update URL with new scope parameters
   */
  const updateUrl = useCallback((scope: ScopeParams) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Clear all scope-related params
    params.delete('scope');
    Array.from(params.keys()).forEach(key => {
      if (key.startsWith('category[') || key.startsWith('location[')) {
        params.delete(key);
      }
    });

    // Set new scope
    params.set('scope', scope.scope);

    // Add category params
    if (scope.category) {
      Object.entries(scope.category).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(`category[${key}]`, String(value));
        }
      });
    }

    // Add location params
    if (scope.location) {
      Object.entries(scope.location).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(`location[${key}]`, String(value));
        }
      });
    }

    // Update URL
    router.push(`/shops?${params.toString()}`);
  }, [searchParams, router]);

  /**
   * Clear all scope filters (return to global)
   */
  const clearScope = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Remove all scope-related params
    params.delete('scope');
    Array.from(params.keys()).forEach(key => {
      if (key.startsWith('category[') || key.startsWith('location[')) {
        params.delete(key);
      }
    });

    const queryString = params.toString();
    router.push(queryString ? `/shops?${queryString}` : '/shops');
  }, [searchParams, router]);

  /**
   * Get current scope from URL (memoized)
   */
  const currentScope = useMemo(() => parseScopeFromUrl(), [parseScopeFromUrl]);

  return {
    currentScope,
    updateUrl,
    clearScope,
    parseScopeFromUrl
  };
};

export default useScopeUrlState;
