import { ReactNode } from 'react';
import { PlatformLayout } from '@/components/navigation/SidebarLayout';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformLayout>
      {children}
    </PlatformLayout>
  );
}
