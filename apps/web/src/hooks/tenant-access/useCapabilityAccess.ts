'use client';

/**
 * Capability Access Hooks
 * 
 * React hooks for capability-aware feature state resolution.
 * These hooks fetch tenant capabilities and provide typed domain state
 * for commerce, payment gateways, and storefront types.
 * 
 * - useCommerceCapability: For cart / product listing visibility
 * - usePaymentGatewayCapability: For checkout / payment gateway options
 * - useStorefrontCapability: For storefront display / location / hours
 * - useAllCapabilities: Combined hook for all three
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { tenantInfoService } from '@/services/TenantInfoService';
import { faqService } from '@/services/FaqService';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';

import {
  CommerceState,
  PaymentGatewayState,
  StorefrontState,
  BarcodeScanState,
  FulfillmentState,
  ProductTypeState,
  ProductOptionsState,
  FeaturedOptionsState,
  IntegrationOptionsState,
  QuickstartOptionsState,
  StorefrontOptionsState,
  StorefrontQrState,
  StorefrontGalleryState,
  StorefrontHoursState,
  StorefrontLayoutState,
  StorefrontMapsState,
  FaqOptionsState,
  CrmOptionsState,
  ChatbotOptionsState,
  SocialCommerceOptionsState,
  DirectoryPromotionState,
  OrgOptionsState,
  WholesaleMatchingState,
  PlatformServicesState,
  FunnelState,
  CouponOptionsState,
  AllCapabilitiesState,
  ConstraintViolationState,
  ConstraintStatusMapState,
  resolveCommerceState,
  resolvePaymentGatewayState,
  resolveStorefrontState,
  resolveBarcodeScanState,
  resolveFulfillmentState,
  resolveProductOptionsState,
  resolveFeaturedOptionsState,
  resolveIntegrationState,
  resolveQuickstartOptionsState,
  resolveStorefrontOptionsState,
  getCapabilityTypeForFeature,
} from '@/services/CapabilityResolutionService';

// ====================
// COMMON TYPES
// ====================

export interface CapabilityHookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ====================
// useCommerceCapability
// ====================

export function useCommerceCapability(
  tenantId: string | null
): CapabilityHookState<CommerceState> {
  const [data, setData] = useState<CommerceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getCommerceState(tenantId);
      
      // console.log(`useCapabilityAccess: state ${JSON.stringify(state)}`);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch commerce capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// usePaymentGatewayCapability
// ====================

export function usePaymentGatewayCapability(
  tenantId: string | null
): CapabilityHookState<PaymentGatewayState> {
  const [data, setData] = useState<PaymentGatewayState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getPaymentGatewayState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch payment gateway capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontCapability
// ====================

export function useStorefrontCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontState> {
  const [data, setData] = useState<StorefrontState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useBarcodeScanCapability
// ====================

export function useBarcodeScanCapability(
  tenantId: string | null
): CapabilityHookState<BarcodeScanState> {
  const [data, setData] = useState<BarcodeScanState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getBarcodeScanState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch barcode scan capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFulfillmentCapability
// ====================

export function useFulfillmentCapability(
  tenantId: string | null
): CapabilityHookState<FulfillmentState> {
  const [data, setData] = useState<FulfillmentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getFulfillmentState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch fulfillment capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useProductTypeCapability
// ====================

export function useProductTypeCapability(
  tenantId: string | null
): CapabilityHookState<ProductTypeState> {
  const [data, setData] = useState<ProductTypeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getProductTypeState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch product type capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useProductOptionsCapability
// ====================

export function useProductOptionsCapability(
  tenantId: string | null
): CapabilityHookState<ProductOptionsState> {
  const [data, setData] = useState<ProductOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getProductOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch product options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFeaturedOptionsCapability
// ====================

export function useFeaturedOptionsCapability(
  tenantId: string | null
): CapabilityHookState<FeaturedOptionsState> {
  const [data, setData] = useState<FeaturedOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getFeaturedOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch featured options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useIntegrationOptionsCapability
// ====================

export function useIntegrationOptionsCapability(
  tenantId: string | null
): CapabilityHookState<IntegrationOptionsState> {
  const [data, setData] = useState<IntegrationOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getIntegrationOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch integration options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useQuickstartOptionsCapability
// ====================

export function useQuickstartOptionsCapability(
  tenantId: string | null
): CapabilityHookState<QuickstartOptionsState> {
  const [data, setData] = useState<QuickstartOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getQuickstartOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch quickstart options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontOptionsCapability
// ====================

export function useStorefrontOptionsCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontOptionsState> {
  const [data, setData] = useState<StorefrontOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontQrCapability
// ====================

export function useStorefrontQrCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontQrState> {
  const [data, setData] = useState<StorefrontQrState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontQrState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront QR capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontGalleryCapability
// ====================

export function useStorefrontGalleryCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontGalleryState> {
  const [data, setData] = useState<StorefrontGalleryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontGalleryState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront gallery capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontHoursCapability
// ====================

export function useStorefrontHoursCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontHoursState> {
  const [data, setData] = useState<StorefrontHoursState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontHoursState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront hours capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontLayoutsCapability
// ====================

export function useStorefrontLayoutsCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontLayoutState> {
  const [data, setData] = useState<StorefrontLayoutState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontLayoutsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront layouts capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontMapsCapability
// ====================

export function useStorefrontMapsCapability(
  tenantId: string | null
): CapabilityHookState<StorefrontMapsState> {
  const [data, setData] = useState<StorefrontMapsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getStorefrontMapsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront maps capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFaqOptionsCapability
// ====================

export function useFaqOptionsCapability(
  tenantId: string | null
): CapabilityHookState<FaqOptionsState> {
  const [data, setData] = useState<FaqOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getFaqOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch FAQ options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useCrmOptionsCapability
// ====================

export function useCrmOptionsCapability(
  tenantId: string | null
): CapabilityHookState<CrmOptionsState> {
  const [data, setData] = useState<CrmOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getCrmOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch CRM options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useChatbotOptionsCapability
// ====================

export function useChatbotOptionsCapability(
  tenantId: string | null
): CapabilityHookState<ChatbotOptionsState> {
  const [data, setData] = useState<ChatbotOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getChatbotOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch chatbot options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useSocialCommerceOptionsCapability
// ====================

export function useSocialCommerceOptionsCapability(
  tenantId: string | null
): CapabilityHookState<SocialCommerceOptionsState> {
  const [data, setData] = useState<SocialCommerceOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getSocialCommerceOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch social commerce options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useDirectoryPromotionCapability
// ====================

export function useDirectoryPromotionCapability(
  tenantId: string | null
): CapabilityHookState<DirectoryPromotionState> {
  const [data, setData] = useState<DirectoryPromotionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getDirectoryPromotionState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch directory promotion capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useOrgOptionsCapability
// ====================

export function useOrgOptionsCapability(
  tenantId: string | null
): CapabilityHookState<OrgOptionsState> {
  const [data, setData] = useState<OrgOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const all = await unifiedCapabilityService.getAllCapabilities(tenantId);
      setData(all.orgOptions);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch org options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useWholesaleMatchingCapability
// ====================

export function useWholesaleMatchingCapability(
  tenantId: string | null
): CapabilityHookState<WholesaleMatchingState> {
  const [data, setData] = useState<WholesaleMatchingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getWholesaleMatchingState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch wholesale matching capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// usePlatformServicesCapability
// ====================

export function usePlatformServicesCapability(
  tenantId: string | null
): CapabilityHookState<PlatformServicesState> {
  const [data, setData] = useState<PlatformServicesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getPlatformServicesState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch platform services capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFunnelCapability
// ====================

export function useFunnelCapability(
  tenantId: string | null
): CapabilityHookState<FunnelState> {
  const [data, setData] = useState<FunnelState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getFunnelState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch funnel capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useCouponOptionsCapability
// ====================

export function useCouponOptionsCapability(
  tenantId: string | null
): CapabilityHookState<CouponOptionsState> {
  const [data, setData] = useState<CouponOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await unifiedCapabilityService.getCouponOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch coupon options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useAllCapabilities
// ====================

export function useAllCapabilities(
  tenantId: string | null
): CapabilityHookState<AllCapabilitiesState> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return unifiedCapabilityService.getAllCapabilities(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 0,
    throwOnError: false,
  });

  const refetchCb = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return useMemo(() => ({
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch capabilities') : null,
    refetch: refetchCb,
  }), [data, isLoading, error, refetchCb]);
}

// ====================
// useCapabilityFeatureCheck
// ====================

/**
 * Lightweight hook that checks a single feature key against capability data.
 * Returns null if the feature is not capability-gated (uncategorized).
 */
export function useCapabilityFeatureCheck(
  tenantId: string | null,
  featureKey: string
): { enabled: boolean | null; loading: boolean } {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) {
      // Not a capability-gated feature
      setEnabled(null);
      return;
    }

    setLoading(true);
    unifiedCapabilityService.checkFeatureByCapability(tenantId, featureKey)
      .then((result: boolean | null) => setEnabled(result))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, [tenantId, featureKey]);

  return { enabled, loading };
}

// ====================
// useMerchantGates
// ====================

/**
 * Fetches each capability's merchant-pref-aware state and determines
 * whether the merchant has disabled the entire capability (tier allows
 * but merchant turned it off). Returns a Record<capabilityKey, boolean>.
 *
 * Uses the same cached option services as the settings pages for reliable
 * master-switch detection. Falls back to resolve-service effective fields
 * when direct settings fetch fails.
 */
export function useMerchantGates(
  tenantId: string | null
): { gates: Record<string, boolean>; loading: boolean } {
  const [gates, setGates] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);


    Promise.all([
      // Tier-allowed states from resolve service
      unifiedCapabilityService.getCommerceState(tenantId).catch(() => null),
      unifiedCapabilityService.getPaymentGatewayState(tenantId).catch(() => null),
      unifiedCapabilityService.getStorefrontState(tenantId).catch(() => null),
      unifiedCapabilityService.getBarcodeScanState(tenantId).catch(() => null),
      unifiedCapabilityService.getFulfillmentState(tenantId).catch(() => null),
      unifiedCapabilityService.getProductOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getFeaturedOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getIntegrationOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getQuickstartOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getStorefrontOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getFaqOptionsState(tenantId).catch(() => null),
      unifiedCapabilityService.getCrmOptionsState(tenantId).catch(() => null),
      // Direct merchant settings from option services (for master switches)
      platformHomeService.getTenantBarcodeScanSettings(tenantId).catch(() => null),
      platformHomeService.getTenantFulfillmentSettings(tenantId).catch(() => null),
      tenantInfoService.getStorefrontOptionsSettings(tenantId).catch(() => null),
      faqService.getOptions(tenantId).then(r => r.settings).catch(() => null),
      tenantInfoService.getPaymentGatewaySettings(tenantId).catch(() => null),
      platformHomeService.getTenantFeaturedOptionsSettings(tenantId).catch(() => null),
      platformHomeService.getTenantProductOptionsSettings(tenantId).catch(() => null),
      platformHomeService.getTenantIntegrationOptionsSettings(tenantId).catch(() => null),
      tenantInfoService.getQuickstartOptionsSettings(tenantId).catch(() => null),
      crmTenantCrmService.getOptions(tenantId).then(r => r.settings).catch(() => null),
    ]).then(([c, pg, sf, bc, fl, po, fo, io, qo, so, faq, crm, bcSettings, flSettings, soSettings, faqSettings, pgSettings, foSettings, poSettings, ioSettings, qoSettings, crmSettings]) => {
      setGates({
        commerce_types: c ? c.enabled && c.effectivePaymentType === 'none' : false,
        // Payment gateway: check master switch from option service
        payment_gateway_options: pg ? pg.enabled && (pgSettings ? pgSettings.gateway_enabled === false : pg.effectiveGateways.length === 0) : false,
        storefront_types: sf ? sf.enabled && sf.effectiveType === 'none' : false,
        // Barcode: check master switch from option service (resolve fn doesn't accept barcode_enabled)
        barcode_scan_options: bc ? bc.enabled && (bcSettings ? bcSettings.barcode_enabled === false : bc.effectiveModes.length === 0) : false,
        // Fulfillment: no master switch — check all 3 individual switches against tier-allowed methods
        fulfillment_options: fl && fl.enabled && (fl.showsPickup || fl.showsDelivery || fl.showsShipping)
          ? flSettings
            ? (!fl.showsPickup || !flSettings.pickup_enabled) && (!fl.showsDelivery || !flSettings.delivery_enabled) && (!fl.showsShipping || !flSettings.shipping_enabled)
            : !fl.effectiveShowsPickup && !fl.effectiveShowsDelivery && !fl.effectiveShowsShipping
          : false,
        // Product options: check if capability is disabled or all creation features are off
        product_options: po
          ? !po.enabled || (!po.creationEnabled && !po.showsVariants && !po.showsGallery && !po.showsVideo && !po.showsSupplierCatalog && !po.layoutEnabled && !po.sectionsEnabled)
          : false,
        // Featured options: check master switch from option service
        featured_options: fo ? fo.enabled && (foSettings ? foSettings.featured_enabled === false : fo.effectiveTypes.length === 0) : false,
        // Integration options: check master switch from option service
        integration_options: io ? io.enabled && (ioSettings ? ioSettings.integration_enabled === false : io.effectiveTypes.length === 0) : false,
        // Quickstart options: check master switch from option service
        quickstart_options: qo ? qo.enabled && (qoSettings ? qoSettings.quickstart_enabled === false : !qo.canUseWizard && !qo.canGenerateImages && !qo.canUseCategoryGenerator && !qo.canUseOpenAI && !qo.canUseGemini && !qo.canUseAIWizard && !qo.canUseHDImages) : false,
        // Storefront options: check master switch from option service
        storefront_options: so ? so.enabled && (soSettings ? soSettings.storefront_opt_enabled === false : so.merchantPreferences.storefront_opt_enabled === false) : false,
        // FAQ: check master switch from option service (resolve fn doesn't accept merchant prefs)
        faq_options: faq ? faq.enabled && (faqSettings ? faqSettings.faq_enabled === false : false) : false,
        // CRM: check master switch from option service
        crm_options: crm ? crm.enabled && (crmSettings ? crmSettings.crm_enabled === false : false) : false,
      });
      setLoading(false);
    });
  }, [tenantId]);

  return { gates, loading };
}

// ====================
// useConstraintViolations
// ====================

/**
 * Fetches cross-capability constraint violations for a tenant.
 * Returns violations array + loading/error state.
 *
 * Uses the unified capabilities endpoint (same as useAllCapabilities).
 * Constraint violations are computed server-side by the CCL post-resolution pass.
 */
export function useConstraintViolations(
  tenantId: string | null
): CapabilityHookState<ConstraintViolationState[]> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'constraints', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await unifiedCapabilityService.getAllCapabilities(tenantId);
      return caps.constraintViolations;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 0,
    throwOnError: false,
  });

  const refetchCb = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return useMemo(() => ({
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch constraint violations') : null,
    refetch: refetchCb,
  }), [data, isLoading, error, refetchCb]);
}

// ====================
// useConstraintStatus
// ====================

/**
 * Fetches cross-capability constraint status for a tenant.
 * Returns a map of capability key → { blockedTypes, warningTypes, activeViolations }.
 *
 * Settings pages use blockedTypes to disable selection controls.
 * Dashboard uses warningTypes to show amber warnings.
 */
export function useConstraintStatus(
  tenantId: string | null
): CapabilityHookState<ConstraintStatusMapState> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'constraint-status', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await unifiedCapabilityService.getAllCapabilities(tenantId);
      return caps.constraintStatus;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 0,
    throwOnError: false,
  });

  const refetchCb = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return useMemo(() => ({
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch constraint status') : null,
    refetch: refetchCb,
  }), [data, isLoading, error, refetchCb]);
}
