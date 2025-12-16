"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useTenantDashboard } from "@/hooks/dashboard/useTenantDashboard";
import { useTenantTier } from "@/hooks/dashboard/useTenantTier";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { canManageTenantSettings } from "@/lib/auth/access-control";
import DashboardHeader from "./DashboardHeader";
import DashboardStats from "./DashboardStats";
import QuickActions from "./QuickActions";
import DashboardSkeleton from "./DashboardSkeleton";
import TierBadge from "./TierBadge";
import TierGainsWelcome from "./TierGainsWelcome";
import WhatYouCanDo from "./WhatYouCanDo";
import UserProfileBadge from "./UserProfileBadge";
import VisibilityCards from "./VisibilityCards";
import TenantLimitBadge from "@/components/tenant/TenantLimitBadge";
import SubscriptionStateBanner from "@/components/subscription/SubscriptionStateBanner";
import LocationStatusBanner from "@/components/tenant/LocationStatusBanner";

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
  
  // Fetch dashboard stats
  const { data, loading: statsLoading, error: statsError } = useTenantDashboard(tenantId);
  
  // Fetch tier information
  const { tier, loading: tierLoading, error: tierError } = useTenantTier(tenantId);
  
  // Fetch user profile
  const { profile, loading: profileLoading } = useUserProfile();

  const canManageSettings = user ? canManageTenantSettings(user, tenantId) : false;
  
  const loading = statsLoading || tierLoading || profileLoading;
  const error = statsError || tierError;

  // Show skeleton while loading
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
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
        {data?.info?.locationStatus && (
          <LocationStatusBanner
            locationStatus={data.info.locationStatus}
            reopeningDate={data.info.reopeningDate}
            tenantName={data.info.name || 'This Location'}
            tenantId={tenantId}
            variant="full"
          />
        )}

        {/* Header */}
        <DashboardHeader 
          title={`${data?.info?.name || 'Tenant'} Dashboard`}
          subtitle="Manage your retail inventory and visibility across platforms"
        />

        {/* Stats */}
        <DashboardStats
          activeItems={data?.stats.activeItems || 0}
          syncIssues={data?.stats.syncIssues || 0}
          tenantId={tenantId}
        />

        {/* Tenant ID Display */}
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-lg border border-neutral-200">
            <span className="text-xs text-neutral-500 font-medium">Platform ID:</span>
            <code className="text-xs font-mono text-neutral-700 bg-white px-2 py-0.5 rounded border select-all">
              {tenantId}
            </code>
          </div>
        </div>

        {/* Tier Gains Welcome - Celebrate what they unlocked */}
        {tier && tier.effective?.level && tier.effective?.name && (
          <TierGainsWelcome 
            currentTier={tier.effective.level}
            tierDisplayName={tier.effective.name}
          />
        )}

        {/* Quick Actions */}
        <QuickActions 
          tenantId={tenantId}
          canManageSettings={canManageSettings}
        />

        {/* Visibility Cards - Path to Visibility */}
        <VisibilityCards
          tenantId={tenantId}
          tenantName={data?.info?.name || 'Your Store'}
          hasStorefront={true}
          isInDirectory={false}
        />

        {/* Tier-Aware Feature Showcase */}
        {tier && (
          <WhatYouCanDo 
            tier={tier}
            tenantId={tenantId}
          />
        )}
      </div>
    </div>
  );
}
