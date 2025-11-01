"use client";

import React, { createContext, useContext } from 'react';

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
