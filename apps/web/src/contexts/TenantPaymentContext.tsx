"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { tenantInfoService } from '@/services/TenantInfoService';

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
      
      const paymentGateways = await tenantInfoService.getPaymentGateways(tenantId);
      
      // Check if any gateway is active
      const hasActiveGateway = paymentGateways.some(gw => gw.isActive !== false);
      
      // Find default gateway type
      const defaultGateway = paymentGateways.find(gw => gw.isDefault);
      
      setCanPurchase(hasActiveGateway);
      setDefaultGatewayType(defaultGateway?.type);
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
