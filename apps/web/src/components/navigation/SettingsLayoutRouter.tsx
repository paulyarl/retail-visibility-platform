"use client";

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UniversalNavContent } from './UniversalNavContent';
import { AdminNavContent } from './AdminNavContent';
import { useNavLinks } from '@/hooks/useNavLinks';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';

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
 *
 * GATES ACCESS: Requires authentication for all settings routes.
 */
export function SettingsLayoutRouter({ children }: SettingsLayoutRouterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdminPath = pathname.startsWith('/settings/admin');
  const { adminLinks, allLinks } = useNavLinks();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, router, pathname]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAdminPath) {
    return <AdminNavContent injectedItems={adminLinks}>{children}</AdminNavContent>;
  }

  return <UniversalNavContent injectedItems={allLinks}>{children}</UniversalNavContent>;
}
