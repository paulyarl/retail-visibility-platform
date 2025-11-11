/**
 * Reusable Subscription Usage Badge Component
 * Displays current plan and SKU usage with visual indicators
 * 
 * Variants:
 * - compact: Small badge for headers/dashboards
 * - card: Full card display for settings pages
 * - inline: Inline display for lists
 * 
 * Usage:
 * <SubscriptionUsageBadge variant="compact" />
 * <SubscriptionUsageBadge variant="card" showUpgradeLink />
 */

import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { Package } from 'lucide-react';

interface SubscriptionUsageBadgeProps {
  variant?: 'compact' | 'card' | 'inline';
  showUpgradeLink?: boolean;
  tenantId?: string;
  className?: string;
}

export default function SubscriptionUsageBadge({
  variant = 'compact',
  showUpgradeLink = false,
  tenantId,
  className = '',
}: SubscriptionUsageBadgeProps) {
  const { usage, loading, error } = useSubscriptionUsage(tenantId);

  if (loading) {
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        Loading...
      </div>
    );
  }

  if (error || !usage) {
    return null;
  }

  // Compact variant - for headers/dashboards
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
        {/* SKU Usage */}
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {usage.skuUsage}
            <span className="text-gray-600 dark:text-gray-400 font-normal">
              {' / '}
              {usage.skuIsUnlimited ? '∞' : usage.skuLimit.toLocaleString()}
            </span>
          </span>
          {!usage.skuIsUnlimited && (
            <div className={`w-2 h-2 rounded-full ${
              usage.skuColor === 'red' ? 'bg-red-500' :
              usage.skuColor === 'yellow' ? 'bg-yellow-500' :
              'bg-green-500'
            }`} />
          )}
        </div>
        
        {/* Separator */}
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
        
        {/* Location Usage */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {usage.locationUsage}
            <span className="text-gray-600 dark:text-gray-400 font-normal">
              {' / '}
              {usage.locationIsUnlimited ? '∞' : usage.locationLimit.toLocaleString()}
            </span>
          </span>
          {!usage.locationIsUnlimited && (
            <div className={`w-2 h-2 rounded-full ${
              usage.locationColor === 'red' ? 'bg-red-500' :
              usage.locationColor === 'yellow' ? 'bg-yellow-500' :
              'bg-green-500'
            }`} />
          )}
        </div>
      </div>
    );
  }

  // Inline variant - for lists
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {usage.tierName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* SKU */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">SKU:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {usage.skuUsage} / {usage.skuIsUnlimited ? '∞' : usage.skuLimit.toLocaleString()}
            </span>
            {!usage.skuIsUnlimited && (
              <span className={`text-xs font-medium ${
                usage.skuColor === 'red' ? 'text-red-600' :
                usage.skuColor === 'yellow' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {usage.skuPercent}%
              </span>
            )}
          </div>
          {/* Location */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Loc:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {usage.locationUsage} / {usage.locationIsUnlimited ? '∞' : usage.locationLimit.toLocaleString()}
            </span>
            {!usage.locationIsUnlimited && (
              <span className={`text-xs font-medium ${
                usage.locationColor === 'red' ? 'text-red-600' :
                usage.locationColor === 'yellow' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {usage.locationPercent}%
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Card variant - for settings pages
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>SKU Usage & Current Plan</CardTitle>
        <CardDescription>Your product usage and subscription details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Plan</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.tierName}
                </h3>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  {usage.tierPrice}
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {usage.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {usage.tierDescription}
            </p>
          </div>

          {/* SKU Usage */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-semibold text-gray-900 dark:text-white">SKU Usage</h4>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {usage.skuUsage}
                  <span className="text-lg text-gray-600 dark:text-gray-400 font-normal">
                    {' / '}
                    {usage.skuIsUnlimited ? '∞' : usage.skuLimit.toLocaleString()}
                  </span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {usage.skuIsUnlimited ? 'Unlimited' : `${usage.skuPercent}% used`}
                </p>
              </div>
            </div>

            {/* SKU Progress Bar */}
            {!usage.skuIsUnlimited && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usage.skuColor === 'red'
                      ? 'bg-red-500'
                      : usage.skuColor === 'yellow'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${usage.skuPercent}%` }}
                />
              </div>
            )}
          </div>


          {/* Upgrade Link */}
          {showUpgradeLink && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <a
                href="/settings/subscription"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all subscription tiers and upgrade options
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
