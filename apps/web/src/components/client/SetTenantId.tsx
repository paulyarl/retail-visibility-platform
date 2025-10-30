"use client";

import { useEffect } from "react";

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
