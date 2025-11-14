'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

export function SubscriptionStatusGuide() {
  const { usage, loading } = useSubscriptionUsage();

  if (loading || !usage) {
    return null;
  }

  const tier = usage.tier;
  const status = usage.status || 'active';
  const now = new Date();

  // ----- Maintenance vs freeze (google_only + canceled/expired) -----
  let maintenanceState: 'maintenance' | 'freeze' | null = null;
  const isInactive = status === 'canceled' || status === 'expired';

  let inMaintenanceWindow = false;
  if (tier === 'google_only' && status === 'active') {
    if (!usage.trialEndsAt) {
      inMaintenanceWindow = true;
    } else {
      const boundary = new Date(usage.trialEndsAt);
      if (!Number.isNaN(boundary.getTime()) && now < boundary) {
        inMaintenanceWindow = true;
      }
    }
  }

  const isFullyFrozen = isInactive || (tier === 'google_only' && !inMaintenanceWindow);

  if (inMaintenanceWindow) {
    maintenanceState = 'maintenance';
  } else if (isFullyFrozen) {
    maintenanceState = 'freeze';
  }

  // ----- Trial nearing expiration -----
  let showTrialWarning = false;
  let trialDaysRemaining: number | null = null;
  if (status === 'trial' && usage.trialEndsAt) {
    const trialEnd = new Date(usage.trialEndsAt);
    if (!Number.isNaN(trialEnd.getTime())) {
      const diffMs = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (trialDaysRemaining > 0 && trialDaysRemaining <= 7) {
        showTrialWarning = true;
      }
    }
  }

  // ----- SKU limits -----
  const skuLimit = usage.skuLimit;
  const skuPercent = usage.skuPercent;
  const showSkuApproaching = skuLimit !== Infinity && skuPercent >= 80 && skuPercent < 100;
  const showSkuExceeded = skuLimit !== Infinity && skuPercent >= 100;

  // ----- Location limits -----
  const locationLimit = usage.locationLimit;
  const locationPercent = usage.locationPercent;
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
              Your trial ends in {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}. After that, you'll move into a limited maintenance window unless you choose a paid plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 dark:text-gray-300">
            <p>
              During the trial you have full access to your selected tier. When the trial ends, your storefront, directory, and Google listings stay online,
              but your ability to grow your catalog will be limited unless you upgrade.
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
              You are using {usage.skuUsage.toLocaleString()} of {skuLimit === Infinity ? '∞' : skuLimit.toLocaleString()} SKUs on your current plan.
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
              You are using {usage.locationUsage} of {locationLimit === Infinity ? '∞' : locationLimit.toString()} locations on your current plan.
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
