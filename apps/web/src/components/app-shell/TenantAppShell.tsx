"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import MobileCapacityIndicator from "@/components/capacity/MobileCapacityIndicator";
import { GlobalAlertBar } from "@/components/ui/GlobalAlertProvider";
import { Settings, LogOut, ArrowLeft, Store, Menu, X } from "lucide-react";
import SidebarLayout from "@/components/navigation/SidebarLayout";
import TenantSwitcher from "@/components/app-shell/TenantSwitcher";

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

type NavItem = { 
  label: string
  href: string
  icon?: React.ReactNode
  badge?: {
    text: string
    variant: 'default' | 'success' | 'warning' | 'error' | 'org'
  }
  children?: NavItem[]
  accessLevel?: 'public' | 'user' | 'admin' | 'owner'
}

interface TenantInfo {
  id: string;
  name: string;
  logo?: string;
  subdomain?: string;
}

interface TenantAppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
}

export default function TenantAppShell({ children, navItems }: TenantAppShellProps) {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;
  const { settings } = usePlatformSettings();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch tenant information for branding
  useEffect(() => {
    const fetchTenantInfo = async () => {
      if (!tenantId) return;
      
      try {
        // Fetch tenant basic info
        const res = await apiRequest(`/api/tenants/${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          
          // Fetch business profile for logo
          let logoUrl = null;
          try {
            const profileRes = await apiRequest(`/api/tenant/profile?tenant_id=${tenantId}`);
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              logoUrl = profileData.logo_url;
            }
          } catch (profileError) {
            console.error('Failed to fetch business profile:', profileError);
          }
          
          setTenantInfo({
            id: data.id,
            name: data.name,
            logo: logoUrl, // Use logo from business profile
            subdomain: data.subdomain,
          });
        }
      } catch (error) {
        console.error('Failed to fetch tenant info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantInfo();
  }, [tenantId]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleBackToPlatform = () => {
    router.push('/');
  };

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50">
      {/* Fixed Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        {/* Main Header Row */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Mobile Sidebar Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1 h-8 w-8"
              title="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Back to Platform */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToPlatform}
              className="hidden sm:flex p-1 h-8 w-8"
              title="Back to Platform Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Tenant Branding */}
            {tenantInfo?.logo ? (
              <img
                src={tenantInfo.logo}
                alt={tenantInfo.name || 'Store Logo'}
                className="h-8 w-auto object-contain"
                loading="lazy"
                decoding="async"
                width="32"
                height="32"
                style={{ aspectRatio: 'auto' }}
                onError={(e) => {
                  // Hide broken images and show fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-8 w-8 bg-neutral-200 rounded-lg flex items-center justify-center">
                <Store className="h-4 w-4 text-neutral-500" />
              </div>
            )}

            {/* Tenant Switcher - Only show if user has multiple tenants */}
            {user && user.tenants && user.tenants.length > 1 && (
              <div className="hidden sm:block">
                <TenantSwitcher />
              </div>
            )}

            {/* Fallback tenant name when no switcher */}
            {(!user || !user.tenants || user.tenants.length <= 1) && (
              <span className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
                {loading ? (
                  <span className="h-4 w-24 bg-neutral-200 rounded animate-pulse inline-block" />
                ) : (
                  tenantInfo?.name || 'Store'
                )}
              </span>
            )}

            {/* Capacity Indicator */}
            {!loading && tenantInfo && (
              <MobileCapacityIndicator tenantId={tenantId} showText={false} className="ml-1" />
            )}

            {/* Platform Badge */}
            {settings?.platformName && (
              <span className="text-xs text-neutral-500 truncate hidden sm:inline">
                · {settings.platformName}
              </span>
            )}
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {user && (
              <>
                <Link href={`/t/${tenantId}/settings`}>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </>
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white">
            <div className="px-3 sm:px-4 py-3 space-y-2">
              {/* Mobile Tenant Switcher */}
              {user && user.tenants && user.tenants.length > 1 && (
                <div className="py-2 border-b border-neutral-100">
                  <TenantSwitcher />
                </div>
              )}
              
              {user && (
                <>
                  <Link href={`/t/${tenantId}/settings`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Global Alert Bar */}
      <GlobalAlertBar />

      {/* Main Content with Sidebar */}
      <div className="flex flex-1">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed md:sticky top-14 left-0 h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-7rem)]
          w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700
          transform transition-transform duration-200 ease-in-out
          z-30 md:z-20
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <SidebarLayout
            navItems={navItems}
            scope="tenant"
            collapsible={true}
          >
            <div /> {/* Empty content - we only need the sidebar navigation */}
          </SidebarLayout>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
