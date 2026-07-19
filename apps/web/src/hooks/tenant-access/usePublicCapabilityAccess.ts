'use client';

/**
 * Public Capability Access Hooks
 *
 * Public-facing counterpart to useCapabilityAccess.
 * Uses publicUnifiedCapabilityService (extends PublicApiSingleton) for
 * unauthenticated public requests — no 401 risk on public pages.
 *
 * - usePublicCommerceCapability: For cart / product listing visibility
 * - usePublicPaymentGatewayCapability: For checkout / payment gateway options
 * - usePublicStorefrontCapability: For storefront display / location / hours
 * - usePublicAllCapabilities: Combined hook for all capabilities
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicUnifiedCapabilityService } from '@/services/PublicUnifiedCapabilityService';

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
  WholesaleMatchingState,
  PlatformServicesState,
  FunnelState,
  CouponOptionsState,
  AllCapabilitiesState,
  ConstraintViolationState,
  ConstraintStatusMapState,
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
// usePublicCommerceCapability
// ====================

export function usePublicCommerceCapability(
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
      const state = await publicUnifiedCapabilityService.getCommerceState(tenantId);
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
// usePublicPaymentGatewayCapability
// ====================

export function usePublicPaymentGatewayCapability(
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
      const state = await publicUnifiedCapabilityService.getPaymentGatewayState(tenantId);
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
// usePublicStorefrontCapability
// ====================

export function usePublicStorefrontCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontState(tenantId);
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
// usePublicBarcodeScanCapability
// ====================

export function usePublicBarcodeScanCapability(
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
      const state = await publicUnifiedCapabilityService.getBarcodeScanState(tenantId);
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
// usePublicFulfillmentCapability
// ====================

export function usePublicFulfillmentCapability(
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
      const state = await publicUnifiedCapabilityService.getFulfillmentState(tenantId);
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
// usePublicProductTypeCapability
// ====================

export function usePublicProductTypeCapability(
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
      const state = await publicUnifiedCapabilityService.getProductTypeState(tenantId);
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
// usePublicProductOptionsCapability
// ====================

export function usePublicProductOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getProductOptionsState(tenantId);
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
// usePublicFeaturedOptionsCapability
// ====================

export function usePublicFeaturedOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getFeaturedOptionsState(tenantId);
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
// usePublicIntegrationOptionsCapability
// ====================

export function usePublicIntegrationOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getIntegrationOptionsState(tenantId);
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
// usePublicQuickstartOptionsCapability
// ====================

export function usePublicQuickstartOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getQuickstartOptionsState(tenantId);
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
// usePublicStorefrontOptionsCapability
// ====================

export function usePublicStorefrontOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontOptionsState(tenantId);
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
// usePublicStorefrontQrCapability
// ====================

export function usePublicStorefrontQrCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontQrState(tenantId);
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
// usePublicStorefrontGalleryCapability
// ====================

export function usePublicStorefrontGalleryCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontGalleryState(tenantId);
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
// usePublicStorefrontHoursCapability
// ====================

export function usePublicStorefrontHoursCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontHoursState(tenantId);
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
// usePublicStorefrontLayoutsCapability
// ====================

export function usePublicStorefrontLayoutsCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontLayoutsState(tenantId);
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
// usePublicStorefrontMapsCapability
// ====================

export function usePublicStorefrontMapsCapability(
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
      const state = await publicUnifiedCapabilityService.getStorefrontMapsState(tenantId);
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
// usePublicFaqOptionsCapability
// ====================

export function usePublicFaqOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getFaqOptionsState(tenantId);
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
// usePublicCrmOptionsCapability
// ====================

export function usePublicCrmOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getCrmOptionsState(tenantId);
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
// usePublicChatbotOptionsCapability
// ====================

export function usePublicChatbotOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getChatbotOptionsState(tenantId);
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
// usePublicSocialCommerceOptionsCapability
// ====================

export function usePublicSocialCommerceOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getSocialCommerceOptionsState(tenantId);
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
// usePublicDirectoryPromotionCapability
// ====================

export function usePublicDirectoryPromotionCapability(
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
      const state = await publicUnifiedCapabilityService.getDirectoryPromotionState(tenantId);
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
// usePublicWholesaleMatchingCapability
// ====================

export function usePublicWholesaleMatchingCapability(
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
      const state = await publicUnifiedCapabilityService.getWholesaleMatchingState(tenantId);
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
// usePublicPlatformServicesCapability
// ====================

export function usePublicPlatformServicesCapability(
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
      const state = await publicUnifiedCapabilityService.getPlatformServicesState(tenantId);
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
// usePublicFunnelCapability
// ====================

export function usePublicFunnelCapability(
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
      const state = await publicUnifiedCapabilityService.getFunnelState(tenantId);
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
// usePublicCouponOptionsCapability
// ====================

export function usePublicCouponOptionsCapability(
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
      const state = await publicUnifiedCapabilityService.getCouponOptionsState(tenantId);
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
// usePublicAllCapabilities
// ====================

export function usePublicAllCapabilities(
  tenantId: string | null
): CapabilityHookState<AllCapabilitiesState> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'public-capabilities', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return publicUnifiedCapabilityService.getAllCapabilities(tenantId);
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
// usePublicCapabilityFeatureCheck
// ====================

export function usePublicCapabilityFeatureCheck(
  tenantId: string | null,
  featureKey: string
): { enabled: boolean | null; loading: boolean } {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) {
      setEnabled(null);
      return;
    }

    setLoading(true);
    publicUnifiedCapabilityService.checkFeatureByCapability(tenantId, featureKey)
      .then((result: boolean | null) => setEnabled(result))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, [tenantId, featureKey]);

  return { enabled, loading };
}

// ====================
// usePublicConstraintViolations
// ====================

export function usePublicConstraintViolations(
  tenantId: string | null
): CapabilityHookState<ConstraintViolationState[]> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'public-capabilities', 'constraints', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await publicUnifiedCapabilityService.getAllCapabilities(tenantId);
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
// usePublicConstraintStatus
// ====================

export function usePublicConstraintStatus(
  tenantId: string | null
): CapabilityHookState<ConstraintStatusMapState> {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'public-capabilities', 'constraint-status', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await publicUnifiedCapabilityService.getAllCapabilities(tenantId);
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
