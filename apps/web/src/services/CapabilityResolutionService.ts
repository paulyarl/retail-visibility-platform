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
  type: StorefrontType;
  showsLocation: boolean;
  showsHours: boolean;
  showsMap: boolean;
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Barcode Scan Options ---

export type BarcodeScanMode = 'scan' | 'manual' | 'usb' | 'camera' | 'none';

export interface BarcodeScanState {
  enabled: boolean;
  /** Available scan modes based on capability features */
  allowedModes: BarcodeScanMode[];
  /** Whether barcode scanning is flexible (all modes available) */
  isFlexible: boolean;
  /** Whether at least one scan mode is available */
  scanAvailable: boolean;
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
export function resolveBarcodeScanState(features: Record<string, boolean>): BarcodeScanState {
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

  return {
    enabled: enabled && !disabled,
    allowedModes: disabled ? [] : uniqueModes,
    isFlexible: flexible,
    scanAvailable: enabled && !disabled && uniqueModes.length > 0,
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
 * Resolve storefront state from raw capability features
 */
export function resolveStorefrontState(features: Record<string, boolean>): StorefrontState {
  const enabled = !!features.storefront_enabled;
  const online = !!features.storefront_online;
  const retail = !!features.storefront_retail;
  const service = !!features.storefront_service;
  const bothOptions = !!features.storefront_both_options;

  let type: StorefrontType = 'none';
  if (!enabled && !online && !retail && !service) {
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

  const showsLocation = retail || bothOptions;
  const showsHours = retail || bothOptions || online || service;
  const showsMap = retail || bothOptions;

  return {
    enabled: enabled || online || retail || service,
    type,
    showsLocation,
    showsHours,
    showsMap,
    isFlexible: bothOptions,
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
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getCommerceSettings(tenantId);
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
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getPaymentGatewaySettings(tenantId);
      if (prefs) {
        return resolvePaymentGatewayState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[CapabilityResolutionService] Failed to fetch merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  /**
   * Get storefront state for a tenant
   */
  async getStorefrontState(tenantId: string): Promise<StorefrontState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefront;
  }

  /**
   * Get barcode scan state for a tenant
   */
  async getBarcodeScanState(tenantId: string): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.barcodeScan;
  }

  /**
   * Get fulfillment state for a tenant, merging tier capability with merchant preferences
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.fulfillment;

    try {
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getFulfillmentSettings(tenantId);
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getFeaturedOptionsSettings(tenantId);
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getPaymentGatewaySettings(tenantId);
      if (prefs) {
        return resolvePaymentGatewayState(tierState.features, prefs);
      }
    } catch (err) {
      console.warn('[TenantCapabilityResolutionService] Failed to fetch merchant preferences, using tier-only state:', err);
    }

    return tierState;
  }

  async getStorefrontState(tenantId: string): Promise<StorefrontState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefront;
  }

  /**
   * Get barcode scan state for a tenant
   */
  async getBarcodeScanState(tenantId: string): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.barcodeScan;
  }

  /**
   * Get fulfillment state for a tenant, merging tier capability with merchant preferences
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    const tierState = all.fulfillment;

    try {
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getFulfillmentSettings(tenantId);
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
      const prefs = await tenantInfoService.getFeaturedOptionsSettings(tenantId);
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      const { tenantInfoService } = await import('./TenantInfoService');
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
      uncategorizedFeatures: data.uncategorized_features || [],
    };
  }
}

// ====================
// EXPORTS
// ====================

export { CapabilityResolutionService, TenantCapabilityResolutionService };
export default CapabilityResolutionService;
