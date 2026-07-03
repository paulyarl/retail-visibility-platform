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
  FaqOptionsState,
  CrmOptionsState,
  ChatbotOptionsState,
  SocialCommerceOptionsState,
  DirectoryPromotionState,
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
// CONTEXT SELECTION
// ====================

/**
 * All capability resolution now goes through UnifiedCapabilityService.
 * Previously selected between TenantCapabilityResolutionService (dashboard)
 * and CapabilityResolutionService (public) — both unified now.
 */
function getService(_forTenant: boolean) {
  return unifiedCapabilityService;
}

// ====================
// useCommerceCapability
// ====================

export function useCommerceCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<CommerceState> {
  const [data, setData] = useState<CommerceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getCommerceState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch commerce capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// usePaymentGatewayCapability
// ====================

export function usePaymentGatewayCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<PaymentGatewayState> {
  const [data, setData] = useState<PaymentGatewayState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getPaymentGatewayState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch payment gateway capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontCapability
// ====================

export function useStorefrontCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<StorefrontState> {
  const [data, setData] = useState<StorefrontState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getStorefrontState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useBarcodeScanCapability
// ====================

export function useBarcodeScanCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<BarcodeScanState> {
  const [data, setData] = useState<BarcodeScanState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getBarcodeScanState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch barcode scan capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFulfillmentCapability
// ====================

export function useFulfillmentCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<FulfillmentState> {
  const [data, setData] = useState<FulfillmentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getFulfillmentState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch fulfillment capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useProductTypeCapability
// ====================

export function useProductTypeCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<ProductTypeState> {
  const [data, setData] = useState<ProductTypeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getProductTypeState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch product type capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useProductOptionsCapability
// ====================

export function useProductOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<ProductOptionsState> {
  const [data, setData] = useState<ProductOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getProductOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch product options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFeaturedOptionsCapability
// ====================

export function useFeaturedOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<FeaturedOptionsState> {
  const [data, setData] = useState<FeaturedOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getFeaturedOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch featured options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useIntegrationOptionsCapability
// ====================

export function useIntegrationOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<IntegrationOptionsState> {
  const [data, setData] = useState<IntegrationOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getIntegrationOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch integration options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useQuickstartOptionsCapability
// ====================

export function useQuickstartOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<QuickstartOptionsState> {
  const [data, setData] = useState<QuickstartOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getQuickstartOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch quickstart options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useStorefrontOptionsCapability
// ====================

export function useStorefrontOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<StorefrontOptionsState> {
  const [data, setData] = useState<StorefrontOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getStorefrontOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storefront options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useFaqOptionsCapability
// ====================

export function useFaqOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<FaqOptionsState> {
  const [data, setData] = useState<FaqOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getFaqOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch FAQ options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useCrmOptionsCapability
// ====================

export function useCrmOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<CrmOptionsState> {
  const [data, setData] = useState<CrmOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getCrmOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch CRM options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useChatbotOptionsCapability
// ====================

export function useChatbotOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<ChatbotOptionsState> {
  const [data, setData] = useState<ChatbotOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getChatbotOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch chatbot options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useSocialCommerceOptionsCapability
// ====================

export function useSocialCommerceOptionsCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<SocialCommerceOptionsState> {
  const [data, setData] = useState<SocialCommerceOptionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getSocialCommerceOptionsState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch social commerce options capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useDirectoryPromotionCapability
// ====================

export function useDirectoryPromotionCapability(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<DirectoryPromotionState> {
  const [data, setData] = useState<DirectoryPromotionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getDirectoryPromotionState(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch directory promotion capability');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ====================
// useAllCapabilities
// ====================

export function useAllCapabilities(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<AllCapabilitiesState> {
  const service = getService(!!options?.forTenant);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return service.getAllCapabilities(tenantId);
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
  featureKey: string,
  options?: { forTenant?: boolean }
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
    const service = getService(!!options?.forTenant);
    service.checkFeatureByCapability(tenantId, featureKey)
      .then((result: boolean | null) => setEnabled(result))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, [tenantId, featureKey, options?.forTenant]);

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
  tenantId: string | null,
  options?: { forTenant?: boolean }
): { gates: Record<string, boolean>; loading: boolean } {
  const [gates, setGates] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    const service = getService(!!options?.forTenant);

    Promise.all([
      // Tier-allowed states from resolve service
      service.getCommerceState(tenantId).catch(() => null),
      service.getPaymentGatewayState(tenantId).catch(() => null),
      service.getStorefrontState(tenantId).catch(() => null),
      service.getBarcodeScanState(tenantId).catch(() => null),
      service.getFulfillmentState(tenantId).catch(() => null),
      service.getProductOptionsState(tenantId).catch(() => null),
      service.getFeaturedOptionsState(tenantId).catch(() => null),
      service.getIntegrationOptionsState(tenantId).catch(() => null),
      service.getQuickstartOptionsState(tenantId).catch(() => null),
      service.getStorefrontOptionsState(tenantId).catch(() => null),
      service.getFaqOptionsState(tenantId).catch(() => null),
      service.getCrmOptionsState(tenantId).catch(() => null),
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
        // Product options: no master switch — check if all tier-allowed types are disabled by merchant
        product_options: po && po.enabled && po.allowedTypes.length > 0
          ? poSettings
            ? po.allowedTypes.every(t => poSettings[`product_${t}_enabled`] === false)
            : po.effectiveTypes.length === 0
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
  }, [tenantId, options?.forTenant]);

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
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<ConstraintViolationState[]> {
  const service = getService(!!options?.forTenant);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'constraints', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await service.getAllCapabilities(tenantId);
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
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<ConstraintStatusMapState> {
  const service = getService(!!options?.forTenant);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'capabilities', 'constraint-status', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      const caps = await service.getAllCapabilities(tenantId);
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
