import { useState, useEffect } from 'react';

/**
 * Hook to show a toast notification when session is restored after login
 * Reads from sessionStorage and auto-dismisses after 4 seconds
 */
export function useSessionRestore(tenantName: string | null): string | null {
  const [restoreToast, setRestoreToast] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const data = sessionStorage.getItem('restored_from_login');
    if (!data) return;

    try {
      const parsed = JSON.parse(data) as { path?: string; tenantId?: string };
      const message = `Restored session${tenantName ? ` · ${tenantName}` : ''}${parsed?.path ? ` → ${parsed.path}` : ''}`;
      setRestoreToast(message);
    } catch {
      setRestoreToast('Session restored');
    }

    sessionStorage.removeItem('restored_from_login');

    const timer = setTimeout(() => setRestoreToast(null), 4000);
    return () => clearTimeout(timer);
  }, [tenantName]);

  return restoreToast;
}
