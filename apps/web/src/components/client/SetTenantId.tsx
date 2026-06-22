"use client";

import { useEffect, useRef } from "react";
import { clientTenantContextManager } from "@/lib/clientTenantContext";

export default function SetTenantId({ tenantId }: { tenantId: string }) {
  const hasSetRef = useRef(false);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[SetTenantId] effect at ${timestamp} tenantId=${tenantId} hasSet=${hasSetRef.current}`);
    
    // Only set once to prevent repeated calls
    if (hasSetRef.current) {
      console.log(`[SetTenantId] skipping - already set at ${timestamp}`);
      return;
    }
    hasSetRef.current = true;

    try {
      if (tenantId && typeof window !== "undefined") {
        console.log(`[SetTenantId] setting tenant context at ${timestamp}`);
        // Use centralized tenant context manager for consistency
        clientTenantContextManager.setTenantContext(tenantId, 'url_param' as any);
      }
    } catch (err) {
      console.error(`[SetTenantId] error at ${timestamp}:`, err);
    }
  }, [tenantId]);

  return null;
}
