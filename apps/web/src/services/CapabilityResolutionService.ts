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

export type StorefrontType = 'online' | 'retail' | 'both' | 'none';

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

// --- Combined ---

export interface AllCapabilitiesState {
  tierKey: string;
  commerce: CommerceState;
  paymentGateway: PaymentGatewayState;
  storefront: StorefrontState;
  barcodeScan: BarcodeScanState;
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
 * Resolve storefront state from raw capability features
 */
export function resolveStorefrontState(features: Record<string, boolean>): StorefrontState {
  const enabled = !!features.storefront_enabled;
  const online = !!features.storefront_online;
  const retail = !!features.storefront_retail;
  const bothOptions = !!features.storefront_both_options;

  let type: StorefrontType = 'none';
  if (!enabled && !online && !retail) {
    type = 'none';
  } else if (bothOptions || (online && retail)) {
    type = 'both';
  } else if (online) {
    type = 'online';
  } else if (retail) {
    type = 'retail';
  }

  const showsLocation = retail || bothOptions;
  const showsHours = retail || bothOptions || online;
  const showsMap = retail || bothOptions;

  return {
    enabled: enabled || online || retail,
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

    return {
      tierKey: data.tier_key,
      commerce: resolveCommerceState(commerceFeatures),
      paymentGateway: resolvePaymentGatewayState(paymentFeatures),
      storefront: resolveStorefrontState(storefrontFeatures),
      barcodeScan: resolveBarcodeScanState(barcodeFeatures),
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

    return {
      tierKey: data.tier_key,
      commerce: resolveCommerceState(commerceFeatures),
      paymentGateway: resolvePaymentGatewayState(paymentFeatures),
      storefront: resolveStorefrontState(storefrontFeatures),
      barcodeScan: resolveBarcodeScanState(barcodeFeatures),
      uncategorizedFeatures: data.uncategorized_features || [],
    };
  }
}

// ====================
// EXPORTS
// ====================

export { CapabilityResolutionService, TenantCapabilityResolutionService };
export default CapabilityResolutionService;
