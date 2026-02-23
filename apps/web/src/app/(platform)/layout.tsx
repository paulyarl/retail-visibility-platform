import React from "react";
import AppShell from "@/components/app-shell/AppShell";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformSettingsProvider>
      <AppShell>{children}</AppShell>
    </PlatformSettingsProvider>
  );
}
