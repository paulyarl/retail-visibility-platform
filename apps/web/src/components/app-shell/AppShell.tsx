"use client";

import { useEffect, useState } from "react";
import TenantSwitcher from "./TenantSwitcher";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = usePlatformSettings();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [links, setLinks] = useState<{ dashboard: string; inventory: string; tenants: string; settings: string }>({
    dashboard: "/",
    inventory: "/items",
    tenants: "/tenants",
    settings: "/settings",
  });
  const [hydrated, setHydrated] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [restoreToast, setRestoreToast] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Evaluate FF on client, using tenantId hint from localStorage
    const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") || undefined : undefined;
    // Dev/test override: localStorage.ff_app_shell_nav = 'on'
    const override = typeof window !== 'undefined' ? localStorage.getItem('ff_app_shell_nav') === 'on' : false;
    const shellOn = override || isFeatureEnabled("FF_APP_SHELL_NAV", tenantId);
    setEnabled(shellOn);

    // Compute tenant-scoped links when FF_TENANT_URLS is enabled
    const tenantUrlsOverride = typeof window !== 'undefined' ? localStorage.getItem('ff_tenant_urls') === 'on' : false;
    const tenantUrlsOn = tenantUrlsOverride || isFeatureEnabled("FF_TENANT_URLS", tenantId);
    if (tenantUrlsOn && tenantId) {
      setLinks({
        dashboard: `/t/${tenantId}/dashboard`,
        inventory: `/t/${tenantId}/items`,
        tenants: "/tenants",
        settings: `/t/${tenantId}/settings`,
      });
    } else {
      setLinks({ dashboard: "/", inventory: "/items", tenants: "/tenants", settings: "/settings" });
    }

    // Resolve current tenant name from user context
    if (tenantId && user?.tenants) {
      const found = user.tenants.find((t: any) => t.id === tenantId);
      if (found?.name) setTenantName(found.name);
    }

    setHydrated(true);
  }, [user]);

  // Show a subtle toast when session was restored after login
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const data = sessionStorage.getItem('restored_from_login');
    if (data) {
      try {
        const parsed = JSON.parse(data) as { path?: string; tenantId?: string };
        setRestoreToast(`Restored session${tenantName ? ` · ${tenantName}` : ''}${parsed?.path ? ` → ${parsed.path}` : ''}`);
      } catch {
        setRestoreToast('Session restored');
      }
      sessionStorage.removeItem('restored_from_login');
      const t = setTimeout(() => setRestoreToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [tenantName]);

  // Don't show AppShell if feature flag is disabled OR user is not authenticated
  if (!enabled || !user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-neutral-900">
              {settings?.platformName || 'RVP'}
            </span>
            {hydrated ? (
              tenantName ? (
                <span className="text-sm text-neutral-500">· {tenantName}</span>
              ) : null
            ) : (
              <span className="inline-block h-4 w-24 bg-neutral-200 rounded animate-pulse" />
            )}
            <nav className="hidden md:flex items-center gap-4 text-sm text-neutral-600">
              <a className="hover:text-neutral-900" href={links.dashboard}>Dashboard</a>
              <a className="hover:text-neutral-900" href={links.inventory}>Inventory</a>
              <a className="hover:text-neutral-900" href={links.tenants}>Tenants</a>
              <a className="hover:text-neutral-900" href={links.settings}>Settings</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <TenantSwitcher />
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      {restoreToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-3 py-2 bg-neutral-900 text-white text-xs rounded shadow-lg opacity-90">
            {restoreToast}
          </div>
        </div>
      )}
    </div>
  );
}
