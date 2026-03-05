"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';

interface TenantPaymentContextValue {
  canPurchase: boolean;
  defaultGatewayType?: string;
  loading: boolean;
  error?: string;
  refreshPaymentStatus: () => Promise<void>;
}

const TenantPaymentContext = createContext<TenantPaymentContextValue | undefined>(undefined);

interface TenantPaymentProviderProps {
  tenantId: string;
  children: ReactNode;
}

export function TenantPaymentProvider({ tenantId, children }: TenantPaymentProviderProps) {
  const [canPurchase, setCanPurchase] = useState(false);
  const [defaultGatewayType, setDefaultGatewayType] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

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
      console.error('Failed to check payment gateway:', err);
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

  const value: TenantPaymentContextValue = {
    canPurchase,
    loading,
    error,
    defaultGatewayType,
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
