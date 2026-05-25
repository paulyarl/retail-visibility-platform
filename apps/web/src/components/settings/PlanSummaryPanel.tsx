'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Check, X, Crown } from 'lucide-react';
import {
  AllCapabilitiesState,
  FeaturedType,
  ProductType,
  GatewayType,
  BarcodeScanMode,
  IntegrationType,
} from '@/services/CapabilityResolutionService';
import { getFeaturedTypeMeta } from '@/utils/featuredOptions';

interface PlanSummaryPanelProps {
  capabilities: AllCapabilitiesState | null;
  loading?: boolean;
  /** Which capability section to highlight (e.g. 'featured_options' or 'product_options') */
  highlightCapability?: string;
}

// --- Display label helpers ---

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  physical: 'Physical',
  digital: 'Digital',
  hybrid: 'Hybrid',
  service: 'Service',
};

const GATEWAY_LABELS: Record<GatewayType, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  square: 'Square',
  clover: 'Clover',
};

const BARCODE_MODE_LABELS: Record<BarcodeScanMode, string> = {
  scan: 'Scanner',
  manual: 'Manual',
  usb: 'USB',
  camera: 'Camera',
  none: '',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  showsPickup: 'Pickup',
  showsDelivery: 'Delivery',
  showsShipping: 'Shipping',
  showsService: 'Service',
};

const COMMERCE_PAYMENT_LABELS: Record<string, string> = {
  full: 'Full Payment',
  deposit: 'Deposit Only',
  both: 'Both Options',
  none: '',
};

const STOREFRONT_TYPE_LABELS: Record<string, string> = {
  online: 'Online',
  retail: 'Retail',
  both: 'Both',
  service: 'Service',
  none: '',
};

const INTEGRATION_TYPE_LABELS: Record<IntegrationType, string> = {
  clover: 'Clover POS',
  square: 'Square POS',
  gbp: 'Google Business Profile',
  google_shopping: 'Google Shopping',
  google_merchant_center: 'Merchant Center',
  gmc_sync: 'GMC Sync',
  propagation_gbp: 'GBP Propagation',
};

// --- Capability display config ---

const CAPABILITY_DISPLAY: Record<string, { label: string; icon: string }> = {
  commerce_types: { label: 'Commerce', icon: '💰' },
  payment_gateway_options: { label: 'Payment Gateway', icon: '💳' },
  storefront_types: { label: 'Storefront', icon: '🏪' },
  barcode_scan_options: { label: 'Barcode Scanning', icon: '📱' },
  fulfillment_options: { label: 'Fulfillment', icon: '📦' },
  product_options: { label: 'Product Options', icon: '🏷️' },
  featured_options: { label: 'Featured Options', icon: '⭐' },
  integration_options: { label: 'Integrations', icon: '🔗' },
};

// --- Resolved feature extraction per capability ---

interface CapabilitySummary {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  /** Human-readable list of specific enabled features */
  specificFeatures: string[];
  /** Whether this capability is highlighted in the current view */
  isHighlighted: boolean;
}

function resolveCapabilitySummaries(caps: AllCapabilitiesState, highlight?: string): CapabilitySummary[] {
  const summaries: CapabilitySummary[] = [];

  // Commerce
  const c = caps.commerce;
  if (Object.keys(c.features).length > 0) {
    const specifics: string[] = [];
    if (c.paymentType && c.paymentType !== 'none') {
      const label = COMMERCE_PAYMENT_LABELS[c.paymentType];
      if (label) specifics.push(label);
    }
    if (c.cartVisible) specifics.push('Cart');
    summaries.push({
      key: 'commerce_types',
      label: CAPABILITY_DISPLAY.commerce_types.label,
      icon: CAPABILITY_DISPLAY.commerce_types.icon,
      enabled: c.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'commerce_types',
    });
  }

  // Payment Gateway
  const pg = caps.paymentGateway;
  if (Object.keys(pg.features).length > 0) {
    summaries.push({
      key: 'payment_gateway_options',
      label: CAPABILITY_DISPLAY.payment_gateway_options.label,
      icon: CAPABILITY_DISPLAY.payment_gateway_options.icon,
      enabled: pg.enabled,
      specificFeatures: pg.allowedGateways.map(g => GATEWAY_LABELS[g] || g),
      isHighlighted: highlight === 'payment_gateway_options',
    });
  }

  // Storefront
  const sf = caps.storefront;
  if (Object.keys(sf.features).length > 0) {
    const specifics: string[] = [];
    if (sf.type && sf.type !== 'none') {
      const label = STOREFRONT_TYPE_LABELS[sf.type];
      if (label) specifics.push(label);
    }
    if (sf.showsLocation) specifics.push('Location');
    if (sf.showsHours && (sf.type === 'retail' || sf.type === 'both')) specifics.push('Hours');
    if (sf.showsMap) specifics.push('Map');
    summaries.push({
      key: 'storefront_types',
      label: CAPABILITY_DISPLAY.storefront_types.label,
      icon: CAPABILITY_DISPLAY.storefront_types.icon,
      enabled: sf.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'storefront_types',
    });
  }

  // Barcode
  const bc = caps.barcodeScan;
  if (Object.keys(bc.features).length > 0) {
    summaries.push({
      key: 'barcode_scan_options',
      label: CAPABILITY_DISPLAY.barcode_scan_options.label,
      icon: CAPABILITY_DISPLAY.barcode_scan_options.icon,
      enabled: bc.enabled,
      specificFeatures: bc.allowedModes.filter(m => m !== 'none').map(m => BARCODE_MODE_LABELS[m] || m),
      isHighlighted: highlight === 'barcode_scan_options',
    });
  }

  // Fulfillment
  const fl = caps.fulfillment;
  if (Object.keys(fl.features).length > 0) {
    const specifics: string[] = [];
    if (fl.showsPickup) specifics.push(FULFILLMENT_LABELS.showsPickup);
    if (fl.showsDelivery) specifics.push(FULFILLMENT_LABELS.showsDelivery);
    if (fl.showsShipping) specifics.push(FULFILLMENT_LABELS.showsShipping);
    if (fl.showsService) specifics.push(FULFILLMENT_LABELS.showsService);
    summaries.push({
      key: 'fulfillment_options',
      label: CAPABILITY_DISPLAY.fulfillment_options.label,
      icon: CAPABILITY_DISPLAY.fulfillment_options.icon,
      enabled: fl.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'fulfillment_options',
    });
  }

  // Product Options
  const po = caps.productOptions;
  if (Object.keys(po.features).length > 0) {
    const specifics: string[] = [];
    po.allowedTypes.forEach(t => specifics.push(PRODUCT_TYPE_LABELS[t] || t));
    if (po.showsVariants) specifics.push('Variants');
    if (po.showsGallery) specifics.push('Gallery');
    if (po.showsVideo) specifics.push('Video');
    summaries.push({
      key: 'product_options',
      label: CAPABILITY_DISPLAY.product_options.label,
      icon: CAPABILITY_DISPLAY.product_options.icon,
      enabled: po.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'product_options',
    });
  }

  // Featured Options
  const fo = caps.featuredOptions;
  if (Object.keys(fo.features).length > 0) {
    const specifics: string[] = [];
    // Show tenant-controlled types (resolver handles group enabled/untouched/disabled)
    fo.allowedTenantTypes.forEach(t => {
      const meta = getFeaturedTypeMeta(t);
      specifics.push(meta.label);
    });
    // Show platform-controlled types (resolver handles group enabled/untouched/disabled)
    fo.allowedPlatformTypes.forEach(t => {
      const meta = getFeaturedTypeMeta(t);
      specifics.push(meta.label);
    });
    summaries.push({
      key: 'featured_options',
      label: CAPABILITY_DISPLAY.featured_options.label,
      icon: CAPABILITY_DISPLAY.featured_options.icon,
      enabled: fo.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'featured_options',
    });
  }

  // Integration Options
  const io = caps.integrationOptions;
  if (Object.keys(io.features).length > 0) {
    const specifics: string[] = [];
    io.allowedTypes.forEach(t => {
      const label = INTEGRATION_TYPE_LABELS[t];
      if (label) specifics.push(label);
    });
    summaries.push({
      key: 'integration_options',
      label: CAPABILITY_DISPLAY.integration_options.label,
      icon: CAPABILITY_DISPLAY.integration_options.icon,
      enabled: io.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'integration_options',
    });
  }

  return summaries;
}

export default function PlanSummaryPanel({ capabilities, loading, highlightCapability }: PlanSummaryPanelProps) {
  if (loading || !capabilities) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="h-32 animate-pulse bg-blue-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const { tierKey, tierName, tierDescription } = capabilities;
  const summaries = resolveCapabilitySummaries(capabilities, highlightCapability);

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-blue-600" />
          Your Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier name and description */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Crown className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-neutral-900 text-lg">{tierName}</h3>
              <Badge variant="info">{tierKey}</Badge>
            </div>
            {tierDescription && (
              <p className="text-sm text-neutral-600 mt-0.5">{tierDescription}</p>
            )}
          </div>
        </div>

        {/* Capability grid with resolved features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {summaries.map(cap => (
            <div
              key={cap.key}
              className={`rounded-lg p-3 border ${
                cap.isHighlighted
                  ? 'bg-white border-blue-300 ring-1 ring-blue-200'
                  : 'bg-white/60 border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{cap.icon}</span>
                <span className={`text-xs font-semibold ${cap.isHighlighted ? 'text-blue-800' : 'text-neutral-700'}`}>
                  {cap.label}
                </span>
                {!cap.enabled && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">Off</Badge>
                )}
              </div>
              {cap.specificFeatures.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {cap.specificFeatures.map(f => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-800 border border-green-200"
                    >
                      <Check className="h-2.5 w-2.5" />
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                  <X className="h-3 w-3" /> None available
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
