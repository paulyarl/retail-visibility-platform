'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge } from '@mantine/core';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tiers';
import { useTierSystem } from '@/hooks/useTierSystem';
import { isTrialStatus, getTrialEndLabel } from '@/lib/trial';
import { CHAIN_TIERS, type ChainTier } from '@/lib/chain-tiers';
import { isPlatformUser, isPlatformAdmin, type UserData } from '@/lib/auth/access-control';
import { useAuth } from '@/contexts/AuthContext';
import { ContextBadges } from '@/components/ContextBadges';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useQueryClient } from '@tanstack/react-query';
import { useUpgradeRequests } from '@/hooks/useApiQueries';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';
import { SelfServiceBillingWithStripe } from '@/components/subscription/SelfServiceBilling';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';

// Simple icon component for subscription page
const SubscriptionIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  effectiveExpiresAt?: string;
  effectiveExpiresType?: 'trial' | 'subscription' | 'manual';
  effectiveExpiresSource?: 'automatic_trial' | 'automatic_subscription' | 'manual_override';
  metadata?: any;
  city?: string;
  state?: string;
  countryCode?: string;
  bannerUrl?: string;
  _count?: {
    items: number;
  };
}

interface PendingRequest {
  id: string;
  requestedTier: string;
  currentTier: string;
  status: string;
  created_at: string;
  adminNotes?: string;
  processed_at?: string;
  processedBy?: string;
}


export default function SubscriptionPage({ tenantId: propTenantId }: { tenantId?: string } = {}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  // Get tenant ID from URL parameter, prop, or localStorage (in priority order)
  const urlTenantId = searchParams?.get('tenantId');
  let tenantId = urlTenantId || propTenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);
  
  // Debug: Log tenant ID resolution
  // console.log('[SubscriptionPage] Tenant ID resolution:', {
  //   urlTenantId,
  //   propTenantId,
  //   localStorageId: typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null,
  //   initialTenantId: tenantId,
  //   userTenants: user?.tenants?.map((t: any) => t.id)
  // });
  
  // Validate tenant ownership - PLATFORM_ADMIN and PLATFORM_SUPPORT can access any tenant
  if (urlTenantId && user?.tenants) {
    const userTenants = user.tenants.map((t: any) => t.id);
    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT';
    const isAuthorized = isPlatformAdmin || userTenants.includes(urlTenantId);
    
    // console.log('[SubscriptionPage] Validating URL tenant ID:', {
    //   urlTenantId,
    //   userTenants,
    //   userRole: user.role,
    //   isPlatformAdmin,
    //   isAuthorized
    // });
    
    if (!isAuthorized) {
      console.warn(`[Subscription] User ${user.id} attempted to access tenant ${urlTenantId} without authorization`);
      // Fall back to user's first tenant or localStorage
      tenantId = propTenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null) || user.tenants[0]?.id || null;
      // console.log('[SubscriptionPage] Fell back to tenant ID:', tenantId);
    } else {
      // console.log('[SubscriptionPage] Access granted to tenant:', urlTenantId);
    }
  }
  
  // Use React Query hooks instead of manual API calls
  const { tenant, isLoading, error } = useTenantComplete(tenantId || '');

  // Debug: Log tenant data to check effective expiration fields
  // console.log('[SubscriptionPage] Tenant data:', tenant);
  // console.log('[SubscriptionPage] Effective expiration:', {
  //   effectiveExpiresAt: tenant?.effectiveExpiresAt,
  //   effectiveExpiresType: tenant?.effectiveExpiresType,
  //   effectiveExpiresSource: tenant?.effectiveExpiresSource,
  // });

  // Cache invalidation for debugging
  const queryClient = useQueryClient();
  const invalidateCache = () => {
    if (tenantId) {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      // console.log('[SubscriptionPage] Cache invalidated for tenant:', tenantId);
    }
  };

  const { data: pendingRequests = [], isLoading: pendingLoading } = useUpgradeRequests(tenantId || undefined, 'new,pending,waiting');
  const { data: requestHistory = [], isLoading: historyLoading } = useUpgradeRequests(tenantId || undefined, 'complete,denied');

  const combinedLoading = isLoading || pendingLoading || historyLoading;

  // Use centralized subscription usage hook
  const { usage: capacityData } = useSubscriptionUsage(tenantId || undefined);

  // Capability-aware resolution for all three capability types
  const allCapabilities = useAllCapabilities(tenantId || null, { forTenant: true });

  // Use dynamic tier system hook
  const { 
    individualTiers, 
    organizationTiers, 
    getTierInfo: getDynamicTierInfo, 
    loading: tiersLoading 
  } = useTierSystem();

  // Add back missing state variables
  const [showHistory, setShowHistory] = useState(false);

  // Show loading while user, tenant, or tier data is being fetched
  if (combinedLoading || !user || tiersLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-600">Loading subscription details...</div>
      </div>
    );
  }

  // Platform users see catalog view only if no tenant context
  if (isPlatformUser(user) && !tenant && !propTenantId) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Subscription Management"
          description="Location subscription management - Available subscription tiers"
          icon={Icons.Settings}
          backLink={{
            href: '/settings/admin',
            label: 'Back to Settings'
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Platform User Info */}
          <Card withBorder padding="lg" radius="md" className="border-2 border-purple-500 bg-purple-50">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  {(user.role as string) === 'PLATFORM_ADMIN' && <span className="text-white text-xl">👑</span>}
                  {(user.role as string) === 'PLATFORM_SUPPORT' && <span className="text-white text-xl">🛠️</span>}
                  {(user.role as string) === 'PLATFORM_VIEWER' && <span className="text-white text-xl">👁️</span>}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900">
                    {(user.role as string) === 'PLATFORM_ADMIN' && '👑 Platform Administrator'}
                    {(user.role as string) === 'PLATFORM_SUPPORT' && '🛠️ Platform Support'}
                    {(user.role as string) === 'PLATFORM_VIEWER' && '👁️ Platform Viewer'}
                  </h3>
                  <p className="text-sm text-purple-800 mt-1">
                    You have platform-level access. You don't have a personal subscription.
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">Your Access:</h4>
                <ul className="space-y-2 text-sm text-purple-800">
                  {(user.role as string) === 'PLATFORM_ADMIN' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>View all tenant subscriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>Create and assign subscriptions to store owners</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>Modify platform settings</span>
                      </li>
                    </>
                  )}
                  {(user.role as string) === 'PLATFORM_SUPPORT' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>View all tenant subscriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>Assist customers with subscription questions</span>
                      </li>
                    </>
                  )}
                  {(user.role as string) === 'PLATFORM_VIEWER' && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>View all tenant subscriptions (read-only)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 font-bold">✓</span>
                        <span>Access analytics and reporting</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </Card>

          {/* Available Tiers Catalog */}
          <div>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Available Subscription Tiers</h2>
            <p className="text-neutral-600 mb-6">
              {isPlatformAdmin(user) 
                ? 'You can create and assign these subscriptions to store owners.'
                : 'View available subscription tiers for reference.'}
            </p>

            {/* Individual Plans */}
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Individual Location Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {individualTiers.length > 0 ? (
                individualTiers.map((tier) => {
                  const info = getDynamicTierInfo(tier.tierKey);
                  return (
                    <Card key={tier.id} className="border-2 border-neutral-200" withBorder padding="lg" radius="md">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{tier.displayName}</h3>
                          <div className="text-2xl font-bold text-neutral-900">
                      {tier.priceMonthly > 0 ? `$${tier.priceMonthly}/month` : 'Free / 14-day'}
                    </div>
                        </div>
                        <p className="text-sm text-neutral-600">{tier.description}</p>
                        <div className="space-y-2">
                          <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                            <span className="font-semibold text-orange-900">SKUs:</span>{' '}
                            <span className="text-orange-700 font-medium">
                              {tier.maxSkus === null || tier.maxSkus === Infinity ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-1.5 text-xs">
                          {(tier.features || info.features)?.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span className="text-neutral-700">
                                {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  );
                })
              ) : (
                // Fallback to static tiers if API unavailable
                (['starter', 'discovery', 'commitment', 'storefront', 'professional', 'enterprise', 'organization'] as SubscriptionTier[]).map((tier) => {
                  const info = TIER_LIMITS[tier];
                  return (
                    <Card key={tier} className="border-2 border-neutral-200" withBorder padding="lg" radius="md">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{info.name}</h3>
                          <div className="text-2xl font-bold text-neutral-900">{info.price}</div>
                        </div>
                        <p className="text-sm text-neutral-600">{info.description}</p>
                        <div className="space-y-2">
                          <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                            <span className="font-semibold text-orange-900">SKUs:</span>{' '}
                            <span className="text-orange-700 font-medium">
                              {info.maxSkus === Infinity ? 'Unlimited' : info.maxSkus.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-1.5 text-xs">
                          {info.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span className="text-neutral-700">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Chain Plans */}
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Multi-Location Chain Plans</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {organizationTiers.length > 0 ? (
                organizationTiers.map((tier) => {
                  const info = getDynamicTierInfo(tier.tierKey);
                  return (
                    <Card key={tier.id} className="border-2 border-neutral-200" withBorder padding="lg" radius="md">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{tier.displayName}</h3>
                          <div className="text-2xl font-bold text-neutral-900">
                            {tier.priceMonthly > 0 ? `$${tier.priceMonthly}/month` : 'Free / 14-day'}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            <span className="font-semibold text-amber-900">Locations:</span>{' '}
                            <span className="text-amber-700 font-medium">
                              {tier.maxLocations === null || tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations}
                            </span>
                          </div>
                          <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                            <span className="font-semibold text-orange-900">Total SKUs:</span>{' '}
                            <span className="text-orange-700 font-medium">
                              {tier.maxSkus === null || tier.maxSkus === Infinity ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-1.5 text-xs">
                          {(tier.features || (info as any).features)?.slice(0, 4).map((feature: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span className="text-neutral-700">
                                {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  );
                })
              ) : (
                // Fallback to static chain tiers if API unavailable
                (['chain_starter', 'chain_professional', 'chain_enterprise'] as ChainTier[]).map((tier) => {
                  const info = CHAIN_TIERS[tier];
                  return (
                    <Card key={tier} className="border-2 border-neutral-200" withBorder padding="lg" radius="md">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{info.name}</h3>
                          <div className="text-2xl font-bold text-neutral-900">{info.price}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            <span className="font-semibold text-amber-900">Locations:</span>{' '}
                            <span className="text-amber-700 font-medium">
                              {info.maxLocations === Infinity ? 'Unlimited' : info.maxLocations}
                            </span>
                          </div>
                          <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                            <span className="font-semibold text-orange-900">Total SKUs:</span>{' '}
                            <span className="text-orange-700 font-medium">
                              {info.maxTotalSKUs === Infinity ? 'Unlimited' : info.maxTotalSKUs.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-1.5 text-xs">
                          {info.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span className="text-neutral-700">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Store owners need a tenant to view subscription
  if (!tenant) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md" withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">No Subscription Found</h3>
            <p className="text-neutral-700">
              You don't have an active subscription. Please select a store or contact support.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const currentTier = tenant.subscriptionTier || (tenant as any).subscription_tier || 'trial';
  const isChainTier = currentTier.startsWith('chain_');
  const tierInfo = getDynamicTierInfo(currentTier);
  
  // Use capacity data from centralized hook
  const skuUsage = capacityData?.skuUsage || 0;
  const skuLimit = capacityData?.skuLimit || (isChainTier 
    ? (tierInfo as any).maxTotalSKUs 
    : (tierInfo as any).maxSkus);
  const usagePercent = capacityData?.skuPercent || 0;

  // Use dynamic tiers from API, fallback to static if unavailable
  const availableTiers = individualTiers.length > 0 ? 
    individualTiers.filter(tier => tier.tierKey !== 'expired_trial') :
    (['starter', 'discovery', 'commitment', 'storefront', 'professional', 'enterprise', 'organization'] as SubscriptionTier[]).map(tier => ({
      id: tier,
      tierKey: tier,
      name: tier,
      displayName: TIER_LIMITS[tier].name,
      description: TIER_LIMITS[tier].description,
      priceMonthly: TIER_LIMITS[tier].pricePerMonth,
      maxSkus: TIER_LIMITS[tier].maxSkus,
      maxLocations: TIER_LIMITS[tier].maxLocations,
      tierType: 'individual',
      isActive: true,
      sortOrder: ['starter', 'discovery', 'commitment', 'storefront', 'professional', 'enterprise', 'organization'].indexOf(tier),
      features: TIER_LIMITS[tier].features,
      createdAt: '',
      updatedAt: '',
    }));
  
  const availableChainTiers = organizationTiers.length > 0 ? 
    organizationTiers.filter(tier => tier.tierKey !== 'expired_trial') :
    (['chain_starter', 'chain_professional', 'chain_enterprise'] as ChainTier[]).map(tier => ({
      id: tier,
      tierKey: tier,
      name: tier,
      displayName: CHAIN_TIERS[tier].name,
      description: '',
      priceMonthly: CHAIN_TIERS[tier].pricePerMonth,
      maxSkus: CHAIN_TIERS[tier].maxTotalSKUs,
      maxLocations: CHAIN_TIERS[tier].maxLocations,
      tierType: 'organization',
      isActive: true,
      sortOrder: ['chain_starter', 'chain_professional', 'chain_enterprise'].indexOf(tier),
      features: CHAIN_TIERS[tier].features,
      createdAt: '',
      updatedAt: '',
    }));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Subscription Management"
        icon={<SubscriptionIcon />}
        actions={
          <Button
            onClick={invalidateCache}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Clear Cache & Refresh
          </Button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        <SubscriptionStatusGuide />

        {/* Context Badges */}
        <ContextBadges 
          tenant={tenant || undefined} 
          showPlatformRole={!tenant}
          contextLabel="Subscription"
        />
        
        {/* Current Plan */}
        {/* SKU Overage Alert */}
        {skuLimit !== Infinity && usagePercent > 100 && (
          <Card className="border-2 border-red-500 bg-red-50" withBorder padding="lg" radius="md">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900">⚠️ SKU Limit Exceeded</h3>
                  <p className="text-sm text-red-800 mt-1">
                    You are currently using <strong>{skuUsage.toLocaleString()} SKUs</strong>, which exceeds your plan limit of <strong>{skuLimit.toLocaleString()} SKUs</strong>.
                  </p>
                </div>
              </div>
              <div className="bg-red-100 rounded-lg p-4 border border-red-300">
                <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Current Limitations:
                </h4>
                <ul className="space-y-2 text-sm text-red-900">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Cannot add new products</strong> - Product creation is disabled until you're back within your limit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Cannot import products</strong> - Bulk imports and scanning are temporarily blocked</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span><strong>Existing products remain visible</strong> - Your storefront and inventory are still accessible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">⚠</span>
                    <span><strong>Grace period:</strong> You have 7 days to resolve this before additional restrictions may apply</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <h4 className="font-semibold text-red-900 mb-2">Action Required:</h4>
                <ul className="space-y-2 text-sm text-red-800">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span><strong>Option 1:</strong> Remove {(skuUsage - skuLimit).toLocaleString()} SKUs to get back within your limit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span><strong>Option 2:</strong> Upgrade to a higher tier plan to accommodate your inventory</span>
                  </li>
                </ul>
                <div className="mt-4 flex gap-3">
                  <Button 
                    variant="danger" 
                    onClick={() => {
                      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
                      if (tenantId) {
                        window.location.href = `/t/${tenantId}/products`;
                      }
                    }}
                  >
                    Manage Products
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View Upgrade Options
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Near Limit Warning */}
        {skuLimit !== Infinity && usagePercent >= 90 && usagePercent <= 100 && (
          <Card className="border-2 border-amber-500 bg-amber-50" withBorder padding="lg" radius="md">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-amber-900">⚠️ Approaching SKU Limit</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    You're using <strong>{usagePercent}%</strong> of your SKU limit ({skuUsage.toLocaleString()} / {skuLimit.toLocaleString()} SKUs). Consider upgrading soon to avoid hitting your limit.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="border-2 border-primary-500" withBorder padding="lg" radius="md">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3>Current Plan</h3>
              <Badge variant="default" className={tierInfo.color}>
                {tierInfo.name}
              </Badge>
            </div>

            {/* Pricing */}
            <div>
              <div className="text-3xl font-bold text-neutral-900">
                {tierInfo.pricePerMonth > 0 ? `$${tierInfo.pricePerMonth}/month` : 'Free / 14-day'}
              </div>
              <p className="text-neutral-600 mt-1">
                {isChainTier 
                  ? `${(tierInfo as any).maxLocations === Infinity ? 'Unlimited' : (tierInfo as any).maxLocations} locations, ${(tierInfo as any).maxTotalSKUs === Infinity ? 'unlimited' : (tierInfo as any).maxTotalSKUs.toLocaleString()} SKUs`
                  : (tierInfo as any).description
                }
              </p>
            </div>

            {/* SKU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700">SKU Usage</span>
                <span className="text-sm text-neutral-600">
                  {skuUsage.toLocaleString()} / {skuLimit === Infinity ? '∞' : skuLimit.toLocaleString()}
                </span>
              </div>
              {skuLimit !== Infinity && (
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      usagePercent >= 90 ? 'bg-red-500' : 
                      usagePercent >= 70 ? 'bg-amber-500' : 
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Features */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Your Plan Includes:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tierInfo.features.map((feature: any, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-sm text-neutral-700">
                      {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capability Summary — shows resolved commerce, payment, and storefront states */}
            {allCapabilities.data && (
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">Active Capabilities:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Commerce */}
                  <div className={`p-3 rounded-lg border ${allCapabilities.data.commerce.enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${allCapabilities.data.commerce.enabled ? 'text-green-800' : 'text-red-800'}`}>
                        Commerce
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${allCapabilities.data.commerce.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {allCapabilities.data.commerce.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      {allCapabilities.data.commerce.paymentType === 'none' ? 'No payment options' :
                       allCapabilities.data.commerce.paymentType === 'deposit' ? 'Deposit only' :
                       allCapabilities.data.commerce.paymentType === 'full' ? 'Full payment' :
                       allCapabilities.data.commerce.paymentType === 'both' ? 'Deposit + Full payment' :
                       'Standard'}
                    </p>
                  </div>
                  {/* Payment Gateway */}
                  <div className={`p-3 rounded-lg border ${allCapabilities.data.paymentGateway.enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${allCapabilities.data.paymentGateway.enabled ? 'text-green-800' : 'text-red-800'}`}>
                        Payment Gateways
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${allCapabilities.data.paymentGateway.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {allCapabilities.data.paymentGateway.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      {allCapabilities.data.paymentGateway.allowedGateways.length > 0
                        ? allCapabilities.data.paymentGateway.allowedGateways.join(', ')
                        : 'No gateways configured'}
                    </p>
                  </div>
                  {/* Storefront */}
                  <div className={`p-3 rounded-lg border ${allCapabilities.data.storefront.enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${allCapabilities.data.storefront.enabled ? 'text-green-800' : 'text-red-800'}`}>
                        Storefront
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${allCapabilities.data.storefront.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {allCapabilities.data.storefront.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      {allCapabilities.data.storefront.type === 'none' ? 'No storefront' :
                       allCapabilities.data.storefront.type === 'online' ? 'Online only' :
                       allCapabilities.data.storefront.type === 'retail' ? 'Retail only' :
                       allCapabilities.data.storefront.type === 'both' ? 'Online + Retail' :
                       'Standard'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="pt-4 border-t border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Status</span>
                <Badge variant={tenant.subscriptionStatus === 'active' ? 'success' : 'default'}>
                  {tenant.subscriptionStatus || 'Active'}
                </Badge>
              </div>
              
              {/* Service Level */}
              {tenant.service_level && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Service Level</span>
                  <span className="text-sm font-medium text-neutral-900 capitalize">
                    {tenant.service_level.replace('_', ' ')}
                  </span>
                </div>
              )}
              
              {/* Account Created */}
              {tenant.createdAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Account Created</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {/* Grace Period */}
              {tenant.grace_ends_at && (
                <div className="flex items-center justify-between p-2 rounded bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-800">Grace Period</span>
                  </div>
                  <span className="text-sm font-bold text-blue-900">
                    {new Date(tenant.grace_ends_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {/* Effective Expiration */}
              {(() => {
                // console.log('[SubscriptionPage] Effective expiration check:', {
                //   effectiveExpiresAt: tenant?.effectiveExpiresAt,
                //   effectiveExpiresType: tenant?.effectiveExpiresType,
                //   effectiveExpiresSource: tenant?.effectiveExpiresSource,
                //   shouldShow: !!tenant?.effectiveExpiresAt
                // });
                return tenant?.effectiveExpiresAt;
              })() && (
                <div className="p-3 rounded-lg border-l-4 bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-500">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        {tenant.effectiveExpiresType === 'trial' 
                          ? 'Trial Ends' 
                          : tenant.effectiveExpiresType === 'manual'
                            ? 'Expires'
                            : 'Renews On'
                        }
                      </span>
                    </div>
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                      {getTrialEndLabel(tenant.effectiveExpiresAt) ?? ''}
                    </span>
                  </div>
                  {tenant.effectiveExpiresSource && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-300">Source:</span>
                      <span className="font-medium text-amber-800 dark:text-amber-200 capitalize">
                        {tenant.effectiveExpiresSource.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Organization Info */}
              {tenant.organizationId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Organization ID</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {tenant.organizationId}
                  </span>
                </div>
              )}

              {/* Reopening Date */}
              {tenant.reopening_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Reopening Date</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {new Date(tenant.reopening_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Metadata Summary Card */}
              {tenant && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tenant Information</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tenant ID:</span>
                      <span className="font-mono text-xs text-slate-800 dark:text-slate-200">{tenant.id}</span>
                    </div>
                    {tenant.city && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">City:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.city}</span>
                      </div>
                    )}
                    {tenant.state && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">State:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.state}</span>
                      </div>
                    )}
                    {tenant.countryCode && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Country:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{tenant.countryCode}</span>
                      </div>
                    )}
                    {tenant.bannerUrl && (
                      <div className="mt-2">
                        <span className="text-slate-600 dark:text-slate-400">Banner:</span>
                        <div className="mt-1 rounded overflow-hidden border border-slate-300 dark:border-slate-600">
                          <img 
                            src={tenant.bannerUrl} 
                            alt="Tenant Banner" 
                            className="w-full h-16 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Subscription Expiration */}
              {tenant.subscriptionStatus === 'active' && tenant.subscriptionEndsAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Renews On</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {new Date(tenant.subscriptionEndsAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action Guidance */}
        {tenant && (
          <Card withBorder padding="lg" radius="md" className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Ready to Manage Your Subscription?</h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Click "Add Card"</span> to activate Stripe for secure card payments
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Click "Add PayPal"</span> to connect your PayPal account for payments
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Click "Change Plan"</span> to select a different subscription tier
                  </p>
                </div>
                <div className="mt-3 p-2 bg-blue-100/50 rounded-md border border-blue-200 dark:bg-blue-800/30 dark:border-blue-600">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> Your current subscription is manually managed. Adding a payment method will enable automatic renewals and prevent service interruption.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Self-Service Billing - Payment Methods & Tier Selection */}
        {tenant && (
          <SelfServiceBillingWithStripe 
            tenantId={tenant.id}
            currentTier={currentTier}
            subscriptionStatus={tenant.subscriptionStatus}
            onTierChange={(newTier) => {
              // Refresh tenant data after tier change
              window.location.reload();
            }}
          />
        )}

        {/* Invoice History Link */}
        {tenant && (
          <Card withBorder padding="lg" radius="md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Invoice History</h3>
                  <p className="text-sm text-neutral-600">View past invoices and download receipts</p>
                </div>
              </div>
              <Button
                variant="light"
                onClick={() => {
                  if (tenant?.id) {
                    window.location.href = `/t/${tenant.id}/settings/billing/invoices`;
                  } else {
                    window.location.href = '/settings/billing/invoices';
                  }
                }}
              >
                View Invoices
              </Button>
            </div>
          </Card>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Card className="border-2 border-amber-500 bg-amber-50" withBorder padding="lg" radius="md">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-amber-900">Pending Subscription Change Requests</h3>
              </div>
              <div className="space-y-3">
                {pendingRequests.map((request: PendingRequest) => {
                  const requestedTierInfo = getDynamicTierInfo(request.requestedTier as any);
                  const statusColors = {
                    new: 'bg-blue-100 text-blue-800',
                    pending: 'bg-amber-100 text-amber-800',
                    waiting: 'bg-gray-100 text-gray-800',
                  };
                  const statusColor = statusColors[request.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
                  
                  return (
                    <div key={request.id} className="bg-white p-4 rounded-lg border border-amber-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-neutral-900">
                              Requesting: {requestedTierInfo.name}
                            </span>
                            <Badge className={statusColor}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-600">
                            Submitted: {new Date(request.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      {request.adminNotes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs font-medium text-blue-900 mb-1">Admin Notes:</p>
                          <p className="text-sm text-blue-800">{request.adminNotes}</p>
                        </div>
                      )}
                      <p className="text-xs text-amber-700 mt-2">
                        ⏳ Your subscription will be updated once this request is approved by our team.
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Subscription History */}
        {requestHistory.length > 0 && (
          <Card withBorder padding="lg" radius="md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3>Subscription History</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? 'Hide' : 'Show'} ({requestHistory.length})
                </Button>
              </div>
              {showHistory && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">💡 Transparency Note:</span> This history shows all your subscription changes. 
                      If you're wondering why certain features are no longer available, check here to see when your plan changed and why.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {requestHistory.map((request: PendingRequest) => {
                      const fromTierInfo = getDynamicTierInfo(request.currentTier as any);
                      const toTierInfo = getDynamicTierInfo(request.requestedTier as any);
                      const isApproved = request.status === 'complete';
                      const isDenied = request.status === 'denied';
                      
                      // Determine if upgrade or downgrade
                      const tierOrder = ['starter', 'discovery', 'commitment', 'storefront', 'professional', 'enterprise'];
                      const chainTierOrder = ['chain_starter', 'chain_professional', 'chain_enterprise'];
                      const isChain = (request.currentTier as string).startsWith('chain_');
                      const order = isChain ? chainTierOrder : tierOrder;
                      const fromIndex = order.indexOf(request.currentTier as string);
                      const toIndex = order.indexOf(request.requestedTier as string);
                      const isUpgrade = toIndex > fromIndex;
                      
                      return (
                        <div 
                          key={request.id} 
                          className={`p-4 rounded-lg border-2 ${
                            isApproved && isUpgrade ? 'bg-green-50 border-green-200' : 
                            isApproved && !isUpgrade ? 'bg-red-50 border-red-200' :
                            isDenied ? 'bg-red-50 border-red-200' : 
                            'bg-neutral-50 border-neutral-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-neutral-900">
                                  {fromTierInfo.name}
                                </span>
                                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="font-semibold text-neutral-900">
                                  {toTierInfo.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-neutral-600">
                                <span>
                                  Requested: {new Date(request.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                                {request.processed_at && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {isApproved ? 'Approved' : 'Denied'}: {new Date(request.processed_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge className={
                              isApproved && isUpgrade ? 'bg-green-100 text-green-800' : 
                              isApproved && !isUpgrade ? 'bg-red-100 text-red-800' :
                              isDenied ? 'bg-red-100 text-red-800' : 
                              'bg-neutral-100 text-neutral-800'
                            }>
                              {isApproved ? (isUpgrade ? '↑ Upgraded' : '↓ Downgraded') : isDenied ? '✗ Denied' : request.status}
                            </Badge>
                          </div>
                          {request.adminNotes && (
                            <div className={`mt-2 p-2 rounded border ${
                              isApproved && isUpgrade ? 'bg-green-100 border-green-300' : 
                              isApproved && !isUpgrade ? 'bg-red-100 border-red-300' :
                              isDenied ? 'bg-red-100 border-red-300' : 
                              'bg-neutral-100 border-neutral-300'
                            }`}>
                              <p className="text-xs font-medium text-neutral-900 mb-1">Admin Notes:</p>
                              <p className="text-sm text-neutral-700">{request.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Change Plan Section */}
        <div id="available-plans">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Additional Plan Details</h2>
          <p className="text-neutral-600 mb-6">
            Explore all available plans and their features. Use the self-service billing above to upgrade your subscription.
          </p>

          {/* Individual Plans Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-neutral-900">Individual Plans</h3>
            </div>
            <p className="text-neutral-600 mb-6">Perfect for single-location businesses and startups.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availableTiers.filter(tier => !tier.tierKey?.startsWith('trial_')).map((tier) => {
                const tierKey = tier.tierKey || tier.id;
                const info = getDynamicTierInfo(tierKey);
                const isCurrent = tierKey === currentTier || tier.name === currentTier;
                
                return (
                  <Card 
                    key={tier.id}
                    className={`${isCurrent ? 'border-2 border-primary-500 opacity-60 p-6 rounded-lg' : 'border-2 border-neutral-200 hover:border-primary-300 transition-colors p-6 rounded-lg'}`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg">{tier.displayName}</h3>
                        {isCurrent && (
                          <Badge variant="default" className="bg-primary-500 text-white">Current</Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {tier.priceMonthly > 0 ? `$${tier.priceMonthly}/month` : 'Free / 14-day'}
                      </div>
                      <p className="text-sm text-neutral-600">{tier.description || info.description}</p>
                      
                      <div className="space-y-2">
                        <div className="text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          <span className="font-semibold text-amber-900">Locations:</span>{' '}
                          <span className="text-amber-700 font-medium">
                            {tier.maxLocations === null || tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations}
                          </span>
                        </div>
                        <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                          <span className="font-semibold text-orange-900">SKUs:</span>{' '}
                          <span className="text-orange-700 font-medium">
                            {tier.maxSkus === null || tier.maxSkus === Infinity ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-1.5 text-xs">
                        {(tier.features || info.features)?.slice(0, 4).map((feature: any, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5"></span>
                            <span className="text-neutral-700">
                              {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isCurrent && (
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled
                        >
                          Current Plan
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Trial Plans Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-neutral-900">Trial Plans</h3>
            </div>
            <p className="text-neutral-600 mb-6">Try our features risk-free for 14 days. No credit card required.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availableTiers.filter(tier => tier.tierKey?.startsWith('trial_')).map((tier) => {
                const tierKey = tier.tierKey || tier.id;
                const info = getDynamicTierInfo(tierKey);
                const isCurrent = tierKey === currentTier || tier.name === currentTier;
                
                return (
                  <Card 
                    key={tier.id}
                    className={`${isCurrent ? 'border-2 border-primary-500 opacity-60 p-6 rounded-lg' : 'border-2 border-neutral-200 hover:border-primary-300 transition-colors p-6 rounded-lg'}`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg">{tier.displayName}</h3>
                        {isCurrent && (
                          <Badge variant="default" className="bg-primary-500 text-white">Current</Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {tier.priceMonthly > 0 ? `$${tier.priceMonthly}/month` : 'Free / 14-day'}
                      </div>
                      <p className="text-sm text-neutral-600">{tier.description || info.description}</p>
                      
                      <div className="space-y-2">
                        <div className="text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          <span className="font-semibold text-amber-900">Locations:</span>{' '}
                          <span className="text-amber-700 font-medium">
                            {tier.maxLocations === null || tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations}
                          </span>
                        </div>
                        <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                          <span className="font-semibold text-orange-900">SKUs:</span>{' '}
                          <span className="text-orange-700 font-medium">
                            {tier.maxSkus === null || tier.maxSkus === Infinity ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-1.5 text-xs">
                        {(tier.features || info.features)?.slice(0, 4).map((feature: any, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5"></span>
                            <span className="text-neutral-700">
                              {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isCurrent && (
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled
                        >
                          Current Plan
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Organization Plans Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-neutral-900">Organization Plans</h3>
            </div>
            <p className="text-neutral-600 mb-6">Perfect for businesses with multiple locations. Massive savings compared to individual plans.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availableChainTiers.map((tier) => {
                const tierKey = tier.tierKey || tier.id;
                const info = getDynamicTierInfo(tierKey);
                const isCurrent = tierKey === currentTier || tier.name === currentTier;
                
                return (
                  <Card 
                    key={tier.id}
                    className={`${isCurrent ? 'border-2 border-primary-500 opacity-60 p-6 rounded-lg' : 'border-2 border-neutral-200 hover:border-primary-300 transition-colors p-6 rounded-lg'}`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg">{tier.displayName}</h3>
                        {isCurrent && (
                          <Badge variant="default" className="bg-primary-500 text-white">Current</Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {tier.priceMonthly > 0 ? `$${tier.priceMonthly}/month` : 'Free / 14-day'}
                      </div>
                      <p className="text-sm text-neutral-600">{tier.description || info.description}</p>
                      
                      <div className="space-y-2">
                        <div className="text-sm bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          <span className="font-semibold text-amber-900">Locations:</span>{' '}
                          <span className="text-amber-700 font-medium">
                            {tier.maxLocations === null || tier.maxLocations === Infinity ? 'Unlimited' : tier.maxLocations}
                          </span>
                        </div>
                        <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                          <span className="font-semibold text-orange-900">Total SKUs:</span>{' '}
                          <span className="text-orange-700 font-medium">
                            {tier.maxSkus === null || tier.maxSkus === Infinity ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-1.5 text-xs">
                        {(tier.features || info.features)?.slice(0, 4).map((feature: any, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5"></span>
                            <span className="text-neutral-700">
                              {typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isCurrent && (
                        <Button
                          variant="secondary"
                          className="w-full"
                          disabled
                        >
                          Current Plan
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* View All Offerings */}
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200 p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  Explore All Platform Offerings
                </h3>
                <p className="text-neutral-700">
                  View all subscription tiers, chain pricing, and managed services options
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => window.location.href = '/settings/offerings' as any}
                style={{ color: 'white' }}
              >
                View All Offerings
              </Button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
