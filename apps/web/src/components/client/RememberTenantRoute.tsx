"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";



export default function RememberTenantRoute({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    
    // Only update if pathname actually changed
    if (pathname === lastPathnameRef.current) {
      return;
    }
    lastPathnameRef.current = pathname;
    
    // Persist last visited tenant route per tenant
    if (pathname.startsWith(`/t/${tenantId}`)) {
      localStorage.setItem('last_tenant_route', pathname);
    }
  }, [pathname, tenantId]);
  return null;
}
