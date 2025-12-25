"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AppShell from "@/components/app-shell/AppShell";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTenantScoped = pathname?.startsWith("/t/") || false;
  if (isTenantScoped) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
