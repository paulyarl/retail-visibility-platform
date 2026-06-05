"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TenantScopedAccountPage() {
  const params = useParams<{ tenantId: string }>();
  const router = useRouter();

  useEffect(() => {
    const id = params?.tenantId;
    if (typeof window !== "undefined" && id) {
      localStorage.setItem("tenantId", id);
    }
    // Redirect to legacy account/settings hub for now
    router.replace("/settings");
  }, [params, router]);

  return null;
}
