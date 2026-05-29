'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Check, X, Crown, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AllCapabilitiesState,
  CommerceState,
  StorefrontState,
  FeaturedType,
  ProductType,
  GatewayType,
  BarcodeScanMode,
  IntegrationType,
  QuickstartProductType,
  QuickstartCategoryType,
  QuickstartAIType,
  StorefrontOptHoursType,
  StorefrontOptCategoryType,
  StorefrontOptRecommendType,
  StorefrontOptInfoType,
  StorefrontOptQRResolutionType,
  StorefrontOptQRContentType,
  StorefrontOptGalleryType,
  StorefrontOptAdvancedType,
} from '@/services/CapabilityResolutionService';
import { getFeaturedTypeMeta } from '@/utils/featuredOptions';

interface PlanSummaryPanelProps {
  capabilities: AllCapabilitiesState | null;
  loading?: boolean;
  /** Which capability section to highlight (e.g. 'featured_options' or 'product_options') */
  highlightCapability?: string;
  /** Tenant ID for building settings page navigation links */
  tenantId?: string;
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

/** Individual features that comprise each commerce payment group */
const COMMERCE_GROUP_FEATURES: Record<string, string[]> = {
  full: ['Full Payment'],
  deposit: ['Deposit Only'],
  both: ['Full Payment', 'Deposit'],
};

const COMMERCE_DETAIL_LABELS: Record<string, string> = {
  cartVisible: 'Cart',
};

const STOREFRONT_TYPE_LABELS: Record<string, string> = {
  online: 'Online',
  retail: 'Retail',
  both: 'Both',
  service: 'Service',
  none: '',
};

/** Features that comprise each storefront type group */
const STOREFRONT_GROUP_FEATURES: Record<string, string[]> = {
  online: ['Online'],
  retail: ['Retail'],
  both: ['Online', 'Retail'],
  service: ['Service'],
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

const QUICKSTART_PRODUCT_LABELS: Record<QuickstartProductType, string> = {
  wizard: 'Static Wizard',
  image_gen: 'Image Gen',
};

const QUICKSTART_CATEGORY_LABELS: Record<QuickstartCategoryType, string> = {
  category_generator: 'Category Gen',
};

const QUICKSTART_AI_LABELS: Record<QuickstartAIType, string> = {
  ai_openai: 'OpenAI',
  ai_gemini: 'Gemini',
  wizard_ai: 'AI Wizard',
  image_hd: 'HD Images',
};

const STOREFRONT_OPT_HOURS_LABELS: Record<StorefrontOptHoursType, string> = {
  hours_animated: 'Animated Hours',
  hours_status: 'Open/Closed',
};

const STOREFRONT_OPT_CATEGORY_LABELS: Record<StorefrontOptCategoryType, string> = {
  category_store: 'Store Categories',
  category_product: 'Product Categories',
};

const STOREFRONT_OPT_RECOMMEND_LABELS: Record<StorefrontOptRecommendType, string> = {
  recommend_store: 'Store Recs',
  recommend_products: 'Product Recs',
};

const STOREFRONT_OPT_INFO_LABELS: Record<StorefrontOptInfoType, string> = {
  storefront_social_media: 'Social Media',
  storefront_contact: 'Contact Info',
  interactive_maps: 'Maps',
};

const STOREFRONT_OPT_QR_RESOLUTION_LABELS: Record<StorefrontOptQRResolutionType, string> = {
  qr_codes_512: 'QR 512px',
  qr_codes_1024: 'QR 1024px',
  qr_codes_2048: 'QR 2048px',
};

const STOREFRONT_OPT_QR_CONTENT_LABELS: Record<StorefrontOptQRContentType, string> = {
  qr_product: 'Product QR',
  qr_store: 'Store QR',
  qr_logo: 'Logo QR',
  qr_directory: 'Directory QR',
};

const STOREFRONT_OPT_GALLERY_LABELS: Record<StorefrontOptGalleryType, string> = {
  image_gallery_5: '5 Images',
  image_gallery_10: '10 Images',
  image_gallery_15: '15 Images',
};

const STOREFRONT_OPT_ADVANCED_LABELS: Record<StorefrontOptAdvancedType, string> = {
  enhanced_seo: 'Enhanced SEO',
  storefront_actions: 'CTA Buttons',
};

// --- Capability display config ---

const CAPABILITY_DISPLAY: Record<string, { label: string; icon: string; settingsPath?: string }> = {
  commerce_types: { label: 'Commerce', icon: '💰', settingsPath: '/settings/commerce' },
  payment_gateway_options: { label: 'Payment Gateway', icon: '💳', settingsPath: '/settings/payment-gateways' },
  storefront_types: { label: 'Storefront', icon: '🏪', settingsPath: '/settings/storefront-type-options' },
  barcode_scan_options: { label: 'Barcode Scanning', icon: '📱', settingsPath: '/settings/barcode-scan-options' },
  fulfillment_options: { label: 'Fulfillment', icon: '📦', settingsPath: '/settings/fulfillment' },
  product_options: { label: 'Product Options', icon: '🏷️', settingsPath: '/settings/product-options' },
  featured_options: { label: 'Featured Options', icon: '⭐', settingsPath: '/settings/featured-options' },
  integration_options: { label: 'Integrations', icon: '🔗', settingsPath: '/settings/integration-options' },
  quickstart_options: { label: 'Quickstart', icon: '🚀', settingsPath: '/settings/quickstart-options' },
  storefront_options: { label: 'Storefront Options', icon: '🎨', settingsPath: '/settings/storefront-options' },
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
  /** Relative path to the settings page for this capability (null if no dedicated page) */
  settingsPath: string | null;
}

function resolveCapabilitySummaries(caps: AllCapabilitiesState, highlight?: string): CapabilitySummary[] {
  const summaries: CapabilitySummary[] = [];

  // Commerce — expand group labels into individual features like Featured Options
  const c = caps.commerce;
  if (Object.keys(c.features).length > 0) {
    const specifics: string[] = [];
    // Expand payment type group into constituent features
    if (c.paymentType && c.paymentType !== 'none') {
      const groupFeatures = COMMERCE_GROUP_FEATURES[c.paymentType];
      if (groupFeatures) {
        groupFeatures.forEach(f => specifics.push(f));
      } else {
        const label = COMMERCE_PAYMENT_LABELS[c.paymentType];
        if (label) specifics.push(label);
      }
    }
    // Add detail features
    Object.entries(COMMERCE_DETAIL_LABELS).forEach(([key, label]) => {
      if (c[key as keyof CommerceState]) specifics.push(label);
    });
    summaries.push({
      key: 'commerce_types',
      label: CAPABILITY_DISPLAY.commerce_types.label,
      icon: CAPABILITY_DISPLAY.commerce_types.icon,
      enabled: c.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'commerce_types',
      settingsPath: CAPABILITY_DISPLAY.commerce_types.settingsPath ?? null,
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
      settingsPath: CAPABILITY_DISPLAY.payment_gateway_options.settingsPath ?? null,
    });
  }

  // Storefront — expand group labels into individual features like Featured Options
  const sf = caps.storefront;
  if (Object.keys(sf.features).length > 0) {
    const specifics: string[] = [];
    // Use allowedTypes for accurate feature display (e.g. retail+service, not online+retail)
    if (sf.allowedTypes && sf.allowedTypes.length > 0) {
      sf.allowedTypes.forEach(t => {
        const label = STOREFRONT_TYPE_LABELS[t];
        if (label) specifics.push(label);
      });
    } else if (sf.type && sf.type !== 'none') {
      const label = STOREFRONT_TYPE_LABELS[sf.type];
      if (label) specifics.push(label);
    }
    summaries.push({
      key: 'storefront_types',
      label: CAPABILITY_DISPLAY.storefront_types.label,
      icon: CAPABILITY_DISPLAY.storefront_types.icon,
      enabled: sf.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'storefront_types',
      settingsPath: CAPABILITY_DISPLAY.storefront_types.settingsPath ?? null,
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
      settingsPath: CAPABILITY_DISPLAY.barcode_scan_options.settingsPath ?? null,
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
      settingsPath: CAPABILITY_DISPLAY.fulfillment_options.settingsPath ?? null,
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
      settingsPath: CAPABILITY_DISPLAY.product_options.settingsPath ?? null,
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
      settingsPath: CAPABILITY_DISPLAY.featured_options.settingsPath ?? null,
    });
  }

  // Integration Options — list individual types grouped by POS/Google like Featured Options groups
  const io = caps.integrationOptions;
  if (Object.keys(io.features).length > 0) {
    const specifics: string[] = [];
    // POS group types
    if (io.allowedPosTypes.length > 0) {
      io.allowedPosTypes.forEach(t => {
        const label = INTEGRATION_TYPE_LABELS[t];
        if (label) specifics.push(label);
      });
    }
    // Google group types
    if (io.allowedGoogleTypes.length > 0) {
      io.allowedGoogleTypes.forEach(t => {
        const label = INTEGRATION_TYPE_LABELS[t];
        if (label) specifics.push(label);
      });
    }
    // Org-only types (not in pos/google groups)
    const groupTypes = new Set([...io.allowedPosTypes, ...io.allowedGoogleTypes]);
    io.allowedTypes.filter(t => !groupTypes.has(t)).forEach(t => {
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
      settingsPath: CAPABILITY_DISPLAY.integration_options.settingsPath ?? null,
    });
  }

  // Quickstart Options — list product, category, and AI types
  const qo = caps.quickstartOptions;
  if (Object.keys(qo.features).length > 0) {
    const specifics: string[] = [];
    // Product group
    qo.allowedProductTypes.forEach(t => {
      const label = QUICKSTART_PRODUCT_LABELS[t];
      if (label) specifics.push(label);
    });
    // Category group
    qo.allowedCategoryTypes.forEach(t => {
      const label = QUICKSTART_CATEGORY_LABELS[t];
      if (label) specifics.push(label);
    });
    // AI group
    qo.allowedAITypes.forEach(t => {
      const label = QUICKSTART_AI_LABELS[t];
      if (label) specifics.push(label);
    });
    summaries.push({
      key: 'quickstart_options',
      label: CAPABILITY_DISPLAY.quickstart_options.label,
      icon: CAPABILITY_DISPLAY.quickstart_options.icon,
      enabled: qo.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'quickstart_options',
      settingsPath: CAPABILITY_DISPLAY.quickstart_options.settingsPath ?? null,
    });
  }

  // Storefront Options — list groups and features
  const so = caps.storefrontOptions;
  if (Object.keys(so.features).length > 0) {
    const specifics: string[] = [];
    so.allowedHoursTypes.forEach(t => { const l = STOREFRONT_OPT_HOURS_LABELS[t]; if (l) specifics.push(l); });
    so.allowedCategoryTypes.forEach(t => { const l = STOREFRONT_OPT_CATEGORY_LABELS[t]; if (l) specifics.push(l); });
    so.allowedRecommendTypes.forEach(t => { const l = STOREFRONT_OPT_RECOMMEND_LABELS[t]; if (l) specifics.push(l); });
    if (so.recentlyViewedEnabled) specifics.push('Recently Viewed');
    so.allowedInfoTypes.forEach(t => { const l = STOREFRONT_OPT_INFO_LABELS[t]; if (l) specifics.push(l); });
    so.allowedQRResolutions.forEach(t => { const l = STOREFRONT_OPT_QR_RESOLUTION_LABELS[t]; if (l) specifics.push(l); });
    so.allowedQRContentTypes.forEach(t => { const l = STOREFRONT_OPT_QR_CONTENT_LABELS[t]; if (l) specifics.push(l); });
    so.allowedGalleryTypes.forEach(t => { const l = STOREFRONT_OPT_GALLERY_LABELS[t]; if (l) specifics.push(l); });
    so.allowedAdvancedTypes.forEach(t => { const l = STOREFRONT_OPT_ADVANCED_LABELS[t]; if (l) specifics.push(l); });
    summaries.push({
      key: 'storefront_options',
      label: CAPABILITY_DISPLAY.storefront_options.label,
      icon: CAPABILITY_DISPLAY.storefront_options.icon,
      enabled: so.enabled,
      specificFeatures: specifics,
      isHighlighted: highlight === 'storefront_options',
      settingsPath: CAPABILITY_DISPLAY.storefront_options.settingsPath ?? null,
    });
  }

  return summaries;
}

export default function PlanSummaryPanel({ capabilities, loading, highlightCapability, tenantId }: PlanSummaryPanelProps) {
  const router = useRouter();
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
          {summaries.map(cap => {
            const href = cap.settingsPath && tenantId ? `/t/${tenantId}${cap.settingsPath}` : null;
            return (
            <div
              key={cap.key}
              className={`rounded-lg p-3 border ${
                cap.isHighlighted
                  ? 'bg-white border-blue-300 ring-1 ring-blue-200'
                  : 'bg-white/60 border-transparent'
              } ${href ? 'cursor-pointer hover:bg-white/80 hover:border-blue-200 transition-colors' : ''}`}
              onClick={() => href && router.push(href)}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{cap.icon}</span>
                <span className={`text-xs font-semibold ${cap.isHighlighted ? 'text-blue-800' : 'text-neutral-700'}`}>
                  {cap.label}
                </span>
                {href && (
                  <ExternalLink className="h-3 w-3 text-blue-500 ml-0.5" />
                )}
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
          );})}
        </div>
      </CardContent>
    </Card>
  );
}
