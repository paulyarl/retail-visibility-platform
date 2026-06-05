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
import MobileCapacityIndicator from "@/components/capacity/MobileCapacityIndicator";
import { GlobalAlertBar } from "@/components/ui/GlobalAlertProvider";
import ShellWithTicker from "@/components/layout/ShellWithTicker";
import { Button } from "@mantine/core";


export default function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = usePlatformSettings();
  const { user, logout, isAuthenticated } = useAuth();
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
  const { links, tenantScopedLinksOn, hydrated } = useAppNavigation({
    tenantId
  });
  const restoreToast = useSessionRestore(tenantName);

  // Resolve current tenant name from user context
  useEffect(() => {
    if (tenantId && user?.tenants) {
      const found = user.tenants.find((t: any) => t.id === tenantId);
      if (found?.name) setTenantName(found.name);
    }
  }, [tenantId, user]);


  // Don't render children if not authenticated


  return (
    <ShellWithTicker shellHeader={
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        {/* Main Header Row */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding & Navigation */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Logo */}
              {settings?.logoUrl && (
                <Link href="/" title={settings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} >
                  <img
                    src={settings.logoUrl}
                    alt={settings.platformName || 'Platform Logo'}
                    className="h-8 w-auto object-contain"
                    loading="lazy"
                    decoding="async"
                    width="32"
                    height="32"
                    style={{ aspectRatio: 'auto' }}
                    onError={(e) => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </Link>
              )}
              <span className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
                <Link href="/" title={settings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} >
                  {settings?.platformName || 'Visible Shelf'}
                </Link>
              </span>
              {/* Visual separator between branding and navigation */}
              <div className="hidden md:block w-px h-4 bg-neutral-300 mx-2" />
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
              {hydrated && user ? (
                <>
                  <Link href="/settings/account">
                    <Button
                      variant='gradient' style={{ color: 'yellow' }}
                      size="sm"
                      className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Account
                    </Button>
                  </Link>
                  <Button
                    variant='gradient' style={{ color: 'white' }}
                    size="sm"
                    className="bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-600 border border-neutral-300 hover:border-red-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                    onClick={async () => {
                      try { await logout(); } catch { }
                      if (typeof window !== 'undefined') window.location.href = '/';
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </Button>
                </>
              ) : (
                <Link href="/auth/login">
                  <Button
                    variant='gradient' style={{ color: 'white' }}
                    size="sm"
                    className="bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
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

          {/* Switcher Row - All Screen Sizes */}
          {hydrated && user && (
            <div className="border-t border-neutral-200 bg-neutral-50">
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2 flex items-center justify-end gap-3 overflow-x-auto">
                <TenantSwitcher />
                <SettingsSwitcher />
              </div>
            </div>
          )}

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

                {/* Mobile Actions */}
                <div className="pt-2 border-t border-neutral-200 space-y-2">
                  {hydrated && user ? (
                    <>
                      <Link href="/settings/account" className="block" onClick={() => setMobileMenuOpen(false)}>
                        <Button
                          variant='gradient' style={{ color: 'yellow' }}
                          className="w-full justify-start flex items-center gap-2 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                          size="md"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Account
                        </Button>
                      </Link>
                      <Button
                        variant='gradient' style={{ color: 'white' }}
                        className="w-full bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-600 border border-neutral-300 hover:border-red-300 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                        size="md"
                        onClick={async () => {
                          setMobileMenuOpen(false);
                          try { await logout(); } catch { }
                          if (typeof window !== 'undefined') window.location.href = '/';
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <Link href="/auth/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                      <Button
                        variant='gradient' style={{ color: 'white' }}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                        size="md"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Sign In
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Alert Bar - Shows rate limit and other important alerts */}
        <GlobalAlertBar />
      </header>
    }>
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
    </ShellWithTicker>
  );
}
