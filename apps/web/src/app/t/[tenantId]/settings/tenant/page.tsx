"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import TenantSettingsPage from "@/app/settings/tenant/page";

export default function TenantScopedSettingsPage() {
  const params = useParams<{ tenantId: string }>();

  useEffect(() => {
    const id = params?.tenantId;
    if (typeof window !== "undefined" && id) {
      localStorage.setItem("tenantId", id);
    }
  }, [params]);

  // Render the existing settings page component directly
  return <TenantSettingsPage />;
}
