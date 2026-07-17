'use client';

import { useEffect, useState } from 'react';
import { tenantPublicService, PublicTenantInfo, LocationStatusInfo } from '@/services/TenantPublicService';
import { AlertCircle, Clock, PauseCircle, XCircle, Archive, MapPin } from 'lucide-react';
import { usePublicStorefrontCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';

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
  // Capability-aware storefront resolution
  const storefrontCap = usePublicStorefrontCapability(tenantId || null);

  // Calculate initial state synchronously for SSR
  const initialShouldShow = tenantInfo ? shouldShowStatusPanel(tenantInfo) : false;
  const initialPanelType = getPanelType(tenantInfo);

  const [statusInfo, setStatusInfo] = useState<{
    tenant: PublicTenantInfo | null;
    isLoading: boolean;
    shouldShowPanel: boolean;
    panelType: 'google_only' | 'status' | 'subscription' | 'capability_gated' | null;
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

  // Capability-aware override: when storefront_types capability data is available,
  // use it as the authoritative source for storefront visibility.
  useEffect(() => {
    if (!storefrontCap.data) return;

    const { enabled, type } = storefrontCap.data;

    setStatusInfo(prev => {
      if (!prev.tenant) return prev;

      // If capability says storefront is disabled or type is 'none', force panel on
      if (!enabled || type === 'none') {
        return { ...prev, shouldShowPanel: true, panelType: 'capability_gated' };
      }

      // If capability says storefront is enabled, let existing logic stand
      // (location status, subscription issues, etc. may still warrant a panel)
      return prev;
    });
  }, [storefrontCap.data]);

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

  // console.log(`tenant: `, tenant)
  // console.log(`isLoading: `, isLoading)
  // console.log(`shouldShowPanel: `, shouldShowPanel)
  // console.log(`panelType: `, panelType)

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

  // Capability-gated panel (storefront disabled by capability type)
  if (panelType === 'capability_gated') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <Archive className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Online Storefront Unavailable
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            This store does not currently offer an online storefront experience. Please visit the physical location or contact the store directly.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Storefront Disabled
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Google-only tier panel
  if (panelType === 'google_only' || tenant.subscriptionTier === 'google_only' || tenant.subscriptionTier === 'discovery') {
    const config = GOOGLE_ONLY_CONFIG;

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
            <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {config.title}
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {config.description}
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Google Maps Active
            </span>
          </div>

          {showGoogleListingLink && tenant.profileData && (
            <a
              href={googleListingUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.profileData.business_name || tenant.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              <MapPin className="w-5 h-5 mr-2" />
              View on Google Maps
            </a>
          )}
        </div>
      </div>
    );
  }

  // Subscription-based panel (canceled, past_due)
  if (panelType === 'subscription' && tenant.subscriptionStatusInfo) {
    const subStatus = tenant.subscriptionStatusInfo.status;
    const config = SUBSCRIPTION_CONFIG[subStatus as keyof typeof SUBSCRIPTION_CONFIG];

    if (!config) return null;

    const isPastDue = subStatus === 'past_due';

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${config.bgClass}`}>
            <div className={config.textClass}>{config.icon}</div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {tenant.subscriptionStatusInfo.label || config.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {tenant.subscriptionStatusInfo.description || config.description}
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgClass} ${config.borderClass} border`}>
            <span className={`w-2 h-2 rounded-full ${isPastDue ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${config.textClass}`}>
              {isPastDue ? 'Payment Overdue' : 'Subscription Canceled'}
            </span>
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

  const statusBadgeLabel: Record<string, string> = {
    pending: 'Setup in Progress',
    inactive: 'Temporarily Unavailable',
    closed: 'Permanently Closed',
    archived: 'Unavailable',
  };

  const statusHasPulse = status === 'pending' || status === 'inactive';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${config.bgClass}`}>
          <div className={config.textClass}>{config.icon}</div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {config.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          {config.getDescription(tenant.statusInfo, reopeningDate)}
        </p>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${config.bgClass} ${config.borderClass} border`}>
          <span className={`w-2 h-2 rounded-full ${statusHasPulse ? 'animate-pulse' : ''} ${config.textClass.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-')}`} />
          <span className={`text-sm font-medium ${config.textClass}`}>
            {statusBadgeLabel[status] || config.title}
          </span>
        </div>
      </div>
    </div>
  );
}

export default StorefrontStatusPanel;
