import { ReactNode } from 'react';
import { TenantLayout } from '@/components/navigation/SidebarLayout';

export default function TenantSettingsLayout({ children }: { children: ReactNode }) {
  return <TenantLayout>{children}</TenantLayout>;
}
