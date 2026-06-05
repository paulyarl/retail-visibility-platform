import React from "react";
import AppShell from "@/components/app-shell/AppShell";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";

// Prevent static generation for all platform routes (Mantine requires dynamic rendering)
export const dynamic = 'force-dynamic';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformSettingsProvider>
      <AppShell>{children}</AppShell>
    </PlatformSettingsProvider>
  );
}
