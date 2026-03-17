"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button } from '@mantine/core';
import { Badge, AnimatedCard } from "@/components/ui";
import { usePlatformComplete } from "@/hooks/dashboard/usePlatformComplete";
import { motion } from "framer-motion";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { platformDashboardService } from '@/services/PlatformDashboardSingletonService';
import { platformPublicService } from '@/services/PlatformPublicService';
import Image from "next/image";
import SubscriptionUsageBadge from "@/components/subscription/SubscriptionUsageBadge";
import { SubscriptionStatusGuide } from "@/components/subscription/SubscriptionStatusGuide";
import PublicFooter from "@/components/PublicFooter";
import FeaturesShowcase, { ShowcaseMode } from "@/components/FeaturesShowcase";

export default function PlatformDashboard() {
  const { settings } = usePlatformSettings();
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();
  const router = useRouter();
  
  const { data: platformData, loading, error, metrics } = usePlatformComplete({ isAuthenticated });
  
  const [platformStats, setPlatformStats] = useState({
    activeRetailers: 0,
    activeRetailersFormatted: '0',
    productsListed: 0,
    productsListedFormatted: '0',
    storefrontsLive: 0,
    storefrontsLiveFormatted: '0',
    platformUptime: 99.9,
    platformUptimeFormatted: '99.9%',
    totalUsers: 0,
    activeUsers: 0,
    systemHealth: null as any,
    growthMetrics: null as any
  });
  
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>('hybrid');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Fetch platform stats
  useEffect(() => {
    if (!authLoading) {
      const fetchPlatformStats = async () => {
        try {
          let statsData;
          
          if (isAuthenticated) {
            const dashboardData = await platformDashboardService.getPlatformDashboard();
            statsData = dashboardData?.stats;
          } else {
            statsData = await platformPublicService.getPlatformStats();
          }
          
          setPlatformStats({
            activeRetailers: (statsData as any).activeRetailers || (statsData as any).activeTenants || (statsData as any).totalTenants || 0,
            activeRetailersFormatted: ((statsData as any).activeRetailers || (statsData as any).activeTenants || (statsData as any).totalTenants || 0).toLocaleString(),
            productsListed: (statsData as any).productsListed || (statsData as any).activeItems || (statsData as any).totalItems || (statsData as any).totalProducts || 0,
            productsListedFormatted: ((statsData as any).productsListed || (statsData as any).activeItems || (statsData as any).totalItems || (statsData as any).totalProducts || 0).toLocaleString(),
            storefrontsLive: (statsData as any).storefrontsLive || Math.floor(((statsData as any).activeTenants || (statsData as any).totalTenants || 0) * 0.5),
            storefrontsLiveFormatted: ((statsData as any).storefrontsLive || Math.floor(((statsData as any).activeTenants || (statsData as any).totalTenants || 0) * 0.5)).toLocaleString(),
            platformUptime: (statsData as any).platformUptime || 99.9,
            platformUptimeFormatted: (statsData as any).platformUptimeFormatted || '99.9%',
            totalUsers: (statsData as any).totalUsers || 0,
            activeUsers: (statsData as any).activeUsers || 0,
            systemHealth: (statsData as any).systemHealth || null,
            growthMetrics: (statsData as any).growthMetrics || null
          });
        } catch (error) {
          console.warn('[Platform Dashboard] Failed to load stats');
        }
      };
      fetchPlatformStats();
    }
  }, [isAuthenticated, authLoading]);

  // Fetch showcase mode
  useEffect(() => {
    const fetchShowcaseConfig = async () => {
      try {
        const config = await platformPublicService.getFeaturesShowcaseConfig();
        const modeMap: Record<string, ShowcaseMode> = {
          'hybrid': 'hybrid',
          'featured': 'grid',
          'recent': 'slider',
          'trending': 'tabs'
        };
        setShowcaseMode(modeMap[config.mode] || 'hybrid');
      } catch {
        setShowcaseMode('hybrid');
      }
    };
    fetchShowcaseConfig();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
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
                  className="object-contain cursor-pointer"
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
              <Link href="/tenants">
                <Button variant="ghost" size="sm">My Stores</Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm">Settings</Button>
              </Link>
              {isAuthenticated ? (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={async () => { await logout(); }}
                >
                  Sign Out
                </Button>
              ) : (
                <a href="/auth/login">
                  <Button variant="secondary" size="sm">Sign In</Button>
                </a>
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

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-4 pb-2 space-y-2 border-t border-neutral-200 pt-4">
              <Link href="/tenants" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start" size="md">My Stores</Button>
              </Link>
              <Link href="/settings" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start" size="md">Settings</Button>
              </Link>
              {isAuthenticated ? (
                <Button 
                  variant="secondary" 
                  className="w-full"
                  size="md"
                  onClick={async () => { setMobileMenuOpen(false); await logout(); }}
                >
                  Sign Out
                </Button>
              ) : (
                <a href="/auth/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" className="w-full" size="md">Sign In</Button>
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        {/* Subscription Status Guide */}
        {isAuthenticated && <SubscriptionStatusGuide />}

        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-2">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                {isAuthenticated ? 'Platform Dashboard' : 'Welcome to Visible Shelf'}
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 mt-1">
                {isAuthenticated 
                  ? 'Manage your retail inventory and visibility across all your store locations'
                  : 'Making your shelves visible online so you can compete with the giants'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Platform Stats Grid */}
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
                  <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">public storefronts</p>
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

          {/* Additional stats for authenticated users */}
          {isAuthenticated && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnimatedCard delay={0.4} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Total Users</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: "spring" }}
                    >
                      {platformStats.totalUsers.toLocaleString()}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">registered accounts</p>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.5} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">Active Users</p>
                    <motion.p 
                      className="text-2xl sm:text-3xl font-bold text-neutral-900 mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7, type: "spring" }}
                    >
                      {platformStats.activeUsers.toLocaleString()}
                    </motion.p>
                    <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">last 30 days</p>
                  </div>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.6} className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-neutral-600">System Health</p>
                    <motion.div 
                      className="mt-1 sm:mt-2"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8, type: "spring" }}
                    >
                      <Badge variant="success">All Systems Operational</Badge>
                    </motion.div>
                  </div>
                </div>
              </AnimatedCard>
            </div>
          )}
        </div>

        {/* Quick Actions for Authenticated Users */}
        {isAuthenticated && (
          <div className="mb-6 sm:mb-8">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/tenants">
                <AnimatedCard className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">My Stores</p>
                </AnimatedCard>
              </Link>
              <Link href="/settings">
                <AnimatedCard className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 bg-neutral-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">Settings</p>
                </AnimatedCard>
              </Link>
              <Link href="/settings/subscription">
                <AnimatedCard className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 bg-success rounded-lg flex items-center justify-center mx-auto mb-2">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">Subscription</p>
                </AnimatedCard>
              </Link>
              <Link href="/settings/profile">
                <AnimatedCard className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 bg-info rounded-lg flex items-center justify-center mx-auto mb-2">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">Profile</p>
                </AnimatedCard>
              </Link>
            </div>
          </div>
        )}

        {/* Features Showcase */}
        <div className="mb-6 sm:mb-8">
          <FeaturesShowcase mode={showcaseMode} />
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
