'use client'

import { createContext, useContext, ReactNode } from 'react';

interface SidebarExtraItem {
  label: string;
  href: string;
}

interface TenantSidebarExtrasContextType {
  extras: SidebarExtraItem[];
}

const TenantSidebarExtrasContext = createContext<TenantSidebarExtrasContextType | null>(null);

export function TenantSidebarExtrasProvider({
  extras = [],
  children,
}: {
  extras?: SidebarExtraItem[];
  children: ReactNode;
}) {
  return (
    <TenantSidebarExtrasContext.Provider value={{ extras }}>
      {children}
    </TenantSidebarExtrasContext.Provider>
  );
}

export function useTenantSidebarExtras() {
  const context = useContext(TenantSidebarExtrasContext);
  return context?.extras || [];
}
