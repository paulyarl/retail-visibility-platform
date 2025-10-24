'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { TIER_LIMITS, type SubscriptionTier } from '@/lib/tiers';
import { CHAIN_TIERS, type ChainTier } from '@/lib/chain-tiers';
import { getAdminEmail } from '@/lib/admin-emails';

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  metadata?: any;
  _count?: {
    items: number;
  };
}

export default function SubscriptionPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | ChainTier | null>(null);
  const [showChangeModal, setShowChangeModal] = useState(false);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        // Get current tenant from localStorage
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) {
          setLoading(false);
          return;
        }

        // Fetch tenant info
        const res = await fetch(`/api/tenants/${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          
          // Get SKU count
          const itemsRes = await fetch(`/api/items?tenantId=${tenantId}`);
          const items = await itemsRes.json();
          const itemCount = Array.isArray(items) ? items.length : 0;
          
          setTenant({
            ...data,
            _count: {
              items: itemCount
            }
          });
        }
      } catch (error) {
        console.error('Failed to load tenant:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTenant();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-600">Loading subscription details...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-600">Unable to load subscription information</div>
      </div>
    );
  }

  const currentTier = tenant.subscriptionTier || 'trial';
  const isChainTier = currentTier.startsWith('chain_');
  const tierInfo = isChainTier 
    ? CHAIN_TIERS[currentTier as ChainTier]
    : TIER_LIMITS[currentTier as SubscriptionTier];
  const skuUsage = tenant._count?.items || 0;
  const skuLimit = isChainTier 
    ? (tierInfo as any).maxTotalSKUs 
    : (tierInfo as any).maxSKUs;
  const usagePercent = skuLimit === Infinity ? 0 : Math.round((skuUsage / skuLimit) * 100);

  const handleRequestChange = (newTier: SubscriptionTier | ChainTier) => {
    setSelectedTier(newTier);
    setShowChangeModal(true);
  };

  const getTierInfo = (tier: SubscriptionTier | ChainTier) => {
    if (tier.startsWith('chain_')) {
      return CHAIN_TIERS[tier as ChainTier];
    }
    return TIER_LIMITS[tier as SubscriptionTier];
  };

  const handleSubmitChange = () => {
    const metadata = tenant.metadata as any;
    const requestedTierInfo = getTierInfo(selectedTier!);
    
    // Get email from Email Management configuration
    const adminEmail = getAdminEmail('subscription');
    const subject = encodeURIComponent(`Subscription Change Request - ${metadata?.businessName || tenant.name}`);
    const body = encodeURIComponent(
      `Hello,\n\n` +
      `I would like to change my subscription plan.\n\n` +
      `Current Plan: ${tierInfo.name}\n` +
      `Requested Plan: ${requestedTierInfo.name}\n` +
      `Business: ${metadata?.businessName || tenant.name}\n` +
      `Tenant ID: ${tenant.id}\n\n` +
      `Please process this subscription change at your earliest convenience.\n\n` +
      `Thank you!`
    );
    
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    setShowChangeModal(false);
  };

  const availableTiers: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const availableChainTiers: ChainTier[] = ['chain_starter', 'chain_professional', 'chain_enterprise'];

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Subscription"
        description="Manage your subscription plan and view features"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Current Plan */}
        <Card className="border-2 border-primary-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              <Badge variant="default" className={tierInfo.color}>
                {tierInfo.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Pricing */}
              <div>
                <div className="text-3xl font-bold text-neutral-900">{tierInfo.price}</div>
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
                  {tierInfo.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span className="text-sm text-neutral-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Status</span>
                  <Badge variant={tenant.subscriptionStatus === 'active' ? 'success' : 'default'}>
                    {tenant.subscriptionStatus || 'Active'}
                  </Badge>
                </div>
                
                {/* Trial Expiration */}
                {tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Trial Ends</span>
                    <span className="text-sm font-medium text-neutral-900">
                      {new Date(tenant.trialEndsAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
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
          </CardContent>
        </Card>

        {/* Change Plan Section */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Change Your Plan</h2>
          <p className="text-neutral-600 mb-6">
            Select a different plan to request a subscription change. An email will be sent to our team for approval.
          </p>

          {/* Individual Plans */}
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Individual Location Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {availableTiers.map((tier) => {
              const info = TIER_LIMITS[tier];
              const isCurrent = tier === currentTier;
              
              return (
                <Card 
                  key={tier}
                  className={`${isCurrent ? 'border-2 border-primary-500 opacity-60' : 'border-2 border-neutral-200 hover:border-primary-300 transition-colors'}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-lg">{info.name}</CardTitle>
                      {isCurrent && (
                        <Badge variant="default" className="bg-primary-500 text-white">Current</Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-neutral-900">{info.price}</div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-600 mb-4">{info.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="text-sm bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
                        <span className="font-semibold text-orange-900">SKUs:</span>{' '}
                        <span className="text-orange-700 font-medium">
                          {info.maxSKUs === Infinity ? 'Unlimited' : info.maxSKUs.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-xs mb-4">
                      {info.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span className="text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={isCurrent ? 'secondary' : 'primary'}
                      className="w-full"
                      disabled={isCurrent}
                      onClick={() => handleRequestChange(tier)}
                    >
                      {isCurrent ? 'Current Plan' : 'Request Change'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chain Plans */}
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Multi-Location Chain Plans</h3>
          <p className="text-sm text-neutral-600 mb-4">
            Perfect for businesses with multiple locations. Massive savings compared to individual plans.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availableChainTiers.map((tier) => {
              const info = CHAIN_TIERS[tier];
              const isCurrent = tier === currentTier;
              
              return (
                <Card 
                  key={tier}
                  className={`${isCurrent ? 'border-2 border-primary-500 opacity-60' : 'border-2 border-neutral-200 hover:border-primary-300 transition-colors'}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-lg">{info.name}</CardTitle>
                      {isCurrent && (
                        <Badge variant="default" className="bg-primary-500 text-white">Current</Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-neutral-900">{info.price}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
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

                    <ul className="space-y-1.5 text-xs mb-4">
                      {info.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span className="text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={isCurrent ? 'secondary' : 'primary'}
                      className="w-full"
                      disabled={isCurrent}
                      onClick={() => handleRequestChange(tier)}
                    >
                      {isCurrent ? 'Current Plan' : 'Request Change'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* View All Offerings */}
        <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
          <CardContent className="pt-6">
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
                onClick={() => window.location.href = '/settings/offerings'}
              >
                View All Offerings
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Change Confirmation Modal */}
      {showChangeModal && selectedTier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Confirm Subscription Change</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-neutral-700">
                  You are requesting to change your subscription from:
                </p>
                
                <div className="bg-neutral-50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Current:</span>
                    <Badge className={`${tierInfo.color} text-white`}>{tierInfo.name}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Requested:</span>
                    <Badge className={`${getTierInfo(selectedTier).color} text-white`}>
                      {getTierInfo(selectedTier).name}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-neutral-600">
                  An email will be sent to our admin team to process this change. 
                  You will be notified once the change is approved and applied.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowChangeModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleSubmitChange}
                  >
                    Send Request
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
