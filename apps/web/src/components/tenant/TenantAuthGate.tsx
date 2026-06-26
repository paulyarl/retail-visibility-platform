"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useServerAuth } from "@/components/tenant/ServerResolvedContextProvider";
import { Spinner } from "@/components/ui";

interface TenantAuthGateProps {
  children: ReactNode;
}

/**
 * Client-side authentication gate for tenant-scoped pages.
 * Trusts server-resolved auth state from ServerResolvedContextProvider when available.
 * Falls back to useAuth() (client-side API call) when server state is not present.
 * - Redirects to Auth0 login with returnTo if not authenticated
 * - Shows a spinner while auth is loading
 */
export default function TenantAuthGate({ children }: TenantAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const serverAuth = useServerAuth();
  const hasRedirectedRef = useRef(false);

  // If server already confirmed authentication, trust it immediately — no redirect, no spinner
  const serverConfirmed = serverAuth?.isAuthenticated === true;

  useEffect(() => {
    // Skip redirect logic if server already confirmed auth
    if (serverConfirmed) return;
    if (!authLoading && !isAuthenticated && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      console.log('[TenantAuthGate] REDIRECT to login — not authenticated');
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, router, pathname, serverConfirmed]);

  if (serverConfirmed) {
    return <>{children}</>;
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
