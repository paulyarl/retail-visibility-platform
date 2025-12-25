"use client";

import React, { createContext, useContext } from 'react';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export type TenantContextShape = {
  tenantId: string | null;
  tenantSlug?: string | null;
  aud?: string | null;
};


export const TenantContext = createContext<TenantContextShape>({ tenantId: null });


export function useTenant() {
  return useContext(TenantContext);
}


export default function TenantContextProvider({ value, children }: { value: TenantContextShape; children: React.ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
