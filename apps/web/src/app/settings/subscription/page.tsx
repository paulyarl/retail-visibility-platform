'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import { getQRFeatures } from '@/lib/qr-tiers';

type Tenant = {
  id: string;
  name: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  metadata?: {
    businessName?: string;
  };
};

const TIER_INFO = {
  trial: {
    name: 'Trial',
    price: 'Free',
    color: 'bg-neutral-100 text-neutral-800',
    description: '30-day trial with full access',
  },
  starter: {
    name: 'Starter',
    price: '$49/month',
    color: 'bg-blue-100 text-blue-800',
    description: 'Perfect for small businesses',
  },
  professional: {
    name: 'Professional',
    price: '$149/month',
    color: 'bg-purple-100 text-purple-800',
    description: 'Advanced features for growing businesses',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$499/month',
    color: 'bg-amber-100 text-amber-800',
    description: 'Full customization and white-label',
  },
};

export default function SubscriptionPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      // Get current tenant from localStorage
      const tenantId = localStorage.getItem('tenantId');
      if (!tenantId) {
        setLoading(false);
        return;
      }

      // Fetch tenant info
      const tenantRes = await fetch(`/api/tenants/${tenantId}`);
      const tenantData = await tenantRes.json();
      setTenant(tenantData);

      // Fetch item count
      const itemsRes = await fetch(`/api/items?tenantId=${tenantId}`);
      const items = await itemsRes.json();
      setItemCount(Array.isArray(items) ? items.length : 0);
    } catch (error) {
      console.error('Failed to load subscription info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Subscription"
          description="Manage your subscription and billing"
          icon={Icons.Settings}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Subscription"
          description="Manage your subscription and billing"
          icon={Icons.Settings}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-600">No tenant selected</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const tier = (tenant.subscriptionTier || 'trial') as keyof typeof TIER_INFO;
  const tierInfo = TIER_INFO[tier] || TIER_INFO.trial;
  const landingPageFeatures = getLandingPageFeatures(tier);
  const qrFeatures = getQRFeatures(tier);

  // SKU limits
  const skuLimits = {
    trial: 500,
    starter: 500,
    professional: 5000,
    enterprise: Infinity,
  };
  const skuLimit = skuLimits[tier] || 500;
  const skuUsagePercent = skuLimit === Infinity ? 0 : (itemCount / skuLimit) * 100;

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Subscription"
        description="Manage your subscription and billing"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-neutral-900">{tierInfo.name}</h3>
                  <Badge variant="default" className={tierInfo.color}>
                    {tenant.subscriptionStatus || 'Active'}
                  </Badge>
                </div>
                <p className="text-neutral-600">{tierInfo.description}</p>
                <p className="text-3xl font-bold text-neutral-900 mt-4">{tierInfo.price}</p>
              </div>
              {tier !== 'enterprise' && (
                <Button 
                  variant="primary"
                  onClick={() => {
                    const adminEmail = tenant.metadata?.admin_email || 'admin@yourplatform.com';
                    const requestedTier = tier === 'trial' || tier === 'starter' ? 'Professional' : 'Enterprise';
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                    const adminLink = `${baseUrl}/admin/tiers`;
                    const subject = encodeURIComponent(`Upgrade Request - ${tenant.metadata?.businessName || tenant.name}`);
                    const body = encodeURIComponent(
                      `Hello,\n\n` +
                      `I would like to upgrade my subscription.\n\n` +
                      `Current Plan: ${tierInfo.name}\n` +
                      `Requested Plan: ${requestedTier}\n` +
                      `Business: ${tenant.metadata?.businessName || tenant.name}\n` +
                      `Tenant ID: ${tenant.id}\n\n` +
                      `To approve this request, click here:\n` +
                      `${adminLink}\n\n` +
                      `Then find "${tenant.metadata?.businessName || tenant.name}" and click the ${requestedTier} tier button.\n\n` +
                      `Thank you!`
                    );
                    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
                  }}
                >
                  Upgrade Plan
                </Button>
              )}
            </div>

            {/* Trial/Subscription end date */}
            {tenant.trialEndsAt && tenant.subscriptionStatus === 'trial' && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Trial ends:</strong> {new Date(tenant.trialEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}
            {tenant.subscriptionEndsAt && tenant.subscriptionStatus === 'active' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <strong>Next billing date:</strong> {new Date(tenant.subscriptionEndsAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* SKU Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700">Products (SKUs)</span>
                  <span className="text-sm text-neutral-600">
                    {itemCount} / {skuLimit === Infinity ? '∞' : skuLimit}
                  </span>
                </div>
                {skuLimit !== Infinity && (
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        skuUsagePercent >= 90 ? 'bg-red-500' : skuUsagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(skuUsagePercent, 100)}%` }}
                    />
                  </div>
                )}
                {skuUsagePercent >= 90 && skuLimit !== Infinity && (
                  <p className="text-xs text-red-600 mt-1">
                    You're approaching your SKU limit. Consider upgrading to add more products.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Included */}
        <Card>
          <CardHeader>
            <CardTitle>Features Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SKU Limit */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-900">
                    {skuLimit === Infinity ? 'Unlimited' : skuLimit} Products
                  </p>
                  <p className="text-sm text-neutral-600">SKU limit</p>
                </div>
              </div>

              {/* QR Code Resolution */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-900">
                    {qrFeatures.maxResolution}px QR Codes
                  </p>
                  <p className="text-sm text-neutral-600">High-resolution downloads</p>
                </div>
              </div>

              {/* Custom Marketing Description */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {landingPageFeatures.customMarketingDescription ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${landingPageFeatures.customMarketingDescription ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    Custom Marketing Copy
                  </p>
                  <p className="text-sm text-neutral-600">Landing page customization</p>
                </div>
              </div>

              {/* Image Gallery */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {landingPageFeatures.imageGallery ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${landingPageFeatures.imageGallery ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    Image Gallery ({landingPageFeatures.maxGalleryImages} images)
                  </p>
                  <p className="text-sm text-neutral-600">Product photo galleries</p>
                </div>
              </div>

              {/* Custom Branding */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {landingPageFeatures.customLogo ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${landingPageFeatures.customLogo ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    Custom Branding
                  </p>
                  <p className="text-sm text-neutral-600">Logo and colors</p>
                </div>
              </div>

              {/* White Label */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {landingPageFeatures.removePlatformBranding ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-medium ${landingPageFeatures.removePlatformBranding ? 'text-neutral-900' : 'text-neutral-400'}`}>
                    White-Label
                  </p>
                  <p className="text-sm text-neutral-600">Remove platform branding</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade CTA */}
        {tier !== 'enterprise' && (
          <Card className="border-2 border-primary-200 bg-primary-50">
            <CardContent className="py-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Want more features?
                </h3>
                <p className="text-neutral-700 mb-4">
                  Upgrade to {tier === 'trial' || tier === 'starter' ? 'Professional' : 'Enterprise'} for advanced customization and unlimited growth
                </p>
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => {
                    const adminEmail = tenant.metadata?.admin_email || 'admin@yourplatform.com';
                    const requestedTier = tier === 'trial' || tier === 'starter' ? 'Professional' : 'Enterprise';
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                    const adminLink = `${baseUrl}/admin/tiers`;
                    const subject = encodeURIComponent(`Upgrade Request - ${tenant.metadata?.businessName || tenant.name}`);
                    const body = encodeURIComponent(
                      `Hello,\n\n` +
                      `I would like to upgrade my subscription.\n\n` +
                      `Current Plan: ${tierInfo.name}\n` +
                      `Requested Plan: ${requestedTier}\n` +
                      `Business: ${tenant.metadata?.businessName || tenant.name}\n` +
                      `Tenant ID: ${tenant.id}\n\n` +
                      `To approve this request, click here:\n` +
                      `${adminLink}\n\n` +
                      `Then find "${tenant.metadata?.businessName || tenant.name}" and click the ${requestedTier} tier button.\n\n` +
                      `Thank you!`
                    );
                    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
                  }}
                >
                  Request Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
