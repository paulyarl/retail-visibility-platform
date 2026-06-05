/**
 * Capability Resolution Service
 * 
 * Fetches and resolves tenant tier capabilities from the backend,
 * providing typed domain-specific state for commerce, payment gateways,
 * and storefront types.
 * 
 * Extends CustomerApiSingleton for public/customer-facing pages.
 * A parallel TenantApiSingleton variant is available via
 * TenantCapabilityResolutionService for tenant dashboard pages.
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { tenantInfoService } from '@/services/TenantInfoService';
import { publicPaymentGatewaySettingsService } from '@/services/PublicPaymentGatewaySettingsService';
import { publicStorefrontTypeService } from '@/services/PublicStorefrontTypeService';
import { publicCommerceSettingsService } from '@/services/PublicCommerceSettingsService';
import { publicFulfillmentService } from '@/services/PublicFulfillmentService';
import { publicFeaturedOptionsService } from '@/services/PublicFeaturedOptionsService';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';


// ====================
// TYPES
// ====================

export interface TenantCapabilitiesResponse {
  tier_key: string;
  tier_name?: string;
  tier_description?: string;
  capabilities: Record<string, CapabilityGroup>;
  uncategorized_features: string[];
}

export interface CapabilityGroup {
  capability_enabled: boolean;
  is_highlighted: boolean;
  features: Record<string, boolean>;
}

// --- Commerce Types ---

export type CommercePaymentType = 'full' | 'deposit' | 'both' | 'none';

export interface CommerceState {
  enabled: boolean;
  cartVisible: boolean;
  paymentType: CommercePaymentType;
  /** Effective payment type after applying merchant preferences */
  effectivePaymentType: CommercePaymentType;
  /** Whether cart is visible after applying merchant preferences */
  effectiveCartVisible: boolean;
  /** Merchant preference toggles for commerce */
  merchantPreferences: {
    deposit_enabled: boolean;
    full_payment_enabled: boolean;
  };
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Payment Gateway Options ---

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';

export interface PaymentGatewayState {
  enabled: boolean;
  /** Gateways allowed by tier capability (hard gate) */
  allowedGateways: GatewayType[];
  /** Gateways effectively enabled after applying merchant preferences (tier allows AND merchant enabled) */
  effectiveGateways: GatewayType[];
  /** Merchant preference toggles per gateway type */
  merchantPreferences: {
    gateway_enabled: boolean;
    stripe_enabled: boolean;
    paypal_enabled: boolean;
    square_enabled: boolean;
    clover_enabled: boolean;
  };
  isFlexible: boolean;
  /** Whether checkout is available (at least one effective gateway) */
  checkoutAvailable: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Storefront Types ---

export type StorefrontType = 'online' | 'retail' | 'service' | 'both' | 'none';

export interface StorefrontState {
  enabled: boolean;
  /** Type determined by tier features (online/retail/service/both/none) */
  type: StorefrontType;
  /** Type effectively used after applying merchant preferences */
  effectiveType: StorefrontType;
  isFlexible: boolean;
  /** Which individual storefront types are allowed by the tier (e.g. ['retail','service'] when type='both') */
  allowedTypes: StorefrontType[];
  /** Whether the merchant has selected a specific type when multiple are available */
  hasMerchantSelection: boolean;
  /** Merchant preference for storefront type */
  merchantPreferences: {
    storefront_type_enabled: boolean;
    selected_storefront_type: StorefrontType;
  };
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Barcode Scan Options ---

export type BarcodeScanMode = 'scan' | 'manual' | 'usb' | 'camera' | 'none';

export interface BarcodeScanState {
  enabled: boolean;
  /** Available scan modes based on capability features (tier-allowed, hard gate) */
  allowedModes: BarcodeScanMode[];
  /** Scan modes effectively enabled after applying merchant preferences (tier allows AND merchant enabled) */
  effectiveModes: BarcodeScanMode[];
  /** Whether barcode scanning is flexible (all modes available) */
  isFlexible: boolean;
  /** Whether at least one scan mode is available (tier-allowed) */
  scanAvailable: boolean;
  /** Whether at least one scan mode is effectively available after merchant preferences */
  effectiveScanAvailable: boolean;
  /** Merchant preference toggles for barcode scan modes */
  merchantPreferences: {
    barcode_scan_enabled: boolean;
    barcode_manual_enabled: boolean;
    barcode_usb_enabled: boolean;
    barcode_camera_enabled: boolean;
  };
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Fulfillment Options ---

export interface FulfillmentState {
  enabled: boolean;
  /** Tier-allowed fulfillment methods (hard gate) */
  showsPickup: boolean;
  showsDelivery: boolean;
  showsShipping: boolean;
  showsService: boolean;
  /** Effective fulfillment methods after applying merchant preferences (tier allows AND merchant enabled) */
  effectiveShowsPickup: boolean;
  effectiveShowsDelivery: boolean;
  effectiveShowsShipping: boolean;
  /** Merchant preference toggles for fulfillment */
  merchantPreferences: {
    pickup_enabled: boolean;
    delivery_enabled: boolean;
    shipping_enabled: boolean;
  };
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Featured Options ---

export type FeaturedType =
  // Tenant-controlled
  | 'store_selection' | 'new_arrival' | 'seasonal' | 'sale'
  | 'staff_pick' | 'clearance' | 'featured'
  // Platform-controlled
  | 'bestseller' | 'trending' | 'recommended' | 'random_featured';

export interface FeaturedOptionsState {
  /** Whether the featured capability is enabled at all */
  enabled: boolean;
  /** Whether tenant-controlled featured types are enabled as a group */
  tenantEnabled: boolean;
  /** Whether platform-controlled featured types are enabled as a group */
  platformEnabled: boolean;
  /** Individual tenant-controlled featured types allowed by tier (hard gate) */
  allowedTenantTypes: FeaturedType[];
  /** Individual platform-controlled featured types allowed by tier (hard gate) */
  allowedPlatformTypes: FeaturedType[];
  /** All allowed featured types (union of tenant + platform, hard gate) */
  allowedTypes: FeaturedType[];
  /** Tenant-controlled featured types effectively enabled (tier allows AND merchant enabled) */
  effectiveTenantTypes: FeaturedType[];
  /** Platform-controlled featured types effectively enabled (tier allows AND merchant enabled) */
  effectivePlatformTypes: FeaturedType[];
  /** All effectively enabled featured types (union of effective tenant + platform) */
  effectiveTypes: FeaturedType[];
  /** Merchant preference toggles for featured options */
  merchantPreferences: {
    featured_enabled: boolean;
    featured_store_selection: boolean;
    featured_new_arrival: boolean;
    featured_seasonal: boolean;
    featured_sale: boolean;
    featured_staff_pick: boolean;
    featured_clearance: boolean;
    featured_featured: boolean;
    featured_bestseller: boolean;
    featured_trending: boolean;
    featured_recommended: boolean;
    featured_random_featured: boolean;
  };
  /** Whether all featured options are available (flexible tier) */
  isFlexible: boolean;
  /** Whether at least one featured type is available (tier-only) */
  featuredAvailable: boolean;
  /** Whether at least one effective featured type is available */
  effectiveFeaturedAvailable: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Product Options ---

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';

export interface ProductOptionsState {
  enabled: boolean;
  /** Available product types based on capability features (tier-allowed, hard gate) */
  allowedTypes: ProductType[];
  /** Product types effectively enabled after applying merchant preferences (tier allows AND merchant enabled) */
  effectiveTypes: ProductType[];
  /** Whether variants are available during creation (tier-allowed) */
  showsVariants: boolean;
  /** Whether image gallery is available during creation (tier-allowed) */
  showsGallery: boolean;
  /** Whether video attachment is available during creation (tier-allowed) */
  showsVideo: boolean;
  /** Whether variants are effectively available after merchant preferences */
  effectiveShowsVariants: boolean;
  /** Whether image gallery is effectively available after merchant preferences */
  effectiveShowsGallery: boolean;
  /** Whether video attachment is effectively available after merchant preferences */
  effectiveShowsVideo: boolean;
  /** Merchant preference toggles for product options */
  merchantPreferences: {
    product_physical_enabled: boolean;
    product_digital_enabled: boolean;
    product_hybrid_enabled: boolean;
    product_service_enabled: boolean;
    product_variant_enabled: boolean;
    product_gallery_enabled: boolean;
    product_video_enabled: boolean;
  };
  /** Whether all product options are available (flexible tier) */
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Integration Options ---

export type IntegrationType =
  | 'clover' | 'square' | 'gbp'
  | 'google_shopping' | 'google_merchant_center' | 'gmc_sync'
  | 'propagation_gbp';

export type IntegrationGroup = 'pos' | 'google';

export interface IntegrationOptionsState {
  /** Whether the integration capability is enabled at all */
  enabled: boolean;
  /** Whether POS integrations are enabled as a group */
  posEnabled: boolean;
  /** Whether Google integrations are enabled as a group */
  googleEnabled: boolean;
  /** Individual POS integration types allowed by tier (hard gate) */
  allowedPosTypes: IntegrationType[];
  /** Individual Google integration types allowed by tier (hard gate) */
  allowedGoogleTypes: IntegrationType[];
  /** All allowed integration types (union of pos + google + org, hard gate) */
  allowedTypes: IntegrationType[];
  /** POS integration types effectively enabled (tier allows AND merchant enabled) */
  effectivePosTypes: IntegrationType[];
  /** Google integration types effectively enabled (tier allows AND merchant enabled) */
  effectiveGoogleTypes: IntegrationType[];
  /** All effectively enabled integration types */
  effectiveTypes: IntegrationType[];
  /** Merchant preference toggles for integration options */
  merchantPreferences: {
    integration_enabled: boolean;
    integration_clover: boolean;
    integration_square: boolean;
    integration_gbp: boolean;
    integration_google_shopping: boolean;
    integration_google_merchant_center: boolean;
    integration_gmc_sync: boolean;
  };
  /** Whether all integration options are available (flexible tier) */
  isFlexible: boolean;
  /** Whether at least one integration type is available (tier-only) */
  integrationsAvailable: boolean;
  /** Whether at least one effective integration type is available */
  effectiveIntegrationsAvailable: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Storefront Options ---

export type StorefrontOptHoursType = 'hours_animated' | 'hours_status';
export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact' | 'interactive_maps';
export type StorefrontOptQRResolutionType = 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
export type StorefrontOptQRContentType = 'qr_product' | 'qr_store' | 'qr_logo' | 'qr_directory';
export type StorefrontOptGalleryType = 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';

export interface StorefrontOptionsState {
  /** Main gate (hard) — storefront_opt_enabled */
  enabled: boolean;
  /** Master gate — storefront_opt_flexible unlocks all feature gates */
  isFlexible: boolean;
  // Store Hours group
  hoursEnabled: boolean;
  allowedHoursTypes: StorefrontOptHoursType[];
  // Category Display group
  categoryEnabled: boolean;
  allowedCategoryTypes: StorefrontOptCategoryType[];
  // Recommendation Display group
  recommendEnabled: boolean;
  allowedRecommendTypes: StorefrontOptRecommendType[];
  // User Behavior
  recentlyViewedEnabled: boolean;
  // Store Information group
  infoEnabled: boolean;
  allowedInfoTypes: StorefrontOptInfoType[];
  // QR Code Display group
  qrEnabled: boolean;
  allowedQRResolutions: StorefrontOptQRResolutionType[];
  allowedQRContentTypes: StorefrontOptQRContentType[];
  // Gallery Display group (radio)
  galleryEnabled: boolean;
  allowedGalleryTypes: StorefrontOptGalleryType[];
  // Advanced group
  advancedEnabled: boolean;
  allowedAdvancedTypes: StorefrontOptAdvancedType[];
  // Convenience flags
  canShowHoursDisplay: boolean;
  canUseAnimatedHours: boolean;
  canShowHoursStatus: boolean;
  canShowMapDisplay: boolean;
  canShowLocationDisplay: boolean;
  canUseCategoryStore: boolean;
  canUseCategoryProduct: boolean;
  canUseRecommendStore: boolean;
  canUseRecommendProducts: boolean;
  canUseRecentlyViewed: boolean;
  canUseSocialMedia: boolean;
  canUseContact: boolean;
  canUseInteractiveMaps: boolean;
  canUseQRCodes: boolean;
  canUseEnhancedSEO: boolean;
  canUseStorefrontActions: boolean;
  /** Merchant preference toggles */
  merchantPreferences: {
    storefront_opt_enabled: boolean;
    hours_display: boolean;
    hours_animated: boolean;
    hours_status: boolean;
    map_display: boolean;
    location_display: boolean;
    category_store: boolean;
    category_product: boolean;
    recommend_store: boolean;
    recommend_products: boolean;
    recently_viewed: boolean;
    storefront_social_media: boolean;
    storefront_contact: boolean;
    interactive_maps: boolean;
    qr_codes_512: boolean;
    qr_codes_1024: boolean;
    qr_codes_2048: boolean;
    qr_product: boolean;
    qr_store: boolean;
    qr_logo: boolean;
    qr_directory: boolean;
    image_gallery_5: boolean;
    image_gallery_10: boolean;
    image_gallery_15: boolean;
    enhanced_seo: boolean;
    storefront_actions: boolean;
    default_qr_resolution: string;
    default_gallery_limit: number;
  };
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Quickstart Options ---

export type QuickstartProductType = 'wizard' | 'image_gen';
export type QuickstartCategoryType = 'category_generator';
export type QuickstartAIType = 'ai_openai' | 'ai_gemini' | 'wizard_ai' | 'image_hd';

export interface QuickstartOptionsState {
  /** Main gate (hard) — quickstart_enabled */
  enabled: boolean;
  /** Master gate — quickstart_flexible unlocks all feature gates */
  isFlexible: boolean;
  /** Product feature gate on (tier-level) */
  productEnabled: boolean;
  /** Product types allowed by tier: wizard (static), image_gen (attach image to product) */
  allowedProductTypes: QuickstartProductType[];
  /** Category feature gate on (tier-level) */
  categoryEnabled: boolean;
  /** Category types allowed by tier */
  allowedCategoryTypes: QuickstartCategoryType[];
  /** AI feature gate on (tier-level) */
  aiEnabled: boolean;
  /** AI types allowed by tier: ai_openai, ai_gemini, wizard_ai (AI wizard), image_hd (HD quality) */
  allowedAITypes: QuickstartAIType[];
  /** Effective: can use static product wizard */
  canUseWizard: boolean;
  /** Effective: can use AI product wizard (requires AI feature gate + wizard_ai) */
  canUseAIWizard: boolean;
  /** Effective: can use category generator */
  canUseCategoryGenerator: boolean;
  /** Effective: can attach images to products during generation (product feature) */
  canGenerateImages: boolean;
  /** Effective: can use OpenAI models */
  canUseOpenAI: boolean;
  /** Effective: can use Gemini models */
  canUseGemini: boolean;
  /** Effective: can use HD image quality (AI feature, requires image_gen) */
  canUseHDImages: boolean;
  /** Merchant preference toggles (soft gate on top of tier hard gate) */
  merchantPreferences: {
    quickstart_enabled: boolean;
    quickstart_wizard: boolean;
    quickstart_image_gen: boolean;
    quickstart_category_generator: boolean;
    quickstart_wizard_ai: boolean;
    quickstart_ai_openai: boolean;
    quickstart_ai_gemini: boolean;
    quickstart_image_hd: boolean;
    default_text_model: string;
    default_image_model: string;
    default_image_quality: string;
  };
  features: Record<string, boolean>;
}

// --- Combined ---

export interface AllCapabilitiesState {
  tierKey: string;
  tierName: string;
  tierDescription: string;
  commerce: CommerceState;
  paymentGateway: PaymentGatewayState;
  storefront: StorefrontState;
  barcodeScan: BarcodeScanState;
  fulfillment: FulfillmentState;
  productOptions: ProductOptionsState;
  featuredOptions: FeaturedOptionsState;
  integrationOptions: IntegrationOptionsState;
  quickstartOptions: QuickstartOptionsState;
  storefrontOptions: StorefrontOptionsState;
  uncategorizedFeatures: string[];
}

// ====================
// FEATURE PREFIX → CAPABILITY TYPE MAPPING
// ====================

const CAPABILITY_FEATURE_PREFIXES: Record<string, string> = {
  commerce_: 'commerce_types',
  payment_gateway_: 'payment_gateway_options',
  storefront_: 'storefront_types',
  barcode_: 'barcode_scan_options',
  fulfillment_: 'fulfillment_options',
  product_: 'product_options',
  featured_: 'featured_options',
  integration_: 'integration_options',
  quickstart_: 'quickstart_options',
  storefront_opt_: 'storefront_options',
};

/**
 * Determine which capability type a feature key belongs to.
 * Returns null for uncategorized features.
 */
export function getCapabilityTypeForFeature(featureKey: string): string | null {
  for (const [prefix, capType] of Object.entries(CAPABILITY_FEATURE_PREFIXES)) {
    if (featureKey.startsWith(prefix)) return capType;
  }
  return null;
}

// ====================
// RESOLUTION LOGIC
// ====================

/**
 * Resolve commerce state from raw capability features
 */
export function resolveCommerceState(
  features: Record<string, boolean>,
  merchantPrefs?: { deposit_enabled?: boolean; full_payment_enabled?: boolean } | null
): CommerceState {
  const enabled = !!features.commerce_enabled;
  const bothOptions = !!features.commerce_both_options;
  const fullPayment = !!features.commerce_full_payment;
  const depositOnly = !!features.commerce_deposit_only;
  const disabled = !!features.commerce_disabled;

  let paymentType: CommercePaymentType = 'none';
  if (disabled || !enabled) {
    paymentType = 'none';
  } else if (bothOptions) {
    paymentType = 'both';
  } else if (fullPayment) {
    paymentType = 'full';
  } else if (depositOnly) {
    paymentType = 'deposit';
  }

  // Cart is visible if any commerce option is enabled (except disabled)
  const cartVisible = enabled && !disabled && (fullPayment || depositOnly || bothOptions);

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    deposit_enabled: merchantPrefs?.deposit_enabled !== false,
    full_payment_enabled: merchantPrefs?.full_payment_enabled !== false,
  };

  // Effective payment type: apply merchant preferences on top of tier-allowed type
  let effectivePaymentType: CommercePaymentType = 'none';
  if (disabled || !enabled) {
    effectivePaymentType = 'none';
  } else if (paymentType === 'both') {
    // Tier allows both → merchant can disable either
    if (prefs.deposit_enabled && prefs.full_payment_enabled) effectivePaymentType = 'both';
    else if (prefs.full_payment_enabled) effectivePaymentType = 'full';
    else if (prefs.deposit_enabled) effectivePaymentType = 'deposit';
    else effectivePaymentType = 'none';
  } else if (paymentType === 'full') {
    effectivePaymentType = prefs.full_payment_enabled ? 'full' : 'none';
  } else if (paymentType === 'deposit') {
    effectivePaymentType = prefs.deposit_enabled ? 'deposit' : 'none';
  }

  const effectiveCartVisible = enabled && !disabled && effectivePaymentType !== 'none';

  return {
    enabled: enabled && !disabled,
    cartVisible,
    paymentType,
    effectivePaymentType,
    effectiveCartVisible,
    merchantPreferences: prefs,
    isFlexible: bothOptions,
    features,
  };
}

/**
 * Resolve payment gateway state from raw capability features + merchant preferences
 * Tier capability = hard gate (allowed/disallowed by plan)
 * Merchant preference = soft toggle (merchant can disable even if tier allows)
 * Effective = tier allows AND merchant preference enabled
 */
export function resolvePaymentGatewayState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    gateway_enabled?: boolean;
    stripe_enabled?: boolean;
    paypal_enabled?: boolean;
    square_enabled?: boolean;
    clover_enabled?: boolean;
  } | null
): PaymentGatewayState {
  const enabled = !!features.payment_gateway_enabled;
  const flexible = !!features.payment_gateway_flexible;

  // Tier-allowed gateways (hard gate)
  const allowedGateways: GatewayType[] = [];
  if (features.payment_gateway_stripe) allowedGateways.push('stripe');
  if (features.payment_gateway_paypal) allowedGateways.push('paypal');
  if (features.payment_gateway_square) allowedGateways.push('square');
  if (features.payment_gateway_clover) allowedGateways.push('clover');

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    gateway_enabled: merchantPrefs?.gateway_enabled !== false,
    stripe_enabled: merchantPrefs?.stripe_enabled !== false,
    paypal_enabled: merchantPrefs?.paypal_enabled !== false,
    square_enabled: merchantPrefs?.square_enabled !== false,
    clover_enabled: merchantPrefs?.clover_enabled !== false,
  };

  // Effective gateways = tier allows AND merchant enabled AND master gateway switch on
  const effectiveGateways = allowedGateways.filter(gw => {
    if (!prefs.gateway_enabled) return false;
    return prefs[`${gw}_enabled` as keyof typeof prefs];
  });

  return {
    enabled: enabled && prefs.gateway_enabled,
    allowedGateways,
    effectiveGateways,
    merchantPreferences: prefs,
    isFlexible: flexible,
    checkoutAvailable: enabled && prefs.gateway_enabled && effectiveGateways.length > 0,
    features,
  };
}

/**
 * Resolve barcode scan state from raw capability features
 */
export function resolveBarcodeScanState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    barcode_scan_enabled?: boolean;
    barcode_manual_enabled?: boolean;
    barcode_usb_enabled?: boolean;
    barcode_camera_enabled?: boolean;
  } | null
): BarcodeScanState {
  const enabled = !!features.barcode_enabled;
  const flexible = !!features.barcode_flexible;
  const disabled = !!features.barcode_disabled;

  const allowedModes: BarcodeScanMode[] = [];
  if (features.barcode_scan) allowedModes.push('scan');
  if (features.barcode_manual) allowedModes.push('manual');
  if (features.barcode_usb) allowedModes.push('usb');
  if (features.barcode_camera) allowedModes.push('camera');

  // If flexible, all modes are available regardless of individual flags
  if (flexible) {
    allowedModes.push('scan', 'manual', 'usb', 'camera');
  }

  const uniqueModes = [...new Set(allowedModes)];

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    barcode_scan_enabled: merchantPrefs?.barcode_scan_enabled !== false,
    barcode_manual_enabled: merchantPrefs?.barcode_manual_enabled !== false,
    barcode_usb_enabled: merchantPrefs?.barcode_usb_enabled !== false,
    barcode_camera_enabled: merchantPrefs?.barcode_camera_enabled !== false,
  };

  // Effective modes = tier allows AND merchant enabled
  const effectiveModes = uniqueModes.filter((m) => {
    switch (m) {
      case 'scan': return prefs.barcode_scan_enabled;
      case 'manual': return prefs.barcode_manual_enabled;
      case 'usb': return prefs.barcode_usb_enabled;
      case 'camera': return prefs.barcode_camera_enabled;
      default: return true;
    }
  });

  return {
    enabled: enabled && !disabled,
    allowedModes: disabled ? [] : uniqueModes,
    effectiveModes: disabled ? [] : effectiveModes,
    isFlexible: flexible,
    scanAvailable: enabled && !disabled && uniqueModes.length > 0,
    effectiveScanAvailable: enabled && !disabled && effectiveModes.length > 0,
    merchantPreferences: prefs,
    features,
  };
}

/**
 * Resolve fulfillment state from raw capability features
 */
export function resolveFulfillmentState(
  features: Record<string, boolean>,
  merchantPrefs?: { pickup_enabled?: boolean; delivery_enabled?: boolean; shipping_enabled?: boolean } | null
): FulfillmentState {
  const enabled = !!features.fulfillment_enabled;
  const disabled = !!features.fulfillment_disabled;
  const flexible = !!features.fulfillment_flexible;
  const pickup = !!features.fulfillment_pickup;
  const delivery = !!features.fulfillment_delivery;
  const shipping = !!features.fulfillment_shipping;
  const service = !!features.fulfillment_service;

  // If flexible, all options are available regardless of individual flags
  const showsPickup = flexible || pickup;
  const showsDelivery = flexible || delivery;
  const showsShipping = flexible || shipping;
  const showsService = flexible || service;

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    pickup_enabled: merchantPrefs?.pickup_enabled !== false,
    delivery_enabled: merchantPrefs?.delivery_enabled !== false,
    shipping_enabled: merchantPrefs?.shipping_enabled !== false,
  };

  // Effective fulfillment methods = tier allows AND merchant enabled
  const effectiveShowsPickup = showsPickup && prefs.pickup_enabled;
  const effectiveShowsDelivery = showsDelivery && prefs.delivery_enabled;
  const effectiveShowsShipping = showsShipping && prefs.shipping_enabled;

  return {
    enabled: enabled && !disabled,
    showsPickup,
    showsDelivery,
    showsShipping,
    showsService,
    effectiveShowsPickup,
    effectiveShowsDelivery,
    effectiveShowsShipping,
    merchantPreferences: prefs,
    isFlexible: flexible,
    features,
  };
}

/**
 * Resolve product options state from raw capability features
 */
export function resolveProductOptionsState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    product_physical_enabled?: boolean;
    product_digital_enabled?: boolean;
    product_hybrid_enabled?: boolean;
    product_service_enabled?: boolean;
    product_variant_enabled?: boolean;
    product_gallery_enabled?: boolean;
    product_video_enabled?: boolean;
  } | null
): ProductOptionsState {
  const enabled = !!features.product_enabled;
  const disabled = !!features.product_disabled;
  const flexible = !!features.product_flexible;
  const physical = !!features.product_physical;
  const digital = !!features.product_digital;
  const hybrid = !!features.product_hybrid;
  const service = !!features.product_service;
  const variant = !!features.product_variant;
  const gallery = !!features.product_gallery;
  const video = !!features.product_video;

  // If flexible, all options are available regardless of individual flags
  const allowedTypes: ProductType[] = [];
  if (flexible || physical) allowedTypes.push('physical');
  if (flexible || digital) allowedTypes.push('digital');
  if (flexible || hybrid) allowedTypes.push('hybrid');
  if (flexible || service) allowedTypes.push('service');

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    product_physical_enabled: merchantPrefs?.product_physical_enabled !== false,
    product_digital_enabled: merchantPrefs?.product_digital_enabled !== false,
    product_hybrid_enabled: merchantPrefs?.product_hybrid_enabled !== false,
    product_service_enabled: merchantPrefs?.product_service_enabled !== false,
    product_variant_enabled: merchantPrefs?.product_variant_enabled !== false,
    product_gallery_enabled: merchantPrefs?.product_gallery_enabled !== false,
    product_video_enabled: merchantPrefs?.product_video_enabled !== false,
  };

  // Effective types = tier allows AND merchant enabled
  const effectiveTypes = allowedTypes.filter(t => prefs[`product_${t}_enabled` as keyof typeof prefs]);

  // Effective variant/gallery/video = tier allows AND merchant enabled
  const effectiveShowsVariants = (flexible || variant) && prefs.product_variant_enabled;
  const effectiveShowsGallery = (flexible || gallery) && prefs.product_gallery_enabled;
  const effectiveShowsVideo = (flexible || video) && prefs.product_video_enabled;

  return {
    enabled: enabled && !disabled,
    allowedTypes,
    effectiveTypes,
    showsVariants: flexible || variant,
    showsGallery: flexible || gallery,
    showsVideo: flexible || video,
    effectiveShowsVariants,
    effectiveShowsGallery,
    effectiveShowsVideo,
    merchantPreferences: prefs,
    isFlexible: flexible,
    features,
  };
}

/**
 * Resolve featured options state from raw capability features
 */
export function resolveFeaturedOptionsState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    featured_enabled?: boolean;
    featured_store_selection?: boolean;
    featured_new_arrival?: boolean;
    featured_seasonal?: boolean;
    featured_sale?: boolean;
    featured_staff_pick?: boolean;
    featured_clearance?: boolean;
    featured_featured?: boolean;
    featured_bestseller?: boolean;
    featured_trending?: boolean;
    featured_recommended?: boolean;
    featured_random_featured?: boolean;
  } | null
): FeaturedOptionsState {
  const enabled = !!features.featured_enabled;
  const disabled = !!features.featured_disabled;
  const flexible = !!features.featured_flexible;
  const tenantGroupEnabled = !!features.featured_tenant_enabled;
  const tenantGroupDisabled = !!features.featured_tenant_disabled;
  const platformGroupEnabled = !!features.featured_platform_enabled;
  const platformGroupDisabled = !!features.featured_platform_disabled;

  // Three states per group: enabled → all types, untouched → individual features, disabled → none
  const tenantEnabled = tenantGroupEnabled && !tenantGroupDisabled;
  const tenantUntouched = !tenantGroupEnabled && !tenantGroupDisabled;
  const platformEnabled = platformGroupEnabled && !platformGroupDisabled;
  const platformUntouched = !platformGroupEnabled && !platformGroupDisabled;

  // Tenant-controlled types
  const allowedTenantTypes: FeaturedType[] = [];
  if (flexible || tenantEnabled) {
    // Group enabled or flexible → all tenant types
    allowedTenantTypes.push('store_selection', 'new_arrival', 'seasonal', 'sale', 'staff_pick', 'clearance', 'featured');
  } else if (tenantUntouched) {
    // Group untouched → only explicitly listed features
    if (features.featured_store_selection) allowedTenantTypes.push('store_selection');
    if (features.featured_new_arrival) allowedTenantTypes.push('new_arrival');
    if (features.featured_seasonal) allowedTenantTypes.push('seasonal');
    if (features.featured_sale) allowedTenantTypes.push('sale');
    if (features.featured_staff_pick) allowedTenantTypes.push('staff_pick');
    if (features.featured_clearance) allowedTenantTypes.push('clearance');
    if (features.featured_featured) allowedTenantTypes.push('featured');
  }
  // else: tenantGroupDisabled → no tenant types

  // Platform-controlled types
  const allowedPlatformTypes: FeaturedType[] = [];
  if (flexible || platformEnabled) {
    // Group enabled or flexible → all platform types
    allowedPlatformTypes.push('bestseller', 'trending', 'recommended', 'random_featured');
  } else if (platformUntouched) {
    // Group untouched → only explicitly listed features
    if (features.featured_bestseller) allowedPlatformTypes.push('bestseller');
    if (features.featured_trending) allowedPlatformTypes.push('trending');
    if (features.featured_recommended) allowedPlatformTypes.push('recommended');
    if (features.featured_random_featured) allowedPlatformTypes.push('random_featured');
  }
  // else: platformGroupDisabled → no platform types

  const allTypes = [...allowedTenantTypes, ...allowedPlatformTypes];

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    featured_enabled: merchantPrefs?.featured_enabled !== false,
    featured_store_selection: merchantPrefs?.featured_store_selection !== false,
    featured_new_arrival: merchantPrefs?.featured_new_arrival !== false,
    featured_seasonal: merchantPrefs?.featured_seasonal !== false,
    featured_sale: merchantPrefs?.featured_sale !== false,
    featured_staff_pick: merchantPrefs?.featured_staff_pick !== false,
    featured_clearance: merchantPrefs?.featured_clearance !== false,
    featured_featured: merchantPrefs?.featured_featured !== false,
    featured_bestseller: merchantPrefs?.featured_bestseller !== false,
    featured_trending: merchantPrefs?.featured_trending !== false,
    featured_recommended: merchantPrefs?.featured_recommended !== false,
    featured_random_featured: merchantPrefs?.featured_random_featured !== false,
  };

  // Map featured type to merchant pref key
  const typeToPrefKey: Record<FeaturedType, keyof typeof prefs> = {
    store_selection: 'featured_store_selection',
    new_arrival: 'featured_new_arrival',
    seasonal: 'featured_seasonal',
    sale: 'featured_sale',
    staff_pick: 'featured_staff_pick',
    clearance: 'featured_clearance',
    featured: 'featured_featured',
    bestseller: 'featured_bestseller',
    trending: 'featured_trending',
    recommended: 'featured_recommended',
    random_featured: 'featured_random_featured',
  };

  // Effective types = tier allows AND merchant enabled AND master switch on
  const effectiveTenantTypes = prefs.featured_enabled
    ? allowedTenantTypes.filter(t => prefs[typeToPrefKey[t]])
    : [];
  const effectivePlatformTypes = prefs.featured_enabled
    ? allowedPlatformTypes.filter(t => prefs[typeToPrefKey[t]])
    : [];
  const effectiveTypes = [...effectiveTenantTypes, ...effectivePlatformTypes];

  return {
    enabled: enabled && !disabled,
    tenantEnabled,
    platformEnabled,
    allowedTenantTypes,
    allowedPlatformTypes,
    allowedTypes: allTypes,
    effectiveTenantTypes,
    effectivePlatformTypes,
    effectiveTypes,
    merchantPreferences: prefs,
    isFlexible: flexible,
    featuredAvailable: enabled && !disabled && allTypes.length > 0,
    effectiveFeaturedAvailable: enabled && !disabled && effectiveTypes.length > 0,
    features,
  };
}

/**
 * Resolve integration options state from raw capability features
 */
export function resolveIntegrationState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    integration_enabled?: boolean;
    integration_clover?: boolean;
    integration_square?: boolean;
    integration_gbp?: boolean;
    integration_google_shopping?: boolean;
    integration_google_merchant_center?: boolean;
    integration_gmc_sync?: boolean;
  } | null
): IntegrationOptionsState {
  const enabled = !!features.integration_enabled;
  const disabled = !!features.integration_disabled;
  const flexible = !!features.integration_flexible;
  const posGroupEnabled = !!features.integration_pos_enabled;
  const posGroupDisabled = !!features.integration_pos_disabled;
  const googleGroupEnabled = !!features.integration_google_enabled;
  const googleGroupDisabled = !!features.integration_google_disabled;

  // Three states per group: enabled → all types, untouched → individual features, disabled → none
  const posEnabled = posGroupEnabled && !posGroupDisabled;
  const posUntouched = !posGroupEnabled && !posGroupDisabled;
  const googleEnabled = googleGroupEnabled && !googleGroupDisabled;
  const googleUntouched = !googleGroupEnabled && !googleGroupDisabled;

  // POS integration types
  const allowedPosTypes: IntegrationType[] = [];
  if (flexible || posEnabled) {
    allowedPosTypes.push('clover', 'square');
  } else if (posUntouched) {
    if (features.integration_clover) allowedPosTypes.push('clover');
    if (features.integration_square) allowedPosTypes.push('square');
  }

  // Google integration types
  const allowedGoogleTypes: IntegrationType[] = [];
  if (flexible || googleEnabled) {
    allowedGoogleTypes.push('google_shopping', 'google_merchant_center', 'gbp', 'gmc_sync');
  } else if (googleUntouched) {
    if (features.integration_google_shopping) allowedGoogleTypes.push('google_shopping');
    if (features.integration_google_merchant_center) allowedGoogleTypes.push('google_merchant_center');
    if (features.integration_gbp) allowedGoogleTypes.push('gbp');
    if (features.integration_gmc_sync) allowedGoogleTypes.push('gmc_sync');
  }

  const allTypes: IntegrationType[] = [...allowedPosTypes, ...allowedGoogleTypes];

  // Organization-only: propagation_gbp (not part of pos/google groups)
  if (features.integration_propagation_gbp) {
    allTypes.push('propagation_gbp');
  }

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    integration_enabled: merchantPrefs?.integration_enabled !== false,
    integration_clover: merchantPrefs?.integration_clover !== false,
    integration_square: merchantPrefs?.integration_square !== false,
    integration_gbp: merchantPrefs?.integration_gbp !== false,
    integration_google_shopping: merchantPrefs?.integration_google_shopping !== false,
    integration_google_merchant_center: merchantPrefs?.integration_google_merchant_center !== false,
    integration_gmc_sync: merchantPrefs?.integration_gmc_sync !== false,
  };

  // Map integration type to merchant pref key
  const typeToPrefKey: Record<string, keyof typeof prefs> = {
    clover: 'integration_clover',
    square: 'integration_square',
    gbp: 'integration_gbp',
    google_shopping: 'integration_google_shopping',
    google_merchant_center: 'integration_google_merchant_center',
    gmc_sync: 'integration_gmc_sync',
  };

  // Effective types = tier allows AND merchant enabled AND master switch on
  const effectivePosTypes = prefs.integration_enabled
    ? allowedPosTypes.filter(t => prefs[typeToPrefKey[t]] !== false)
    : [];
  const effectiveGoogleTypes = prefs.integration_enabled
    ? allowedGoogleTypes.filter(t => prefs[typeToPrefKey[t]] !== false)
    : [];
  const effectiveTypes: IntegrationType[] = [...effectivePosTypes, ...effectiveGoogleTypes];

  return {
    enabled: enabled && !disabled,
    posEnabled,
    googleEnabled,
    allowedPosTypes,
    allowedGoogleTypes,
    allowedTypes: allTypes,
    effectivePosTypes,
    effectiveGoogleTypes,
    effectiveTypes,
    merchantPreferences: prefs,
    isFlexible: flexible,
    integrationsAvailable: enabled && !disabled && allTypes.length > 0,
    effectiveIntegrationsAvailable: enabled && !disabled && effectiveTypes.length > 0,
    features,
  };
}

/**
 * Resolve quickstart options state from raw capability features
 */
export function resolveQuickstartOptionsState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    quickstart_enabled?: boolean;
    quickstart_wizard?: boolean;
    quickstart_image_gen?: boolean;
    quickstart_category_generator?: boolean;
    quickstart_wizard_ai?: boolean;
    quickstart_ai_openai?: boolean;
    quickstart_ai_gemini?: boolean;
    quickstart_image_hd?: boolean;
    default_text_model?: string;
    default_image_model?: string;
    default_image_quality?: string;
  } | null
): QuickstartOptionsState {
  // Main gate (hard) — must be on for any quickstart feature
  const enabled = !!features.quickstart_enabled;
  const disabled = !!features.quickstart_disabled;
  // Master gate — unlocks all feature gates
  const flexible = !!features.quickstart_flexible;

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    quickstart_enabled: merchantPrefs?.quickstart_enabled !== false,
    quickstart_wizard: merchantPrefs?.quickstart_wizard !== false,
    quickstart_image_gen: merchantPrefs?.quickstart_image_gen !== false,
    quickstart_category_generator: merchantPrefs?.quickstart_category_generator !== false,
    quickstart_wizard_ai: merchantPrefs?.quickstart_wizard_ai !== false,
    quickstart_ai_openai: merchantPrefs?.quickstart_ai_openai !== false,
    quickstart_ai_gemini: merchantPrefs?.quickstart_ai_gemini !== false,
    quickstart_image_hd: merchantPrefs?.quickstart_image_hd !== false,
    default_text_model: merchantPrefs?.default_text_model || 'openai',
    default_image_model: merchantPrefs?.default_image_model || 'openai',
    default_image_quality: merchantPrefs?.default_image_quality || 'standard',
  };

  // --- Product feature gate ---
  // Gates: wizard (static product wizard), image_gen (attach image to product)
  const productGroupEnabled = !!features.quickstart_product_enabled;
  const productGroupDisabled = !!features.quickstart_product_disabled;
  const productEnabled = productGroupEnabled && !productGroupDisabled;
  const productUntouched = !productGroupEnabled && !productGroupDisabled;

  const allowedProductTypes: QuickstartProductType[] = [];
  if (flexible || productEnabled) {
    allowedProductTypes.push('wizard', 'image_gen');
  } else if (productUntouched) {
    if (features.quickstart_wizard) allowedProductTypes.push('wizard');
    if (features.quickstart_image_gen) allowedProductTypes.push('image_gen');
  }

  // --- Category feature gate ---
  // Gates: category_generator
  const categoryGroupEnabled = !!features.quickstart_category_enabled;
  const categoryGroupDisabled = !!features.quickstart_category_disabled;
  const categoryEnabled = categoryGroupEnabled && !categoryGroupDisabled;
  const categoryUntouched = !categoryGroupEnabled && !categoryGroupDisabled;

  const allowedCategoryTypes: QuickstartCategoryType[] = [];
  if (flexible || categoryEnabled) {
    allowedCategoryTypes.push('category_generator');
  } else if (categoryUntouched) {
    if (features.quickstart_category_generator) allowedCategoryTypes.push('category_generator');
  }

  // --- AI feature gate ---
  // Gates: ai_openai, ai_gemini, wizard_ai (AI wizard), image_hd (HD quality)
  const aiGroupEnabled = !!features.quickstart_ai_enabled;
  const aiGroupDisabled = !!features.quickstart_ai_disabled;
  const aiGroupOn = aiGroupEnabled && !aiGroupDisabled;
  const aiUntouched = !aiGroupEnabled && !aiGroupDisabled;

  const allowedAITypes: QuickstartAIType[] = [];
  if (flexible || aiGroupOn) {
    allowedAITypes.push('ai_openai', 'ai_gemini', 'wizard_ai', 'image_hd');
  } else if (aiUntouched) {
    if (features.quickstart_ai_openai) allowedAITypes.push('ai_openai');
    if (features.quickstart_ai_gemini) allowedAITypes.push('ai_gemini');
    if (features.quickstart_wizard_ai) allowedAITypes.push('wizard_ai');
    if (features.quickstart_image_hd) allowedAITypes.push('image_hd');
  }

  // aiEnabled = group flag OR any individual AI type allowed
  const aiEnabled = (aiGroupOn || allowedAITypes.length > 0) && !aiGroupDisabled;

  // --- Cross-group dependencies ---
  // wizard_ai (AI group) requires product feature gate — it generates products
  const hasAIModel = allowedAITypes.includes('ai_openai') || allowedAITypes.includes('ai_gemini');
  const effectivelyCanUseAIWizard = allowedAITypes.includes('wizard_ai') && productEnabled && hasAIModel;
  // image_hd (AI group) requires image_gen from product group — HD only if images are attached
  const effectivelyCanUseHDImages = allowedAITypes.includes('image_hd') && allowedProductTypes.includes('image_gen');

  // --- Effective flags = main gate AND tier allows AND merchant enabled AND master switch ---
  const masterOn = prefs.quickstart_enabled;
  const effectiveCanUseWizard = masterOn && allowedProductTypes.includes('wizard') && prefs.quickstart_wizard;
  const effectiveCanGenerateImages = masterOn && allowedProductTypes.includes('image_gen') && prefs.quickstart_image_gen;
  const effectiveCanUseAIWizard = masterOn && effectivelyCanUseAIWizard && prefs.quickstart_wizard_ai;
  const effectiveCanUseCategoryGenerator = masterOn && allowedCategoryTypes.includes('category_generator') && prefs.quickstart_category_generator;
  const effectiveCanUseOpenAI = masterOn && allowedAITypes.includes('ai_openai') && prefs.quickstart_ai_openai;
  const effectiveCanUseGemini = masterOn && allowedAITypes.includes('ai_gemini') && prefs.quickstart_ai_gemini;
  const effectiveCanUseHDImages = masterOn && effectivelyCanUseHDImages && prefs.quickstart_image_hd;

  return {
    enabled: enabled && !disabled,
    isFlexible: flexible,
    productEnabled,
    allowedProductTypes,
    categoryEnabled,
    allowedCategoryTypes,
    aiEnabled,
    allowedAITypes,
    canUseWizard: enabled && !disabled && effectiveCanUseWizard,
    canUseAIWizard: enabled && !disabled && effectiveCanUseAIWizard,
    canUseCategoryGenerator: enabled && !disabled && effectiveCanUseCategoryGenerator,
    canGenerateImages: enabled && !disabled && effectiveCanGenerateImages,
    canUseOpenAI: enabled && !disabled && effectiveCanUseOpenAI,
    canUseGemini: enabled && !disabled && effectiveCanUseGemini,
    canUseHDImages: enabled && !disabled && effectiveCanUseHDImages,
    merchantPreferences: prefs,
    features,
  };
}

/**
 * Resolve storefront options state from raw capability features + merchant preferences
 * Feature prefix: storefront_opt_ (distinct from storefront_ for storefront_types)
 */
export function resolveStorefrontOptionsState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    storefront_opt_enabled?: boolean;
    hours_display?: boolean;
    hours_animated?: boolean;
    hours_status?: boolean;
    map_display?: boolean;
    location_display?: boolean;
    category_store?: boolean;
    category_product?: boolean;
    recommend_store?: boolean;
    recommend_products?: boolean;
    recently_viewed?: boolean;
    storefront_social_media?: boolean;
    storefront_contact?: boolean;
    interactive_maps?: boolean;
    qr_codes_512?: boolean;
    qr_codes_1024?: boolean;
    qr_codes_2048?: boolean;
    qr_product?: boolean;
    qr_store?: boolean;
    qr_logo?: boolean;
    qr_directory?: boolean;
    image_gallery_5?: boolean;
    image_gallery_10?: boolean;
    image_gallery_15?: boolean;
    enhanced_seo?: boolean;
    storefront_actions?: boolean;
    default_qr_resolution?: string;
    default_gallery_limit?: number;
  } | null
): StorefrontOptionsState {
  // Main gate (hard)
  const enabled = !!features.storefront_opt_enabled;
  const disabled = !!features.storefront_opt_disabled;
  // Master gate — unlocks all feature gates
  const flexible = !!features.storefront_opt_flexible;

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    storefront_opt_enabled: merchantPrefs?.storefront_opt_enabled !== false,
    hours_display: merchantPrefs?.hours_display !== false,
    hours_animated: merchantPrefs?.hours_animated !== false,
    hours_status: merchantPrefs?.hours_status !== false,
    map_display: merchantPrefs?.map_display !== false,
    location_display: merchantPrefs?.location_display !== false,
    category_store: merchantPrefs?.category_store !== false,
    category_product: merchantPrefs?.category_product !== false,
    recommend_store: merchantPrefs?.recommend_store !== false,
    recommend_products: merchantPrefs?.recommend_products !== false,
    recently_viewed: merchantPrefs?.recently_viewed !== false,
    storefront_social_media: merchantPrefs?.storefront_social_media !== false,
    storefront_contact: merchantPrefs?.storefront_contact !== false,
    interactive_maps: merchantPrefs?.interactive_maps !== false,
    qr_codes_512: merchantPrefs?.qr_codes_512 ?? false,
    qr_codes_1024: merchantPrefs?.qr_codes_1024 !== false,
    qr_codes_2048: merchantPrefs?.qr_codes_2048 ?? false,
    qr_product: merchantPrefs?.qr_product !== false,
    qr_store: merchantPrefs?.qr_store !== false,
    qr_logo: merchantPrefs?.qr_logo ?? false,
    qr_directory: merchantPrefs?.qr_directory ?? false,
    image_gallery_5: merchantPrefs?.image_gallery_5 !== false,
    image_gallery_10: merchantPrefs?.image_gallery_10 ?? false,
    image_gallery_15: merchantPrefs?.image_gallery_15 ?? false,
    enhanced_seo: merchantPrefs?.enhanced_seo ?? false,
    storefront_actions: merchantPrefs?.storefront_actions ?? false,
    default_qr_resolution: merchantPrefs?.default_qr_resolution || '1024',
    default_gallery_limit: merchantPrefs?.default_gallery_limit || 5,
  };

  // --- Store Hours feature gate ---
  const hoursGroupEnabled = !!features.storefront_opt_hours_enabled;
  const hoursGroupDisabled = !!features.storefront_opt_hours_disabled;
  const hoursEnabled = hoursGroupEnabled && !hoursGroupDisabled;
  const hoursUntouched = !hoursGroupEnabled && !hoursGroupDisabled;

  const allowedHoursTypes: StorefrontOptHoursType[] = [];
  if (flexible || hoursEnabled) {
    allowedHoursTypes.push('hours_animated', 'hours_status');
  } else if (hoursUntouched) {
    if (features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
    if (features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
  }

  // --- Category Display feature gate ---
  const categoryGroupEnabled = !!features.storefront_opt_category_enabled;
  const categoryGroupDisabled = !!features.storefront_opt_category_disabled;
  const categoryEnabled = categoryGroupEnabled && !categoryGroupDisabled;
  const categoryUntouched = !categoryGroupEnabled && !categoryGroupDisabled;

  const allowedCategoryTypes: StorefrontOptCategoryType[] = [];
  if (flexible || categoryEnabled) {
    allowedCategoryTypes.push('category_store', 'category_product');
  } else if (categoryUntouched) {
    if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
    if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
  }

  // --- Recommendation Display feature gate ---
  const recommendGroupEnabled = !!features.storefront_opt_recommend_enabled;
  const recommendGroupDisabled = !!features.storefront_opt_recommend_disabled;
  const recommendEnabled = recommendGroupEnabled && !recommendGroupDisabled;
  const recommendUntouched = !recommendGroupEnabled && !recommendGroupDisabled;

  const allowedRecommendTypes: StorefrontOptRecommendType[] = [];
  if (flexible || recommendEnabled) {
    allowedRecommendTypes.push('recommend_store', 'recommend_products');
  } else if (recommendUntouched) {
    if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
    if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
  }

  // --- Section Display (standalone, no group gate) ---
  const hoursDisplayTierAllowed = flexible || !!features.storefront_opt_hours_display;
  const mapDisplayTierAllowed = flexible || !!features.storefront_opt_map_display;
  const locationDisplayTierAllowed = flexible || !!features.storefront_opt_location_display;

  // --- User Behavior (standalone, no group gate) ---
  const recentlyViewedTierAllowed = flexible || !!features.storefront_opt_recently_viewed;

  // --- Store Information feature gate ---
  const infoGroupEnabled = !!features.storefront_opt_info_enabled;
  const infoGroupDisabled = !!features.storefront_opt_info_disabled;
  const infoEnabled = infoGroupEnabled && !infoGroupDisabled;
  const infoUntouched = !infoGroupEnabled && !infoGroupDisabled;

  const allowedInfoTypes: StorefrontOptInfoType[] = [];
  if (flexible || infoEnabled) {
    allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
  } else if (infoUntouched) {
    if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
    if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
    if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
  }

  // --- QR Code Display feature gate ---
  const qrGroupEnabled = !!features.storefront_opt_qr_enabled;
  const qrGroupDisabled = !!features.storefront_opt_qr_disabled;
  const qrEnabled = qrGroupEnabled && !qrGroupDisabled;
  const qrUntouched = !qrGroupEnabled && !qrGroupDisabled;

  const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
  const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
  if (flexible || qrEnabled) {
    allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
    allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
  } else if (qrUntouched) {
    if (features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
    if (features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
    if (features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
    if (features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
    if (features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
    if (features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
    if (features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
  }

  // --- Gallery Display feature gate (radio — only one active at a time) ---
  const galleryGroupEnabled = !!features.storefront_opt_gallery_enabled;
  const galleryGroupDisabled = !!features.storefront_opt_gallery_disabled;
  const galleryEnabled = galleryGroupEnabled && !galleryGroupDisabled;
  const galleryUntouched = !galleryGroupEnabled && !galleryGroupDisabled;

  const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
  if (flexible || galleryEnabled) {
    allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
  } else if (galleryUntouched) {
    if (features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
    if (features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
    if (features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
  }

  // --- Advanced feature gate ---
  const advancedGroupEnabled = !!features.storefront_opt_advanced_enabled;
  const advancedGroupDisabled = !!features.storefront_opt_advanced_disabled;
  const advancedEnabled = advancedGroupEnabled && !advancedGroupDisabled;
  const advancedUntouched = !advancedGroupEnabled && !advancedGroupDisabled;

  const allowedAdvancedTypes: StorefrontOptAdvancedType[] = [];
  if (flexible || advancedEnabled) {
    allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
  } else if (advancedUntouched) {
    if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
    if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
  }

  const mainOn = enabled && !disabled;

  // Effective flags = main gate AND tier allows AND merchant enabled
  const effectiveHoursTypes = prefs.storefront_opt_enabled
    ? allowedHoursTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveCategoryTypes = prefs.storefront_opt_enabled
    ? allowedCategoryTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveRecommendTypes = prefs.storefront_opt_enabled
    ? allowedRecommendTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveHoursDisplay = prefs.storefront_opt_enabled && hoursDisplayTierAllowed && prefs.hours_display;
  const effectiveMapDisplay = prefs.storefront_opt_enabled && mapDisplayTierAllowed && prefs.map_display;
  const effectiveLocationDisplay = prefs.storefront_opt_enabled && locationDisplayTierAllowed && prefs.location_display;
  const effectiveRecentlyViewed = prefs.storefront_opt_enabled && recentlyViewedTierAllowed && prefs.recently_viewed;
  const effectiveInfoTypes = prefs.storefront_opt_enabled
    ? allowedInfoTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveQRResolutions = prefs.storefront_opt_enabled
    ? allowedQRResolutions.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveQRContentTypes = prefs.storefront_opt_enabled
    ? allowedQRContentTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveGalleryTypes = prefs.storefront_opt_enabled
    ? allowedGalleryTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];
  const effectiveAdvancedTypes = prefs.storefront_opt_enabled
    ? allowedAdvancedTypes.filter(t => prefs[`${t}` as keyof typeof prefs] !== false)
    : [];

  return {
    enabled: mainOn,
    isFlexible: flexible,
    hoursEnabled: mainOn && (hoursEnabled || allowedHoursTypes.length > 0),
    allowedHoursTypes,
    categoryEnabled: mainOn && (categoryEnabled || allowedCategoryTypes.length > 0),
    allowedCategoryTypes,
    recommendEnabled: mainOn && (recommendEnabled || allowedRecommendTypes.length > 0),
    allowedRecommendTypes,
    recentlyViewedEnabled: mainOn && recentlyViewedTierAllowed,
    infoEnabled: mainOn && (infoEnabled || allowedInfoTypes.length > 0),
    allowedInfoTypes,
    qrEnabled: mainOn && (qrEnabled || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
    allowedQRResolutions,
    allowedQRContentTypes,
    galleryEnabled: mainOn && (galleryEnabled || allowedGalleryTypes.length > 0),
    allowedGalleryTypes,
    advancedEnabled: mainOn && (advancedEnabled || allowedAdvancedTypes.length > 0),
    allowedAdvancedTypes,
    canShowHoursDisplay: mainOn && effectiveHoursDisplay,
    canUseAnimatedHours: mainOn && effectiveHoursTypes.includes('hours_animated'),
    canShowHoursStatus: mainOn && effectiveHoursTypes.includes('hours_status'),
    canShowMapDisplay: mainOn && effectiveMapDisplay,
    canShowLocationDisplay: mainOn && effectiveLocationDisplay,
    canUseCategoryStore: mainOn && effectiveCategoryTypes.includes('category_store'),
    canUseCategoryProduct: mainOn && effectiveCategoryTypes.includes('category_product'),
    canUseRecommendStore: mainOn && effectiveRecommendTypes.includes('recommend_store'),
    canUseRecommendProducts: mainOn && effectiveRecommendTypes.includes('recommend_products'),
    canUseRecentlyViewed: mainOn && effectiveRecentlyViewed,
    canUseSocialMedia: mainOn && effectiveInfoTypes.includes('storefront_social_media'),
    canUseContact: mainOn && effectiveInfoTypes.includes('storefront_contact'),
    canUseInteractiveMaps: mainOn && effectiveInfoTypes.includes('interactive_maps'),
    canUseQRCodes: mainOn && (effectiveQRResolutions.length > 0 || effectiveQRContentTypes.length > 0),
    canUseEnhancedSEO: mainOn && effectiveAdvancedTypes.includes('enhanced_seo'),
    canUseStorefrontActions: mainOn && effectiveAdvancedTypes.includes('storefront_actions'),
    merchantPreferences: prefs,
    features,
  };
}

/**
 * Resolve storefront state from raw capability features
 */
export function resolveStorefrontState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    storefront_type_enabled?: boolean;
    selected_storefront_type?: string;
  } | null
): StorefrontState {
  // Master gates (explicit activation/deactivation)
  const masterActivate = !!features.storefront || !!features.storefront_enabled;
  const masterDeactivate = !!features.storefront_disabled;

  // Feature gates (implicit activation)
  const online = !!features.storefront_online;
  const retail = !!features.storefront_retail;
  const service = !!features.storefront_service;

  // Flexible gate
  const bothOptions = !!features.storefront_both_options;

  // Determine enabled state
  // 1. Deactivation master gate takes highest priority
  // 2. Activation master gates enable explicitly
  // 3. Feature/flexible gates enable implicitly when master gates are untouched
  const hasAnyFeatureGate = online || retail || service || bothOptions;
  const isEnabled = masterDeactivate
    ? false
    : masterActivate
      ? true
      : hasAnyFeatureGate;

  // Determine type from feature gates
  let type: StorefrontType = 'none';
  if (!isEnabled) {
    type = 'none';
  } else if (bothOptions || (online && retail) || (online && service) || (retail && service)) {
    type = 'both';
  } else if (online) {
    type = 'online';
  } else if (retail) {
    type = 'retail';
  } else if (service) {
    type = 'service';
  }

  // Compute allowed types from actual feature gates (not just type='both' → all)
  const allowedTypes: StorefrontType[] = [];
  if (isEnabled) {
    if (bothOptions) {
      // Flexible: all individual types allowed
      allowedTypes.push('online', 'retail', 'service');
    } else {
      if (online) allowedTypes.push('online');
      if (retail) allowedTypes.push('retail');
      if (service) allowedTypes.push('service');
    }
  }

  // Merchant preferences
  const prefs = {
    storefront_type_enabled: merchantPrefs?.storefront_type_enabled !== false,
    selected_storefront_type: (merchantPrefs?.selected_storefront_type as StorefrontType) || 'online',
  };

  // Compute effective type: if merchant selected a specific type and tier allows it, use it
  let effectiveType: StorefrontType = type;
  let hasMerchantSelection = false;

  if (type === 'both' && prefs.storefront_type_enabled) {
    const selected = prefs.selected_storefront_type;
    if (selected === 'online' && allowedTypes.includes('online')) {
      effectiveType = 'online';
      hasMerchantSelection = true;
    } else if (selected === 'retail' && allowedTypes.includes('retail')) {
      effectiveType = 'retail';
      hasMerchantSelection = true;
    } else if (selected === 'service' && allowedTypes.includes('service')) {
      effectiveType = 'service';
      hasMerchantSelection = true;
    }
  }

  return {
    enabled: isEnabled && prefs.storefront_type_enabled,
    type,
    effectiveType,
    isFlexible: bothOptions,
    allowedTypes,
    hasMerchantSelection,
    merchantPreferences: prefs,
    features,
  };
}

// ====================
// CUSTOMER-FACING SERVICE (CustomerApiSingleton)
// ====================

class CapabilityResolutionService extends CustomerApiSingleton {
  private static instance: CapabilityResolutionService;
  private capCache = new Map<string, { data: AllCapabilitiesState; expiry: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    super('capability-resolution-service', { ttl: 15 * 60 * 1000 });
  }

  static getInstance(): CapabilityResolutionService {
    if (!CapabilityResolutionService.instance) {
      CapabilityResolutionService.instance = new CapabilityResolutionService();
    }
    return CapabilityResolutionService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['tenant-capabilities'];
  }

  async invalidateServiceCaches(customerId?: string): Promise<void> {
    this.capCache.clear();
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /**
   * Fetch and resolve all capabilities for a tenant
   */
  async getAllCapabilities(tenantId: string): Promise<AllCapabilitiesState> {
    // Check in-memory cache
    const cached = this.capCache.get(tenantId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const response = await this.makeDefaultRequest<TenantCapabilitiesResponse>(
      `/api/tenants/${tenantId}/capabilities`,
      { method: 'GET' },
      `tenant-capabilities-${tenantId}`,
      this.CACHE_TTL,
      {
        context: AppContext.SHOP,
        isolation: CacheIsolation.SHOP,
      }
    );

    const data = response?.data || response;

    const result = this.resolveAll(tenantId, data as TenantCapabilitiesResponse);

    // Cache in memory
    this.capCache.set(tenantId, { data: result, expiry: Date.now() + this.CACHE_TTL });

    return result;
  }

  /**
   * Get commerce state for a tenant, merging tier capability with merchant preferences
   */
  async getCommerceState(tenantId: string): Promise<CommerceState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.commerce;

    try {
      const prefs = await publicCommerceSettingsService.getCommerceSettings(tenantId);
      if (prefs) {
        return resolveCommerceState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch commerce merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get payment gateway state for a tenant, merging tier capability with merchant preferences
   */
  async getPaymentGatewayState(tenantId: string): Promise<PaymentGatewayState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.paymentGateway;

    // Fetch merchant preferences and re-resolve with them
    try {

      const prefs = await publicPaymentGatewaySettingsService.getPaymentGatewaySettings(tenantId);
      if (prefs) {
        return resolvePaymentGatewayState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get storefront state for a tenant, merging tier capability with merchant preferences
   */
  async getStorefrontState(tenantId: string): Promise<StorefrontState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.storefront;

    try {

      const prefs = await publicStorefrontTypeService.getStorefrontTypeState(tenantId);
      if (prefs) {
        return resolveStorefrontState(tierState.features, prefs);
      }
    } catch (e) {
      console.warn('[CapabilityResolutionService] Failed to fetch storefront type settings, falling back to tier state:', e);
    }

    return tierState;
  }

  /**
   * Get barcode scan state for a tenant, merging tier capability with merchant preferences
   */
  async getBarcodeScanState(tenantId: string): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.barcodeScan;

    try {

      const prefs = await tenantInfoService.getBarcodeScanSettings(tenantId);
      if (prefs) {
        return resolveBarcodeScanState(tierState.features, prefs);
      }
    } catch (e) {
      console.warn('[CapabilityResolutionService] Failed to fetch barcode scan settings, falling back to tier state:', e);
    }

    return tierState;
  }

  /**
   * Get fulfillment state for a tenant, merging tier capability with merchant preferences
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.fulfillment;

    try {

      const prefs = await publicFulfillmentService.getFulfillmentSettings(tenantId);
      if (prefs) {
        return resolveFulfillmentState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch fulfillment merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get product options state for a tenant, merging tier capability with merchant preferences
   */
  async getProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.productOptions;

    try {

      const prefs = await tenantInfoService.getProductOptionsSettings(tenantId);
      if (prefs) {
        return resolveProductOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch product options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get featured options state for a tenant, merging tier capability with merchant preferences
   */
  async getFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.featuredOptions;

    try {

      const prefs = await publicFeaturedOptionsService.getFeaturedOptionsSettings(tenantId);
      if (prefs) {
        return resolveFeaturedOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch featured options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get integration options state for a tenant, merging tier capability with merchant preferences
   */
  async getIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.integrationOptions;

    try {

      const prefs = await tenantInfoService.getIntegrationOptionsSettings(tenantId);
      if (prefs) {
        return resolveIntegrationState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch integration options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get quickstart options state for a tenant, merging tier capability with merchant preferences
   */
  async getQuickstartOptionsState(tenantId: string): Promise<QuickstartOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.quickstartOptions;

    try {

      const prefs = await tenantInfoService.getQuickstartOptionsSettings(tenantId);
      if (prefs) {
        return resolveQuickstartOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch quickstart options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get storefront options state for a tenant, merging tier capability with merchant preferences
   */
  async getStorefrontOptionsState(tenantId: string): Promise<StorefrontOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.storefrontOptions;

    try {

      const prefs = await tenantInfoService.getStorefrontOptionsSettings(tenantId);
      if (prefs) {
        return resolveStorefrontOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch storefront options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Check a specific feature key against capability data.
   * If the feature belongs to a capability type, use the capability's features.
   * Returns null if the feature doesn't belong to any capability type (uncategorized).
   */
  async checkFeatureByCapability(tenantId: string, featureKey: string): Promise<boolean | null> {
    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) return null; // Not a capability-gated feature

    const all = await this.getAllCapabilities(tenantId);
    const capGroup = (all as any)[capType] as { features: Record<string, boolean> } | undefined;
    if (!capGroup) return false;

    return !!capGroup.features[featureKey];
  }

  /**
   * Resolve raw API response into typed state
   */
  private resolveAll(tenantId: string, data: TenantCapabilitiesResponse): AllCapabilitiesState {
    const commerceFeatures = data.capabilities?.commerce_types?.features || {};
    const paymentFeatures = data.capabilities?.payment_gateway_options?.features || {};
    const storefrontFeatures = data.capabilities?.storefront_types?.features || {};
    const barcodeFeatures = data.capabilities?.barcode_scan_options?.features || {};
    const fulfillmentFeatures = data.capabilities?.fulfillment_options?.features || {};
    const productOptionsFeatures = data.capabilities?.product_options?.features || {};
    const featuredOptionsFeatures = data.capabilities?.featured_options?.features || {};
    const integrationOptionsFeatures = data.capabilities?.integration_options?.features || {};
    const quickstartOptionsFeatures = data.capabilities?.quickstart_options?.features || {};
    const storefrontOptionsFeatures = data.capabilities?.storefront_options?.features || {};

    return {
      tierKey: data.tier_key,
      tierName: data.tier_name || data.tier_key,
      tierDescription: data.tier_description || '',
      commerce: resolveCommerceState(commerceFeatures),
      paymentGateway: resolvePaymentGatewayState(paymentFeatures),
      storefront: resolveStorefrontState(storefrontFeatures),
      barcodeScan: resolveBarcodeScanState(barcodeFeatures),
      fulfillment: resolveFulfillmentState(fulfillmentFeatures),
      productOptions: resolveProductOptionsState(productOptionsFeatures),
      featuredOptions: resolveFeaturedOptionsState(featuredOptionsFeatures),
      integrationOptions: resolveIntegrationState(integrationOptionsFeatures),
      quickstartOptions: resolveQuickstartOptionsState(quickstartOptionsFeatures),
      storefrontOptions: resolveStorefrontOptionsState(storefrontOptionsFeatures),
      uncategorizedFeatures: data.uncategorized_features || [],
    };
  }
}

// ====================
// TENANT-FACING SERVICE (TenantApiSingleton)
// ====================

class TenantCapabilityResolutionService extends TenantApiSingleton {
  private static instance: TenantCapabilityResolutionService;
  private capCache = new Map<string, { data: AllCapabilitiesState; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes (shorter for dashboard)

  private constructor() {
    super('tenant-capability-resolution-service', { ttl: 5 * 60 * 1000 });
  }

  static getInstance(): TenantCapabilityResolutionService {
    if (!TenantCapabilityResolutionService.instance) {
      TenantCapabilityResolutionService.instance = new TenantCapabilityResolutionService();
    }
    return TenantCapabilityResolutionService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['tenant-capabilities-dashboard'];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.capCache.delete(tenantId);
    } else {
      this.capCache.clear();
    }
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /**
   * Fetch and resolve all capabilities for a tenant (tenant-authenticated)
   */
  async getAllCapabilities(tenantId: string): Promise<AllCapabilitiesState> {
    const cached = this.capCache.get(tenantId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    this.setCurrentTenant(tenantId);

    const response = await this.makeDefaultRequest<TenantCapabilitiesResponse>(
      `/api/tenants/${tenantId}/capabilities`,
      { method: 'GET' },
      `tenant-capabilities-dashboard-${tenantId}`,
      this.CACHE_TTL,
      {
        context: AppContext.TENANT,
        isolation: CacheIsolation.TENANT,
      }
    );

    const data = response?.data || response;

    const result = this.resolveAll(tenantId, data as TenantCapabilitiesResponse);
    this.capCache.set(tenantId, { data: result, expiry: Date.now() + this.CACHE_TTL });

    return result;
  }

  async getCommerceState(tenantId: string): Promise<CommerceState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.commerce;

    try {

      const prefs = await tenantInfoService.getCommerceSettings(tenantId);
      if (prefs) {
        return resolveCommerceState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch commerce merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  async getPaymentGatewayState(tenantId: string): Promise<PaymentGatewayState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.paymentGateway;

    // Fetch merchant preferences and re-resolve with them
    try {

      const prefs = await publicPaymentGatewaySettingsService.getPaymentGatewaySettings(tenantId);
      if (prefs) {
        return resolvePaymentGatewayState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[PublicPaymentGatewaySettingsService] Failed to fetch merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  async getStorefrontState(tenantId: string): Promise<StorefrontState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.storefront;

    try {

      const prefs = await publicStorefrontTypeService.getStorefrontTypeState(tenantId);
      if (prefs) {
        return resolveStorefrontState(tierState.features, prefs);
      }
    } catch (e) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch storefront type settings, falling back to tier state:', e);
    }

    return tierState;
  }

  /**
   * Get barcode scan state for a tenant, merging tier capability with merchant preferences
   */
  async getBarcodeScanState(tenantId: string): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.barcodeScan;

    try {

      const prefs = await tenantInfoService.getBarcodeScanSettings(tenantId);
      if (prefs) {
        return resolveBarcodeScanState(tierState.features, prefs);
      }
    } catch (e) {
      console.warn('[CapabilityResolutionService] Failed to fetch barcode scan settings, falling back to tier state:', e);
    }

    return tierState;
  }

  /**
   * Get fulfillment state for a tenant, merging tier capability with merchant preferences
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.fulfillment;

    try {

      const prefs = await publicFulfillmentService.getFulfillmentSettings(tenantId);
      if (prefs) {
        return resolveFulfillmentState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch fulfillment merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get product options state for a tenant, merging tier capability with merchant preferences
   */
  async getProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.productOptions;

    try {

      const prefs = await tenantInfoService.getProductOptionsSettings(tenantId);
      if (prefs) {
        return resolveProductOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch product options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get featured options state for a tenant, merging tier capability with merchant preferences
   */
  async getFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.featuredOptions;

    try {

      const prefs = await publicFeaturedOptionsService.getFeaturedOptionsSettings(tenantId);
      if (prefs) {
        return resolveFeaturedOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch featured options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get integration options state for a tenant, merging tier capability with merchant preferences
   */
  async getIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.integrationOptions;

    try {

      const prefs = await tenantInfoService.getIntegrationOptionsSettings(tenantId);
      if (prefs) {
        return resolveIntegrationState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch integration options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get quickstart options state for a tenant, merging tier capability with merchant preferences
   */
  async getQuickstartOptionsState(tenantId: string): Promise<QuickstartOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.quickstartOptions;

    try {

      const prefs = await tenantInfoService.getQuickstartOptionsSettings(tenantId);
      if (prefs) {
        return resolveQuickstartOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch quickstart options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get storefront options state for a tenant, merging tier capability with merchant preferences
   */
  async getStorefrontOptionsState(tenantId: string): Promise<StorefrontOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.storefrontOptions;

    try {

      const prefs = await tenantInfoService.getStorefrontOptionsSettings(tenantId);
      if (prefs) {
        return resolveStorefrontOptionsState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch storefront options merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Check a specific feature key against capability data.
   * If the feature belongs to a capability type, use the capability's features.
   * Returns null if the feature doesn't belong to any capability type (uncategorized).
   */
  async checkFeatureByCapability(tenantId: string, featureKey: string): Promise<boolean | null> {
    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) return null;

    const all = await this.getAllCapabilities(tenantId);
    const capGroup = (all as any)[capType] as { features: Record<string, boolean> } | undefined;
    if (!capGroup) return false;

    return !!capGroup.features[featureKey];
  }

  private resolveAll(tenantId: string, data: TenantCapabilitiesResponse): AllCapabilitiesState {
    const commerceFeatures = data.capabilities?.commerce_types?.features || {};
    const paymentFeatures = data.capabilities?.payment_gateway_options?.features || {};
    const storefrontFeatures = data.capabilities?.storefront_types?.features || {};
    const barcodeFeatures = data.capabilities?.barcode_scan_options?.features || {};
    const fulfillmentFeatures = data.capabilities?.fulfillment_options?.features || {};
    const productOptionsFeatures = data.capabilities?.product_options?.features || {};
    const featuredOptionsFeatures = data.capabilities?.featured_options?.features || {};
    const integrationOptionsFeatures = data.capabilities?.integration_options?.features || {};
    const quickstartOptionsFeatures = data.capabilities?.quickstart_options?.features || {};
    const storefrontOptionsFeatures = data.capabilities?.storefront_options?.features || {};

    return {
      tierKey: data.tier_key,
      tierName: data.tier_name || data.tier_key,
      tierDescription: data.tier_description || '',
      commerce: resolveCommerceState(commerceFeatures),
      paymentGateway: resolvePaymentGatewayState(paymentFeatures),
      storefront: resolveStorefrontState(storefrontFeatures),
      barcodeScan: resolveBarcodeScanState(barcodeFeatures),
      fulfillment: resolveFulfillmentState(fulfillmentFeatures),
      productOptions: resolveProductOptionsState(productOptionsFeatures),
      featuredOptions: resolveFeaturedOptionsState(featuredOptionsFeatures),
      integrationOptions: resolveIntegrationState(integrationOptionsFeatures),
      quickstartOptions: resolveQuickstartOptionsState(quickstartOptionsFeatures),
      storefrontOptions: resolveStorefrontOptionsState(storefrontOptionsFeatures),
      uncategorizedFeatures: data.uncategorized_features || [],
    };
  }
}

// ====================
// EXPORTS
// ====================

export { CapabilityResolutionService, TenantCapabilityResolutionService };
export default CapabilityResolutionService;
