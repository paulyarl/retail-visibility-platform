"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RememberTenantRoute({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    // Persist last visited tenant route per tenant
    if (pathname.startsWith(`/t/${tenantId}`)) {
      localStorage.setItem('last_tenant_route', pathname);
    }
  }, [pathname, tenantId]);
  return null;
}
