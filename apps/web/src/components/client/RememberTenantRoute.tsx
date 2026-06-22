"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";



export default function RememberTenantRoute({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[RememberTenantRoute] effect at ${timestamp} pathname=${pathname} tenantId=${tenantId} lastPathname=${lastPathnameRef.current}`);
    
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    
    // Only update if pathname actually changed
    if (pathname === lastPathnameRef.current) {
      console.log(`[RememberTenantRoute] skipping - pathname unchanged at ${timestamp}`);
      return;
    }
    lastPathnameRef.current = pathname;
    
    // Persist last visited tenant route per tenant
    if (pathname.startsWith(`/t/${tenantId}`)) {
      console.log(`[RememberTenantRoute] setting localStorage at ${timestamp}`);
      localStorage.setItem('last_tenant_route', pathname);
    }
  }, [pathname, tenantId]);
  return null;
}
