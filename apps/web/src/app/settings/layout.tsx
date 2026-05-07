"use client";

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';

/**
 * Authentication gate for /settings routes outside (platform)
 * Redirects unauthenticated users to login
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, isAuthenticated, router, pathname]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
