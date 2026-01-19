import { ReactNode } from 'react';
import { AdminNavContent } from '@/components/navigation/AdminNavContent';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AdminNavContent>{children}</AdminNavContent>;
}
