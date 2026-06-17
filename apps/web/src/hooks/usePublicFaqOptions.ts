/**
 * Public FAQ Options Hook
 *
 * Lightweight hook for public pages (storefront, product, directory)
 * that fetches FAQ capability flags from the unauthenticated endpoint.
 * Returns only display-relevant flags (no management/preview features).
 */

import { useState, useEffect, useCallback } from 'react';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';

export interface PublicFaqOptionsState {
  flags: PublicFaqOptionsFlags | null;
  loading: boolean;
  error: string | null;
  /** True if FAQ should be shown on storefront pages */
  storefrontEnabled: boolean;
  /** True if FAQ should be shown on product pages */
  productEnabled: boolean;
  /** True if feedback buttons should be shown */
  feedbackEnabled: boolean;
}

export function usePublicFaqOptions(tenantId: string | null): PublicFaqOptionsState {
  const [flags, setFlags] = useState<PublicFaqOptionsFlags | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await unifiedCapabilityService.getFaqOptionsFlags(tenantId);
      setFlags(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch FAQ options');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return {
    flags,
    loading,
    error,
    storefrontEnabled: (flags?.faq_enabled && flags?.faq_display_storefront_accordion) ?? false,
    productEnabled: (flags?.faq_enabled && flags?.faq_display_product_accordion) ?? false,
    feedbackEnabled: (flags?.faq_enabled && flags?.faq_display_feedback) ?? false,
  };
}
