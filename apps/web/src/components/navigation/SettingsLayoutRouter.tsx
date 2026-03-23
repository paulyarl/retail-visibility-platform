"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { UniversalNavContent } from './UniversalNavContent';
import { AdminNavContent } from './AdminNavContent';
import { useNavLinks } from '@/hooks/useNavLinks';

interface SettingsLayoutRouterProps {
  children: ReactNode;
}

/**
 * Routes to the correct sidebar based on the current settings path:
 * - /settings/admin/* → AdminNavContent (platform admin sidebar)
 * - /settings/*       → UniversalNavContent (all-users sidebar)
 *
 * Fetches persisted nav links from the Navigation Control Panel and passes
 * the target-filtered slice to each sidebar as injectedItems.
 */
export function SettingsLayoutRouter({ children }: SettingsLayoutRouterProps) {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith('/settings/admin');
  const { adminLinks, allLinks } = useNavLinks();

  if (isAdminPath) {
    return <AdminNavContent injectedItems={adminLinks}>{children}</AdminNavContent>;
  }

  return <UniversalNavContent injectedItems={allLinks}>{children}</UniversalNavContent>;
}
