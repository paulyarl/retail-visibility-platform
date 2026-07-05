/**
 * Capability Resolution Functions & Types
 *
 * Pure resolution logic that converts raw capability feature maps
 * into typed domain-specific state objects.
 *
 * Previously included CapabilityResolutionService and TenantCapabilityResolutionService
 * classes — both removed in favor of UnifiedCapabilityService.
 */


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

export interface CheckoutModeConfig {
  mode: 'deposit_only' | 'full_payment_only' | 'flexible' | 'disabled';
  deposit_percentage?: number;
  deposit_min_cents?: number;
  deposit_max_cents?: number;
}

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
  /** Resolved checkout mode with deposit configuration from backend */
  checkoutMode: CheckoutModeConfig;
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

export type StorefrontType = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

export interface StorefrontState {
  enabled: boolean;
  /** Type determined by tier features (online/retail/service/social/flexible/none) */
  type: StorefrontType;
  /** Type effectively used after applying merchant preferences */
  effectiveType: StorefrontType;
  isFlexible: boolean;
  /** Which individual storefront types are allowed by the tier (e.g. ['retail','service'] when type='flexible') */
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
  /** Delivery configuration from merchant settings */
  deliveryRadiusMiles: number | null;
  deliveryFeeCents: number;
  deliveryMinFreeCents: number | null;
  deliveryTimeHours: number;
  /** Shipping configuration from merchant settings */
  shippingFlatRateCents: number | null;
  shippingMinFreeCents: number | null;
  shippingHandlingDays: number;
  /** Pickup configuration from merchant settings */
  pickupReadyTimeMinutes: number;
  pickupInstructions: string | null;
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
    featured_expiry_monitor: boolean;
  };
  /** Whether all featured options are available (flexible tier) */
  isFlexible: boolean;
  /** Whether at least one featured type is available (tier-only) */
  featuredAvailable: boolean;
  /** Whether at least one effective featured type is available */
  effectiveFeaturedAvailable: boolean;
  /** Whether the expiry monitor capability is enabled (tier-gated, professional+) */
  expiryMonitorEnabled: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

// --- Product Options ---

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';
export type ProductLayoutType = 'classic' | 'editorial' | 'immersive';

// --- Product Types ---

export interface ProductTypeState {
  enabled: boolean;
  /** Type determined by tier features (physical/digital/hybrid/service/flexible/none) */
  type: ProductType | 'flexible' | 'none';
  /** Type effectively used after applying merchant preferences (scalar, backward compat) */
  effectiveType: ProductType | 'flexible' | 'none';
  /** Types effectively available after applying merchant preferences (multi-select) */
  effectiveTypes: ProductType[];
  isFlexible: boolean;
  /** Which individual product types are allowed by the tier */
  allowedTypes: ProductType[];
  /** Whether the merchant has selected specific types when multiple are available */
  hasMerchantSelection: boolean;
  /** Merchant preference for product types */
  merchantPreferences: {
    product_types_enabled: boolean;
    selected_product_type: ProductType | 'none';
    selected_product_types: ProductType[];
  };
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

export interface ProductOptionsState {
  enabled: boolean;
  /** Available product types based on capability features (tier-allowed, hard gate) */
  allowedTypes: ProductType[];
  /** Product types effectively enabled after applying merchant preferences (tier allows AND merchant enabled) */
  effectiveTypes: ProductType[];
  /** Creation group enabled */
  creationEnabled: boolean;
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
  /** Product page layout group enabled */
  layoutEnabled: boolean;
  /** Available product page layouts based on capability features (tier-allowed, hard gate) */
  allowedLayouts: ProductLayoutType[];
  /** Product page layout effectively used after applying merchant preferences */
  effectiveLayout: ProductLayoutType;
  /** Whether classic product page layout is allowed */
  canUseLayoutClassic: boolean;
  /** Whether editorial product page layout is allowed */
  canUseLayoutEditorial: boolean;
  /** Whether immersive product page layout is allowed */
  canUseLayoutImmersive: boolean;
  /** Product page section gates */
  showsRecentlyViewed: boolean;
  showsQRCodes: boolean;
  showsQRLogo: boolean;
  showsRecommended: boolean;
  showsMapDisplay: boolean;
  showsLocationDisplay: boolean;
  showsHoursDisplay: boolean;
  showsEnhancedSEO: boolean;
  showsReviews: boolean;
  showsFulfillment: boolean;
  showsCategories: boolean;
  showsLocationAvailability: boolean;
  /** Sections group enabled */
  sectionsEnabled: boolean;
  /** Effective section gates after applying merchant preferences */
  effectiveShowsRecentlyViewed: boolean;
  effectiveShowsQRCodes: boolean;
  effectiveShowsQRLogo: boolean;
  effectiveShowsRecommended: boolean;
  effectiveShowsMapDisplay: boolean;
  effectiveShowsLocationDisplay: boolean;
  effectiveShowsHoursDisplay: boolean;
  effectiveShowsEnhancedSEO: boolean;
  effectiveShowsReviews: boolean;
  effectiveShowsFulfillment: boolean;
  effectiveShowsCategories: boolean;
  effectiveShowsLocationAvailability: boolean;
  /** Whether supplier catalog import is available during creation (tier-allowed) */
  showsSupplierCatalog: boolean;
  /** Whether supplier catalog import is effectively available after merchant preferences */
  effectiveShowsSupplierCatalog: boolean;
  /** Merchant preference toggles for product options */
  merchantPreferences: {
    product_physical_enabled: boolean;
    product_digital_enabled: boolean;
    product_hybrid_enabled: boolean;
    product_service_enabled: boolean;
    product_variant_enabled: boolean;
    product_gallery_enabled: boolean;
    product_video_enabled: boolean;
    product_layout: ProductLayoutType;
    product_opt_recently_viewed: boolean;
    product_opt_qr_codes: boolean;
    product_opt_recommended: boolean;
    product_opt_map_display: boolean;
    product_opt_location_display: boolean;
    product_opt_hours_display: boolean;
    product_opt_enhanced_seo: boolean;
    product_opt_reviews: boolean;
    product_opt_fulfillment: boolean;
    product_opt_categories: boolean;
    product_opt_location_availability: boolean;
    product_opt_supplier_catalog: boolean;
  };
  /** Whether all product options are available (flexible tier) */
  isFlexible: boolean;
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

/** Alias for backward compatibility with old PublicProductOptionsService */
export type ProductOptionFlags = ProductOptionsState;

// --- Directory Entry Options ---

export type DirectoryEntryLayoutKey = 'classic' | 'editorial' | 'immersive' | 'premium';

export interface DirectoryEntryOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  layoutEnabled: boolean;
  allowedLayouts: DirectoryEntryLayoutKey[];
  effectiveLayout: DirectoryEntryLayoutKey;
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  canUseLayoutPremium: boolean;
  // Section effective flags
  hoursEnabled: boolean;
  mapEnabled: boolean;
  contactEnabled: boolean;
  galleryEnabled: boolean;
  qrEnabled: boolean;
  socialEnabled: boolean;
  seoEnabled: boolean;
  // Tier-gated availability (for UI disable states)
  canShowHours: boolean;
  canShowMap: boolean;
  canShowContact: boolean;
  canShowGallery: boolean;
  canShowQr: boolean;
  canShowSocial: boolean;
  canShowSeo: boolean;
  merchantPreferences: {
    directory_entry_opt_enabled: boolean;
    directory_entry_layout: DirectoryEntryLayoutKey;
  };
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
export type StorefrontOptLayoutType = 'classic' | 'editorial' | 'immersive';

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
  // Layout group
  layoutEnabled: boolean;
  allowedLayouts: StorefrontOptLayoutType[];
  effectiveLayout: StorefrontOptLayoutType;
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
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
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
    storefront_layout: 'classic' | 'editorial' | 'immersive';
    default_qr_resolution: string;
    default_gallery_limit: number;
  };
  /** Raw feature map from backend */
  features: Record<string, boolean>;
}

/** Compatibility shape for old PublicStorefrontOptionsService consumers */
export interface StorefrontOptionFlags {
  showHoursDisplay: boolean;
  showAnimatedHours: boolean;
  showHoursStatus: boolean;
  showMapDisplay: boolean;
  showLocationDisplay: boolean;
  showCategoryStore: boolean;
  showCategoryProduct: boolean;
  showRecommendStore: boolean;
  showRecommendProducts: boolean;
  showRecentlyViewed: boolean;
  showSocialMedia: boolean;
  showContact: boolean;
  showInteractiveMaps: boolean;
  showQRCodes: boolean;
  showQRProduct: boolean;
  showQRStore: boolean;
  showQRLogo: boolean;
  showQRDirectory: boolean;
  qrResolution: string;
  qrResolutions: string[];
  galleryLimit: number;
  showEnhancedSEO: boolean;
  showStorefrontActions: boolean;
  storefrontLayout?: 'classic' | 'editorial' | 'immersive';
}

/** Convert unified StorefrontOptionsState → old StorefrontOptionFlags shape */
export function toStorefrontOptionFlags(state: StorefrontOptionsState): StorefrontOptionFlags {
  const p = state.merchantPreferences;
  return {
    showHoursDisplay: state.canShowHoursDisplay,
    showAnimatedHours: state.canUseAnimatedHours,
    showHoursStatus: state.canShowHoursStatus,
    showMapDisplay: state.canShowMapDisplay,
    showLocationDisplay: state.canShowLocationDisplay,
    showCategoryStore: state.canUseCategoryStore,
    showCategoryProduct: state.canUseCategoryProduct,
    showRecommendStore: state.canUseRecommendStore,
    showRecommendProducts: state.canUseRecommendProducts,
    showRecentlyViewed: state.canUseRecentlyViewed,
    showSocialMedia: state.canUseSocialMedia,
    showContact: state.canUseContact,
    showInteractiveMaps: state.canUseInteractiveMaps,
    showQRCodes: state.canUseQRCodes,
    showQRProduct: p?.qr_product ?? true,
    showQRStore: p?.qr_store ?? true,
    showQRLogo: p?.qr_logo ?? true,
    showQRDirectory: p?.qr_directory ?? true,
    qrResolution: p?.default_qr_resolution ?? '512',
    qrResolutions: state.allowedQRResolutions,
    galleryLimit: p?.default_gallery_limit ?? 5,
    showEnhancedSEO: state.canUseEnhancedSEO,
    showStorefrontActions: state.canUseStorefrontActions,
    storefrontLayout: p?.storefront_layout ?? 'classic',
  };
}

// --- FAQ Options ---

export type FaqManagementType =
  | 'faq_management_hub'
  | 'faq_management_templates'
  | 'faq_management_import'
  | 'faq_management_wizard_inline'
  | 'faq_management_bulk_actions'
  | 'faq_management_reorder'
  | 'faq_management_search';

export type FaqPreviewType =
  | 'faq_preview_bot'
  | 'faq_preview_gap_report'
  | 'faq_preview_auto_suggest';

export type FaqDisplayType =
  | 'faq_display_storefront_accordion'
  | 'faq_display_product_accordion'
  | 'faq_display_search_overlay'
  | 'faq_display_feedback'
  | 'faq_display_bot_handoff'
  | 'faq_display_markdown'
  | 'faq_display_deep_link';

export type FaqKnowledgeBaseType =
  | 'faq_kb_static_lookup'
  | 'faq_kb_rag_retrieval'
  | 'faq_kb_product_scoped'
  | 'faq_kb_auto_sync'
  | 'faq_kb_coverage_metrics';

export interface FaqOptionsState {
  enabled: boolean;
  storefrontEnabled: boolean;
  productEnabled: boolean;
  templatesEnabled: boolean;
  managementEnabled: boolean;
  previewEnabled: boolean;
  displayEnabled: boolean;
  kbEnabled: boolean;
  allowedManagementTypes: FaqManagementType[];
  allowedPreviewTypes: FaqPreviewType[];
  allowedDisplayTypes: FaqDisplayType[];
  allowedKbTypes: FaqKnowledgeBaseType[];
  isFlexible: boolean;
  faqAvailable: boolean;
  merchantPreferences: { faq_enabled?: boolean | null } | null;
  features: Record<string, boolean>;
}

/** Compatibility shape for old PublicFaqService consumers */
export interface PublicFaqOptionsFlags {
  faq_enabled: boolean;
  faq_display_storefront_accordion: boolean;
  faq_display_product_accordion: boolean;
  faq_display_feedback: boolean;
  faq_display_bot_handoff: boolean;
}

/** Convert unified FaqOptionsState → old PublicFaqOptionsFlags shape */
export function toPublicFaqOptionsFlags(state: FaqOptionsState): PublicFaqOptionsFlags {
  const display = state.allowedDisplayTypes || [];
  return {
    faq_enabled: state.enabled,
    faq_display_storefront_accordion: display.includes('faq_display_storefront_accordion'),
    faq_display_product_accordion: display.includes('faq_display_product_accordion'),
    faq_display_feedback: display.includes('faq_display_feedback'),
    faq_display_bot_handoff: display.includes('faq_display_bot_handoff'),
  };
}

// --- CRM Options ---

export type CrmInquiryType =
  | 'crm_inquiry_product_enabled'
  | 'crm_inquiry_storefront_enabled'
  | 'crm_inquiry_directory_enabled'
  | 'crm_inquiry_anonymous'
  | 'crm_inquiry_customer'
  | 'crm_inquiry_assignment'
  | 'crm_inquiry_auto_response';

export type CrmContactType = 'crm_contact_management' | 'crm_contact_import' | 'crm_contact_sync';
export type CrmTicketType = 'crm_ticket_priority' | 'crm_ticket_assignment' | 'crm_ticket_templates' | 'crm_ticket_escalation';
export type CrmMessageType = 'crm_message_rich_text' | 'crm_message_attachments' | 'crm_message_templates';
export type CrmCustomerTicketType = 'crm_customer_tickets';
export type CrmDashboardType = 'crm_dashboard_analytics' | 'crm_requests_hub';

export interface CrmOptionsState {
  enabled: boolean;
  inquiryProductEnabled: boolean;
  inquiryStorefrontEnabled: boolean;
  inquiryDirectoryEnabled: boolean;
  contactsEnabled: boolean;
  ticketFeaturesEnabled: boolean;
  messageFeaturesEnabled: boolean;
  customerTicketsEnabled: boolean;
  dashboardEnabled: boolean;
  allowedInquiryTypes: CrmInquiryType[];
  allowedContactTypes: CrmContactType[];
  allowedTicketTypes: CrmTicketType[];
  allowedMessageTypes: CrmMessageType[];
  allowedCustomerTicketTypes: CrmCustomerTicketType[];
  allowedDashboardTypes: CrmDashboardType[];
  isFlexible: boolean;
  crmAvailable: boolean;
  merchantPreferences: { crm_enabled?: boolean | null } | null;
  features: Record<string, boolean>;
}

/** Compatibility shape for old PublicCrmService consumers */
export interface PublicCrmOptionsFlags {
  crm_enabled: boolean;
  crm_inquiry_product_enabled: boolean;
  crm_inquiry_storefront_enabled: boolean;
  crm_inquiry_directory_enabled: boolean;
  crm_customer_tickets: boolean;
}

/** Convert unified CrmOptionsState → old PublicCrmOptionsFlags shape */
export function toPublicCrmOptionsFlags(state: CrmOptionsState): PublicCrmOptionsFlags {
  return {
    crm_enabled: state.enabled,
    crm_inquiry_product_enabled: state.inquiryProductEnabled,
    crm_inquiry_storefront_enabled: state.inquiryStorefrontEnabled,
    crm_inquiry_directory_enabled: state.inquiryDirectoryEnabled,
    crm_customer_tickets: state.customerTicketsEnabled,
  };
}

// --- Social Commerce Options ---

export type SocialCommerceMetaType =
  | 'social_commerce_meta_catalog' | 'social_commerce_meta_shop' | 'social_commerce_meta_pixel';

export type SocialCommerceTikTokType =
  | 'social_commerce_tiktok_catalog' | 'social_commerce_tiktok_shop' | 'social_commerce_tiktok_pixel';

export type SocialCommerceExperienceType =
  | 'social_commerce_share_buttons' | 'social_commerce_social_proof' | 'social_commerce_abandoned_cart';

export interface SocialCommerceOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  metaEnabled: boolean;
  allowedMetaTypes: SocialCommerceMetaType[];
  tiktokEnabled: boolean;
  allowedTikTokTypes: SocialCommerceTikTokType[];
  experienceEnabled: boolean;
  allowedExperienceTypes: SocialCommerceExperienceType[];
  canUseMetaCatalog: boolean;
  canUseMetaShop: boolean;
  canUseMetaPixel: boolean;
  canUseTikTokCatalog: boolean;
  canUseTikTokShop: boolean;
  canUseTikTokPixel: boolean;
  canUseShareButtons: boolean;
  canUseSocialProof: boolean;
  canUseAbandonedCart: boolean;
  socialCommerceAvailable: boolean;
  merchantPreferences: Record<string, boolean>;
  features: Record<string, boolean>;
}

// --- Directory Promotion ---

export type PromotionTierType = 'basic' | 'premium' | 'featured';

export interface DirectoryPromotionState {
  enabled: boolean;
  isFlexible: boolean;
  allowedTiers: PromotionTierType[];
}

// --- Chatbot Options ---

export type ChatbotResponseEngineType =
  | 'chatbot_static_lookup' | 'chatbot_shared_dynamic'
  | 'chatbot_lora_finetuned' | 'chatbot_dedicated';

export type ChatbotSkillType =
  | 'chatbot_skill_product_search' | 'chatbot_skill_inventory'
  | 'chatbot_skill_order_tracking' | 'chatbot_skill_store_hours'
  | 'chatbot_skill_cross_merchant'
  | 'chatbot_skill_crm_assistant'
  | 'chatbot_skill_policy_faq';

export type ChatbotKnowledgeBaseType =
  | 'chatbot_kb_static_faq' | 'chatbot_kb_rag_retrieval'
  | 'chatbot_kb_product_scoped' | 'chatbot_kb_gap_report'
  | 'chatbot_kb_auto_sync';

export type ChatbotWidgetType =
  | 'chatbot_widget_embed' | 'chatbot_widget_custom_theme'
  | 'chatbot_widget_skill_cards' | 'chatbot_widget_after_hours';

export interface ChatbotOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  staticEnabled: boolean;
  dynamicEnabled: boolean;
  skillsEnabled: boolean;
  kbEnabled: boolean;
  widgetEnabled: boolean;
  allowedResponseEngines: ChatbotResponseEngineType[];
  allowedSkillTypes: ChatbotSkillType[];
  allowedKbTypes: ChatbotKnowledgeBaseType[];
  allowedWidgetTypes: ChatbotWidgetType[];
  chatbotAvailable: boolean;
  canUseWidgetCustomTheme: boolean;
  canUseWidgetSkillCards: boolean;
  canUseWidgetAfterHours: boolean;
  merchantPreferences: {
    chatbot_enabled?: boolean | null;
    chatbot_static_enabled?: boolean | null;
    chatbot_dynamic_enabled?: boolean | null;
    chatbot_skills_enabled?: boolean | null;
    chatbot_kb_enabled?: boolean | null;
    chatbot_widget_enabled?: boolean | null;
    chatbot_widget_custom_theme?: boolean | null;
    chatbot_widget_skill_cards?: boolean | null;
    chatbot_widget_after_hours?: boolean | null;
  } | null;
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

export interface SubscriptionContextState {
  internalStatus: 'trialing' | 'active' | 'past_due' | 'maintenance' | 'frozen' | 'canceled' | 'expired';
  maintenanceState: 'maintenance' | 'freeze' | null;
  isReadOnly: boolean;
  isLimited: boolean;
  writable: boolean;
}

export type ConstraintType = 'requires' | 'recommends' | 'excludes' | 'implies';
export type ConstraintSeverity = 'block' | 'warn' | 'info';

export interface ConstraintViolationState {
  constraintId: string;
  type: ConstraintType;
  severity: ConstraintSeverity;
  sourceCapability: string;
  sourceType: string;
  targetCapability: string;
  targetType: string;
  message: string;
  resolutionHint: string;
}

export interface ConstraintStatusState {
  blockedTypes: string[];
  warningTypes: string[];
  activeViolations: string[];
}

export type ConstraintStatusMapState = Record<string, ConstraintStatusState>;

export interface AllCapabilitiesState {
  tierKey: string;
  tierName: string;
  tierDescription: string;
  subscriptionContext: SubscriptionContextState;
  commerce: CommerceState;
  paymentGateway: PaymentGatewayState;
  storefront: StorefrontState;
  barcodeScan: BarcodeScanState;
  fulfillment: FulfillmentState;
  productType: ProductTypeState;
  productOptions: ProductOptionsState;
  featuredOptions: FeaturedOptionsState;
  integrationOptions: IntegrationOptionsState;
  quickstartOptions: QuickstartOptionsState;
  storefrontOptions: StorefrontOptionsState;
  directoryEntryOptions: DirectoryEntryOptionsState;
  faqOptions: FaqOptionsState;
  crmOptions: CrmOptionsState;
  chatbotOptions: ChatbotOptionsState;
  socialCommerceOptions: SocialCommerceOptionsState;
  directoryPromotion: DirectoryPromotionState;
  constraintViolations: ConstraintViolationState[];
  constraintStatus: ConstraintStatusMapState;
  uncategorizedFeatures: string[];
  purchasedFeatureKeys: string[];
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
  product_types_: 'product_types',
  product_options_: 'product_options',
  product_: 'product_options',
  featured_: 'featured_options',
  integration_: 'integration_options',
  quickstart_: 'quickstart_options',
  storefront_opt_: 'storefront_options',
  directory_entry_: 'directory_entry_options',
  faq_: 'faq_options',
  crm_: 'crm_options',
  chatbot_: 'chatbot_options',
  social_commerce_: 'social_commerce_options',
  directory_promotion_: 'directory_promotion',
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

  // Build checkout mode (deposit config unavailable at pure resolution layer;
  // UnifiedCapabilityService.mapCommerce fills it from backend response)
  const checkoutMode: CheckoutModeConfig =
    effectivePaymentType === 'deposit'
      ? { mode: 'deposit_only' }
      : effectivePaymentType === 'full'
        ? { mode: 'full_payment_only' }
        : effectivePaymentType === 'both'
          ? { mode: 'flexible' }
          : { mode: 'disabled' };

  return {
    enabled: enabled && !disabled,
    cartVisible,
    paymentType,
    effectivePaymentType,
    effectiveCartVisible,
    merchantPreferences: prefs,
    checkoutMode,
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
    deliveryRadiusMiles: null,
    deliveryFeeCents: 0,
    deliveryMinFreeCents: null,
    deliveryTimeHours: 24,
    shippingFlatRateCents: null,
    shippingMinFreeCents: null,
    shippingHandlingDays: 1,
    pickupReadyTimeMinutes: 30,
    pickupInstructions: null,
    features,
  };
}

/**
 * Resolve product type state from raw capability features
 */
export function resolveProductTypeState(
  features: Record<string, boolean>,
  merchantPrefs?: {
    product_types_enabled?: boolean;
    selected_product_type?: string | null;
    selected_product_types?: string[] | null;
  } | null
): ProductTypeState {
  const masterActivate = !!features.product_types_enabled;
  const masterDeactivate = !!features.product_types_disabled;
  const flexible = !!features.product_types_flexible;
  const physical = !!features.product_types_physical;
  const digital = !!features.product_types_digital;
  const hybrid = !!features.product_types_hybrid;
  const service = !!features.product_types_service;

  const hasAnyFeatureGate = physical || digital || hybrid || service;

  // R17: disabled > enabled > flexible > features
  const isEnabled = masterDeactivate
    ? false
    : masterActivate
      ? true
      : hasAnyFeatureGate;

  // Determine type from feature gates
  let type: ProductType | 'flexible' | 'none' = 'none';
  if (!isEnabled) {
    type = 'none';
  } else if (flexible || (physical && digital) || (physical && hybrid) || (physical && service) || (digital && hybrid) || (digital && service) || (hybrid && service)) {
    type = 'flexible';
  } else if (physical) {
    type = 'physical';
  } else if (digital) {
    type = 'digital';
  } else if (hybrid) {
    type = 'hybrid';
  } else if (service) {
    type = 'service';
  }

  // Compute allowed types from actual feature gates
  const allowedTypes: ProductType[] = [];
  if (isEnabled) {
    if (flexible) {
      allowedTypes.push('physical', 'digital', 'hybrid', 'service');
    } else {
      if (physical) allowedTypes.push('physical');
      if (digital) allowedTypes.push('digital');
      if (hybrid) allowedTypes.push('hybrid');
      if (service) allowedTypes.push('service');
    }
  }

  // Merchant preferences
  const prefs = {
    product_types_enabled: merchantPrefs?.product_types_enabled !== false,
    selected_product_type: (merchantPrefs?.selected_product_type as ProductType | 'none') || 'none',
    selected_product_types: (merchantPrefs?.selected_product_types as ProductType[] | null) || [],
  };

  // Build merchant-selected types array (prefer new array field, fall back to scalar)
  let selectedTypes: ProductType[] = [];
  if (prefs.selected_product_types && prefs.selected_product_types.length > 0) {
    selectedTypes = prefs.selected_product_types.filter(t => allowedTypes.includes(t));
  } else if (prefs.selected_product_type !== 'none') {
    if (allowedTypes.includes(prefs.selected_product_type)) {
      selectedTypes = [prefs.selected_product_type];
    }
  }

  // Compute effective_types: intersection of tier-allowed and merchant-selected
  let effectiveTypes: ProductType[] = [];
  if (isEnabled && prefs.product_types_enabled) {
    if (selectedTypes.length > 0) {
      effectiveTypes = selectedTypes;
    } else if (type !== 'flexible' && type !== 'none') {
      effectiveTypes = [type as ProductType];
    } else if (type === 'flexible' && allowedTypes.length === 1) {
      effectiveTypes = [allowedTypes[0]];
    }
  }

  // Backward compat: effective_type as scalar
  let effectiveType: ProductType | 'flexible' | 'none' = type;
  let hasMerchantSelection = false;

  if (isEnabled && prefs.product_types_enabled) {
    if (effectiveTypes.length === 1) {
      effectiveType = effectiveTypes[0];
      hasMerchantSelection = true;
    } else if (effectiveTypes.length > 1) {
      effectiveType = 'flexible';
      hasMerchantSelection = true;
    } else if (effectiveTypes.length === 0 && type === 'flexible') {
      effectiveType = 'none';
    }
  } else if (!prefs.product_types_enabled) {
    effectiveType = 'none';
  }

  return {
    enabled: isEnabled,
    type,
    effectiveType,
    effectiveTypes,
    isFlexible: flexible,
    allowedTypes,
    hasMerchantSelection,
    merchantPreferences: prefs,
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
    product_layout?: ProductLayoutType;
    product_opt_recently_viewed?: boolean;
    product_opt_qr_codes?: boolean;
    product_opt_qr_logo?: boolean;
    product_opt_recommended?: boolean;
    product_opt_map_display?: boolean;
    product_opt_location_display?: boolean;
    product_opt_hours_display?: boolean;
    product_opt_enhanced_seo?: boolean;
    product_opt_reviews?: boolean;
    product_opt_fulfillment?: boolean;
    product_opt_categories?: boolean;
    product_opt_location_availability?: boolean;
    product_opt_supplier_catalog?: boolean;
  } | null
): ProductOptionsState {
  const enabled = !!features.product_options_enabled || !!features.product_enabled;
  const disabled = !!features.product_options_disabled || !!features.product_disabled;
  const flexible = !!features.product_options_flexible || !!features.product_flexible;
  // Legacy type fields kept for backward compat (types now resolved by resolveProductTypeState)
  const physical = !!features.product_options_physical || !!features.product_physical;
  const digital = !!features.product_options_digital || !!features.product_digital;
  const hybrid = !!features.product_options_hybrid || !!features.product_hybrid;
  const service = !!features.product_options_service || !!features.product_service;
  // Creation group gates
  const creationGroupEnabled = !!features.product_options_creation_enabled || flexible;
  const variant = !!features.product_options_variants || !!features.product_variant;
  const gallery = !!features.product_options_gallery || !!features.product_gallery;
  const video = !!features.product_options_video || !!features.product_video;

  // If flexible, all options are available regardless of individual flags
  const allowedTypes: ProductType[] = [];
  if (flexible || physical) allowedTypes.push('physical');
  if (flexible || digital) allowedTypes.push('digital');
  if (flexible || hybrid) allowedTypes.push('hybrid');
  if (flexible || service) allowedTypes.push('service');

  // Product page layout feature gates (canonical + legacy fallback)
  const layoutClassic = !!features.product_options_layout_classic || !!features.product_layout_classic;
  const layoutEditorial = !!features.product_options_layout_editorial || !!features.product_layout_editorial;
  const layoutImmersive = !!features.product_options_layout_immersive || !!features.product_layout_immersive;

  const allowedLayouts: ProductLayoutType[] = [];
  if (flexible || layoutClassic) allowedLayouts.push('classic');
  if (flexible || layoutEditorial) allowedLayouts.push('editorial');
  if (flexible || layoutImmersive) allowedLayouts.push('immersive');

  // Sections group gate
  const sectionsGroupEnabled = !!features.product_options_sections_enabled || flexible;

  // Product page section feature gates (canonical + legacy fallback)
  const showsRecentlyViewed = sectionsGroupEnabled && (flexible || !!features.product_options_recently_viewed || !!features.product_opt_recently_viewed);
  const showsQRCodes = sectionsGroupEnabled && (flexible || !!features.product_options_qr_codes || !!features.product_opt_qr_codes);
  const showsQRLogo = sectionsGroupEnabled && (flexible || !!features.product_options_qr_logo || !!features.product_opt_qr_logo);
  const showsRecommended = sectionsGroupEnabled && (flexible || !!features.product_options_recommended || !!features.product_opt_recommended);
  const showsMapDisplay = sectionsGroupEnabled && (flexible || !!features.product_options_map_display || !!features.product_opt_map_display);
  const showsLocationDisplay = sectionsGroupEnabled && (flexible || !!features.product_options_location_display || !!features.product_opt_location_display);
  const showsHoursDisplay = sectionsGroupEnabled && (flexible || !!features.product_options_hours_display || !!features.product_opt_hours_display);
  const showsEnhancedSEO = sectionsGroupEnabled && (flexible || !!features.product_options_enhanced_seo || !!features.product_opt_enhanced_seo);
  const showsReviews = sectionsGroupEnabled && (flexible || !!features.product_options_reviews || !!features.product_opt_reviews);
  const showsFulfillment = sectionsGroupEnabled && (flexible || !!features.product_options_fulfillment || !!features.product_opt_fulfillment);
  const showsCategories = sectionsGroupEnabled && (flexible || !!features.product_options_categories || !!features.product_opt_categories);
  const showsLocationAvailability = sectionsGroupEnabled && (flexible || !!features.product_options_location_availability || !!features.product_opt_location_availability);

  // Merchant preferences (soft toggle, defaults to true if not set)
  const prefs = {
    product_physical_enabled: merchantPrefs?.product_physical_enabled !== false,
    product_digital_enabled: merchantPrefs?.product_digital_enabled !== false,
    product_hybrid_enabled: merchantPrefs?.product_hybrid_enabled !== false,
    product_service_enabled: merchantPrefs?.product_service_enabled !== false,
    product_variant_enabled: merchantPrefs?.product_variant_enabled !== false,
    product_gallery_enabled: merchantPrefs?.product_gallery_enabled !== false,
    product_video_enabled: merchantPrefs?.product_video_enabled !== false,
    product_layout: merchantPrefs?.product_layout || 'classic',
    product_opt_recently_viewed: merchantPrefs?.product_opt_recently_viewed !== false,
    product_opt_qr_codes: merchantPrefs?.product_opt_qr_codes !== false,
    product_opt_qr_logo: merchantPrefs?.product_opt_qr_logo !== false,
    product_opt_recommended: merchantPrefs?.product_opt_recommended !== false,
    product_opt_map_display: merchantPrefs?.product_opt_map_display !== false,
    product_opt_location_display: merchantPrefs?.product_opt_location_display !== false,
    product_opt_hours_display: merchantPrefs?.product_opt_hours_display !== false,
    product_opt_enhanced_seo: merchantPrefs?.product_opt_enhanced_seo !== false,
    product_opt_reviews: merchantPrefs?.product_opt_reviews !== false,
    product_opt_fulfillment: merchantPrefs?.product_opt_fulfillment !== false,
    product_opt_categories: merchantPrefs?.product_opt_categories !== false,
    product_opt_location_availability: merchantPrefs?.product_opt_location_availability !== false,
    product_opt_supplier_catalog: merchantPrefs?.product_opt_supplier_catalog !== false,
  };

  // Effective types = tier allows AND merchant enabled
  const effectiveTypes = allowedTypes.filter(t => prefs[`product_${t}_enabled` as keyof typeof prefs]);

  // Effective variant/gallery/video = tier allows AND merchant enabled
  const effectiveShowsVariants = (flexible || variant) && prefs.product_variant_enabled;
  const effectiveShowsGallery = (flexible || gallery) && prefs.product_gallery_enabled;
  const effectiveShowsVideo = (flexible || video) && prefs.product_video_enabled;
  const showsSupplierCatalog = creationGroupEnabled && (flexible || !!features.product_options_creation_supplier_catalog);

  // Effective layout = tier allows AND merchant preference
  const effectiveLayout = allowedLayouts.includes(prefs.product_layout)
    ? prefs.product_layout
    : (allowedLayouts[0] || 'classic');

  // Effective product page section gates = tier allows AND merchant enabled
  const effectiveShowsRecentlyViewed = showsRecentlyViewed && prefs.product_opt_recently_viewed;
  const effectiveShowsQRCodes = showsQRCodes && prefs.product_opt_qr_codes;
  const effectiveShowsQRLogo = showsQRLogo && prefs.product_opt_qr_logo;
  const effectiveShowsRecommended = showsRecommended && prefs.product_opt_recommended;
  const effectiveShowsMapDisplay = showsMapDisplay && prefs.product_opt_map_display;
  const effectiveShowsLocationDisplay = showsLocationDisplay && prefs.product_opt_location_display;
  const effectiveShowsHoursDisplay = showsHoursDisplay && prefs.product_opt_hours_display;
  const effectiveShowsEnhancedSEO = showsEnhancedSEO && prefs.product_opt_enhanced_seo;
  const effectiveShowsReviews = showsReviews && prefs.product_opt_reviews;
  const effectiveShowsFulfillment = showsFulfillment && prefs.product_opt_fulfillment;
  const effectiveShowsCategories = showsCategories && prefs.product_opt_categories;
  const effectiveShowsLocationAvailability = showsLocationAvailability && prefs.product_opt_location_availability;

  return {
    enabled: enabled && !disabled,
    allowedTypes,
    effectiveTypes,
    creationEnabled: creationGroupEnabled,
    showsVariants: creationGroupEnabled && (flexible || variant),
    showsGallery: creationGroupEnabled && (flexible || gallery),
    showsVideo: creationGroupEnabled && (flexible || video),
    effectiveShowsVariants,
    effectiveShowsGallery,
    effectiveShowsVideo,
    layoutEnabled: allowedLayouts.length > 0,
    allowedLayouts,
    effectiveLayout,
    canUseLayoutClassic: flexible || layoutClassic,
    canUseLayoutEditorial: flexible || layoutEditorial,
    canUseLayoutImmersive: flexible || layoutImmersive,
    showsRecentlyViewed,
    showsQRCodes,
    showsQRLogo,
    showsRecommended,
    showsMapDisplay,
    showsLocationDisplay,
    showsHoursDisplay,
    showsEnhancedSEO,
    showsReviews,
    showsFulfillment,
    showsCategories,
    showsLocationAvailability,
    sectionsEnabled: sectionsGroupEnabled,
    effectiveShowsRecentlyViewed,
    effectiveShowsQRCodes,
    effectiveShowsQRLogo,
    effectiveShowsRecommended,
    effectiveShowsMapDisplay,
    effectiveShowsLocationDisplay,
    effectiveShowsHoursDisplay,
    effectiveShowsEnhancedSEO,
    effectiveShowsReviews,
    effectiveShowsFulfillment,
    effectiveShowsCategories,
    effectiveShowsLocationAvailability,
    showsSupplierCatalog,
    effectiveShowsSupplierCatalog: showsSupplierCatalog && prefs.product_opt_supplier_catalog,
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
    featured_expiry_monitor?: boolean;
  } | null
): FeaturedOptionsState {
  const enabled = !!features.featured_enabled;
  const disabled = !!features.featured_disabled;
  const flexible = !!features.featured_flexible;
  const tenantGroupEnabled = !!features.featured_tenant_enabled;
  const tenantGroupDisabled = !!features.featured_tenant_disabled;
  const platformGroupEnabled = !!features.featured_platform_enabled;
  const platformGroupDisabled = !!features.featured_platform_disabled;

  // Fail-open: when no tier config exists at all, allow all types.
  // This matches the SQL gate behavior in tier-capability-sql.ts.
  const hasAnyFeaturedConfig = Object.keys(features).some(k => k.startsWith('featured_'));

  // Three states per group: enabled → all types, untouched → individual features, disabled → none
  const tenantEnabled = tenantGroupEnabled && !tenantGroupDisabled;
  const tenantUntouched = !tenantGroupEnabled && !tenantGroupDisabled;
  const platformEnabled = platformGroupEnabled && !platformGroupDisabled;
  const platformUntouched = !platformGroupEnabled && !platformGroupDisabled;

  // Tenant-controlled types
  const allowedTenantTypes: FeaturedType[] = [];
  if (!hasAnyFeaturedConfig || flexible || tenantEnabled) {
    // Group enabled or flexible or unconfigured → all tenant types
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
  if (!hasAnyFeaturedConfig || flexible || platformEnabled) {
    // Group enabled or flexible or unconfigured → all platform types
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
    featured_expiry_monitor: merchantPrefs?.featured_expiry_monitor === true,
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

  // Fail-open: unconfigured tiers are treated as enabled
  const isEnabled = !hasAnyFeaturedConfig || (enabled && !disabled);

  return {
    enabled: isEnabled,
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
    featuredAvailable: isEnabled && allTypes.length > 0,
    effectiveFeaturedAvailable: isEnabled && effectiveTypes.length > 0,
    expiryMonitorEnabled: flexible || !!features.featured_expiry_monitor,
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
  } | null,
  capabilityEnabled?: boolean
): IntegrationOptionsState {
  const enabled = capabilityEnabled ?? !!features.integration_enabled;
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
    storefront_layout?: 'classic' | 'editorial' | 'immersive';
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
    storefront_layout: merchantPrefs?.storefront_layout || 'classic',
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

  // --- Layout feature gate ---
  const layoutGroupEnabled = !!features.storefront_opt_layout_enabled;
  const layoutGroupDisabled = !!features.storefront_opt_layout_disabled;
  const layoutEnabled = layoutGroupEnabled && !layoutGroupDisabled;
  const layoutUntouched = !layoutGroupEnabled && !layoutGroupDisabled;

  const allowedLayouts: StorefrontOptLayoutType[] = [];
  if (flexible || layoutEnabled) {
    allowedLayouts.push('classic', 'editorial', 'immersive');
  } else if (layoutUntouched) {
    if (features.storefront_opt_layout_classic) allowedLayouts.push('classic');
    if (features.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
    if (features.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
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

  // Effective layout = tier allowed (merchant selects one via storefront_layout preference)
  const effectiveLayouts = prefs.storefront_opt_enabled ? allowedLayouts : [];

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
    layoutEnabled: mainOn && (layoutEnabled || allowedLayouts.length > 0),
    allowedLayouts,
    effectiveLayout: effectiveLayouts.includes(prefs.storefront_layout as StorefrontOptLayoutType)
      ? (prefs.storefront_layout as StorefrontOptLayoutType)
      : (effectiveLayouts[0] || 'classic'),
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
    canUseLayoutClassic: mainOn && allowedLayouts.includes('classic'),
    canUseLayoutEditorial: mainOn && allowedLayouts.includes('editorial'),
    canUseLayoutImmersive: mainOn && allowedLayouts.includes('immersive'),
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
  const social = !!features.storefront_social;

  // Flexible gate
  const bothOptions = !!features.storefront_both_options;

  // Determine enabled state
  // 1. Deactivation master gate takes highest priority
  // 2. Activation master gates enable explicitly
  // 3. Feature/flexible gates enable implicitly when master gates are untouched
  const hasAnyFeatureGate = online || retail || service || social || bothOptions;
  const isEnabled = masterDeactivate
    ? false
    : masterActivate
      ? true
      : hasAnyFeatureGate;

  // Determine type from feature gates
  let type: StorefrontType = 'none';
  if (!isEnabled) {
    type = 'none';
  } else if (bothOptions || (online && retail) || (online && service) || (online && social) || (retail && service) || (retail && social) || (service && social)) {
    type = 'flexible';
  } else if (social) {
    type = 'social';
  } else if (online) {
    type = 'online';
  } else if (retail) {
    type = 'retail';
  } else if (service) {
    type = 'service';
  }

  // Compute allowed types from actual feature gates (not just type='flexible' → all)
  const allowedTypes: StorefrontType[] = [];
  if (isEnabled) {
    if (bothOptions) {
      // Flexible: all individual types allowed
      allowedTypes.push('online', 'retail', 'service', 'social');
    } else {
      if (online) allowedTypes.push('online');
      if (retail) allowedTypes.push('retail');
      if (service) allowedTypes.push('service');
      if (social) allowedTypes.push('social');
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

  if (type === 'flexible' && prefs.storefront_type_enabled) {
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
    } else if (selected === 'social' && allowedTypes.includes('social')) {
      effectiveType = 'social';
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

/**
 * Resolve FAQ options state from raw capability features
 */
export function resolveFaqOptionsState(
  features: Record<string, boolean>
): FaqOptionsState {
  const enabled = !!features.faq_enabled;
  const disabled = !!features.faq_disabled;
  const flexible = !!features.faq_flexible;

  // Scope group gates (storefront, product, templates)
  const storefrontGroupEnabled = !!features.faq_storefront_enabled;
  const storefrontGroupDisabled = !!features.faq_storefront_disabled;
  const productGroupEnabled = !!features.faq_product_enabled;
  const productGroupDisabled = !!features.faq_product_disabled;
  const templatesGroupEnabled = !!features.faq_templates_enabled;
  const templatesGroupDisabled = !!features.faq_templates_disabled;

  const storefrontEnabled = flexible || (storefrontGroupEnabled && !storefrontGroupDisabled);
  const productEnabled = flexible || (productGroupEnabled && !productGroupDisabled);
  const templatesEnabled = flexible || (templatesGroupEnabled && !templatesGroupDisabled);

  const managementGroupEnabled = !!features.faq_management_enabled;
  const managementGroupDisabled = !!features.faq_management_disabled;
  const previewGroupEnabled = !!features.faq_preview_enabled;
  const previewGroupDisabled = !!features.faq_preview_disabled;
  const displayGroupEnabled = !!features.faq_display_enabled;
  const displayGroupDisabled = !!features.faq_display_disabled;
  const kbGroupEnabled = !!features.faq_kb_enabled;
  const kbGroupDisabled = !!features.faq_kb_disabled;

  const managementEnabled = managementGroupEnabled && !managementGroupDisabled;
  const managementUntouched = !managementGroupEnabled && !managementGroupDisabled;
  const previewEnabled = previewGroupEnabled && !previewGroupDisabled;
  const previewUntouched = !previewGroupEnabled && !previewGroupDisabled;
  const displayEnabled = displayGroupEnabled && !displayGroupDisabled;
  const displayUntouched = !displayGroupEnabled && !displayGroupDisabled;
  const kbEnabled = kbGroupEnabled && !kbGroupDisabled;
  const kbUntouched = !kbGroupEnabled && !kbGroupDisabled;

  const allowedManagementTypes: FaqManagementType[] = [];
  if (flexible || managementEnabled) {
    allowedManagementTypes.push('faq_management_hub', 'faq_management_templates', 'faq_management_import', 'faq_management_wizard_inline', 'faq_management_bulk_actions', 'faq_management_reorder', 'faq_management_search');
  } else if (managementUntouched) {
    if (features.faq_management_hub) allowedManagementTypes.push('faq_management_hub');
    if (features.faq_management_templates) allowedManagementTypes.push('faq_management_templates');
    if (features.faq_management_import) allowedManagementTypes.push('faq_management_import');
    if (features.faq_management_wizard_inline) allowedManagementTypes.push('faq_management_wizard_inline');
    if (features.faq_management_bulk_actions) allowedManagementTypes.push('faq_management_bulk_actions');
    if (features.faq_management_reorder) allowedManagementTypes.push('faq_management_reorder');
    if (features.faq_management_search) allowedManagementTypes.push('faq_management_search');
  }

  const allowedPreviewTypes: FaqPreviewType[] = [];
  if (flexible || previewEnabled) {
    allowedPreviewTypes.push('faq_preview_bot', 'faq_preview_gap_report', 'faq_preview_auto_suggest');
  } else if (previewUntouched) {
    if (features.faq_preview_bot) allowedPreviewTypes.push('faq_preview_bot');
    if (features.faq_preview_gap_report) allowedPreviewTypes.push('faq_preview_gap_report');
    if (features.faq_preview_auto_suggest) allowedPreviewTypes.push('faq_preview_auto_suggest');
  }

  const allowedDisplayTypes: FaqDisplayType[] = [];
  if (flexible || displayEnabled) {
    allowedDisplayTypes.push('faq_display_storefront_accordion', 'faq_display_product_accordion', 'faq_display_search_overlay', 'faq_display_feedback', 'faq_display_bot_handoff', 'faq_display_markdown', 'faq_display_deep_link');
  } else if (displayUntouched) {
    if (features.faq_display_storefront_accordion) allowedDisplayTypes.push('faq_display_storefront_accordion');
    if (features.faq_display_product_accordion) allowedDisplayTypes.push('faq_display_product_accordion');
    if (features.faq_display_search_overlay) allowedDisplayTypes.push('faq_display_search_overlay');
    if (features.faq_display_feedback) allowedDisplayTypes.push('faq_display_feedback');
    if (features.faq_display_bot_handoff) allowedDisplayTypes.push('faq_display_bot_handoff');
    if (features.faq_display_markdown) allowedDisplayTypes.push('faq_display_markdown');
    if (features.faq_display_deep_link) allowedDisplayTypes.push('faq_display_deep_link');
  }

  const allowedKbTypes: FaqKnowledgeBaseType[] = [];
  if (flexible || kbEnabled) {
    allowedKbTypes.push('faq_kb_static_lookup', 'faq_kb_rag_retrieval', 'faq_kb_product_scoped', 'faq_kb_auto_sync', 'faq_kb_coverage_metrics');
  } else if (kbUntouched) {
    if (features.faq_kb_static_lookup) allowedKbTypes.push('faq_kb_static_lookup');
    if (features.faq_kb_rag_retrieval) allowedKbTypes.push('faq_kb_rag_retrieval');
    if (features.faq_kb_product_scoped) allowedKbTypes.push('faq_kb_product_scoped');
    if (features.faq_kb_auto_sync) allowedKbTypes.push('faq_kb_auto_sync');
    if (features.faq_kb_coverage_metrics) allowedKbTypes.push('faq_kb_coverage_metrics');
  }

  const allTypes = [...allowedManagementTypes, ...allowedPreviewTypes, ...allowedDisplayTypes, ...allowedKbTypes];

  return {
    enabled: enabled && !disabled,
    storefrontEnabled: enabled && !disabled && storefrontEnabled,
    productEnabled: enabled && !disabled && productEnabled,
    templatesEnabled: enabled && !disabled && templatesEnabled,
    managementEnabled,
    previewEnabled,
    displayEnabled,
    kbEnabled,
    allowedManagementTypes,
    allowedPreviewTypes,
    allowedDisplayTypes,
    allowedKbTypes,
    isFlexible: flexible,
    faqAvailable: enabled && !disabled && allTypes.length > 0,
    merchantPreferences: null,
    features,
  };
}

/**
 * Resolve CRM options state from raw capability features
 */
export function resolveCrmOptionsState(
  features: Record<string, boolean>,
  capabilityEnabled?: boolean
): CrmOptionsState {
  // Trim feature keys to handle potential leading/trailing spaces in DB
  const cleanFeatures: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(features)) {
    cleanFeatures[key.trim()] = val;
  }
  const feat = cleanFeatures;

  const enabled = capabilityEnabled ?? !!feat.crm_enabled;
  const disabled = !!feat.crm_disabled;
  const flexible = !!feat.crm_flexible;

  const inquiryProductEnabled = flexible || !!feat.crm_inquiry_product_enabled;
  const inquiryStorefrontEnabled = flexible || !!feat.crm_inquiry_storefront_enabled;
  const inquiryDirectoryEnabled = flexible || !!feat.crm_inquiry_directory_enabled;

  const contactsEnabled = flexible || !!feat.crm_contact_management;
  const ticketFeaturesEnabled = flexible || (!!feat.crm_ticket_priority || !!feat.crm_ticket_assignment || !!feat.crm_ticket_templates || !!feat.crm_ticket_escalation);
  const messageFeaturesEnabled = flexible || (!!feat.crm_message_rich_text || !!feat.crm_message_attachments || !!feat.crm_message_templates);
  const customerTicketsEnabled = flexible || !!feat.crm_customer_tickets;
  const dashboardEnabled = flexible || (!!feat.crm_dashboard_analytics || !!feat.crm_requests_hub);

  const allInquiry: CrmInquiryType[] = [];
  if (flexible) {
    allInquiry.push('crm_inquiry_product_enabled', 'crm_inquiry_storefront_enabled', 'crm_inquiry_directory_enabled', 'crm_inquiry_anonymous', 'crm_inquiry_customer', 'crm_inquiry_assignment', 'crm_inquiry_auto_response');
  } else {
    if (feat.crm_inquiry_product_enabled) allInquiry.push('crm_inquiry_product_enabled');
    if (feat.crm_inquiry_storefront_enabled) allInquiry.push('crm_inquiry_storefront_enabled');
    if (feat.crm_inquiry_directory_enabled) allInquiry.push('crm_inquiry_directory_enabled');
    if (feat.crm_inquiry_anonymous) allInquiry.push('crm_inquiry_anonymous');
    if (feat.crm_inquiry_customer) allInquiry.push('crm_inquiry_customer');
    if (feat.crm_inquiry_assignment) allInquiry.push('crm_inquiry_assignment');
    if (feat.crm_inquiry_auto_response) allInquiry.push('crm_inquiry_auto_response');
  }

  const allContact: CrmContactType[] = [];
  if (flexible) {
    allContact.push('crm_contact_management', 'crm_contact_import', 'crm_contact_sync');
  } else {
    if (feat.crm_contact_management) allContact.push('crm_contact_management');
    if (feat.crm_contact_import) allContact.push('crm_contact_import');
    if (feat.crm_contact_sync) allContact.push('crm_contact_sync');
  }

  const allTicket: CrmTicketType[] = [];
  if (flexible) {
    allTicket.push('crm_ticket_priority', 'crm_ticket_assignment', 'crm_ticket_templates', 'crm_ticket_escalation');
  } else {
    if (feat.crm_ticket_priority) allTicket.push('crm_ticket_priority');
    if (feat.crm_ticket_assignment) allTicket.push('crm_ticket_assignment');
    if (feat.crm_ticket_templates) allTicket.push('crm_ticket_templates');
    if (feat.crm_ticket_escalation) allTicket.push('crm_ticket_escalation');
  }

  const allMessage: CrmMessageType[] = [];
  if (flexible) {
    allMessage.push('crm_message_rich_text', 'crm_message_attachments', 'crm_message_templates');
  } else {
    if (feat.crm_message_rich_text) allMessage.push('crm_message_rich_text');
    if (feat.crm_message_attachments) allMessage.push('crm_message_attachments');
    if (feat.crm_message_templates) allMessage.push('crm_message_templates');
  }

  const allCustomerTicket: CrmCustomerTicketType[] = [];
  if (flexible || feat.crm_customer_tickets) {
    allCustomerTicket.push('crm_customer_tickets');
  }

  const allDashboard: CrmDashboardType[] = [];
  if (flexible) {
    allDashboard.push('crm_dashboard_analytics', 'crm_requests_hub');
  } else {
    if (feat.crm_dashboard_analytics) allDashboard.push('crm_dashboard_analytics');
    if (feat.crm_requests_hub) allDashboard.push('crm_requests_hub');
  }

  const allTypes = [...allInquiry, ...allContact, ...allTicket, ...allMessage, ...allCustomerTicket, ...allDashboard];

  return {
    enabled: enabled && !disabled,
    inquiryProductEnabled: enabled && !disabled && inquiryProductEnabled,
    inquiryStorefrontEnabled: enabled && !disabled && inquiryStorefrontEnabled,
    inquiryDirectoryEnabled: enabled && !disabled && inquiryDirectoryEnabled,
    contactsEnabled: enabled && !disabled && contactsEnabled,
    ticketFeaturesEnabled: enabled && !disabled && ticketFeaturesEnabled,
    messageFeaturesEnabled: enabled && !disabled && messageFeaturesEnabled,
    customerTicketsEnabled: enabled && !disabled && customerTicketsEnabled,
    dashboardEnabled: enabled && !disabled && dashboardEnabled,
    allowedInquiryTypes: allInquiry,
    allowedContactTypes: allContact,
    allowedTicketTypes: allTicket,
    allowedMessageTypes: allMessage,
    allowedCustomerTicketTypes: allCustomerTicket,
    allowedDashboardTypes: allDashboard,
    isFlexible: flexible,
    crmAvailable: enabled && !disabled && allTypes.length > 0,
    merchantPreferences: null,
    features: cleanFeatures,
  };
}

// End of capability resolution functions — no classes remain.
// UnifiedCapabilityService is the single service entry-point now.
