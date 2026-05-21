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

import { useState, useEffect, useCallback } from 'react';
import {
  CapabilityResolutionService,
  TenantCapabilityResolutionService,
  CommerceState,
  PaymentGatewayState,
  StorefrontState,
  BarcodeScanState,
  AllCapabilitiesState,
  resolveCommerceState,
  resolvePaymentGatewayState,
  resolveStorefrontState,
  resolveBarcodeScanState,
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
 * Select the appropriate service based on context.
 * Customer pages (storefront, checkout) → CapabilityResolutionService
 * Tenant dashboard pages → TenantCapabilityResolutionService
 */
function getService(forTenant: boolean) {
  return forTenant
    ? TenantCapabilityResolutionService.getInstance()
    : CapabilityResolutionService.getInstance();
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
// useAllCapabilities
// ====================

export function useAllCapabilities(
  tenantId: string | null,
  options?: { forTenant?: boolean }
): CapabilityHookState<AllCapabilitiesState> {
  const [data, setData] = useState<AllCapabilitiesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const service = getService(!!options?.forTenant);
      const state = await service.getAllCapabilities(tenantId);
      setData(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch capabilities');
    } finally {
      setLoading(false);
    }
  }, [tenantId, options?.forTenant]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
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
