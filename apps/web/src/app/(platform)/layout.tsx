import React from "react";
import AppShell from "@/components/app-shell/AppShell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
