import { ReactNode } from 'react';

// This layout is intentionally empty to avoid double sidebar nesting
// The parent layout at /settings/layout.tsx handles all navigation
export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
