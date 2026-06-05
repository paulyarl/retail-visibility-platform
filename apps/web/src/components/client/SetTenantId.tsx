"use client";

import { useEffect } from "react";
import { clientTenantContextManager } from "@/lib/clientTenantContext";

export default function SetTenantId({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    try {
      if (tenantId && typeof window !== "undefined") {
        // Use centralized tenant context manager for consistency
        clientTenantContextManager.setTenantContext(tenantId, 'url_param' as any);
      }
    } catch {}
  }, [tenantId]);

  return null;
}
