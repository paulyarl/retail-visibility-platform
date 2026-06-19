'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Check, X, Crown, ExternalLink, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AllCapabilitiesState,
  CommerceState,
  StorefrontState,
  FeaturedType,
  ProductType,
  ProductLayoutType,
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
  StorefrontOptLayoutType,
  FaqManagementType,
  FaqPreviewType,
  FaqDisplayType,
  FaqKnowledgeBaseType,
  DirectoryEntryLayoutKey,
} from '@/services/CapabilityResolutionService';
import { getFeaturedTypeMeta } from '@/utils/featuredOptions';

interface PlanSummaryPanelProps {
  capabilities: AllCapabilitiesState | null;
  loading?: boolean;
  /** Per-capability merchant-gate status from merchant-pref-aware service methods */
  merchantGates?: Record<string, boolean>;
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

const STOREFRONT_OPT_LAYOUT_LABELS: Record<StorefrontOptLayoutType, string> = {
  classic: 'Classic Layout',
  editorial: 'Editorial Layout',
  immersive: 'Immersive Layout',
};

const PRODUCT_LAYOUT_LABELS: Record<ProductLayoutType, string> = {
  classic: 'Classic Layout',
  editorial: 'Editorial Layout',
  immersive: 'Immersive Layout',
};

const FAQ_MANAGEMENT_LABELS: Record<FaqManagementType, string> = {
  faq_management_hub: 'Hub',
  faq_management_templates: 'Templates',
  faq_management_import: 'Import',
  faq_management_wizard_inline: 'Inline Wizard',
  faq_management_bulk_actions: 'Bulk Actions',
  faq_management_reorder: 'Reorder',
  faq_management_search: 'Search',
};

const FAQ_PREVIEW_LABELS: Record<FaqPreviewType, string> = {
  faq_preview_bot: 'Bot Preview',
  faq_preview_gap_report: 'Gap Report',
  faq_preview_auto_suggest: 'Auto Suggest',
};

const FAQ_DISPLAY_LABELS: Record<FaqDisplayType, string> = {
  faq_display_storefront_accordion: 'Storefront',
  faq_display_product_accordion: 'Product',
  faq_display_search_overlay: 'Search Overlay',
  faq_display_feedback: 'Feedback',
  faq_display_bot_handoff: 'Bot Handoff',
  faq_display_markdown: 'Markdown',
  faq_display_deep_link: 'Deep Link',
};

const FAQ_KB_LABELS: Record<FaqKnowledgeBaseType, string> = {
  faq_kb_static_lookup: 'Static KB',
  faq_kb_rag_retrieval: 'RAG',
  faq_kb_product_scoped: 'Product Scoped',
  faq_kb_auto_sync: 'Auto Sync',
  faq_kb_coverage_metrics: 'Coverage',
};

const DIRECTORY_ENTRY_LAYOUT_LABELS: Record<DirectoryEntryLayoutKey, string> = {
  classic: 'Classic Layout',
  editorial: 'Editorial Layout',
  immersive: 'Immersive Layout',
  premium: 'Premium Layout',
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
  faq_options: { label: 'FAQ Options', icon: '❓', settingsPath: '/faq/options' },
  crm_options: { label: 'CRM', icon: '🤝', settingsPath: '/settings/crm-options' },
  directory_entry: { label: 'Directory Entry', icon: '📍', settingsPath: '/settings/directory' },
  chatbot_options: { label: 'Chatbot', icon: '🤖', settingsPath: '/bot' },
};

// --- Resolved feature extraction per capability ---

type FeatureStatus = 'enabled' | 'merchant-gated' | 'tier-gated';

interface FeatureItem {
  label: string;
  status: FeatureStatus;
}

interface CapabilitySummary {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  /** Whether any feature in this capability is merchant-gated */
  merchantGated: boolean;
  /** Human-readable list of specific enabled features */
  specificFeatures: string[];
  /** Per-feature status for color-coded rendering */
  featureStatuses: FeatureItem[];
  /** Whether this capability is highlighted in the current view */
  isHighlighted: boolean;
  /** Relative path to the settings page for this capability (null if no dedicated page) */
  settingsPath: string | null;
}

function resolveCapabilitySummaries(caps: AllCapabilitiesState, highlight?: string, merchantGates?: Record<string, boolean>): CapabilitySummary[] {
  const summaries: CapabilitySummary[] = [];

  // Commerce — expand group labels into individual features like Featured Options
  const c = caps.commerce;
  if (c.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    // Expand payment type group into constituent features
    if (c.paymentType && c.paymentType !== 'none') {
      const groupFeatures = COMMERCE_GROUP_FEATURES[c.paymentType];
      if (groupFeatures) {
        groupFeatures.forEach(f => {
          specifics.push(f);
          const isEnabled = c.effectivePaymentType === 'both' ||
            (f === 'Full Payment' ? c.effectivePaymentType === 'full' : c.effectivePaymentType === 'deposit');
          statuses.push({ label: f, status: isEnabled ? 'enabled' : 'merchant-gated' });
        });
      } else {
        const label = COMMERCE_PAYMENT_LABELS[c.paymentType];
        if (label) {
          specifics.push(label);
          statuses.push({ label, status: c.effectivePaymentType !== 'none' ? 'enabled' : 'merchant-gated' });
        }
      }
    }
    // Add detail features
    Object.entries(COMMERCE_DETAIL_LABELS).forEach(([key, label]) => {
      if (c[key as keyof CommerceState]) {
        specifics.push(label);
        const effectiveKey = `effective${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CommerceState;
        statuses.push({ label, status: (c[effectiveKey] as boolean) ? 'enabled' : 'merchant-gated' });
      }
    });
    summaries.push({
      key: 'commerce_types',
      label: CAPABILITY_DISPLAY.commerce_types.label,
      icon: CAPABILITY_DISPLAY.commerce_types.icon,
      enabled: c.enabled,
      merchantGated: merchantGates?.['commerce_types'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'commerce_types',
      settingsPath: CAPABILITY_DISPLAY.commerce_types.settingsPath ?? null,
    });
  }

  // Payment Gateway
  const pg = caps.paymentGateway;
  if (pg.enabled) {
    const pgStatuses: FeatureItem[] = pg.allowedGateways.map(g => ({
      label: GATEWAY_LABELS[g] || g,
      status: pg.effectiveGateways.includes(g) ? 'enabled' : 'merchant-gated',
    }));
    summaries.push({
      key: 'payment_gateway_options',
      label: CAPABILITY_DISPLAY.payment_gateway_options.label,
      icon: CAPABILITY_DISPLAY.payment_gateway_options.icon,
      enabled: pg.enabled,
      merchantGated: merchantGates?.['payment_gateway_options'] ?? false,
      specificFeatures: pg.allowedGateways.map(g => GATEWAY_LABELS[g] || g),
      featureStatuses: pgStatuses,
      isHighlighted: highlight === 'payment_gateway_options',
      settingsPath: CAPABILITY_DISPLAY.payment_gateway_options.settingsPath ?? null,
    });
  }

  // Storefront — expand group labels into individual features like Featured Options
  const sf = caps.storefront;
  if (sf.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    const tierTypes = sf.allowedTypes.length > 0 ? sf.allowedTypes : (sf.type !== 'none' ? [sf.type] : []);
    tierTypes.forEach(t => {
      const label = STOREFRONT_TYPE_LABELS[t];
      if (label) {
        specifics.push(label);
        const eff = sf.effectiveType;
        const isEnabled = eff === t || eff === 'both' || (eff !== 'none' && tierTypes.includes(eff as any) && t === eff);
        statuses.push({ label, status: isEnabled ? 'enabled' : 'merchant-gated' });
      }
    });
    summaries.push({
      key: 'storefront_types',
      label: CAPABILITY_DISPLAY.storefront_types.label,
      icon: CAPABILITY_DISPLAY.storefront_types.icon,
      enabled: sf.enabled,
      merchantGated: merchantGates?.['storefront_types'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'storefront_types',
      settingsPath: CAPABILITY_DISPLAY.storefront_types.settingsPath ?? null,
    });
  }

  // Barcode
  const bc = caps.barcodeScan;
  if (bc.enabled) {
    const bcStatuses: FeatureItem[] = bc.allowedModes.filter(m => m !== 'none').map(m => ({
      label: BARCODE_MODE_LABELS[m] || m,
      status: bc.effectiveModes.includes(m) ? 'enabled' : 'merchant-gated',
    }));
    summaries.push({
      key: 'barcode_scan_options',
      label: CAPABILITY_DISPLAY.barcode_scan_options.label,
      icon: CAPABILITY_DISPLAY.barcode_scan_options.icon,
      enabled: bc.enabled,
      merchantGated: merchantGates?.['barcode_scan_options'] ?? false,
      specificFeatures: bc.allowedModes.filter(m => m !== 'none').map(m => BARCODE_MODE_LABELS[m] || m),
      featureStatuses: bcStatuses,
      isHighlighted: highlight === 'barcode_scan_options',
      settingsPath: CAPABILITY_DISPLAY.barcode_scan_options.settingsPath ?? null,
    });
  }

  // Fulfillment
  const fl = caps.fulfillment;
  if (fl.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    const addFl = (tier: boolean, label: string, eff: boolean) => {
      if (tier) { specifics.push(label); statuses.push({ label, status: eff ? 'enabled' : 'merchant-gated' }); }
    };
    addFl(fl.showsPickup, FULFILLMENT_LABELS.showsPickup, fl.effectiveShowsPickup);
    addFl(fl.showsDelivery, FULFILLMENT_LABELS.showsDelivery, fl.effectiveShowsDelivery);
    addFl(fl.showsShipping, FULFILLMENT_LABELS.showsShipping, fl.effectiveShowsShipping);
    addFl(fl.showsService, FULFILLMENT_LABELS.showsService, fl.showsService); // no effective for service
    summaries.push({
      key: 'fulfillment_options',
      label: CAPABILITY_DISPLAY.fulfillment_options.label,
      icon: CAPABILITY_DISPLAY.fulfillment_options.icon,
      enabled: fl.enabled,
      merchantGated: merchantGates?.['fulfillment_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'fulfillment_options',
      settingsPath: CAPABILITY_DISPLAY.fulfillment_options.settingsPath ?? null,
    });
  }

  // Product Options
  const po = caps.productOptions;
  if (po.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    po.allowedTypes.forEach(t => {
      const label = PRODUCT_TYPE_LABELS[t] || t;
      specifics.push(label);
      statuses.push({ label, status: po.effectiveTypes.includes(t) ? 'enabled' : 'merchant-gated' });
    });
    const addPo = (tier: boolean, label: string, eff: boolean) => {
      if (tier) { specifics.push(label); statuses.push({ label, status: eff ? 'enabled' : 'merchant-gated' }); }
    };
    addPo(po.showsVariants, 'Variants', po.effectiveShowsVariants);
    addPo(po.showsGallery, 'Gallery', po.effectiveShowsGallery);
    addPo(po.showsVideo, 'Video', po.effectiveShowsVideo);
    // Layouts
    po.allowedLayouts.forEach(t => {
      const label = PRODUCT_LAYOUT_LABELS[t] || t;
      addPo(true, label, t === po.effectiveLayout);
    });
    // Product page section features
    addPo(po.showsRecentlyViewed, 'Recently Viewed', po.effectiveShowsRecentlyViewed);
    addPo(po.showsQRCodes, 'QR Codes', po.effectiveShowsQRCodes);
    addPo(po.showsQRLogo, 'QR Logo', po.effectiveShowsQRLogo);
    addPo(po.showsRecommended, 'Recommended', po.effectiveShowsRecommended);
    addPo(po.showsMapDisplay, 'Map', po.effectiveShowsMapDisplay);
    addPo(po.showsLocationDisplay, 'Location', po.effectiveShowsLocationDisplay);
    addPo(po.showsHoursDisplay, 'Hours', po.effectiveShowsHoursDisplay);
    addPo(po.showsEnhancedSEO, 'Enhanced SEO', po.effectiveShowsEnhancedSEO);
    addPo(po.showsReviews, 'Reviews', po.effectiveShowsReviews);
    addPo(po.showsFulfillment, 'Fulfillment', po.effectiveShowsFulfillment);
    addPo(po.showsCategories, 'Categories', po.effectiveShowsCategories);
    addPo(po.showsLocationAvailability, 'Availability', po.effectiveShowsLocationAvailability);
    summaries.push({
      key: 'product_options',
      label: CAPABILITY_DISPLAY.product_options.label,
      icon: CAPABILITY_DISPLAY.product_options.icon,
      enabled: po.enabled,
      merchantGated: merchantGates?.['product_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'product_options',
      settingsPath: CAPABILITY_DISPLAY.product_options.settingsPath ?? null,
    });
  }

  // Featured Options
  const fo = caps.featuredOptions;
  if (fo.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    fo.allowedTenantTypes.forEach(t => {
      const meta = getFeaturedTypeMeta(t);
      specifics.push(meta.label);
      statuses.push({ label: meta.label, status: fo.effectiveTenantTypes.includes(t) ? 'enabled' : 'merchant-gated' });
    });
    fo.allowedPlatformTypes.forEach(t => {
      const meta = getFeaturedTypeMeta(t);
      specifics.push(meta.label);
      statuses.push({ label: meta.label, status: fo.effectivePlatformTypes.includes(t) ? 'enabled' : 'merchant-gated' });
    });
    summaries.push({
      key: 'featured_options',
      label: CAPABILITY_DISPLAY.featured_options.label,
      icon: CAPABILITY_DISPLAY.featured_options.icon,
      enabled: fo.enabled,
      merchantGated: merchantGates?.['featured_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'featured_options',
      settingsPath: CAPABILITY_DISPLAY.featured_options.settingsPath ?? null,
    });
  }

  // Integration Options — list individual types grouped by POS/Google like Featured Options groups
  const io = caps.integrationOptions;
  if (io.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    io.allowedPosTypes.forEach(t => {
      const label = INTEGRATION_TYPE_LABELS[t];
      if (label) { specifics.push(label); statuses.push({ label, status: io.effectivePosTypes.includes(t) ? 'enabled' : 'merchant-gated' }); }
    });
    io.allowedGoogleTypes.forEach(t => {
      const label = INTEGRATION_TYPE_LABELS[t];
      if (label) { specifics.push(label); statuses.push({ label, status: io.effectiveGoogleTypes.includes(t) ? 'enabled' : 'merchant-gated' }); }
    });
    const groupTypes = new Set([...io.allowedPosTypes, ...io.allowedGoogleTypes]);
    io.allowedTypes.filter(t => !groupTypes.has(t)).forEach(t => {
      const label = INTEGRATION_TYPE_LABELS[t];
      if (label) { specifics.push(label); statuses.push({ label, status: io.effectiveTypes.includes(t) ? 'enabled' : 'merchant-gated' }); }
    });
    summaries.push({
      key: 'integration_options',
      label: CAPABILITY_DISPLAY.integration_options.label,
      icon: CAPABILITY_DISPLAY.integration_options.icon,
      enabled: io.enabled,
      merchantGated: merchantGates?.['integration_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'integration_options',
      settingsPath: CAPABILITY_DISPLAY.integration_options.settingsPath ?? null,
    });
  }

  // FAQ Options
  const faq = caps.faqOptions;
  if (faq.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    const addFaq = (label: string, enabled: boolean) => {
      if (enabled) { specifics.push(label); statuses.push({ label, status: 'enabled' }); }
    };
    addFaq('Storefront FAQs', faq.storefrontEnabled);
    addFaq('Product FAQs', faq.productEnabled);
    addFaq('FAQ Templates', faq.templatesEnabled);
    faq.allowedManagementTypes.forEach(t => addFaq(FAQ_MANAGEMENT_LABELS[t], true));
    faq.allowedPreviewTypes.forEach(t => addFaq(FAQ_PREVIEW_LABELS[t], true));
    faq.allowedDisplayTypes.forEach(t => addFaq(FAQ_DISPLAY_LABELS[t], true));
    faq.allowedKbTypes.forEach(t => addFaq(FAQ_KB_LABELS[t], true));
    summaries.push({
      key: 'faq_options',
      label: CAPABILITY_DISPLAY.faq_options.label,
      icon: CAPABILITY_DISPLAY.faq_options.icon,
      enabled: faq.enabled,
      merchantGated: merchantGates?.['faq_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'faq_options',
      settingsPath: CAPABILITY_DISPLAY.faq_options.settingsPath ?? null,
    });
  }

  // Storefront Options — list groups and features
  const so = caps.storefrontOptions;
  if (so.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    const addSo = (label: string, tierAllowed: boolean, effective: boolean) => {
      if (tierAllowed && label) { specifics.push(label); statuses.push({ label, status: effective ? 'enabled' : 'merchant-gated' }); }
    };
    so.allowedHoursTypes.forEach(t => addSo(STOREFRONT_OPT_HOURS_LABELS[t], true, t === 'hours_animated' ? so.canUseAnimatedHours : t === 'hours_status' ? so.canShowHoursStatus : false));
    so.allowedCategoryTypes.forEach(t => addSo(STOREFRONT_OPT_CATEGORY_LABELS[t], true, t === 'category_store' ? so.canUseCategoryStore : t === 'category_product' ? so.canUseCategoryProduct : false));
    so.allowedRecommendTypes.forEach(t => addSo(STOREFRONT_OPT_RECOMMEND_LABELS[t], true, t === 'recommend_store' ? so.canUseRecommendStore : t === 'recommend_products' ? so.canUseRecommendProducts : false));
    addSo('Recently Viewed', so.recentlyViewedEnabled, so.canUseRecentlyViewed);
    so.allowedInfoTypes.forEach(t => addSo(STOREFRONT_OPT_INFO_LABELS[t], true, t === 'storefront_social_media' ? so.canUseSocialMedia : t === 'storefront_contact' ? so.canUseContact : t === 'interactive_maps' ? so.canUseInteractiveMaps : false));
    so.allowedQRResolutions.forEach(t => addSo(STOREFRONT_OPT_QR_RESOLUTION_LABELS[t], true, so.canUseQRCodes));
    so.allowedQRContentTypes.forEach(t => addSo(STOREFRONT_OPT_QR_CONTENT_LABELS[t], true, so.canUseQRCodes));
    so.allowedGalleryTypes.forEach(t => addSo(STOREFRONT_OPT_GALLERY_LABELS[t], true, true));
    so.allowedAdvancedTypes.forEach(t => addSo(STOREFRONT_OPT_ADVANCED_LABELS[t], true, t === 'enhanced_seo' ? so.canUseEnhancedSEO : t === 'storefront_actions' ? so.canUseStorefrontActions : false));
    // Layouts
    so.allowedLayouts.forEach(t => addSo(STOREFRONT_OPT_LAYOUT_LABELS[t], true, t === 'classic' ? so.canUseLayoutClassic : t === 'editorial' ? so.canUseLayoutEditorial : so.canUseLayoutImmersive));
    summaries.push({
      key: 'storefront_options',
      label: CAPABILITY_DISPLAY.storefront_options.label,
      icon: CAPABILITY_DISPLAY.storefront_options.icon,
      enabled: so.enabled,
      merchantGated: merchantGates?.['storefront_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'storefront_options',
      settingsPath: CAPABILITY_DISPLAY.storefront_options.settingsPath ?? null,
    });
  }

  // Quickstart Options — list product, category, and AI types
  const qo = caps.quickstartOptions;
  if (qo.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    qo.allowedProductTypes.forEach(t => {
      const label = QUICKSTART_PRODUCT_LABELS[t];
      if (label) {
        specifics.push(label);
        const isEnabled = t === 'wizard' ? qo.canUseWizard : t === 'image_gen' ? qo.canGenerateImages : false;
        statuses.push({ label, status: isEnabled ? 'enabled' : 'merchant-gated' });
      }
    });
    qo.allowedCategoryTypes.forEach(t => {
      const label = QUICKSTART_CATEGORY_LABELS[t];
      if (label) {
        specifics.push(label);
        const isEnabled = t === 'category_generator' ? qo.canUseCategoryGenerator : false;
        statuses.push({ label, status: isEnabled ? 'enabled' : 'merchant-gated' });
      }
    });
    qo.allowedAITypes.forEach(t => {
      const label = QUICKSTART_AI_LABELS[t];
      if (label) {
        specifics.push(label);
        const isEnabled = t === 'ai_openai' ? qo.canUseOpenAI : t === 'ai_gemini' ? qo.canUseGemini : t === 'wizard_ai' ? qo.canUseAIWizard : t === 'image_hd' ? qo.canUseHDImages : false;
        statuses.push({ label, status: isEnabled ? 'enabled' : 'merchant-gated' });
      }
    });
    summaries.push({
      key: 'quickstart_options',
      label: CAPABILITY_DISPLAY.quickstart_options.label,
      icon: CAPABILITY_DISPLAY.quickstart_options.icon,
      enabled: qo.enabled,
      merchantGated: merchantGates?.['quickstart_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'quickstart_options',
      settingsPath: CAPABILITY_DISPLAY.quickstart_options.settingsPath ?? null,
    });
  }

  // Directory Entry
  const de = caps.directoryEntryOptions;
  if (de.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    de.allowedLayouts.forEach(t => {
      const label = DIRECTORY_ENTRY_LAYOUT_LABELS[t];
      if (label) {
        specifics.push(label);
        statuses.push({ label, status: de.effectiveLayout === t ? 'enabled' : 'merchant-gated' });
      }
    });
    const addDe = (label: string, tierAllowed: boolean, effective: boolean) => {
      if (tierAllowed && label) { specifics.push(label); statuses.push({ label, status: effective ? 'enabled' : 'merchant-gated' }); }
    };
    addDe('Hours', de.hoursEnabled, de.hoursEnabled);
    addDe('Map', de.mapEnabled, de.mapEnabled);
    addDe('Contact', de.contactEnabled, de.contactEnabled);
    addDe('Gallery', de.galleryEnabled, de.galleryEnabled);
    addDe('QR', de.qrEnabled, de.qrEnabled);
    addDe('Social', de.socialEnabled, de.socialEnabled);
    addDe('SEO', de.seoEnabled, de.seoEnabled);
    summaries.push({
      key: 'directory_entry',
      label: CAPABILITY_DISPLAY.directory_entry.label,
      icon: CAPABILITY_DISPLAY.directory_entry.icon,
      enabled: de.enabled,
      merchantGated: merchantGates?.['directory_entry'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'directory_entry',
      settingsPath: CAPABILITY_DISPLAY.directory_entry.settingsPath ?? null,
    });
  }

  // CRM Options
  const crm = caps.crmOptions;
  if (crm.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    if (crm.allowedInquiryTypes.length > 0) {
      specifics.push('Inquiries');
      statuses.push({ label: 'Inquiries', status: (crm.inquiryProductEnabled || crm.inquiryStorefrontEnabled || crm.inquiryDirectoryEnabled) ? 'enabled' : 'merchant-gated' });
    }
    if (crm.allowedContactTypes.length > 0) {
      specifics.push('Contacts');
      statuses.push({ label: 'Contacts', status: crm.contactsEnabled ? 'enabled' : 'merchant-gated' });
    }
    if (crm.allowedTicketTypes.length > 0) {
      specifics.push('Tickets');
      statuses.push({ label: 'Tickets', status: crm.ticketFeaturesEnabled ? 'enabled' : 'merchant-gated' });
    }
    if (crm.allowedMessageTypes.length > 0) {
      specifics.push('Messages');
      statuses.push({ label: 'Messages', status: crm.messageFeaturesEnabled ? 'enabled' : 'merchant-gated' });
    }
    if (crm.allowedCustomerTicketTypes.length > 0) {
      specifics.push('Customer Portal');
      statuses.push({ label: 'Customer Portal', status: crm.customerTicketsEnabled ? 'enabled' : 'merchant-gated' });
    }
    if (crm.allowedDashboardTypes.length > 0) {
      specifics.push('Dashboard');
      statuses.push({ label: 'Dashboard', status: crm.dashboardEnabled ? 'enabled' : 'merchant-gated' });
    }
    summaries.push({
      key: 'crm_options',
      label: CAPABILITY_DISPLAY.crm_options.label,
      icon: CAPABILITY_DISPLAY.crm_options.icon,
      enabled: crm.enabled,
      merchantGated: merchantGates?.['crm_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'crm_options',
      settingsPath: CAPABILITY_DISPLAY.crm_options.settingsPath ?? null,
    });
  }

  // Chatbot Options
  const bot = caps.chatbotOptions;
  if (bot.enabled) {
    const specifics: string[] = [];
    const statuses: FeatureItem[] = [];
    if (bot.staticEnabled) {
      specifics.push('Static FAQ');
      statuses.push({ label: 'Static FAQ', status: 'enabled' });
    }
    if (bot.dynamicEnabled) {
      specifics.push('Dynamic AI');
      statuses.push({ label: 'Dynamic AI', status: 'enabled' });
    }
    if (bot.skillsEnabled) {
      specifics.push('Skills');
      statuses.push({ label: 'Skills', status: 'enabled' });
    }
    if (bot.kbEnabled) {
      specifics.push('Knowledge Base');
      statuses.push({ label: 'Knowledge Base', status: 'enabled' });
    }
    if (bot.widgetEnabled) {
      specifics.push('Widget');
      statuses.push({ label: 'Widget', status: 'enabled' });
    }
    summaries.push({
      key: 'chatbot_options',
      label: CAPABILITY_DISPLAY.chatbot_options.label,
      icon: CAPABILITY_DISPLAY.chatbot_options.icon,
      enabled: bot.enabled,
      merchantGated: merchantGates?.['chatbot_options'] ?? false,
      specificFeatures: specifics,
      featureStatuses: statuses,
      isHighlighted: highlight === 'chatbot_options',
      settingsPath: CAPABILITY_DISPLAY.chatbot_options.settingsPath ?? null,
    });
  }

  return summaries;
}

export default function PlanSummaryPanel({ capabilities, loading, highlightCapability, tenantId, merchantGates }: PlanSummaryPanelProps) {
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
  const summaries = resolveCapabilitySummaries(capabilities, highlightCapability, merchantGates);

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
                className={`rounded-lg p-3 border ${cap.isHighlighted
                  ? 'bg-white border-blue-300 ring-1 ring-blue-200'
                  : cap.merchantGated
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white/60 border-transparent'
                  } ${href ? 'cursor-pointer hover:bg-white/80 hover:border-blue-200 transition-colors' : ''}`}
                onClick={() => href && router.push(href)}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{cap.icon}</span>
                  <span className={`text-xs font-semibold ${cap.isHighlighted ? 'text-blue-800' : cap.merchantGated ? 'text-amber-800' : 'text-neutral-700'}`}>
                    {cap.label}
                  </span>
                  {href && (
                    <ExternalLink className={`h-3 w-3 ml-0.5 ${cap.merchantGated ? 'text-amber-600' : 'text-blue-500'}`} />
                  )}
                  {!cap.enabled ? (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">Off</Badge>
                  ) : cap.merchantGated ? (
                    <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>
                  ) : null}
                </div>
                {cap.featureStatuses.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {cap.featureStatuses.map(f => (
                      <span
                        key={f.label}
                        className={`inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded border ${f.status === 'enabled'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : f.status === 'merchant-gated'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                      >
                        {f.status === 'enabled' ? (
                          <Check className="h-2.5 w-2.5" />
                        ) : f.status === 'merchant-gated' ? (
                          <Lock className="h-2.5 w-2.5" />
                        ) : (
                          <X className="h-2.5 w-2.5" />
                        )}
                        {f.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                    <X className="h-3 w-3" /> None available
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
