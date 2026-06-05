import { ReactNode } from 'react';

// Admin sidebar is rendered by SettingsLayoutRouter in the parent settings/layout.tsx
export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
