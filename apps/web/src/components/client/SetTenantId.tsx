"use client";

import { useEffect } from "react";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function SetTenantId({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    try {
      if (tenantId && typeof window !== "undefined") {
        localStorage.setItem("tenantId", tenantId);
      }
    } catch {}
  }, [tenantId]);

  return null;
}
