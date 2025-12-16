/**
 * Tenant Limit Badge Component
 * 
 * Displays current tenant count and limit with upgrade prompts
 */

'use client';

import { useTenantLimits } from '@/hooks/useTenantLimits';
import { MapPin, AlertCircle, ArrowUpCircle } from 'lucide-react';
import Link from 'next/link';

interface TenantLimitBadgeProps {
  variant?: 'compact' | 'full';
  showUpgrade?: boolean;
}

export default function TenantLimitBadge({ 
  variant = 'compact',
  showUpgrade = true 
}: TenantLimitBadgeProps) {
  const { status, loading, isAtLimit, percentUsed } = useTenantLimits();

  if (loading || !status) {
    return null;
  }

  const limitText = status.limit === 'unlimited' ? '∞' : status.limit;
  const isNearLimit = percentUsed >= 80 && status.limit !== 'unlimited';

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
          isAtLimit ? 'bg-red-100 text-red-700' :
          isNearLimit ? 'bg-amber-100 text-amber-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          <MapPin className="w-3.5 h-3.5" />
          <span>{status.current} / {limitText}</span>
        </div>
        
        {isAtLimit && showUpgrade && status.upgradeToTier && (
          <Link 
            href="/settings/subscription"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade
          </Link>
        )}
      </div>
    );
  }

  // Full variant
  const isPlatformUser = status.tier.startsWith('platform_');
  
  // Format tier name for display
  const formatTierName = (tier: string) => {
    return tier.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Get tier badge color
  const getTierBadgeColor = (tier: string) => {
    if (tier.startsWith('platform_')) return 'bg-purple-100 text-purple-700';
    switch (tier) {
      case 'organization': return 'bg-blue-100 text-blue-700';
      case 'enterprise': return 'bg-indigo-100 text-indigo-700';
      case 'professional': return 'bg-green-100 text-green-700';
      case 'starter': return 'bg-amber-100 text-amber-700';
      case 'google_only': return 'bg-gray-100 text-gray-700';
      case 'trial': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  
  return (
    <div className={`border rounded-lg p-4 shadow-sm ${
      isPlatformUser 
        ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200' 
        : 'bg-white'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Locations
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTierBadgeColor(status.tier)}`}>
              {formatTierName(status.tier)}
            </span>
            <span className="text-xs text-gray-500">
              {status.tierDisplayName || `${status.limit === 'unlimited' ? 'Unlimited' : status.limit} locations`}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {status.current}
            <span className="text-gray-400 text-lg font-normal"> / {limitText}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {status.limit === 'unlimited' 
              ? 'Unlimited access' 
              : `${status.remaining} remaining`
            }
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {status.limit !== 'unlimited' && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                isAtLimit ? 'bg-red-500' :
                isNearLimit ? 'bg-amber-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Status message */}
      {isAtLimit && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-900">Location limit reached</p>
            <p className="text-xs text-red-700 mt-0.5">
              {status.upgradeMessage || 'Upgrade your plan to add more locations'}
            </p>
          </div>
        </div>
      )}

      {isNearLimit && !isAtLimit && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">Almost at your limit</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You have {status.remaining} location slot{status.remaining !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {showUpgrade && (isAtLimit || isNearLimit) && status.upgradeToTier && (
        <Link
          href="/settings/subscription"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <ArrowUpCircle className="w-4 h-4" />
          Upgrade to {status.upgradeToTier}
        </Link>
      )}

      {/* Tenant list (optional) */}
      {status.tenants && status.tenants.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Your Locations</h4>
          <div className="space-y-1.5">
            {status.tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate">{tenant.name}</span>
                <span className="text-gray-500 capitalize">{tenant.tier}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
