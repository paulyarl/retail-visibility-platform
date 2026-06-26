"use client";

import { useEffect, useRef } from "react";
import { clientTenantContextManager } from "@/lib/clientTenantContext";

export default function SetTenantId({ tenantId }: { tenantId: string }) {
  const hasSetRef = useRef(false);

  useEffect(() => {
    // Only set once to prevent repeated calls
    if (hasSetRef.current) {
      return;
    }
    hasSetRef.current = true;

    try {
      if (tenantId && typeof window !== "undefined") {
        // Use centralized tenant context manager for consistency
        clientTenantContextManager.setTenantContext(tenantId, 'url_param' as any);
      }
    } catch (err) {
      console.error('[SetTenantId] error:', err);
    }
  }, [tenantId]);

  return null;
}
