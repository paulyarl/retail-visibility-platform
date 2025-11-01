"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AppShell from "@/components/app-shell/AppShell";

export default function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTenantScoped = pathname?.startsWith("/t/") || false;
  if (isTenantScoped) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
