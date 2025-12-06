import { ReactNode } from 'react';
import { AdminLayout } from '@/components/navigation/SidebarLayout';

export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
