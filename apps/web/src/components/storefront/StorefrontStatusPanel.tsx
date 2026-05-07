'use client';

import { useEffect, useState } from 'react';
import { tenantPublicService, PublicTenantInfo, LocationStatusInfo } from '@/services/TenantPublicService';
import { AlertCircle, Clock, PauseCircle, XCircle, Archive, MapPin } from 'lucide-react';

/**
 * Status panel configuration for different location statuses
 */
const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  textClass: string;
  title: string;
  getDescription: (info?: LocationStatusInfo, reopeningDate?: string | null) => string;
}> = {
  pending: {
    icon: <Clock className="w-6 h-6" />,
    bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderClass: 'border-yellow-200 dark:border-yellow-800',
    textClass: 'text-yellow-800 dark:text-yellow-200',
    title: 'Location Pending',
    getDescription: () => 'This location is currently being set up. Please check back soon!',
  },
  inactive: {
    icon: <PauseCircle className="w-6 h-6" />,
    bgClass: 'bg-orange-50 dark:bg-orange-900/20',
    borderClass: 'border-orange-200 dark:border-orange-800',
    textClass: 'text-orange-800 dark:text-orange-200',
    title: 'Temporarily Closed',
    getDescription: (_info, reopeningDate) => 
      reopeningDate 
        ? `This location is temporarily closed. Expected reopening: ${new Date(reopeningDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
        : "This location is temporarily closed for renovations or seasonal closure. Please check back soon!",
  },
  closed: {
    icon: <XCircle className="w-6 h-6" />,
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-800 dark:text-red-200',
    title: 'Permanently Closed',
    getDescription: () => 'This location is permanently closed. Thank you for your patronage over the years.',
  },
  archived: {
    icon: <Archive className="w-6 h-6" />,
    bgClass: 'bg-gray-50 dark:bg-gray-900/20',
    borderClass: 'border-gray-200 dark:border-gray-800',
    textClass: 'text-gray-800 dark:text-gray-200',
    title: 'Location Unavailable',
    getDescription: () => 'This location is no longer available.',
  },
};

/**
 * Google-only tier configuration
 */
const GOOGLE_ONLY_CONFIG = {
  icon: <MapPin className="w-6 h-6" />,
  bgClass: 'bg-blue-50 dark:bg-blue-900/20',
  borderClass: 'border-blue-200 dark:border-blue-800',
  textClass: 'text-blue-800 dark:text-blue-200',
  title: 'Google Listing Only',
  description: 'This location is currently listed on Google only. A full storefront experience is coming soon!',
};

/**
 * Subscription status configurations
 */
const SUBSCRIPTION_CONFIG = {
  canceled: {
    icon: <XCircle className="w-6 h-6" />,
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-800 dark:text-red-200',
    title: 'Subscription Canceled',
    description: 'This store\'s subscription has been canceled and is no longer active.',
  },
  past_due: {
    icon: <AlertCircle className="w-6 h-6" />,
    bgClass: 'bg-orange-50 dark:bg-orange-900/20',
    borderClass: 'border-orange-200 dark:border-orange-800',
    textClass: 'text-orange-800 dark:text-orange-200',
    title: 'Subscription Past Due',
    description: 'This store\'s subscription is past due. Please contact the store owner.',
  },
};

export interface StorefrontStatusPanelProps {
  tenantId?: string;
  tenantInfo?: PublicTenantInfo;
  className?: string;
  showGoogleListingLink?: boolean;
  googleListingUrl?: string;
}

/**
 * Hook to fetch and cache storefront status
 */
export function useStorefrontStatus(tenantId?: string, tenantInfo?: PublicTenantInfo) {
  // Calculate initial state synchronously for SSR
  const initialShouldShow = tenantInfo ? shouldShowStatusPanel(tenantInfo) : false;
  const initialPanelType = getPanelType(tenantInfo);

  const [statusInfo, setStatusInfo] = useState<{
    tenant: PublicTenantInfo | null;
    isLoading: boolean;
    shouldShowPanel: boolean;
    panelType: 'google_only' | 'status' | 'subscription' | null;
  }>({
    tenant: tenantInfo || null,
    isLoading: !tenantInfo && !!tenantId,
    shouldShowPanel: initialShouldShow,
    panelType: initialPanelType,
  });

  useEffect(() => {
    if (tenantInfo) {
      // Use provided tenant info
      const shouldShow = shouldShowStatusPanel(tenantInfo);
      setStatusInfo({
        tenant: tenantInfo,
        isLoading: false,
        shouldShowPanel: shouldShow,
        panelType: getPanelType(tenantInfo),
      });
      return;
    }

    if (!tenantId) {
      setStatusInfo(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Fetch tenant info
    tenantPublicService.getPublicTenantInfo(tenantId).then(tenant => {
      if (tenant) {
        const shouldShow = shouldShowStatusPanel(tenant);
        setStatusInfo({
          tenant,
          isLoading: false,
          shouldShowPanel: shouldShow,
          panelType: getPanelType(tenant),
        });
      } else {
        setStatusInfo(prev => ({ ...prev, isLoading: false }));
      }
    });
  }, [tenantId, tenantInfo]);

  return statusInfo;
}

/**
 * Helper to determine panel type
 */
function getPanelType(tenant: PublicTenantInfo | null | undefined): 'google_only' | 'status' | 'subscription' | null {
  if (!tenant) return null;

  if (tenant.subscriptionTier === 'google_only' || tenant.subscriptionTier === 'discovery') return 'google_only';
  if (tenant.showSubscriptionPanel && tenant.subscriptionStatusInfo) return 'subscription';
  if (tenant.locationStatus && tenant.locationStatus !== 'active') return 'status';
  if (tenant.statusInfo && !tenant.statusInfo.showStorefront) return 'status';

  return null;
}

/**
 * Helper to determine if status panel should be shown
 */
export function shouldShowStatusPanel(tenant: PublicTenantInfo | null): boolean {
  // console.log(`[shouldShowStatusPanel] tenant: `, tenant);
  if (!tenant) return false;

  // Show for google_only tier
  if (tenant.subscriptionTier === 'google_only' || tenant.subscriptionTier === 'discovery') return true;

  // Show for non-active statuses
  if (tenant.locationStatus && tenant.locationStatus !== 'active') return true;

  // Also check statusInfo.showStorefront flag
  if (tenant.statusInfo && !tenant.statusInfo.showStorefront) return true;

  // Show for subscription issues (canceled not in org, or past_due after grace period)
  if (tenant.showSubscriptionPanel === true) return true;

  return false;
}

/**
 * StorefrontStatusPanel Component
 * 
 * Displays status information for locations that:
 * - Are on google_only tier
 * - Have a non-active location status (pending, inactive, closed, archived)
 */
export function StorefrontStatusPanel({
  tenantId,
  tenantInfo: providedTenantInfo,
  className = '',
  showGoogleListingLink = true,
  googleListingUrl,
}: StorefrontStatusPanelProps) {
  const { tenant, isLoading, shouldShowPanel, panelType } = useStorefrontStatus(tenantId, providedTenantInfo);
  console.log(``)

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      </div>
    );
  }

  if (!shouldShowPanel || !tenant) {
    return null;
  }

  // Google-only tier panel
  if (panelType === 'google_only' || tenant.subscriptionTier === 'google_only' || tenant.subscriptionTier === 'discovery') {
    const config = GOOGLE_ONLY_CONFIG;

    return (
      <div className={`${config.bgClass} ${config.borderClass} border-2 rounded-lg p-6 ${className}`}>
        <div className="flex items-start gap-4">
          <div className={`${config.textClass} flex-shrink-0`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${config.textClass} mb-2`}>
              {config.title}
            </h2>
            <p className={`${config.textClass} opacity-90 mb-4`}>
              {config.description}
            </p>
            {showGoogleListingLink && tenant.profileData && (
              <a
                href={googleListingUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.profileData.business_name || tenant.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <MapPin className="w-4 h-4" />
                View on Google Maps
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Subscription-based panel (canceled, past_due)
  if (panelType === 'subscription' && tenant.subscriptionStatusInfo) {
    const subStatus = tenant.subscriptionStatusInfo.status;
    const config = SUBSCRIPTION_CONFIG[subStatus as keyof typeof SUBSCRIPTION_CONFIG];

    if (!config) return null;

    return (
      <div className={`${config.bgClass} ${config.borderClass} border-2 rounded-lg p-6 ${className}`}>
        <div className="flex items-start gap-4">
          <div className={`${config.textClass} flex-shrink-0`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${config.textClass} mb-2`}>
              {tenant.subscriptionStatusInfo.label || config.title}
            </h2>
            <p className={`${config.textClass} opacity-90`}>
              {tenant.subscriptionStatusInfo.description || config.description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Status-based panel (pending, inactive, closed, archived)
  const status = tenant.locationStatus || 'pending';
  const config = STATUS_CONFIG[status];

  if (!config) {
    return null;
  }

  // Get reopening date from profileData if available
  const reopeningDate = tenant.profileData?.reopening_date || tenant.metadata?.reopening_date;

  return (
    <div className={`${config.bgClass} ${config.borderClass} border-2 rounded-lg p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <div className={`${config.textClass} flex-shrink-0`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <h2 className={`text-xl font-semibold ${config.textClass} mb-2`}>
            {config.title}
          </h2>
          <p className={`${config.textClass} opacity-90`}>
            {config.getDescription(tenant.statusInfo, reopeningDate)}
          </p>
          {tenant.statusInfo && (
            <div className="mt-4 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bgClass} ${config.textClass} border ${config.borderClass}`}>
                {tenant.statusInfo.icon} {tenant.statusInfo.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StorefrontStatusPanel;
