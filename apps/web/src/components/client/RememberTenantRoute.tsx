"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

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
