"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


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
