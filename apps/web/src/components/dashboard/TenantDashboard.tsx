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
        {/* Top Bar: User Profile + Tier Badge */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* User Profile */}
          {profile && (
            <div className="flex-1 min-w-[300px]">
              <UserProfileBadge profile={profile} />
            </div>
          )}
          
          {/* Tier Badge */}
          {tier && (
            <div className="shrink-0">
              <TierBadge tier={tier} showDetails={true} />
            </div>
          )}
        </div>

        {/* Header */}
        <DashboardHeader 
          title={`${data?.info?.name || 'Tenant'} Dashboard`}
          subtitle="Manage your retail inventory and visibility across platforms"
        />

        {/* Stats */}
        <DashboardStats
          totalItems={data?.stats.totalItems || 0}
          activeItems={data?.stats.activeItems || 0}
          syncIssues={data?.stats.syncIssues || 0}
          locations={data?.stats.locations || 0}
        />

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
