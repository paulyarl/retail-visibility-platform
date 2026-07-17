/**
 * Shop URL Resolution Hook
 * Handles flexible shop URL resolution with multiple identifier types
 */

import { useMemo, useCallback } from 'react';
import { Shop, ShopUrls, ShopResolution } from '@/types/shop';
import { shopsService } from '@/services/ShopsService';
import { clientLogger } from '@/lib/client-logger';

export interface ShopUrlOptions {
  preferSlug?: boolean;
  includeAll?: boolean;
}

export interface ResolvedShopUrl {
  url: string;
  type: 'slug' | 'tenantId' | 'autoId';
  canonical: string;
  all?: ShopUrls;
}

/**
 * Hook for resolving shop URLs by any identifier
 */
export function useShopUrlResolver() {
  /**
   * Resolve shop by identifier and return URL information
   */
  const resolveShopUrl = useCallback(async (
    identifier: string,
    options: ShopUrlOptions = {}
  ): Promise<ResolvedShopUrl | null> => {
    try {
      const resolution = await shopsService.resolveShop(identifier);
      
      if (!resolution.found || !resolution.shop) {
        return null;
      }

      const shop = resolution.shop;
      const { preferSlug = true, includeAll = false } = options;

      // Determine which URL to return
      let url: string;
      let type: 'slug' | 'tenantId' | 'autoId';

      if (preferSlug && shop.urls.slugUrl) {
        url = shop.urls.slugUrl;
        type = 'slug';
      } else {
        url = shop.urls.tenantIdUrl;
        type = 'tenantId';
      }

      return {
        url,
        type,
        canonical: shop.urls.canonicalUrl,
        ...(includeAll && { all: shop.urls })
      };
    } catch (error) {
      clientLogger.error('[SHOP URL RESOLVER] Failed to resolve shop URL:', { detail: error });
      return null;
    }
  }, [shopsService]);

  /**
   * Generate shop URLs for a given tenant
   */
  const generateShopUrls = useCallback(async (
    tenantId: string,
    slug?: string
  ): Promise<ShopUrls> => {
    try {
      return await shopsService.getShopUrls(tenantId, slug);
    } catch (error) {
      clientLogger.error('[SHOP URL RESOLVER] Failed to generate shop URLs:', { detail: error });
      throw error;
    }
  }, [shopsService]);

  /**
   * Validate if an identifier is a valid shop identifier
   */
  const validateIdentifier = useCallback((identifier: string): boolean => {
    if (!identifier) return false;

    // Check if it's a tenant ID (starts with tid-)
    if (identifier.startsWith('tid-')) {
      return true;
    }

    // Check if it's a 4-character auto ID
    if (/^[A-Z0-9]{4}$/.test(identifier)) {
      return true;
    }

    // Check if it's a valid slug (lowercase, alphanumeric with hyphens)
    if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(identifier)) {
      return true;
    }

    return false;
  }, []);

  /**
   * Get identifier type from string
   */
  const getIdentifierType = useCallback((identifier: string): 'tenantId' | 'slug' | 'autoId' | 'unknown' => {
    if (identifier.startsWith('tid-')) {
      return 'tenantId';
    }

    if (/^[A-Z0-9]{4}$/.test(identifier)) {
      return 'autoId';
    }

    if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(identifier)) {
      return 'slug';
    }

    return 'unknown';
  }, []);

  /**
   * Format shop URL for display
   */
  const formatShopUrl = useCallback((url: string, options: {
    includeDomain?: boolean;
    short?: boolean;
  } = {}): string => {
    const { includeDomain = false, short = false } = options;

    if (short) {
      // Return just the identifier part
      const parts = url.split('/');
      return parts[parts.length - 1];
    }

    if (includeDomain) {
      const domain = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';
      return `${domain}${url}`;
    }

    return url;
  }, []);

  return {
    resolveShopUrl,
    generateShopUrls,
    validateIdentifier,
    getIdentifierType,
    formatShopUrl
  };
}

/**
 * Hook for working with a specific shop's URLs
 */
export function useShopUrls(tenantId: string, slug?: string) {
  const { generateShopUrls, formatShopUrl } = useShopUrlResolver();
  
  const urls = useMemo(() => {
    // This would be populated by the generateShopUrls call
    return null;
  }, [tenantId, slug]);

  const loading = useMemo(() => false, []);
  const error = useMemo(() => null, []);

  const refresh = useCallback(async () => {
    try {
      const shopUrls = await generateShopUrls(tenantId, slug);
      return shopUrls;
    } catch (err) {
      clientLogger.error('[SHOP URLS] Failed to refresh shop URLs:', { detail: err });
      throw err;
    }
  }, [generateShopUrls, tenantId, slug]);

  return {
    urls,
    loading,
    error,
    refresh,
    formatShopUrl
  };
}

/**
 * Hook for resolving shop from current URL
 */
export function useCurrentShopUrl() {
  const { resolveShopUrl, validateIdentifier, getIdentifierType } = useShopUrlResolver();
  
  const currentUrl = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    const pathname = window.location.pathname;
    if (!pathname.startsWith('/shops/')) return null;
    
    return pathname.replace('/shops/', '');
  }, []);

  const identifier = useMemo(() => {
    if (!currentUrl) return null;
    
    // Extract identifier from URL path
    const parts = currentUrl.split('/');
    return parts[0] || null;
  }, [currentUrl]);

  const isValid = useMemo(() => {
    return identifier ? validateIdentifier(identifier) : false;
  }, [identifier, validateIdentifier]);

  const identifierType = useMemo(() => {
    return identifier ? getIdentifierType(identifier) : 'unknown';
  }, [identifier, getIdentifierType]);

  const resolution = useMemo(() => {
    return null; // Would be populated by resolveShopUrl
  }, [identifier]);

  const loading = useMemo(() => false, []);
  const error = useMemo(() => null, []);

  const resolve = useCallback(async () => {
    if (!identifier) return null;
    
    try {
      return await resolveShopUrl(identifier, { includeAll: true });
    } catch (err) {
      clientLogger.error('[CURRENT SHOP URL] Failed to resolve:', { detail: err });
      throw err;
    }
  }, [resolveShopUrl, identifier]);

  return {
    currentUrl,
    identifier,
    isValid,
    identifierType,
    resolution,
    loading,
    error,
    resolve
  };
}

/**
 * Utility functions for shop URL handling
 */
export const shopUrlUtils = {
  /**
   * Extract identifier from shop URL
   */
  extractIdentifierFromUrl: (url: string): string | null => {
    if (!url) return null;
    
    const pathname = url.startsWith('http') 
      ? new URL(url).pathname 
      : url;
    
    if (!pathname.startsWith('/shops/')) return null;
    
    return pathname.replace('/shops/', '').split('/')[0];
  },

  /**
   * Build shop URL with identifier
   */
  buildShopUrl: (identifier: string, options: {
    includeDomain?: boolean;
    domain?: string;
  } = {}): string => {
    const { includeDomain = false, domain } = options;
    
    const path = `/shops/${identifier}`;
    
    if (includeDomain) {
      const baseDomain = domain || (
        typeof window !== 'undefined' 
          ? window.location.origin 
          : process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'
      );
      return `${baseDomain}${path}`;
    }
    
    return path;
  },

  /**
   * Check if URL is a shop URL
   */
  isShopUrl: (url: string): boolean => {
    if (!url) return false;
    
    const pathname = url.startsWith('http') 
      ? new URL(url).pathname 
      : url;
    
    return pathname.startsWith('/shops/');
  },

  /**
   * Normalize shop URL (ensure consistent format)
   */
  normalizeShopUrl: (url: string): string => {
    if (!url) return '';
    
    // Remove trailing slash
    const normalized = url.replace(/\/$/, '');
    
    // Ensure it starts with /shops/
    if (!normalized.startsWith('/shops/')) {
      return `/shops/${normalized}`;
    }
    
    return normalized;
  }
};

export default useShopUrlResolver;
