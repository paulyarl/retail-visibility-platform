/**
 * Public Unified Capability Service
 *
 * Public-facing counterpart to UnifiedCapabilityService.
 * Extends PublicApiSingleton for unauthenticated public requests.
 *
 * FlexibleApiSingleton.makeDefaultRequest routes based on defaultRequestType
 * (PUBLIC from PublicApiSingleton), so this service just calls makeDefaultRequest
 * and the base class handles routing to /api/public/... with no auth cookies.
 *
 * All mapping functions are shared from UnifiedCapabilityService.ts.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';
import {
  AllCapabilitiesState,
  CommerceState,
  PaymentGatewayState,
  StorefrontState,
  BarcodeScanState,
  FulfillmentState,
  ProductTypeState,
  ProductOptionsState,
  FeaturedOptionsState,
  IntegrationOptionsState,
  QuickstartOptionsState,
  StorefrontOptionsState,
  StorefrontQrState,
  StorefrontGalleryState,
  StorefrontHoursState,
  StorefrontLayoutState,
  StorefrontMapsState,
  StorefrontOptionFlags,
  toStorefrontOptionFlags,
  DirectoryEntryOptionsState,
  FaqOptionsState,
  PublicFaqOptionsFlags,
  toPublicFaqOptionsFlags,
  CrmOptionsState,
  PublicCrmOptionsFlags,
  toPublicCrmOptionsFlags,
  SocialCommerceOptionsState,
  DirectoryPromotionState,
  WholesaleMatchingState,
  PlatformServicesState,
  FunnelState,
  ChatbotOptionsState,
  CouponOptionsState,
} from './CapabilityResolutionService';
import {
  BackendEffectiveCapabilities,
  mapAll,
} from './UnifiedCapabilityService';

class PublicUnifiedCapabilityService extends PublicApiSingleton {
  private static instance: PublicUnifiedCapabilityService;
  private capCache = new Map<string, { data: AllCapabilitiesState; expiry: number }>();
  private inFlight = new Map<string, Promise<BackendEffectiveCapabilities | null>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    super('public-unified-capability-service', { ttl: 15 * 60 * 1000 });
  }

  public static getInstance(): PublicUnifiedCapabilityService {
    if (!PublicUnifiedCapabilityService.instance) {
      PublicUnifiedCapabilityService.instance = new PublicUnifiedCapabilityService();
    }
    return PublicUnifiedCapabilityService.instance;
  }

  /** Invalidate cached capabilities for a single tenant */
  async invalidateTenantCapabilities(tenantId: string): Promise<void> {
    this.capCache.delete(tenantId);
    await this.invalidateCache(`public-unified-caps-${tenantId}`);
  }

  private async fetchEffective(tenantId: string): Promise<BackendEffectiveCapabilities | null> {
    const cacheKey = `public-unified-caps-${tenantId}`;

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const promise = (async (): Promise<BackendEffectiveCapabilities | null> => {
      try {
        const endpoint = `/api/public/tenants/${tenantId}/effective-capabilities`;
        const result = await this.makeDefaultRequest<{ success: boolean; data: BackendEffectiveCapabilities }>(
          endpoint,
          {},
          cacheKey,
          this.CACHE_TTL
        );
        if (!result.success) {
          clientLogger.error('[PublicUnifiedCapabilityService] Failed to fetch capabilities:', { detail: result.error });
          return null;
        }
        return result.data?.data || null;
      } catch (error) {
        clientLogger.error('[PublicUnifiedCapabilityService] Error fetching capabilities:', { detail: error });
        return null;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  async getAllCapabilities(tenantId: string): Promise<AllCapabilitiesState> {
    const cached = this.capCache.get(tenantId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const raw = await this.fetchEffective(tenantId);
    if (!raw) {
      throw new Error(`[PublicUnifiedCapabilityService] Unable to resolve capabilities for tenant: ${tenantId}`);
    }

    const mapped = mapAll(raw);
    this.capCache.set(tenantId, { data: mapped, expiry: Date.now() + this.CACHE_TTL });
    return mapped;
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

  async getBarcodeScanState(tenantId: string): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.barcodeScan;
  }

  async getFulfillmentState(tenantId: string): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.fulfillment;
  }

  async getProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.productOptions;
  }

  async getProductTypeState(tenantId: string): Promise<ProductTypeState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.productType;
  }

  async getProductOptionFlags(tenantId: string): Promise<ProductOptionsState> {
    return this.getProductOptionsState(tenantId);
  }

  async getFeaturedOptionsState(tenantId: string): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.featuredOptions;
  }

  async getIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.integrationOptions;
  }

  async getQuickstartOptionsState(tenantId: string): Promise<QuickstartOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.quickstartOptions;
  }

  async getStorefrontOptionsState(tenantId: string): Promise<StorefrontOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontOptions;
  }

  async getStorefrontQrState(tenantId: string): Promise<StorefrontQrState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontQr;
  }

  async getStorefrontGalleryState(tenantId: string): Promise<StorefrontGalleryState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontGallery;
  }

  async getStorefrontHoursState(tenantId: string): Promise<StorefrontHoursState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontHours;
  }

  async getStorefrontLayoutsState(tenantId: string): Promise<StorefrontLayoutState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontLayouts;
  }

  async getStorefrontMapsState(tenantId: string): Promise<StorefrontMapsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.storefrontMaps;
  }

  async getDirectoryEntryOptionsState(tenantId: string): Promise<DirectoryEntryOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.directoryEntryOptions;
  }

  async getStorefrontOptionFlags(tenantId: string): Promise<StorefrontOptionFlags> {
    const all = await this.getAllCapabilities(tenantId);
    const flags = toStorefrontOptionFlags(all.storefrontOptions);

    if (all.storefrontQr) {
      flags.showQRCodes = all.storefrontQr.canUseQRCodes;
      flags.showQRStyled = all.storefrontQr.qrStyledEnabled;
      flags.qrResolutions = all.storefrontQr.allowedQRResolutions as unknown as string[];
      flags.allowedQRDotStyles = all.storefrontQr.allowedQRDotStyles as unknown as string[];
      flags.allowedQRCornerStyles = all.storefrontQr.allowedQRCornerStyles as unknown as string[];
      flags.allowedQRCornerDotStyles = all.storefrontQr.allowedQRCornerDotStyles as unknown as string[];
      flags.qrCustomColors = all.storefrontQr.qrCustomColors;
      flags.qrGradients = all.storefrontQr.qrGradients;
      const qrPrefs = all.storefrontQr.merchantPreferences as any;
      flags.showQRProduct = qrPrefs?.qr_product ?? false;
      flags.showQRStore = qrPrefs?.qr_store ?? false;
      flags.showQRLogo = qrPrefs?.qr_logo ?? false;
      flags.showQRDirectory = qrPrefs?.qr_directory ?? false;
      flags.qrResolution = qrPrefs?.default_qr_resolution ?? '512';
      flags.qrDotType = qrPrefs?.qr_dot_type;
      flags.qrCornerType = qrPrefs?.qr_corner_type;
      flags.qrCornerDotType = qrPrefs?.qr_corner_dot_type;
      flags.qrCornerDotColor = qrPrefs?.qr_corner_dot_color;
      flags.qrLogoShape = qrPrefs?.qr_logo_shape;
      flags.qrDotColor = qrPrefs?.qr_dot_color;
      flags.qrCornerColor = qrPrefs?.qr_corner_color;
      flags.qrBgColor = qrPrefs?.qr_bg_color;
      flags.qrGradientEnabled = qrPrefs?.qr_gradient_enabled;
      flags.qrGradientStart = qrPrefs?.qr_gradient_start;
      flags.qrGradientEnd = qrPrefs?.qr_gradient_end;
    }

    if (all.storefrontGallery) {
      flags.galleryDisplayMode = all.storefrontGallery.galleryDisplayMode;
      flags.canUseMagazineGallery = all.storefrontGallery.canUseMagazineGallery;
      if (all.storefrontGallery.defaultGalleryLimit) {
        flags.galleryLimit = all.storefrontGallery.defaultGalleryLimit;
      }
    }

    if (all.storefrontHours) {
      flags.showHoursDisplay = all.storefrontHours.canShowHoursDisplay;
      flags.showAnimatedHours = all.storefrontHours.canUseAnimatedHours;
      flags.showHoursStatus = all.storefrontHours.canShowHoursStatus;
    }

    if (all.storefrontLayouts) {
      flags.storefrontLayout = all.storefrontLayouts.effectiveLayout;
    }

    if (all.storefrontMaps) {
      flags.showMapDisplay = all.storefrontMaps.canShowMapDisplay;
      flags.showLocationDisplay = all.storefrontMaps.canShowLocationDisplay;
      flags.showInteractiveMaps = all.storefrontMaps.canUseInteractiveMaps;
    }

    return flags;
  }

  async getFaqOptionsState(tenantId: string): Promise<FaqOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.faqOptions;
  }

  async getFaqOptionsFlags(tenantId: string): Promise<PublicFaqOptionsFlags> {
    const state = await this.getFaqOptionsState(tenantId);
    return toPublicFaqOptionsFlags(state);
  }

  async getCrmOptionsState(tenantId: string): Promise<CrmOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.crmOptions;
  }

  async getCrmOptionsFlags(tenantId: string): Promise<PublicCrmOptionsFlags> {
    const state = await this.getCrmOptionsState(tenantId);
    return toPublicCrmOptionsFlags(state);
  }

  async getChatbotOptionsState(tenantId: string): Promise<ChatbotOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.chatbotOptions;
  }

  async getSocialCommerceOptionsState(tenantId: string): Promise<SocialCommerceOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.socialCommerceOptions;
  }

  async getDirectoryPromotionState(tenantId: string): Promise<DirectoryPromotionState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.directoryPromotion;
  }

  async getPlatformServicesState(tenantId: string): Promise<PlatformServicesState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.platformServices;
  }

  async getFunnelState(tenantId: string): Promise<FunnelState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.funnel;
  }

  async getWholesaleMatchingState(tenantId: string): Promise<WholesaleMatchingState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.wholesaleMatching;
  }

  async getCouponOptionsState(tenantId: string): Promise<CouponOptionsState> {
    const all = await this.getAllCapabilities(tenantId);
    return all.couponOptions;
  }

  async getCouponSpotlightEnabled(tenantId: string): Promise<boolean> {
    const state = await this.getCouponOptionsState(tenantId);
    return !!state?.canUseSpotlight;
  }

  async checkFeatureByCapability(tenantId: string, featureKey: string): Promise<boolean | null> {
    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) return null;

    const all = await this.getAllCapabilities(tenantId);
    const capGroup = (all as any)[capType] as { features: Record<string, boolean> } | undefined;
    if (!capGroup) return false;

    return !!capGroup.features[featureKey];
  }
}

const CAPABILITY_FEATURE_PREFIXES: Record<string, string> = {
  commerce_: 'commerce',
  payment_gateway_: 'paymentGateway',
  storefront_: 'storefront',
  barcode_: 'barcodeScan',
  fulfillment_: 'fulfillment',
  product_: 'productOptions',
  featured_: 'featuredOptions',
  integration_: 'integrationOptions',
  quickstart_: 'quickstartOptions',
  storefront_opt_: 'storefrontOptions',
  directory_entry_: 'directoryEntryOptions',
  faq_: 'faqOptions',
  crm_: 'crmOptions',
  chatbot_: 'chatbotOptions',
  social_commerce_: 'socialCommerceOptions',
  directory_promotion_: 'directoryPromotion',
  wholesale_: 'wholesaleMatching',
  platform_service_: 'platformServices',
  platform_services_: 'platformServices',
  coupon_: 'couponOptions',
};

function getCapabilityTypeForFeature(featureKey: string): string | null {
  for (const [prefix, capType] of Object.entries(CAPABILITY_FEATURE_PREFIXES)) {
    if (featureKey.startsWith(prefix)) return capType;
  }
  return null;
}

export const publicUnifiedCapabilityService = PublicUnifiedCapabilityService.getInstance();
export default PublicUnifiedCapabilityService;
