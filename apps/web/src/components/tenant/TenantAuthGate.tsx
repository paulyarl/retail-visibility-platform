"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui";

interface TenantAuthGateProps {
  children: ReactNode;
}

/**
 * Client-side authentication gate for tenant-scoped pages.
 * Mirrors the pattern used in /tenants/layout.tsx and /settings/layout.tsx:
 * - Checks useAuth() state
 * - Redirects to Auth0 login with returnTo if not authenticated
 * - Shows a spinner while auth is loading
 */
export default function TenantAuthGate({ children }: TenantAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, router, pathname]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
