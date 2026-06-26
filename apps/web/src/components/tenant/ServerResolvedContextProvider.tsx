"use client";

import React, { createContext, useContext, useMemo } from "react";

export interface ServerResolvedAuth {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
    auth0Id?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    onboardingCompleted?: boolean;
    tenants?: Array<{
      id: string;
      name: string;
      role: string;
      organizationId?: string;
    }>;
  } | null;
}

export interface ServerResolvedTenant {
  tenantId: string;
  tenantSlug: string | null;
  hasPublishedDirectory: boolean;
  aud: string | null;
  tenantInfo: any | null;
}

export interface ServerResolvedState {
  auth: ServerResolvedAuth;
  tenant: ServerResolvedTenant;
}

const ServerResolvedContext = createContext<ServerResolvedState | null>(null);

export function useServerResolved(): ServerResolvedState | null {
  return useContext(ServerResolvedContext);
}

export function useServerAuth(): ServerResolvedAuth | null {
  const state = useContext(ServerResolvedContext);
  return state?.auth ?? null;
}

export function useServerTenant(): ServerResolvedTenant | null {
  const state = useContext(ServerResolvedContext);
  return state?.tenant ?? null;
}

interface ServerResolvedContextProviderProps {
  auth: ServerResolvedAuth;
  tenant: ServerResolvedTenant;
  children: React.ReactNode;
}

export default function ServerResolvedContextProvider({
  auth,
  tenant,
  children,
}: ServerResolvedContextProviderProps) {
  const value = useMemo<ServerResolvedState>(
    () => ({ auth, tenant }),
    [auth, tenant]
  );

  return (
    <ServerResolvedContext.Provider value={value}>
      {children}
    </ServerResolvedContext.Provider>
  );
}
