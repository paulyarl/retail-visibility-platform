'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { isTrialStatus } from '@/lib/trial';
import { getMaintenanceState, type MaintenanceState } from '@/lib/subscription-status';

interface SubscriptionStatusGuideProps {
  tenantId?: string;
  // Optional: pass known values from parent to avoid separate fetch
  tier?: string;
  status?: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  skuUsage?: number;
  skuLimit?: number;
  locationUsage?: number;
  locationLimit?: number;
}

export function SubscriptionStatusGuide({
  tenantId: tenantIdProp,
  tier: tierProp,
  status: statusProp,
  trialEndsAt: trialEndsAtProp,
  subscriptionEndsAt: subscriptionEndsAtProp,
  skuUsage: skuUsageProp,
  skuLimit: skuLimitProp,
  locationUsage: locationUsageProp,
  locationLimit: locationLimitProp,
}: SubscriptionStatusGuideProps = {}) {
  // Don't render anything if no tenant is explicitly provided
  // This prevents showing maintenance mode for stale localStorage tenantId
  if (!tenantIdProp) {
    return null;
  }

  // Pass tier props to hook so it uses parent's known values
  const { usage, loading } = useSubscriptionUsage(tenantIdProp, {
    tier: tierProp,
    status: statusProp,
    trialEndsAt: trialEndsAtProp,
  });

  if (loading || !usage) {
    return null;
  }

  // Use props if provided, otherwise use fetched data
  const tier = tierProp || usage.tier || 'starter';
  const status = statusProp || usage.status || 'active';
  const trialEndsAt = trialEndsAtProp ?? usage.trialEndsAt ?? null;
  const subscriptionEndsAt = subscriptionEndsAtProp ?? usage.subscriptionEndsAt ?? null;
  const skuUsage = skuUsageProp ?? usage.skuUsage ?? 0;
  const skuLimit = skuLimitProp ?? usage.skuLimit ?? Infinity;
  const locationUsage = locationUsageProp ?? usage.locationUsage ?? 0;
  const locationLimit = locationLimitProp ?? usage.locationLimit ?? Infinity;

  // Skip if we don't have enough data
  if (!tier) {
    return null;
  }

  const now = new Date();

  // ----- Maintenance vs freeze (google_only lifecycle) -----
  // Use centralized helper that mirrors backend logic
  const maintenanceState: MaintenanceState = getMaintenanceState({
    tier,
    status,
    trialEndsAt,
  });

  // ----- Trial nearing expiration -----
  let showTrialWarning = false;
  let trialDaysRemaining: number | null = null;
  if (isTrialStatus(status) && trialEndsAt) {
    const trialEnd = new Date(trialEndsAt);
    if (!Number.isNaN(trialEnd.getTime())) {
      const diffMs = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (trialDaysRemaining > 0 && trialDaysRemaining <= 7) {
        showTrialWarning = true;
      }
    }
  }

  // ----- SKU limits -----
  const skuPercent = skuLimit !== Infinity ? Math.round((skuUsage / skuLimit) * 100) : 0;
  const showSkuApproaching = skuLimit !== Infinity && skuPercent >= 80 && skuPercent < 100;
  const showSkuExceeded = skuLimit !== Infinity && skuPercent >= 100;

  // ----- Location limits -----
  const locationPercent = locationLimit !== Infinity ? Math.round((locationUsage / locationLimit) * 100) : 0;
  const showLocationApproaching = locationLimit !== Infinity && locationPercent >= 80 && locationPercent < 100;
  const showLocationExceeded = locationLimit !== Infinity && locationPercent >= 100;

  const showAnything =
    maintenanceState !== null ||
    showTrialWarning ||
    showSkuApproaching ||
    showSkuExceeded ||
    showLocationApproaching ||
    showLocationExceeded;

  if (!showAnything) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showTrialWarning && (
        <Card>
          <CardHeader>
            <CardTitle>Trial ending soon</CardTitle>
            <CardDescription>
              Your trial ends in {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}. After that, you'll automatically move into a maintenance window where you can update existing products but cannot add new ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p className="font-medium">What happens when your trial ends:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your storefront, directory listing, and Google listings remain online</li>
              <li>You can update existing products (prices, descriptions, images)</li>
              <li>You cannot add new products or grow your catalog</li>
              <li>Premium features (Quick Start, barcode scanner) will be disabled</li>
            </ul>
            <p className="mt-3">
              To keep full access and continue growing, choose a paid plan that fits your needs.
            </p>
          </CardContent>
        </Card>
      )}

      {(showSkuApproaching || showSkuExceeded) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {showSkuExceeded ? 'SKU limit reached' : 'Approaching SKU limit'}
            </CardTitle>
            <CardDescription>
              You are using {skuUsage.toLocaleString()} of {skuLimit === Infinity ? '∞' : skuLimit.toLocaleString()} SKUs on your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            {showSkuExceeded ? (
              <p>
                New product creation and bulk imports may be blocked until you either remove SKUs or upgrade to a higher plan with more SKU capacity.
              </p>
            ) : (
              <p>
                You are above 80% of your SKU capacity. Once you hit your limit, adding new products or importing inventory may be blocked until you upgrade or archive items.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(showLocationApproaching || showLocationExceeded) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {showLocationExceeded ? 'Location limit reached' : 'Approaching location limit'}
            </CardTitle>
            <CardDescription>
              You are using {locationUsage} of {locationLimit === Infinity ? '∞' : locationLimit.toString()} locations on your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            {showLocationExceeded ? (
              <p>
                Creating new locations is blocked until you remove locations or move to a higher tier that supports more locations.
              </p>
            ) : (
              <p>
                You are above 80% of your locations capacity. Once you reach your limit, creating new locations will be blocked until you upgrade.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {maintenanceState && (
        <Card>
          <CardHeader className="flex flex-row items-start gap-3">
            <div className="mt-1 rounded-full bg-amber-100 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>
                {maintenanceState === 'maintenance'
                  ? 'Limited maintenance window'
                  : 'Read-only visibility mode'}
              </CardTitle>
              <CardDescription>
                {maintenanceState === 'maintenance'
                  ? 'You can keep your existing catalog aligned and visible, but you cannot grow it without upgrading.'
                  : 'Your existing visibility remains online, but you cannot make changes or sync new updates until you upgrade.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            {maintenanceState === 'maintenance' ? (
              <>
                <p className="font-medium">What you can do right now</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Fix and enrich existing products (names, descriptions, prices, metadata).</li>
                  <li>Align and update categories and images for products already in your catalog.</li>
                  <li>Run Google feed jobs to keep current products in sync with Google and your storefront.</li>
                  <li>Update your storefront and directory profile (business info, hours, logo, copy).</li>
                </ul>
                <p className="font-medium mt-3">What is currently blocked</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Create new products or locations.</li>
                  <li>Use Quick Start or barcode scanning to add new items.</li>
                  <li>Run bulk operations that increase total SKU count.</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium">Your account is in a full freeze</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your storefront, directory listing, and existing Google/GBP listings remain online.</li>
                  <li>You cannot edit products, prices, images, metadata, or your profile.</li>
                  <li>You cannot start new sync jobs, Quick Start runs, scans, or enrichment jobs.</li>
                </ul>
              </>
            )}

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To restore full editing and growth features, choose a paid plan that fits your location and SKU needs.
              </p>
              <a
                href="/settings/subscription"
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                View plans & upgrade
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
