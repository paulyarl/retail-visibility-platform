"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface TenantPaymentContextValue {
  canPurchase: boolean;
  defaultGatewayType?: string;
  loading: boolean;
  error?: string;
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

  useEffect(() => {
    const checkPurchaseAbility = async () => {
      try {
        setLoading(true);
        setError(undefined);
        
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/tenants/${tenantId}/payment-gateway`);
        
        if (response.ok) {
          const data = await response.json();
          setCanPurchase(data.hasActiveGateway || false);
          setDefaultGatewayType(data.defaultGatewayType || undefined);
        } else {
          setCanPurchase(false);
          setError('Failed to check payment gateway');
        }
      } catch (err) {
        console.error('Failed to check payment gateway:', err);
        setCanPurchase(false);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      checkPurchaseAbility();
    }
  }, [tenantId]);

  return (
    <TenantPaymentContext.Provider value={{ canPurchase, defaultGatewayType, loading, error }}>
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
