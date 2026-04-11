"use client";

import { lazy, Suspense } from "react";
import { Card as MantineCard, Button, Tooltip, Group, Badge, Box, Title, Text, Stack } from '@mantine/core';
import { useTenantComplete } from "@/hooks/dashboard/useTenantComplete";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { canManageTenantSettings } from "@/lib/auth/access-control";
import DashboardHeader from "./DashboardHeader";
import DashboardStats from "./DashboardStats";
import DashboardSkeleton from "./DashboardSkeleton";
import TierBadge from "./TierBadge";
import UserProfileBadge from "./UserProfileBadge";
import TenantLimitBadge from "@/components/tenant/TenantLimitBadge";
import SubscriptionStateBanner from "@/components/subscription/SubscriptionStateBanner";
import { SubscriptionDisplayCard } from "@/components/subscription/SubscriptionDisplayCard";
import LocationStatusBanner from "@/components/tenant/LocationStatusBanner";
import { useState, useEffect } from "react";
import { computeStoreStatus } from "@/lib/hours-utils";
import { tenantSlugService } from '../../services/TenantSlugService';
import { tenantInfoService } from '../../services/TenantInfoService';
import { platformHomeService } from '../../services/PlatformHomeSingletonService';
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';

// Lazy load secondary components (non-critical for initial render)
const QuickActions = lazy(() => import("./QuickActions"));
const VisibilityCards = lazy(() => import("./VisibilityCards"));
const TierGainsWelcome = lazy(() => import("./TierGainsWelcome"));

// Simple loading fallback for lazy components
const ComponentLoader = () => (
  <div className="animate-pulse bg-neutral-200 rounded-lg h-32" />
);

interface TenantDashboardProps {
  tenantId: string;
}

/**
 * Tier-Aware Tenant Dashboard Component
 * Dynamically adapts to tenant's tier, organization context, and user role
 * Shows available features and upgrade opportunities
 */


export default function TenantDashboard({ tenantId }: TenantDashboardProps) {
  const { user } = useAuth();
  
  // Consolidated data fetching - replaces 3 separate API calls with 1
  const { 
    tenant: tenantData, 
    tier, 
    usage, 
    organizationTenants,
    loading: completeLoading, 
    error: completeError, 
    refresh: refreshTenantData 
  } = useTenantComplete(tenantId, true);

  
  // User profile (still separate since it's user-specific, not tenant-specific)
  const { profile, loading: profileLoading } = useUserProfile();
  
  // Business profile for logo
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(true);

  // Tenant hours information
  const [hoursInfo, setHoursInfo] = useState<{ hasHours: boolean; today: string | null } | null>(null);

  // Tenant banner information  
  const [tenantBanner, setTenantBanner] = useState<{ bannerUrl?: string; name: string } | null>(null);

  const canManageSettings = user ? canManageTenantSettings(user, tenantId) : false;
  
  const loading = completeLoading || profileLoading || businessProfileLoading;
  const error = completeError;
  
  //const slugs = tenantSlugService.getTenantSlug({ businessName: tenantData?.name || '', tenantId });
 // console.log(`${TenantDashboard.name} tenant data`, tenantData);

  const slugs = tenantData?.slug || tenantData?.id || tenantId;
  const { status: hoursStatus } = useStoreStatus(tenantId||tenantData?.id || '', false); // Public scope

 // console.log(`${TenantDashboard.name} tenant slugs`, slugs);
  
  // Track tenant dashboard view
  useEffect(() => {
    if (tenantId) {
      trackBehaviorClient({
        entityType: 'dashboard',
        entityId: `tenant_dashboard_${tenantId}`,
        entityName: 'Tenant Dashboard',
        pageType: 'tenant_dashboard',
        context: {
          tenantId
        }
      });
    }
  }, [tenantId]);
  
  // Fetch business profile for logo
  useEffect(() => {
    const fetchBusinessProfile = async () => {
      try {
        const data = await platformHomeService.getTenantProfile(tenantId);
        if (data) {
          setBusinessProfile(data);
        }
      } catch (error) {
        console.error('Failed to fetch business profile:', error);
      } finally {
        setBusinessProfileLoading(false);
      }
    };

    if (tenantId) {
      fetchBusinessProfile();
    }
  }, [tenantId]);

  // Fetch tenant business hours
  useEffect(() => {
    const fetchHours = async () => {
      try {
        if (!tenantId) { setHoursInfo(null); return; }
        
        // Use tenantInfoService for business hours data (authenticated endpoint)
        const hours = await tenantInfoService.getBusinessHours(tenantId);
        
        if (!hours) { 
          setHoursInfo({ hasHours: false, today: null }); 
          return; 
        }
        
        // Check if hours are configured
        let hasHours = false;
        if (typeof hours === 'object') {
          // Check for periods array format or day-based format
          const hoursObj = hours as any;
          if (hoursObj.periods && Array.isArray(hoursObj.periods)) {
            hasHours = hoursObj.periods.length > 0;
          } else {
            // Check day-based format (Monday, Tuesday, etc.)
            hasHours = Object.keys(hoursObj).some(k => k !== 'timezone' && k !== 'special' && hoursObj[k]);
          }
        }

        // Use shared utility to compute store status (handles special hours too!)
        const status = computeStoreStatus(hours);
        const today = status?.label;

        setHoursInfo({ hasHours, today: status?.label ?? null });
      } catch {
        setHoursInfo(null);
      }
    };
    fetchHours();
  }, [tenantId]);

  // Fetch tenant banner and name
  useEffect(() => {
    const fetchTenantDetails = async () => {
      if (!tenantId) return;
      
      try {
        // Use tenantInfoService for tenant profile data
        const tenantInfo = await tenantInfoService.getTenantInfo(tenantId);
          
        if (tenantInfo) {
          setTenantBanner({
            name: tenantInfo.name,
            bannerUrl: tenantInfo.bannerUrl,
          });
        }
      } catch (error) {
        // Silently fail - tenant details are non-critical for dashboard
        console.warn('[Tenant Details] Failed to load banner, continuing without it');
      }
    };
    
    fetchTenantDetails();
  }, [tenantId]);

  // Show skeleton while loading
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <MantineCard padding="lg" radius="md" withBorder w="max-w-md">
          <Title order={4} c="red">Error Loading Dashboard</Title>
          <Text c="dimmed" mt="md">{error}</Text>
        </MantineCard>
      </div>
    );
  }

  //const { status: hoursStatus } = useStoreStatus(tenantId, true); // Public scope
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 relative">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {businessProfile?.logo_url ? (
              <Link href={`/t/${tenantId}/dashboard`}>
                <Image
                  src={businessProfile.logo_url}
                  alt={tenantData?.name || 'Store Logo'}
                  width={150}
                  height={40}
                  className="object-contain cursor-pointer"
                />
              </Link>
            ) : (
              <Link href={`/t/${tenantId}/dashboard`}>
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 cursor-pointer hover:text-primary-600 transition-colors">
                  {tenantData?.name || 'Store Dashboard'}
                </h1>
              </Link>
            )}
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center gap-2 md:gap-3">
              <Tooltip label="Store profile and branding">
                <Link href={`/t/${tenantId}/settings/tenant`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Profile
                  </Button>
                </Link>
              </Tooltip>
              <Tooltip label="Manage products and inventory">
                <Link href={`/t/${tenantId}/items`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Inventory
                  </Button>
                </Link>
              </Tooltip>
              <Tooltip label="View and manage orders">
                <Link href={`/t/${tenantId}/orders`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Orders
                  </Button>
                </Link>
              </Tooltip>
              <Tooltip label="Google Business Profile integration">
                <Link href={`/t/${tenantId}/settings/integrations/google`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    Google
                  </Button>
                </Link>
              </Tooltip>
              <Tooltip label="Data sync and feed status">
                <Link href={`/t/${tenantId}/settings/integrations/google/sync-status`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync
                  </Button>
                </Link>
              </Tooltip>
              <Tooltip label="Store settings and configuration">
                <Link href={`/t/${tenantId}/settings`}>
                  <Button 
                    variant="subtle" 
                    size="sm"
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Button>
                </Link>
              </Tooltip>
            </div>

            {/* Mobile Menu Button */}
            <MobileMenuButton tenantId={tenantId} />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Bar: User Profile + Tier Badge + Tenant Limits */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* User Profile */}
          {profile && (
            <div className="flex-1 min-w-[300px]">
              <UserProfileBadge profile={profile} />
            </div>
          )}
          
          {/* Right Side: Chain Badge + Tier Badge + Tenant Limits */}
          <div className="shrink-0 flex items-center gap-3">
            {/* Chain Badge - Show organization name if part of a chain */}
            {tier?.organization?.name && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="font-medium text-sm">{tier.organization.name}</span>
              </div>
            )}
            
            {/* Tenant Limits Badge (Compact) */}
            <TenantLimitBadge variant="compact" showUpgrade={true} />
            
            {/* Tier Badge */}
            {tier && (
              <TierBadge tier={tier} showDetails={true} />
            )}
          </div>
        </div>

        {/* Subscription State Banner (Maintenance/Freeze) */}
        <SubscriptionStateBanner tenantId={tenantId} />

        {/* Location Status Banner (Inactive/Closed/Pending/Archived) */}
        {tenantData?.locationStatus && (
          <LocationStatusBanner
            locationStatus={tenantData.locationStatus as "pending" | "active" | "inactive" | "closed" | "archived"}
            reopeningDate={tenantData.statusInfo?.reopeningDate}
            tenantName={tenantData.name || 'This Location'}
            tenantId={tenantId}
            variant="full"
          />
        )}

        {/* Banner Hero Section */}
        {tenantBanner?.bannerUrl && (
          <div className="mb-6 sm:mb-8">
            <div className="relative w-full h-40 sm:h-48 md:h-64 rounded-lg overflow-hidden shadow-lg">
              <Image
                src={tenantBanner.bannerUrl}
                alt={`${tenantBanner.name} banner`}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        )}

        {/* Header */}
        <DashboardHeader 
          title={`${tenantData?.name || 'Tenant'} Dashboard`}
          subtitle="Manage your retail inventory and visibility across platforms"
          storeLogo={businessProfile?.logo_url}
          storeName={tenantData?.name}
          user={user}
        />

        {/* Stats */}
        <DashboardStats
          activeItems={usage?.activeItems || 0} // Use consolidated usage data
          totalItems={usage?.totalItems || 0}   // Pass total items for catalog size
          categories={usage?.categories || 0}    // Pass categories count
          users={usage?.users || 0}             // Pass users count
          orders={usage?.orders || 0}           // Pass orders count
          syncIssues={0} // TODO: Implement sync issues tracking
          tenantId={tenantId}
        />

        {/* Tenant ID Display */}
        <div className="flex justify-between items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg border border-neutral-200">
            <span className="text-xs text-neutral-500 font-medium">Platform ID:</span>
            <code className="text-xs font-mono text-neutral-700 bg-white px-2 py-0.5 rounded border select-all">
              {tenantId}
            </code>
              {/* Hours Badge - Status */}
         <HoursStatusBadge status={hoursStatus} />
          </div>
          
          {/* Debug Refresh Button */}
          <button
            onClick={() => refreshTenantData()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors text-xs font-medium"
            title="Clear cache and refresh all dashboard data"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>

        {/* Customizable Subscription Display Card */}
        {tier && (
          <SubscriptionDisplayCard
            tenantId={tenantId}
            tierData={{
              tier: tier.effective?.id || 'starter',
              subscriptionStatus: tenantData?.subscriptionStatus || 'active',
              trialEndsAt: null,
              subscriptionEndsAt: null,
              isChain: tier.isChain,
              organizationId: tier.organizationId,
              organizationName: tier.organizationName,
              organizationTenants: organizationTenants,
              organizationTier: tier.organization ? {
                tier_key: tier.organization.id,
                display_name: tier.organization.name,
                price_monthly: tier.organization.limits?.maxProducts ? 299.99 : 0,
                max_skus: tier.organization.limits?.maxProducts || 0,
                max_locations: tier.organization.limits?.maxLocations || 0,
                features: tier.organization.features?.map(f => ({
                  feature_key: f.id,
                  feature_name: f.name,
                  is_enabled: f.enabled !== false,
                })),
              } : undefined,
              tenantTier: tier.tenant ? {
                tier_key: tier.tenant.id,
                display_name: tier.tenant.name,
                price_monthly: tier.tenant.limits?.maxProducts ? 49 : 0,
                max_skus: tier.tenant.limits?.maxProducts || 0,
                max_locations: tier.tenant.limits?.maxLocations || 0,
                features: tier.tenant.features?.map(f => ({
                  feature_key: f.id,
                  feature_name: f.name,
                  is_enabled: f.enabled !== false,
                })),
              } : undefined,
            }}
          />
        )}

        {/* Tier Gains Welcome - Celebrate what they unlocked */}
        {tier && tier.effective?.level && tier.effective?.name && (
          <>
            {/* {console.log('[TenantDashboard] Tier object:', tier)}
            {console.log('[TenantDashboard] tier.effective:', tier.effective)}
            {console.log('[TenantDashboard] tier.effective.id:', tier.effective.id)}
            {console.log('[TenantDashboard] tier.effective.level:', tier.effective.level)}
            {console.log('[TenantDashboard] tier.effective.name:', tier.effective.name)}
            {console.log('[TenantDashboard] tier.organization:', (tier as any).organization)}
            {console.log('[TenantDashboard] tier.tenant:', tier.tenant)} */}
            <Suspense fallback={<ComponentLoader />}>
              <TierGainsWelcome 
                currentTier={tier.tenant?.id || tier.effective.id}
                tierDisplayName={tier.tenant?.name || tier.effective.name}
                organizationTier={(tier as any).organization?.id}
                organizationTierDisplayName={(tier as any).organization?.name}
              />
            </Suspense>
          </>
        )}

        {/* Quick Actions */}
        <Suspense fallback={<ComponentLoader />}>
          <QuickActions 
            tenantId={tenantId}
            canManageSettings={canManageSettings}
          />
        </Suspense>

        {/* Visibility Cards - Path to Visibility */}
        <Suspense fallback={<ComponentLoader />}>
          <VisibilityCards
            tenantId={tenantId}
            tenantName={tenantData?.name || 'Your Store'}
            hasStorefront={tenantData?.statusInfo?.showStorefront}
            isInDirectory={tenantData?.statusInfo?.showInDirectory}
            hasPublishedDirectory={tenantData?.hasPublishedDirectory}
            hasProduct={!!usage?.totalItems && usage.totalItems > 0}
            slug={tenantData?.slug ?? null}
          />
        </Suspense>

        {/* Business Hours Card (tenant-scoped) */}
        <div className="mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
          >
            <MantineCard padding="md" radius="md" withBorder className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <Title order={4} className="text-base sm:text-lg font-bold text-neutral-900">Business Hours</Title>
                  </div>
                  {hoursInfo?.hasHours ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Hours Badge - Status */}
          <HoursStatusBadge status={hoursStatus} />
            <Text>{hoursStatus?.label}</Text>
                  </div>
                ) : (
                  <p className="text-sm sm:text-base text-neutral-500">
                    Set your store hours to display them here.
                  </p>
                )}
              </div>
              {(() => {
                // Use centralized permission helper
                if (!user || !canManageSettings) return null;
                return (
                  <Link href={`/t/${tenantId}/settings/hours`} className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap">
                      {hoursInfo?.hasHours ? '⚙️ Manage Hours' : '➕ Set Hours'}
                    </button>
                  </Link>
                );
              })()}
            </div>
          </MantineCard>
            </motion.div>
        </div>

        {/* Value Showcase - Only show when user has products */}
        {!loading && usage && usage.totalItems > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
            {/* Storefront Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <MantineCard padding="md" radius="md" withBorder className="p-6 h-full">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Title order={5} className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex-1 min-w-0">Your Storefront</Title>
                  <Badge color="green" variant="light">Live</Badge>
                </div>
                <Box mt="md">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text fw={600} className="text-neutral-900 text-sm sm:text-base">{usage.activeItems} Products Live</Text>
                      <Text size="xs" c="dimmed">Visible to customers</Text>
                    </div>
                  </div>
                  <Link href={`/tenant/${tenantId}`} target="_blank">
                    <Button fullWidth mt="md" variant="filled" style={{ color: 'white' }}>View Storefront →</Button>
                  </Link>
                </Box>
              </MantineCard>
            </motion.div>

            {/* Google Integration Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.3 }}
            >
              <MantineCard padding="md" radius="md" withBorder className="p-6 h-full">
                <Title order={5} className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Google Integration</Title>
                <Box mt="md">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text fw={600} className="text-neutral-900 text-sm sm:text-base">Google Shopping</Text>
                      <Text size="xs" c="dimmed">{usage.activeItems} products synced</Text>
                    </div>
                  </div>
                  <Link href={`/t/${tenantId}/settings`}>
                    <Button fullWidth mt="md" variant="filled" style={{ color: 'white' }}>Manage Integration →</Button>
                  </Link>
                </Box>
              </MantineCard>
            </motion.div>

            {/* Actionable Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              <MantineCard padding="md" radius="md" withBorder className="p-6 h-full">
                <Title order={5} className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Action Items</Title>
                <Box mt="md">
                  <Stack gap="sm">
                    {(0) > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                        <svg className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <Text size="xs" fw={500} className="text-neutral-900">{0} items need sync</Text>
                          <Link href={`/t/${tenantId}/items`} className="text-xs text-blue-600 hover:underline block mt-1">
                            Review sync status →
                          </Link>
                        </div>
                      </div>
                    )}
                    {(usage.totalItems - usage.activeItems) > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                        <svg className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <Text size="xs" fw={500} className="text-neutral-900">{usage.totalItems - usage.activeItems} inactive products</Text>
                          <Link href={`/t/${tenantId}/items`} className="text-xs text-blue-600 hover:underline block mt-1">
                            Activate products →
                          </Link>
                        </div>
                      </div>
                    )}
                    {(0) === 0 && (usage.totalItems - usage.activeItems) === 0 && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                        <svg className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <Text size="xs" fw={500} className="text-neutral-900">Everything looks great! 🎉</Text>
                      </div>
                    )}
                  </Stack>
                </Box>
              </MantineCard>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}

// Mobile Menu Button Component
function MobileMenuButton({ tenantId }: { tenantId: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-neutral-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-3 py-4 space-y-2">
            <Link href={`/t/${tenantId}/settings/tenant`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">Profile</Button>
            </Link>
            <Link href={`/t/${tenantId}/items`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">Inventory</Button>
            </Link>
            <Link href={`/t/${tenantId}/orders`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">Orders</Button>
            </Link>
            <Link href={`/t/${tenantId}/settings/integrations/google`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">Google Merchant</Button>
            </Link>
            <Link href={`/t/${tenantId}/settings/integrations`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">POS Integrations</Button>
            </Link>
            <Link href={`/t/${tenantId}/settings`} className="block" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="subtle" fullWidth size="md">Settings</Button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
