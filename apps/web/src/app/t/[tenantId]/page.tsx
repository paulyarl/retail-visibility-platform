"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TenantScopedDashboardPage() {
  const params = useParams<{ tenantId: string }>();
  const router = useRouter();

  useEffect(() => {
    const id = params?.tenantId;
    if (typeof window !== "undefined" && id) {
      localStorage.setItem("tenantId", id);
    }
    // Reuse legacy dashboard page for now
    router.replace("/");
  }, [params, router]);

  return null;
}
