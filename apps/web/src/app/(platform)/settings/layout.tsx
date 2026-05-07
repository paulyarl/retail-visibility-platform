import { ReactNode } from 'react';
import { SettingsLayoutRouter } from '@/components/navigation/SettingsLayoutRouter';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsLayoutRouter>{children}</SettingsLayoutRouter>;
}
