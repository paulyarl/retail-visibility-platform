'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Shield, ChevronRight } from 'lucide-react';
import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';

interface PlanSummaryWidgetProps {
  capabilities: AllCapabilitiesState | null;
  loading?: boolean;
  tenantId: string;
  merchantGates?: Record<string, boolean>;
}

type CapabilityStatusColor = 'green' | 'red' | 'orange' | 'blue' | 'purple';

interface CapabilityTypeEntry {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  color: CapabilityStatusColor;
  settingsPath?: string;
}

const CAPABILITY_META: Array<{ key: string; label: string; icon: string; prefix: string; settingsPath: string }> = [
  { key: 'commerce_types', label: 'Commerce', icon: '💰', prefix: 'commerce_', settingsPath: '/settings/commerce' },
  { key: 'payment_gateway_options', label: 'Payment Gateway', icon: '💳', prefix: 'payment_gateway_', settingsPath: '/settings/payment-gateways' },
  { key: 'storefront_types', label: 'Storefront', icon: '🏪', prefix: 'storefront_', settingsPath: '/settings/storefront-type-options' },
  { key: 'barcode_scan_options', label: 'Barcode Scanning', icon: '📱', prefix: 'barcode_', settingsPath: '/settings/barcode-scan-options' },
  { key: 'fulfillment_options', label: 'Fulfillment', icon: '📦', prefix: 'fulfillment_', settingsPath: '/settings/fulfillment' },
  { key: 'product_types', label: 'Product Types', icon: '📦', prefix: 'product_types_', settingsPath: '/settings/product-types' },
  { key: 'product_options', label: 'Product Options', icon: '🏷️', prefix: 'product_options_', settingsPath: '/settings/product-options' },
  { key: 'featured_options', label: 'Featured Options', icon: '⭐', prefix: 'featured_', settingsPath: '/settings/featured-options' },
  { key: 'integration_options', label: 'Integrations', icon: '🔗', prefix: 'integration_', settingsPath: '/settings/integration-options' },
  { key: 'quickstart_options', label: 'Quickstart', icon: '🚀', prefix: 'quickstart_', settingsPath: '/settings/quickstart-options' },
  { key: 'storefront_options', label: 'Storefront Options', icon: '🎨', prefix: 'storefront_opt_', settingsPath: '/settings/storefront-options' },
  { key: 'storefront_qr', label: 'QR Codes', icon: '📱', prefix: 'storefront_qr_', settingsPath: '/settings/storefront-qr' },
  { key: 'storefront_gallery', label: 'Image Gallery', icon: '🖼️', prefix: 'storefront_gallery_', settingsPath: '/settings/storefront-gallery' },
  { key: 'storefront_hours', label: 'Business Hours', icon: '🕐', prefix: 'storefront_hours_', settingsPath: '/settings/storefront-hours' },
  { key: 'storefront_layouts', label: 'Storefront Layout', icon: '📐', prefix: 'storefront_layouts_', settingsPath: '/settings/storefront-layouts' },
  { key: 'storefront_maps', label: 'Storefront Maps', icon: '🗺️', prefix: 'storefront_maps_', settingsPath: '/settings/storefront-maps' },
  { key: 'faq_options', label: 'FAQ Options', icon: '❓', prefix: 'faq_', settingsPath: '/faq/options' },
  { key: 'crm_options', label: 'CRM', icon: '🤝', prefix: 'crm_', settingsPath: '/settings/crm-options' },
  { key: 'directory_entry', label: 'Directory Entry', icon: '📍', prefix: 'directory_entry_', settingsPath: '/settings/directory' },
  { key: 'chatbot_options', label: 'Chatbot', icon: '🤖', prefix: 'chatbot_', settingsPath: '/bot/options' },
  { key: 'social_commerce_options', label: 'Social Commerce', icon: '🛍️', prefix: 'social_commerce_', settingsPath: '/settings/social-commerce' },
  { key: 'wholesale_matching_options', label: 'Wholesale Matching', icon: '🔗', prefix: 'wholesale_', settingsPath: '/settings/wholesale' },
  { key: 'platform_services', label: 'Platform Services', icon: '🔧', prefix: 'platform_service_', settingsPath: '/settings/feature-store' },
  { key: 'funnel_options', label: 'Sales Funnels', icon: '⚡', prefix: 'funnel_options_', settingsPath: '/settings/funnels' },
  { key: 'coupon_options', label: 'Coupons', icon: '🏷️', prefix: 'coupon_', settingsPath: '/settings/coupons' },
];

const COLOR_CLASSES: Record<CapabilityStatusColor, { text: string; dot: string; hover: string }> = {
  green: { text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', hover: 'hover:bg-green-50 dark:hover:bg-green-900/20' },
  red: { text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', hover: 'hover:bg-red-50 dark:hover:bg-red-900/20' },
  orange: { text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', hover: 'hover:bg-orange-50 dark:hover:bg-orange-900/20' },
  blue: { text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
  purple: { text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/20' },
};

function resolveCapabilityColor(
  capKey: string,
  prefix: string,
  enabled: boolean,
  merchantGated: boolean,
  purchasedFeatureKeys: string[],
  overrideFeatureKeys: string[],
): CapabilityStatusColor {
  if (!enabled) return 'red';
  if (merchantGated) return 'orange';

  const hasPurchase = purchasedFeatureKeys.some(k => k.startsWith(prefix));
  if (hasPurchase) return 'blue';

  const hasOverride = overrideFeatureKeys.some(k => k.startsWith(prefix));
  if (hasOverride) return 'purple';

  return 'green';
}

function getCapabilityEnabled(caps: AllCapabilitiesState, capKey: string): boolean {
  switch (capKey) {
    case 'commerce_types': return caps.commerce.enabled;
    case 'payment_gateway_options': return caps.paymentGateway.enabled;
    case 'storefront_types': return caps.storefront.enabled;
    case 'barcode_scan_options': return caps.barcodeScan.enabled;
    case 'fulfillment_options': return caps.fulfillment.enabled;
    case 'product_types': return caps.productType.enabled;
    case 'product_options': return caps.productOptions.enabled;
    case 'featured_options': return caps.featuredOptions.enabled;
    case 'integration_options': return caps.integrationOptions.enabled;
    case 'quickstart_options': return caps.quickstartOptions.enabled;
    case 'storefront_options': return caps.storefrontOptions.enabled;
    case 'storefront_qr': return caps.storefrontQr.enabled;
    case 'storefront_gallery': return caps.storefrontGallery.enabled;
    case 'storefront_hours': return caps.storefrontHours.enabled;
    case 'storefront_layouts': return !!caps.storefrontLayouts?.enabled;
    case 'storefront_maps': return !!caps.storefrontMaps?.enabled;
    case 'faq_options': return caps.faqOptions.enabled;
    case 'crm_options': return caps.crmOptions.enabled;
    case 'directory_entry': return caps.directoryEntryOptions.enabled;
    case 'chatbot_options': return caps.chatbotOptions.enabled;
    case 'social_commerce_options': return caps.socialCommerceOptions.enabled;
    case 'wholesale_matching_options': return !!caps.wholesaleMatching?.enabled;
    case 'platform_services': return !!caps.platformServices?.enabled;
    case 'funnel_options': return !!caps.funnel?.enabled;
    case 'coupon_options': return !!caps.couponOptions?.enabled;
    default: return false;
  }
}

export default function PlanSummaryWidget({ capabilities, loading, tenantId, merchantGates }: PlanSummaryWidgetProps) {
  if (loading || !capabilities) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="h-20 animate-pulse bg-blue-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const { tierName, tierKey, purchasedFeatureKeys, overrideFeatureKeys } = capabilities;

  const entries: CapabilityTypeEntry[] = CAPABILITY_META.map(meta => {
    const enabled = getCapabilityEnabled(capabilities, meta.key);
    const gated = merchantGates?.[meta.key] ?? false;
    const color = resolveCapabilityColor(meta.key, meta.prefix, enabled, gated, purchasedFeatureKeys, overrideFeatureKeys);
    return {
      key: meta.key,
      label: meta.label,
      icon: meta.icon,
      enabled,
      color,
      settingsPath: meta.settingsPath,
    };
  });

  const enabledCount = entries.filter(e => e.enabled).length;
  const totalCount = entries.length;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Your Plan
          </span>
          <span className="text-xs font-normal text-neutral-500">
            {tierName} · {enabledCount}/{totalCount} active
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="flex flex-wrap gap-1.5">
          {entries.map(entry => {
            const colors = COLOR_CLASSES[entry.color];
            const href = entry.settingsPath ? `/t/${tenantId}${entry.settingsPath}` : `/t/${tenantId}/settings/plan-summary`;
            return (
              <Link
                key={entry.key}
                href={href}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${colors.text} ${colors.hover} border border-transparent hover:border-current/20`}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span>{entry.icon}</span>
                <span>{entry.label}</span>
              </Link>
            );
          })}
        </div>
        <Link
          href={`/t/${tenantId}/settings/plan-summary`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          View full plan details
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
