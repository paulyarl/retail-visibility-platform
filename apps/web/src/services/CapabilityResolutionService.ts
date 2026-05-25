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
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Payment Gateway Options ---

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';

export interface PaymentGatewayState {
  enabled: boolean;
  allowedGateways: GatewayType[];
  isFlexible: boolean;
  /** Whether checkout is available (at least one gateway enabled) */
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
  showsPickup: boolean;
  showsDelivery: boolean;
  showsShipping: boolean;
  showsService: boolean;
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
  /** Individual tenant-controlled featured types allowed by tier */
  allowedTenantTypes: FeaturedType[];
  /** Individual platform-controlled featured types allowed by tier */
  allowedPlatformTypes: FeaturedType[];
  /** All allowed featured types (union of tenant + platform) */
  allowedTypes: FeaturedType[];
  /** Whether all featured options are available (flexible tier) */
  isFlexible: boolean;
  /** Whether at least one featured type is available */
  featuredAvailable: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Product Options ---

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';

export interface ProductOptionsState {
  enabled: boolean;
  /** Available product types based on capability features */
  allowedTypes: ProductType[];
  /** Whether variants are available during creation */
  showsVariants: boolean;
  /** Whether image gallery is available during creation */
  showsGallery: boolean;
  /** Whether video attachment is available during creation */
  showsVideo: boolean;
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
  /** Individual POS integration types allowed by tier */
  allowedPosTypes: IntegrationType[];
  /** Individual Google integration types allowed by tier */
  allowedGoogleTypes: IntegrationType[];
  /** All allowed integration types (union of pos + google + org) */
  allowedTypes: IntegrationType[];
  /** Whether all integration options are available (flexible tier) */
  isFlexible: boolean;
  /** Whether at least one integration type is available */
  integrationsAvailable: boolean;
  /** Raw feature map from backend */
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
export function resolveCommerceState(features: Record<string, boolean>): CommerceState {
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

  return {
    enabled: enabled && !disabled,
    cartVisible,
    paymentType,
    isFlexible: bothOptions,
    features,
  };
}

/**
 * Resolve payment gateway state from raw capability features
 */
export function resolvePaymentGatewayState(features: Record<string, boolean>): PaymentGatewayState {
  const enabled = !!features.payment_gateway_enabled;
  const flexible = !!features.payment_gateway_flexible;

  const allowedGateways: GatewayType[] = [];
  if (features.payment_gateway_stripe) allowedGateways.push('stripe');
  if (features.payment_gateway_paypal) allowedGateways.push('paypal');
  if (features.payment_gateway_square) allowedGateways.push('square');
  if (features.payment_gateway_clover) allowedGateways.push('clover');

  return {
    enabled,
    allowedGateways,
    isFlexible: flexible,
    checkoutAvailable: enabled && allowedGateways.length > 0,
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
export function resolveFulfillmentState(features: Record<string, boolean>): FulfillmentState {
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

  return {
    enabled: enabled && !disabled,
    showsPickup,
    showsDelivery,
    showsShipping,
    showsService,
    isFlexible: flexible,
    features,
  };
}

/**
 * Resolve product options state from raw capability features
 */
export function resolveProductOptionsState(features: Record<string, boolean>): ProductOptionsState {
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

  return {
    enabled: enabled && !disabled,
    allowedTypes,
    showsVariants: flexible || variant,
    showsGallery: flexible || gallery,
    showsVideo: flexible || video,
    isFlexible: flexible,
    features,
  };
}

/**
 * Resolve featured options state from raw capability features
 */
export function resolveFeaturedOptionsState(features: Record<string, boolean>): FeaturedOptionsState {
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

  return {
    enabled: enabled && !disabled,
    tenantEnabled,
    platformEnabled,
    allowedTenantTypes,
    allowedPlatformTypes,
    allowedTypes: allTypes,
    isFlexible: flexible,
    featuredAvailable: enabled && !disabled && allTypes.length > 0,
    features,
  };
}

/**
 * Resolve integration options state from raw capability features
 */
export function resolveIntegrationState(features: Record<string, boolean>): IntegrationOptionsState {
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

  return {
    enabled: enabled && !disabled,
    posEnabled,
    googleEnabled,
    allowedPosTypes,
    allowedGoogleTypes,
    allowedTypes: allTypes,
    isFlexible: flexible,
    integrationsAvailable: enabled && !disabled && allTypes.length > 0,
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
   * Get commerce state for a tenant
   */
  async getCommerceState(tenantId: string): Promise<CommerceState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.commerce;
  }

  /**
   * Get payment gateway state for a tenant
   */
  async getPaymentGatewayState(tenantId: string): Promise<PaymentGatewayState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.paymentGateway;
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
   * Get fulfillment state for a tenant
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.fulfillment;
  }

  /**
   * Get product options state for a tenant
   */
  async getProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.productOptions;
  }

  /**
   * Get featured options state for a tenant
   */
  async getFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.featuredOptions;
  }

  /**
   * Get integration options state for a tenant
   */
  async getIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.integrationOptions;
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
    return all.commerce;
  }

  async getPaymentGatewayState(tenantId: string): Promise<PaymentGatewayState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.paymentGateway;
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
   * Get fulfillment state for a tenant
   */
  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.fulfillment;
  }

  /**
   * Get product options state for a tenant
   */
  async getProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.productOptions;
  }

  /**
   * Get featured options state for a tenant
   */
  async getFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.featuredOptions;
  }

  /**
   * Get integration options state for a tenant
   */
  async getIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.integrationOptions;
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
      uncategorizedFeatures: data.uncategorized_features || [],
    };
  }
}

// ====================
// EXPORTS
// ====================

export { CapabilityResolutionService, TenantCapabilityResolutionService };
export default CapabilityResolutionService;
