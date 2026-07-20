'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui';
import { 
  Crown, Activity, Building2, Tag, DollarSign, Package, MapPin, Shield, Clock,
  Settings, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { 
  useSubscriptionDisplay, 
  FIELD_METADATA, 
  type SubscriptionDisplayField 
} from '@/hooks/useSubscriptionDisplay';
import { SubscriptionDisplayOptionsModal } from './SubscriptionDisplayOptionsModal';
import { deriveInternalStatus, getStatusLabel, type InternalStatus } from '@/lib/subscription-status';
import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown,
  Activity,
  Building2,
  Tag,
  DollarSign,
  Package,
  MapPin,
  Shield,
  Clock,
};

interface TierData {
  tier: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  isChain?: boolean;
  organizationId?: string;
  organizationName?: string;
  organizationTenants?: Array<{
    id: string;
    name: string;
    subscription_status: string;
    subscription_tier: string;
  }>;
  organizationTier?: {
    tier_key: string;
    display_name: string;
    price_monthly: number;
    max_skus: number;
    max_locations: number;
    features?: Array<{ feature_key: string; feature_name: string; is_enabled: boolean }>;
  };
  tenantTier?: {
    tier_key: string;
    display_name: string;
    price_monthly: number;
    max_skus: number;
    max_locations: number;
    features?: Array<{ feature_key: string; feature_name: string; is_enabled: boolean }>;
  };
}

interface SubscriptionDisplayCardProps {
  tenantId: string;
  tierData: TierData;
  capabilities?: AllCapabilitiesState | null;
  className?: string;
}

const TOTAL_CAPABILITY_DOMAINS = 27;

const CAPABILITY_DOMAINS: Array<{ key: string; label: string; field: keyof AllCapabilitiesState }> = [
  { key: 'commerce', label: 'Commerce', field: 'commerce' },
  { key: 'paymentGateway', label: 'Payment Gateway', field: 'paymentGateway' },
  { key: 'storefront', label: 'Storefront', field: 'storefront' },
  { key: 'barcodeScan', label: 'Barcode Scan', field: 'barcodeScan' },
  { key: 'fulfillment', label: 'Fulfillment', field: 'fulfillment' },
  { key: 'productType', label: 'Product Types', field: 'productType' },
  { key: 'productOptions', label: 'Product Options', field: 'productOptions' },
  { key: 'featuredOptions', label: 'Featured Options', field: 'featuredOptions' },
  { key: 'integrationOptions', label: 'Integrations', field: 'integrationOptions' },
  { key: 'quickstartOptions', label: 'Quickstart', field: 'quickstartOptions' },
  { key: 'storefrontOptions', label: 'Storefront Options', field: 'storefrontOptions' },
  { key: 'storefrontQr', label: 'Storefront QR', field: 'storefrontQr' },
  { key: 'storefrontGallery', label: 'Image Gallery', field: 'storefrontGallery' },
  { key: 'storefrontHours', label: 'Business Hours', field: 'storefrontHours' },
  { key: 'storefrontLayouts', label: 'Storefront Layouts', field: 'storefrontLayouts' },
  { key: 'storefrontMaps', label: 'Storefront Maps', field: 'storefrontMaps' },
  { key: 'directoryEntryOptions', label: 'Directory Entry', field: 'directoryEntryOptions' },
  { key: 'faqOptions', label: 'FAQ', field: 'faqOptions' },
  { key: 'crmOptions', label: 'CRM', field: 'crmOptions' },
  { key: 'chatbotOptions', label: 'Chatbot', field: 'chatbotOptions' },
  { key: 'socialCommerceOptions', label: 'Social Commerce', field: 'socialCommerceOptions' },
  { key: 'directoryPromotion', label: 'Directory Promotion', field: 'directoryPromotion' },
  { key: 'orgOptions', label: 'Organization', field: 'orgOptions' },
  { key: 'wholesaleMatching', label: 'Wholesale Matching', field: 'wholesaleMatching' },
  { key: 'platformServices', label: 'Platform Services', field: 'platformServices' },
  { key: 'funnel', label: 'Sales Funnels', field: 'funnel' },
  { key: 'couponOptions', label: 'Coupons', field: 'couponOptions' },
];

function countEnabledCapabilities(caps: AllCapabilitiesState): number {
  const domains = [
    caps.commerce, caps.paymentGateway, caps.storefront, caps.barcodeScan,
    caps.fulfillment, caps.productType, caps.productOptions, caps.featuredOptions,
    caps.integrationOptions, caps.quickstartOptions, caps.storefrontOptions,
    caps.storefrontQr, caps.storefrontGallery, caps.storefrontHours,
    caps.storefrontLayouts, caps.storefrontMaps, caps.directoryEntryOptions,
    caps.faqOptions, caps.crmOptions, caps.chatbotOptions, caps.socialCommerceOptions,
    caps.directoryPromotion, caps.orgOptions, caps.wholesaleMatching,
    caps.platformServices, caps.funnel, caps.couponOptions,
  ];
  return domains.filter(d => d?.enabled).length;
}

export function SubscriptionDisplayCard({ 
  tenantId, 
  tierData, 
  capabilities,
  className = '' 
}: SubscriptionDisplayCardProps) {
  const { config, isLoading, isFieldVisible } = useSubscriptionDisplay(tenantId);
  const [showOptions, setShowOptions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(config.layout === 'expanded');

  useEffect(() => {
    setIsExpanded(config.layout === 'expanded');
  }, [config.layout]);

  if (isLoading || !tierData) {
    return null;
  }

  // Calculate derived values
  const effectiveTier = tierData.organizationTier || tierData.tenantTier;
  const enabledCapabilityCount = capabilities ? countEnabledCapabilities(capabilities) : 0;
  // console.log(` TIER: ${JSON.stringify(tierData)}`);
  // console.log(` capabilities: ${JSON.stringify(capabilities)}`);
  // Trial days remaining
  let trialDaysRemaining: number | null = null;
  if (tierData.trialEndsAt) {
    const trialEnd = new Date(tierData.trialEndsAt);
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();
    trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  // Derive internal status — prefer backend-provided subscriptionContext from
  // effective-capabilities endpoint, fall back to local derivation
  const internalStatus: InternalStatus =
    capabilities?.subscriptionContext?.internalStatus ??
    deriveInternalStatus({
      subscriptionStatus: tierData.subscriptionStatus,
      subscriptionTier: tierData.tier,
      trialEndsAt: tierData.trialEndsAt,
      subscriptionEndsAt: tierData.subscriptionEndsAt,
    });

  // Status badge color based on internal status
  const getStatusColor = (status: InternalStatus): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active': return 'success';
      case 'trialing': return 'info';
      case 'past_due': return 'warning';
      case 'maintenance': return 'warning';
      case 'frozen': return 'error';
      case 'canceled': return 'error';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  // Visual treatment classes based on internal status
  const getStatusStyles = (status: InternalStatus): { border: string; bg: string; dot: string } => {
    switch (status) {
      case 'active':
        return { border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50/30 dark:bg-emerald-950/30', dot: 'bg-emerald-500' };
      case 'trialing':
        return { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50/30 dark:bg-blue-950/30', dot: 'bg-blue-500' };
      case 'past_due':
        return { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50/30 dark:bg-amber-950/30', dot: 'bg-amber-500' };
      case 'maintenance':
        return { border: 'border-yellow-200 dark:border-yellow-800', bg: 'bg-yellow-50/30 dark:bg-yellow-950/30', dot: 'bg-yellow-500' };
      case 'frozen':
      case 'canceled':
      case 'expired':
        return { border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50/30 dark:bg-red-950/30', dot: 'bg-red-500' };
      default:
        return { border: '', bg: '', dot: 'bg-gray-400' };
    }
  };

  const statusStyles = getStatusStyles(internalStatus);

  // Render individual field
  const renderField = (field: SubscriptionDisplayField) => {
    const meta = FIELD_METADATA[field];
    if (!meta) return null;
    const Icon = ICON_MAP[meta.icon];
    if (!Icon) return null;

    switch (field) {
      case 'effectiveTier':
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Tier:</span>
            <Badge variant="default">
              {effectiveTier?.display_name || tierData.tier}
            </Badge>
          </div>
        );

      case 'subscriptionStatus':
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            <Badge variant={getStatusColor(internalStatus)}>
              {getStatusLabel(internalStatus)}
            </Badge>
          </div>
        );

      case 'organization':
        if (!tierData.isChain || !tierData.organizationName) return null;
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Organization:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {tierData.organizationName}
            </span>
            {tierData.organizationTier && (
              <Badge variant="info">
                {tierData.organizationTier.display_name}
              </Badge>
            )}
          </div>
        );

      case 'tenantTier':
        if (!tierData.tenantTier || tierData.tenantTier.tier_key === tierData.tier) return null;
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-500">Individual tier:</span>
            <Badge variant="default">
              {tierData.tenantTier.display_name}
            </Badge>
          </div>
        );

      case 'pricing':
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Price:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              ${effectiveTier?.price_monthly?.toLocaleString() || '0'}/mo
            </span>
          </div>
        );

      case 'skuLimit':
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">SKU Limit:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {effectiveTier?.max_skus?.toLocaleString() || '∞'}
            </span>
          </div>
        );

      case 'locationLimit':
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Locations:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {effectiveTier?.max_locations || '∞'}
            </span>
          </div>
        );

      case 'capabilities':
        if (!capabilities) return null;
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Capabilities:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {enabledCapabilityCount}/{TOTAL_CAPABILITY_DOMAINS} active
            </span>
          </div>
        );

      case 'capabilityBreakdown':
        if (!capabilities || !isExpanded) return null;
        return (
          <div key={field} className="col-span-2 sm:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Capability Breakdown ({enabledCapabilityCount}/{CAPABILITY_DOMAINS.length} active)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-6">
              {CAPABILITY_DOMAINS.map(({ key, label, field: capField }) => {
                const domain = capabilities[capField] as { enabled?: boolean } | undefined;
                const isEnabled = !!domain?.enabled;
                return (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className={isEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'trialInfo':
        if (!tierData.trialEndsAt || trialDaysRemaining === null) return null;
        return (
          <div key={field} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Trial:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {trialDaysRemaining > 0 
                ? `${trialDaysRemaining} days remaining` 
                : 'Trial ended'}
            </span>
          </div>
        );

      case 'organizationTenants':
        if (!tierData.isChain || !tierData.organizationTenants || tierData.organizationTenants.length === 0) return null;
        return (
          <div key={field} className="col-span-2 sm:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization Locations ({tierData.organizationTenants.length}):
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6">
              {tierData.organizationTenants.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${t.subscription_status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-gray-700 dark:text-gray-300 truncate">{t.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">({t.subscription_tier})</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get visible fields
  const visibleFields = config.visibleFields.filter(f => isFieldVisible(f));
  const displayedFields = visibleFields.map(renderField).filter(Boolean);
  
  // console.log('[SubscriptionDisplayCard] Rendering:', {
  //   visibleFields,
  //   displayedFieldsCount: displayedFields.length,
  //   tierData: {
  //     isChain: tierData.isChain,
  //     organizationName: tierData.organizationName,
  //     tenantTier: tierData.tenantTier,
  //     effectiveTier,
  //   }
  // });

  if (displayedFields.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={`${statusStyles.border} ${statusStyles.bg} ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusStyles.dot}`} />
            Subscription
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOptions(true)}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Customize display"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
            {config.layout !== 'minimal' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-3">
          <div className={`grid gap-2 ${isExpanded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {displayedFields}
          </div>
        </CardContent>
      </Card>

      <SubscriptionDisplayOptionsModal
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
        tenantId={tenantId}
        capabilities={capabilities}
      />
    </>
  );
}
