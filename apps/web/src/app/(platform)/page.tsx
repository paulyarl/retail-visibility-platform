"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, AnimatedCard } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { useDashboardData } from "@/hooks/useDashboardData";
import { motion } from "framer-motion";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import Image from "next/image";
import { canManageTenantSettings } from "@/lib/auth/access-control";
import PublicFooter from "@/components/PublicFooter";
import FeaturesShowcase, { ShowcaseMode } from "@/components/FeaturesShowcase";
import { computeStoreStatus } from "@/lib/hours-utils";

export default function PlatformHomePage() {
  return <Home embedded />;
}

function Home({ embedded = false }: { embedded?: boolean } = {}) {
  const { settings } = usePlatformSettings();
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();
  const router = useRouter();
  
  // Use optimized dashboard data hook
  const { data: dashboardData, loading, error } = useDashboardData(isAuthenticated, authLoading);
  
  const [scopedLinks, setScopedLinks] = useState<{ items: string; createItem: string; tenants: string; settingsTenant: string }>({
    items: "/items",
    createItem: "/items?create=true",
    tenants: "/tenants",
    settingsTenant: "/settings",
  });
  const [hoursInfo, setHoursInfo] = useState<{ hasHours: boolean; today?: string } | null>(null);
  const [tenantData, setTenantData] = useState<{ name: string; logoUrl?: string; bannerUrl?: string } | null>(null);
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>('hybrid');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState({
    activeRetailers: 0,
    activeRetailersFormatted: '0',
    productsListed: 0,
    productsListedFormatted: '0',
    storefrontsLive: 0,
    storefrontsLiveFormatted: '0',
    platformUptime: 99.9,
    platformUptimeFormatted: '99.9%',
  });
  
  // Extract stats from dashboard data
  const stats = {
    total: dashboardData?.stats?.totalItems || 0,
    active: dashboardData?.stats?.activeItems || 0,
    syncIssues: dashboardData?.stats?.syncIssues || 0,
    locations: dashboardData?.stats?.locations || 0,
    isChain: dashboardData?.isChain || false,
    organizationName: dashboardData?.organizationName || null,
  };
  const selectedTenantId = dashboardData?.tenant?.id || null;
  
  // Fetch public platform stats for visitors
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      const fetchPlatformStats = async () => {
        try {
          // Call backend API directly (public endpoint, no auth needed)
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
          const response = await fetch(`${API_BASE_URL}/api/platform-stats`);
          if (response.ok) {
            const data = await response.json();
            setPlatformStats(data);
          }
        } catch (error) {
          // Silently fail - platform stats are non-critical for user experience
          console.warn('[Platform Stats] Failed to load public stats, using defaults');
        }
      };
      fetchPlatformStats();
    }
  }, [isAuthenticated, authLoading]);

  // Fetch showcase mode configuration
  useEffect(() => {
    const fetchShowcaseConfig = async () => {
      try {
        // Check for preview mode in URL
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const preview = params.get('preview_showcase') as ShowcaseMode;
          if (preview) {
            setShowcaseMode(preview);
            return;
          }
        }

        // Fetch from public endpoint (no auth needed for reading)
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${API_BASE_URL}/api/public/features-showcase-config`);
        if (response.ok) {
          const data = await response.json();
          setShowcaseMode(data.mode || 'hybrid');
        }
      } catch (error) {
        // Silently fail - showcase config is non-critical, defaults to 'hybrid'
        console.warn('[Showcase Config] Failed to load config, using hybrid mode');
        setShowcaseMode('hybrid');
      }
    };
    fetchShowcaseConfig();
  }, []);

  // Fetch tenant business hours when a tenant is selected
  useEffect(() => {
    const fetchHours = async () => {
      try {
        if (!selectedTenantId) { setHoursInfo(null); return; }
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await fetch(`${API_BASE_URL}/public/tenant/${selectedTenantId}/profile`, { cache: 'no-store' });
        if (!res.ok) { setHoursInfo(null); return; }
        const prof = await res.json();
        const hours = prof?.hours;
        let hasHours = false;
        if (Array.isArray(hours)) hasHours = hours.length > 0;
        else if (hours && typeof hours === 'object') hasHours = Object.keys(hours).filter(k => k !== 'timezone' && k !== 'special').length > 0;

        // Use shared utility to compute store status (handles special hours too!)
        const status = computeStoreStatus(hours);
        const today = status?.label;

        setHoursInfo({ hasHours, today });
      } catch {
        setHoursInfo(null);
      }
    };
    fetchHours();
  }, [selectedTenantId]);
  
  // Fetch tenant details (logo/banner) when tenant ID is available
  useEffect(() => {
    const fetchTenantDetails = async () => {
      if (!selectedTenantId) return;
      
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const tenantRes = await api.get(`${apiBaseUrl}/tenants/${selectedTenantId}`);
        if (tenantRes.ok) {
          const tenantInfo = await tenantRes.json();
          setTenantData({
            name: tenantInfo.name,
            logoUrl: tenantInfo.metadata?.logo_url,
            bannerUrl: tenantInfo.metadata?.banner_url,
          });
        }
      } catch (error) {
        // Silently fail - tenant details are non-critical for dashboard
        console.warn('[Tenant Details] Failed to load logo/banner, continuing without them');
      }
    };
    
    fetchTenantDetails();
  }, [selectedTenantId]);

  // Compute tenant-scoped quick action links independently for faster UI readiness
  useLayoutEffect(() => {
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') || undefined : undefined;
    const override = typeof window !== 'undefined' ? localStorage.getItem('ff_tenant_urls') === 'on' : false;
    const on = override || isFeatureEnabled('FF_TENANT_URLS', tenantId);
    if (on && tenantId) {
      setScopedLinks({
        items: `/t/${tenantId}/items`,
        createItem: `/t/${tenantId}/items?create=true`,
        tenants: `/tenants`,
        settingsTenant: `/t/${tenantId}/settings`,
      });
    } else {
      setScopedLinks({ items: "/items", createItem: "/items?create=true", tenants: "/tenants", settingsTenant: "/settings" });
    }
  }, []);
  
  // Animated counts for metrics
  const inventoryCount = useCountUp(stats.total);
  const listingsCount = useCountUp(stats.active);
  const syncIssuesCount = useCountUp(stats.syncIssues);
  const locationsCount = useCountUp(stats.locations);
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {!embedded && (
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {settings?.logoUrl ? (
                <Link href="/">
                  <Image
                    src={settings.logoUrl}
                    alt={settings.platformName || 'Platform Logo'}
                    width={150}
                    height={40}
                    className="h-8 sm:h-10 w-auto object-contain cursor-pointer"
                  />
                </Link>
              ) : (
                <Link href="/">
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 cursor-pointer hover:text-primary-600 transition-colors">
                    {settings?.platformName || 'Visible Shelf'}
                  </h1>
                </Link>
              )}
              
              {/* Desktop Navigation */}
              <div className="hidden sm:flex items-center gap-2 md:gap-3">
                <Link href="/settings">
                  <Button variant="ghost" size="sm">Settings</Button>
                </Link>
                {isAuthenticated ? (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={async () => {
                      await logout();
                      router.push('/');
                    }}
                  >
                    Sign Out
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button variant="secondary" size="sm">Sign In</Button>
                  </Link>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="sm:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
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
              <div className="sm:hidden mt-4 pb-2 space-y-2 border-t border-neutral-200 pt-4">
                <Link href="/settings" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" size="md">Settings</Button>
                </Link>
                {isAuthenticated ? (
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    size="md"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await logout();
                      router.push('/');
                    }}
                  >
                    Sign Out
                  </Button>
                ) : (
                  <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full" size="md">Sign In</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        {/* Banner Hero Section (if authenticated and banner exists) */}
        {isAuthenticated && tenantData?.bannerUrl && (
          <div className="mb-6 sm:mb-8">
            <div className="relative w-full h-40 sm:h-48 md:h-64 rounded-lg overflow-hidden shadow-lg">
              <Image
                src={tenantData.bannerUrl}
                alt={`${tenantData.name} banner`}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-2">
            {isAuthenticated && tenantData?.logoUrl && (
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <Image
                  src={tenantData.logoUrl}
                  alt={tenantData.name}
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
            )}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                {isAuthenticated ? (tenantData?.name ? `${tenantData.name} Dashboard` : 'Welcome to Your Dashboard') : 'Platform Overview'}
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 mt-1">
                {isAuthenticated 
                  ? (stats.isChain 
                      ? `Managing ${stats.locations} locations across ${stats.organizationName || 'your organization'}`
                      : 'Manage your retail inventory and visibility across platforms'
                    )
                  : 'Empowering retailers with complete online visibility'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Public Platform Health - For visitors/non-authenticated users */}
        {!isAuthenticated && !authLoading && (
          <div className="mb-6 sm:mb-8">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
              <AnimatedCard delay={0} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Active Retailers</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      {platformStats.activeRetailersFormatted}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">using the platform</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.1} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Products Listed</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      {platformStats.productsListedFormatted}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">on Google Shopping</p>
                  </div>
                  <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.2} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Storefronts Live</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                    >
                      {platformStats.storefrontsLiveFormatted}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">total products</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-info rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.3} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Platform Uptime</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      {platformStats.platformUptimeFormatted}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">last 30 days</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-success rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>
            </div>

            {/* Mission Statement - For visitors */}
            <div className="my-8 sm:my-12 md:my-16 text-center max-w-4xl mx-auto px-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-3 sm:mb-4">
                  Empowering Local Retailers to Compete Online
                </h2>
                <p className="text-base sm:text-lg text-neutral-600 mb-6 sm:mb-8 leading-relaxed">
                  We believe every local retailer deserves the same online presence as major chains. 
                  That's why we built a platform that gives you enterprise-level tools without the 
                  enterprise price tag or complexity.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
                  <motion.div 
                    className="p-4 sm:p-6 bg-primary-50 rounded-xl border-2 border-primary-100"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🎯</div>
                    <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Mission</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      Level the playing field for local retailers competing against big box stores
                    </p>
                  </motion.div>
                  <motion.div 
                    className="p-4 sm:p-6 bg-green-50 rounded-xl border-2 border-green-100"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">💡</div>
                    <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Vision</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      A world where local businesses thrive online as easily as they do in-store
                    </p>
                  </motion.div>
                  <motion.div 
                    className="p-4 sm:p-6 bg-blue-50 rounded-xl border-2 border-blue-100"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">⚡</div>
                    <h3 className="font-bold text-neutral-900 mb-1 sm:mb-2 text-base sm:text-lg">Our Promise</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      Enterprise features, small business pricing, and setup in minutes—not months
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </div>

            {/* Features Showcase - WOW Factor for visitors */}
            <div className="my-8 sm:my-12">
              <FeaturesShowcase mode={showcaseMode} />
            </div>

            {/* CTA for visitors */}
            <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200">
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">
                Join Thousands of Retailers
              </h3>
              <p className="text-sm sm:text-base text-neutral-600 mb-6 max-w-2xl mx-auto">
                Get your products on Google Shopping, create a beautiful storefront, and reach more customers - all in one platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    Start Free Trial →
                  </Button>
                </Link>
                <Link href="/features" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Learn More
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}

        {/* Platform Overview - Only for chains with multiple locations */}
        {!loading && stats.isChain && stats.locations > 1 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 flex-1 min-w-0">
                {stats.organizationName} - Platform Overview
              </h3>
              <Badge variant="default" className="bg-primary-600 text-white flex-shrink-0">
                {stats.locations} Locations
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-neutral-600 mb-1">Total Locations</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.locations}</p>
                <p className="text-xs text-neutral-500 mt-1">Across organization</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-neutral-600 mb-1">Organization Type</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">Chain</p>
                <p className="text-xs text-neutral-500 mt-1">Multi-location</p>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-neutral-600 mb-1">Current View</p>
                <p className="text-base sm:text-lg font-bold text-neutral-900 truncate" title={selectedTenantId || ''}>
                  {selectedTenantId ? 'Single Location' : 'All'}
                </p>
                <Link href="/tenants" className="text-xs text-primary-600 hover:underline mt-1 block">
                  Switch location →
                </Link>
              </Card>
              <Card className="p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-neutral-600 mb-1">Quick Access</p>
                <Link href="/tenants">
                  <Button variant="secondary" size="sm" className="w-full mt-1">
                    View All Locations
                  </Button>
                </Link>
              </Card>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Metrics below show data for the currently selected location. 
                <Link href="/tenants" className="text-blue-600 hover:underline ml-1">
                  Switch locations
                </Link> to view different store data.
              </p>
            </div>
          </div>
        )}

        {/* Empty State - Only show for authenticated users */}
        {!loading && isAuthenticated && stats.total === 0 && (
          <Card className="col-span-full text-center p-6 sm:p-8 md:p-12 mb-6 sm:mb-8">
            <div className="max-w-md mx-auto">
              <div className="text-5xl sm:text-6xl mb-4">🏪</div>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">Welcome to Your Dashboard!</h3>
              <p className="text-sm sm:text-base text-neutral-600 mb-6">
                Let's get your storefront up and running. Start by adding your first product.
              </p>
              <Link href={scopedLinks.createItem}>
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Product
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Hero Metrics */}
        {!loading && stats.total > 0 && stats.isChain && stats.locations > 1 && (
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Current Location Metrics
          </h3>
        )}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-24 mb-3"></div>
                  <div className="h-10 bg-neutral-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-20"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link href={scopedLinks.items}>
              <AnimatedCard delay={0} className="p-6 cursor-pointer hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Catalog Size</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      {inventoryCount}
                    </motion.p>
                    <p className="text-sm text-neutral-500 mt-1">total products</p>
                  </div>
                <motion.div 
                  className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </motion.div>
              </div>
            </AnimatedCard>
          </Link>

          <AnimatedCard delay={0.1} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Live Products</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  {listingsCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">synced to Google</p>
              </div>
              <motion.div 
                className="h-12 w-12 bg-success rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>

          {/* Google Sync Status - Actionable metric */}
          <AnimatedCard delay={0.2} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Sync Health</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  {syncIssuesCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">{syncIssuesCount > 0 ? 'items need sync' : 'everything synced'}</p>
              </div>
              <motion.div 
                className={`h-12 w-12 ${syncIssuesCount > 0 ? 'bg-warning' : 'bg-success'} rounded-lg flex items-center justify-center`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>

          {/* Locations Count - Context-aware */}
          <Link href={scopedLinks.tenants}>
            <AnimatedCard delay={0.3} className="p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600">
                    {stats.isChain ? 'Chain Locations' : 'Your Locations'}
                  </p>
                  <motion.p 
                    className="text-3xl font-bold text-neutral-900 mt-2"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    {locationsCount}
                  </motion.p>
                  <p className="text-sm text-neutral-500 mt-1">
                    {stats.isChain && stats.organizationName ? stats.organizationName : 'manage stores'}
                  </p>
                </div>
                <motion.div 
                  className="h-12 w-12 bg-info rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </motion.div>
              </div>
            </AnimatedCard>
          </Link>
        </div>
        )}

        {/* Business Hours Card (tenant-scoped) */}
        {isAuthenticated && selectedTenantId && (
          <div className="mb-6">
            <AnimatedCard delay={0.35} className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-base sm:text-lg font-bold text-neutral-900">Business Hours</h3>
                  </div>
                  {hoursInfo?.hasHours ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {hoursInfo.today ? (() => {
                        // Parse status from label (e.g., "Open now • Closes at 5:00 PM" or "Closed • Opens today at 9:00 AM")
                        const isOpen = hoursInfo.today.startsWith('Open');
                        const dotColor = isOpen ? 'bg-green-500' : 'bg-red-500';
                        const statusText = isOpen ? 'Open' : 'Closed';
                        const statusColor = isOpen ? 'text-green-700' : 'text-red-700';
                        
                        return (
                          <>
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
                            <span className={`font-semibold ${statusColor}`}>{statusText}</span>
                            <span className="text-neutral-400">•</span>
                            <span className="text-sm sm:text-base text-neutral-900">{hoursInfo.today}</span>
                          </>
                        );
                      })() : <span className="text-sm sm:text-base text-neutral-900">Hours configured</span>}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-neutral-500">
                      Set your store hours to display them here.
                    </p>
                  )}
                </div>
                {(() => {
                  // Use centralized permission helper
                  if (!user || !canManageTenantSettings(user, selectedTenantId)) return null;
                  return (
                    <Link href={`/t/${selectedTenantId}/settings/hours`} className="w-full sm:w-auto">
                      <Button variant="secondary" size="md" className="w-full sm:w-auto whitespace-nowrap font-semibold">
                        {hoursInfo?.hasHours ? '⚙️ Manage Hours' : '➕ Set Hours'}
                      </Button>
                    </Link>
                  );
                })()}
              </div>
            </AnimatedCard>
          </div>
        )}

        {/* Quick Actions - Different for authenticated vs visitors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isAuthenticated ? (
            <>
            <AnimatedCard delay={0.4} hover={false}>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Quick Actions</CardTitle>
                <CardDescription className="text-sm">Get started with common tasks</CardDescription>
              </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              {selectedTenantId && (
                <Link href={`/tenant/${selectedTenantId}`} className="block" target="_blank">
                  <Button variant="primary" className="w-full justify-start" size="md">
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    View Your Storefront
                  </Button>
                </Link>
              )}
              <Link href={scopedLinks.tenants} className="block">
                <Button variant="secondary" className="w-full justify-start" size="md">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Manage Locations
                </Button>
              </Link>
              <Link href={scopedLinks.items} className="block">
                <Button variant="secondary" className="w-full justify-start" size="md">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  View Inventory
                </Button>
              </Link>
              <Link href={scopedLinks.createItem} className="block">
                <Button variant="secondary" className="w-full justify-start" size="md">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Product
                </Button>
              </Link>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.5} hover={false}>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Getting Started</CardTitle>
              <CardDescription className="text-sm">Set up your Visible Shelf</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <Link href={selectedTenantId ? `/t/${selectedTenantId}/onboarding` : "/tenants"} className="flex items-start gap-3 p-3 sm:p-4 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-7 w-7 sm:h-6 sm:w-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:scale-110 transition-transform">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors text-sm sm:text-base">Complete Business Profile</p>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Set up your store identity and details</p>
                </div>
              </Link>
              <Link href={scopedLinks.createItem} className="flex items-start gap-3 p-3 sm:p-4 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-7 w-7 sm:h-6 sm:w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors text-sm sm:text-base">Add inventory items</p>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Upload products with photos</p>
                </div>
              </Link>
              <Link href={scopedLinks.settingsTenant} className="flex items-start gap-3 p-3 sm:p-4 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-7 w-7 sm:h-6 sm:w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors text-sm sm:text-base">Connect to Google</p>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Sync with Google Merchant Center</p>
                </div>
              </Link>
            </CardContent>
          </AnimatedCard>
          </>
          ) : (
            // Visitor Quick Actions
            <>
              <AnimatedCard delay={0.4} hover={false}>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Why Choose Us?</CardTitle>
                  <CardDescription className="text-sm">Everything you need to succeed online</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm sm:text-base">Instant Google Visibility</p>
                      <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Get your products on Google Shopping automatically</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-success flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm sm:text-base">Beautiful Storefront</p>
                      <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Professional online store, no coding required</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-info flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm sm:text-base">Easy Management</p>
                      <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Update inventory from one simple dashboard</p>
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>

              <AnimatedCard delay={0.5} hover={false}>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Get Started Today</CardTitle>
                  <CardDescription className="text-sm">Join retailers already using our platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <Link href="/register" className="block">
                    <Button variant="primary" className="w-full justify-start" size="md">
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Create Free Account
                    </Button>
                  </Link>
                  <Link href="/login" className="block">
                    <Button variant="secondary" className="w-full justify-start" size="md">
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </Button>
                  </Link>
                  <div className="pt-3 sm:pt-4 border-t border-neutral-200">
                    <p className="text-xs sm:text-sm text-neutral-600 mb-2">Questions?</p>
                    <Link href="/contact" className="text-xs sm:text-sm text-primary-600 hover:underline">
                      Contact our team →
                    </Link>
                  </div>
                </CardContent>
              </AnimatedCard>
            </>
          )}
        </div>

        {/* Value Showcase - Only show when user has products */}
        {!loading && stats.total > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
            {/* Storefront Status */}
            <AnimatedCard delay={0.6} hover={false}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg flex-1 min-w-0">Your Storefront</CardTitle>
                  <Badge variant="success" className="flex-shrink-0">Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 text-sm sm:text-base">{stats.active} Products Live</p>
                      <p className="text-xs sm:text-sm text-neutral-600">Visible to customers</p>
                    </div>
                  </div>
                  {selectedTenantId && (
                    <Link href={`/tenant/${selectedTenantId}`} target="_blank">
                      <Button variant="secondary" className="w-full" size="md">
                        View Storefront →
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </AnimatedCard>

            {/* Google Integration Status */}
            <AnimatedCard delay={0.7} hover={false}>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Google Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-success rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 text-sm sm:text-base">Google Shopping</p>
                      <p className="text-xs sm:text-sm text-neutral-600">{stats.active} products synced</p>
                    </div>
                  </div>
                  <Link href={scopedLinks.settingsTenant}>
                    <Button variant="secondary" className="w-full" size="md">
                      Manage Integration →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </AnimatedCard>

            {/* Actionable Insights */}
            <AnimatedCard delay={0.8} hover={false}>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 sm:space-y-3">
                  {stats.syncIssues > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-warning-50 rounded-lg">
                      <svg className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-neutral-900">{stats.syncIssues} items need Google sync</p>
                        <Link href={scopedLinks.items} className="text-xs text-primary-600 hover:underline block mt-1">
                          Review sync status →
                        </Link>
                      </div>
                    </div>
                  )}
                  {stats.total - stats.active > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-info-50 rounded-lg">
                      <svg className="h-5 w-5 text-info mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-neutral-900">{stats.total - stats.active} inactive products</p>
                        <Link href={scopedLinks.items} className="text-xs text-primary-600 hover:underline block mt-1">
                          Activate products →
                        </Link>
                      </div>
                    </div>
                  )}
                  {stats.syncIssues === 0 && stats.total === stats.active && (
                    <div className="flex items-start gap-2 p-3 bg-success-50 rounded-lg">
                      <svg className="h-5 w-5 text-success mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs sm:text-sm font-medium text-neutral-900">Everything looks great! 🎉</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </AnimatedCard>
          </div>
        )}
      </main>
      
      <PublicFooter />
    </div>
  );
}
