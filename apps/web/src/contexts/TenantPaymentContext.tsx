"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
// Hooks replaced by server-fetched props to eliminate client-side waterfall
// import { useCommerceCapability, usePaymentGatewayCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { clientLogger } from '@/lib/client-logger';

interface TenantPaymentContextValue {
  canPurchase: boolean;
  defaultGatewayType?: string;
  loading: boolean;
  error?: string;
  commerceDisabled?: boolean;
  refreshPaymentStatus: () => Promise<void>;
}

const TenantPaymentContext = createContext<TenantPaymentContextValue | undefined>(undefined);

interface TenantPaymentProviderProps {
  tenantId: string;
  children: ReactNode;
  // Server-fetched capability props (eliminates client-side waterfall)
  initialCommerceSettings?: { enabled?: boolean } | null;
  initialPaymentGatewaySettings?: { enabled?: boolean; gateway_enabled?: boolean } | null;
}

export function TenantPaymentProvider({ tenantId, children, initialCommerceSettings, initialPaymentGatewaySettings }: TenantPaymentProviderProps) {
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Capability-aware commerce and payment gateway resolution — from server-fetched props
  const commerceCap = {
    data: initialCommerceSettings ? { enabled: initialCommerceSettings.enabled ?? true } : undefined,
    loading: false,
  };
  const paymentCap = {
    data: initialPaymentGatewaySettings ? { enabled: initialPaymentGatewaySettings.enabled ?? initialPaymentGatewaySettings.gateway_enabled ?? true } : undefined,
    loading: false,
  };

  const checkPurchaseAbility = async () => {
    try {
      setLoading(true);
      setError(undefined);
      
      const paymentGateways = await publicTenantInfoService.getPaymentGateways(tenantId);
      
      // Check if any gateway is active - check both camelCase and snake_case
      const hasActiveGateway = paymentGateways.some(gw => 
        gw.isActive !== false && gw.is_active !== false
      );
      
      // Find default gateway type - check both camelCase and snake_case
      const defaultGateway = paymentGateways.find(gw => gw.isDefault || gw.is_default);
      const gatewayType = defaultGateway?.gatewayType || defaultGateway?.gateway_type || defaultGateway?.type;
      
      setCanPurchase(hasActiveGateway);
      setDefaultGatewayType(gatewayType);
    } catch (err) {
      clientLogger.error('Failed to check payment gateway:', { detail: err });
      setCanPurchase(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const refreshPaymentStatus = async () => {
    await checkPurchaseAbility();
  };

  useEffect(() => {
    if (tenantId) {
      checkPurchaseAbility();
    }
  }, [tenantId]);

  // Capability-aware override: commerce must be enabled AND gateway must be active
  const commerceEnabled = commerceCap.data?.enabled ?? true; // default to true while loading
  const commerceDisabled = commerceCap.data ? !commerceCap.data.enabled : false;
  const gatewayCapEnabled = paymentCap.data ? paymentCap.data.enabled : true; // default to true while loading
  const effectiveCanPurchase = canPurchase && commerceEnabled && gatewayCapEnabled;

  const value: TenantPaymentContextValue = {
    canPurchase: effectiveCanPurchase,
    loading: loading || commerceCap.loading || paymentCap.loading,
    error,
    defaultGatewayType,
    commerceDisabled,
    refreshPaymentStatus
  };

  return (
    <TenantPaymentContext.Provider value={value}>
      {children}
    </TenantPaymentContext.Provider>
  );
}

export function useTenantPayment() {
  const context = useContext(TenantPaymentContext);
  if (context === undefined) {
    throw new Error('useTenantPayment must be used within a TenantPaymentProvider');
  }
  return context;
}

// Optional hook that doesn't require provider (for backward compatibility)
export function useTenantPaymentOptional() {
  const context = useContext(TenantPaymentContext);
  return context;
}
