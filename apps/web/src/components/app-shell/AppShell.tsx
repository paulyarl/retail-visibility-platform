"use client";

import { useEffect, useState } from "react";
import TenantSwitcher from "./TenantSwitcher";
import SettingsSwitcher from "./SettingsSwitcher";
import NavLinks from "./NavLinks";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useSessionRestore } from "./hooks/useSessionRestore";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = usePlatformSettings();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  
  // Get current tenant ID from localStorage
  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantId(localStorage.getItem('tenantId'));
    }
  }, [user]);
  
  // Use extracted hooks for navigation and session restore
  const { links, tenantScopedLinksOn, hydrated } = useAppNavigation(tenantId);
  const restoreToast = useSessionRestore(tenantName);

  // Resolve current tenant name from user context
  useEffect(() => {
    if (tenantId && user?.tenants) {
      const found = user.tenants.find((t: any) => t.id === tenantId);
      if (found?.name) setTenantName(found.name);
    }
  }, [tenantId, user]);


  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
              {settings?.platformName || 'RVP'}
            </span>
            {hydrated ? (
              tenantName ? (
                <span className="text-xs sm:text-sm text-neutral-500 truncate hidden sm:inline">· {tenantName}</span>
              ) : null
            ) : (
              <span className="h-4 w-24 bg-neutral-200 rounded animate-pulse hidden sm:inline-block" />
            )}
            {hydrated && (
              <NavLinks
                links={links}
                tenantScopedLinksOn={tenantScopedLinksOn}
                className="hidden md:flex items-center gap-3 lg:gap-4 text-xs lg:text-sm text-neutral-600"
                itemClassName="hover:text-neutral-900 whitespace-nowrap"
              />
            )}
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {hydrated && user && <TenantSwitcher />}
            {hydrated && user && <SettingsSwitcher />}
            {hydrated && user ? (
              <>
                <Link href="/settings">
                  <Button variant="ghost" size="sm">Account</Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try { await logout(); } catch {}
                    if (typeof window !== 'undefined') window.location.href = '/';
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="secondary" size="sm">Sign In</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 space-y-2">
              {/* Mobile Navigation */}
              {hydrated && (
                <NavLinks
                  links={links}
                  tenantScopedLinksOn={tenantScopedLinksOn}
                  className="space-y-1"
                  itemClassName="block px-3 py-2 rounded-lg hover:bg-neutral-100 text-neutral-900 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                />
              )}

              {/* Mobile Tenant & Settings Switchers */}
              {hydrated && user && (
                <div className="pt-2 border-t border-neutral-200 space-y-2">
                  <TenantSwitcher />
                  <SettingsSwitcher />
                </div>
              )}

              {/* Mobile Actions */}
              <div className="pt-2 border-t border-neutral-200 space-y-2">
                {hydrated && user ? (
                  <>
                    <Link href="/settings" className="block" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start" size="md">Account</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      className="w-full"
                      size="md"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        try { await logout(); } catch {}
                        if (typeof window !== 'undefined') window.location.href = '/';
                      }}
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full" size="md">Sign In</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
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
