"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, AnimatedCard } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import Image from "next/image";
import PublicFooter from "@/components/PublicFooter";

export default function Home() {
  const { settings } = usePlatformSettings();
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [scopedLinks, setScopedLinks] = useState<{ items: string; createItem: string; tenants: string; settingsTenant: string }>({
    items: "/items",
    createItem: "/items?create=true",
    tenants: "/tenants",
    settingsTenant: "/settings/tenant",
  });
  const [stats, setStats] = useState({ 
    total: 0, 
    active: 0, 
    syncIssues: 0,
    locations: 0,
    isChain: false,
    organizationName: null as string | null,
  });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
          console.error('[Home] Failed to fetch platform stats:', error);
        }
      };
      fetchPlatformStats();
    }
  }, [isAuthenticated, authLoading]);
  
  useEffect(() => {
    // Only fetch stats if authenticated
    if (!isAuthenticated || authLoading) {
      setLoading(false);
      return;
    }
    
    // Fetch comprehensive dashboard stats from optimized endpoint
    const fetchStats = async () => {
      try {
        const dashboardRes = await api.get('/api/dashboard');
        
        if (!dashboardRes.ok) {
          setLoading(false);
          return;
        }
        
        const data = await dashboardRes.json();
        
        if (data.tenant) {
          setSelectedTenantId(data.tenant.id);
        }
        
        setStats({
          total: data.stats.totalItems,
          active: data.stats.activeItems,
          syncIssues: data.stats.syncIssues,
          locations: data.stats.locations,
          isChain: data.isChain,
          organizationName: data.organizationName,
        });
      } catch (error) {
        console.error('[Dashboard] Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [isAuthenticated, authLoading]);

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
        settingsTenant: `/t/${tenantId}/settings/tenant`,
      });
    } else {
      setScopedLinks({ items: "/items", createItem: "/items?create=true", tenants: "/tenants", settingsTenant: "/settings/tenant" });
    }
  }, []);
  
  // Animated counts for metrics
  const inventoryCount = useCountUp(stats.total);
  const listingsCount = useCountUp(stats.active);
  const syncIssuesCount = useCountUp(stats.syncIssues);
  const locationsCount = useCountUp(stats.locations);
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {settings?.logoUrl ? (
              <Link href="/">
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={150}
                  height={40}
                  className="h-10 w-auto object-contain cursor-pointer"
                />
              </Link>
            ) : (
              <Link href="/">
                <h1 className="text-2xl font-bold text-neutral-900 cursor-pointer hover:text-primary-600 transition-colors">
                  {settings?.platformName || 'Visible Shelf'}
                </h1>
              </Link>
            )}
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="ghost" size="sm">Settings</Button>
              </Link>
              {isAuthenticated ? (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={async () => {
                    await logout();
                    // Navigate to clean home page to show public platform metrics
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">
            {isAuthenticated ? 'Welcome to Your Dashboard' : 'Platform Overview'}
          </h2>
          <p className="text-neutral-600">
            {isAuthenticated 
              ? (stats.isChain 
                  ? `Managing ${stats.locations} locations across ${stats.organizationName || 'your organization'}`
                  : 'Manage your retail inventory and visibility across platforms'
                )
              : 'Empowering retailers with complete online visibility'
            }
          </p>
        </div>

        {/* Public Platform Health - For visitors/non-authenticated users */}
        {!isAuthenticated && !authLoading && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <AnimatedCard delay={0} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Active Retailers</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      {platformStats.activeRetailersFormatted}
                    </motion.p>
                    <p className="text-sm text-neutral-500 mt-1">using the platform</p>
                  </div>
                  <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.1} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Products Listed</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      {platformStats.productsListedFormatted}
                    </motion.p>
                    <p className="text-sm text-neutral-500 mt-1">on Google Shopping</p>
                  </div>
                  <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.2} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Storefronts Live</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                    >
                      {platformStats.storefrontsLiveFormatted}
                    </motion.p>
                    <p className="text-sm text-neutral-500 mt-1">online stores</p>
                  </div>
                  <div className="h-12 w-12 bg-info rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.3} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-600">Platform Uptime</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      {platformStats.platformUptimeFormatted}
                    </motion.p>
                    <p className="text-sm text-neutral-500 mt-1">last 30 days</p>
                  </div>
                  <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </AnimatedCard>
            </div>

            {/* CTA for visitors */}
            <Card className="p-8 text-center bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200">
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                Join Thousands of Retailers
              </h3>
              <p className="text-neutral-600 mb-6 max-w-2xl mx-auto">
                Get your products on Google Shopping, create a beautiful storefront, and reach more customers - all in one platform.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/register">
                  <Button variant="primary" size="lg">
                    Start Free Trial →
                  </Button>
                </Link>
                <Link href="/features">
                  <Button variant="secondary" size="lg">
                    Learn More
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}

        {/* Platform Overview - Only for chains with multiple locations */}
        {!loading && stats.isChain && stats.locations > 1 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-neutral-900">
                {stats.organizationName} - Platform Overview
              </h3>
              <Badge variant="default" className="bg-primary-600 text-white">
                {stats.locations} Locations
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-sm text-neutral-600 mb-1">Total Locations</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.locations}</p>
                <p className="text-xs text-neutral-500 mt-1">Across organization</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-neutral-600 mb-1">Organization Type</p>
                <p className="text-2xl font-bold text-neutral-900">Chain</p>
                <p className="text-xs text-neutral-500 mt-1">Multi-location</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-neutral-600 mb-1">Current View</p>
                <p className="text-lg font-bold text-neutral-900 truncate" title={selectedTenantId || ''}>
                  {selectedTenantId ? 'Single Location' : 'All'}
                </p>
                <Link href="/tenants" className="text-xs text-primary-600 hover:underline mt-1 block">
                  Switch location →
                </Link>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-neutral-600 mb-1">Quick Access</p>
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
          <Card className="col-span-full text-center p-12 mb-8">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🏪</div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">Welcome to Your Dashboard!</h3>
              <p className="text-neutral-600 mb-6">
                Let's get your storefront up and running. Start by adding your first product.
              </p>
              <Link href={scopedLinks.createItem}>
                <Button variant="primary" size="lg">
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
                    <p className="text-sm font-medium text-neutral-600">Total Inventory</p>
                    <motion.p 
                      className="text-3xl font-bold text-neutral-900 mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      {inventoryCount}
                    </motion.p>
                  <p className="text-sm text-neutral-500 mt-1">items</p>
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
                <p className="text-sm font-medium text-neutral-600">Active Listings</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  {listingsCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">on Google</p>
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
                <p className="text-sm font-medium text-neutral-600">Sync Status</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  {syncIssuesCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">{syncIssuesCount > 0 ? 'needs attention' : 'all synced'}</p>
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

        {/* Quick Actions - Different for authenticated vs visitors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isAuthenticated ? (
            <>
            <AnimatedCard delay={0.4} hover={false}>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Get started with common tasks</CardDescription>
              </CardHeader>
            <CardContent className="space-y-3">
              {selectedTenantId && (
                <Link href={`/tenant/${selectedTenantId}`} className="block" target="_blank">
                  <Button variant="primary" className="w-full justify-start">
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    View Your Storefront
                  </Button>
                </Link>
              )}
              <Link href={scopedLinks.tenants} className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Manage Tenants
                </Button>
              </Link>
              <Link href="/items" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  View Inventory
                </Button>
              </Link>
              <Link href={scopedLinks.createItem} className="block">
                <Button variant="secondary" className="w-full justify-start">
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
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Set up your Visible Shelf</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/tenants" className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:scale-110 transition-transform">
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Create a tenant</p>
                  <p className="text-sm text-neutral-600">Set up your store or business</p>
                </div>
              </Link>
              <Link href="/items?create=true" className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Add inventory items</p>
                  <p className="text-sm text-neutral-600">Upload products with photos</p>
                </div>
              </Link>
              <Link href={scopedLinks.settingsTenant} className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  3
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Connect to Google</p>
                  <p className="text-sm text-neutral-600">Sync with Google Merchant Center</p>
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
                  <CardTitle>Why Choose Us?</CardTitle>
                  <CardDescription>Everything you need to succeed online</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">Instant Google Visibility</p>
                      <p className="text-sm text-neutral-600">Get your products on Google Shopping automatically</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-success flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">Beautiful Storefront</p>
                      <p className="text-sm text-neutral-600">Professional online store, no coding required</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-info flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">Easy Management</p>
                      <p className="text-sm text-neutral-600">Update inventory from one simple dashboard</p>
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>

              <AnimatedCard delay={0.5} hover={false}>
                <CardHeader>
                  <CardTitle>Get Started Today</CardTitle>
                  <CardDescription>Join retailers already using our platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link href="/register" className="block">
                    <Button variant="primary" className="w-full justify-start" size="lg">
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Create Free Account
                    </Button>
                  </Link>
                  <Link href="/login" className="block">
                    <Button variant="secondary" className="w-full justify-start">
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </Button>
                  </Link>
                  <div className="pt-4 border-t border-neutral-200">
                    <p className="text-sm text-neutral-600 mb-2">Questions?</p>
                    <Link href="/contact" className="text-sm text-primary-600 hover:underline">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Storefront Status */}
            <AnimatedCard delay={0.6} hover={false}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Your Storefront</CardTitle>
                  <Badge variant="success">Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900">{stats.active} Products Live</p>
                      <p className="text-sm text-neutral-600">Visible to customers</p>
                    </div>
                  </div>
                  {selectedTenantId && (
                    <Link href={`/tenant/${selectedTenantId}`} target="_blank">
                      <Button variant="secondary" className="w-full">
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
                <CardTitle className="text-lg">Google Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-success rounded-lg flex items-center justify-center">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900">Google Shopping</p>
                      <p className="text-sm text-neutral-600">{stats.active} products synced</p>
                    </div>
                  </div>
                  <Link href={scopedLinks.settingsTenant}>
                    <Button variant="secondary" className="w-full">
                      Manage Integration →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </AnimatedCard>

            {/* Actionable Insights */}
            <AnimatedCard delay={0.8} hover={false}>
              <CardHeader>
                <CardTitle className="text-lg">Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.syncIssues > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-warning-50 rounded-lg">
                      <svg className="h-5 w-5 text-warning mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{stats.syncIssues} items need Google sync</p>
                        <Link href={scopedLinks.items} className="text-xs text-primary-600 hover:underline">
                          Review sync status →
                        </Link>
                      </div>
                    </div>
                  )}
                  {stats.total - stats.active > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-info-50 rounded-lg">
                      <svg className="h-5 w-5 text-info mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{stats.total - stats.active} inactive products</p>
                        <Link href={scopedLinks.items} className="text-xs text-primary-600 hover:underline">
                          Activate products →
                        </Link>
                      </div>
                    </div>
                  )}
                  {stats.syncIssues === 0 && stats.total === stats.active && (
                    <div className="flex items-start gap-2 p-2 bg-success-50 rounded-lg">
                      <svg className="h-5 w-5 text-success mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-neutral-900">Everything looks great! 🎉</p>
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
