/**
 * Unified Capability Service
 *
 * Drop-in replacement for CapabilityResolutionService.
 * Calls the unified backend endpoint once and maps the pre-resolved
 * response into the existing typed state objects.
 *
 * No client-side resolution logic — just mapping.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { RequestType } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
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
  StorefrontOptionFlags,
  toStorefrontOptionFlags,
  DirectoryEntryOptionsState,
  DirectoryEntryLayoutKey,
  FaqOptionsState,
  PublicFaqOptionsFlags,
  toPublicFaqOptionsFlags,
  CrmOptionsState,
  PublicCrmOptionsFlags,
  toPublicCrmOptionsFlags,
  SocialCommerceOptionsState,
  SocialCommerceMetaType,
  SocialCommerceTikTokType,
  SocialCommerceExperienceType,
  DirectoryPromotionState,
  PromotionTierType,
  CommercePaymentType,
  GatewayType,
  StorefrontType,
  BarcodeScanMode,
  ProductType,
  ProductLayoutType,
  FeaturedType,
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
  StorefrontOptQRDotStyleType,
  StorefrontOptQRCornerStyleType,
  StorefrontOptGalleryType,
  StorefrontOptGalleryDisplayMode,
  StorefrontOptAdvancedType,
  StorefrontOptLayoutType,
  FaqManagementType,
  FaqPreviewType,
  FaqDisplayType,
  FaqKnowledgeBaseType,
  CrmInquiryType,
  CrmContactType,
  CrmTicketType,
  CrmMessageType,
  CrmCustomerTicketType,
  CrmDashboardType,
  ChatbotOptionsState,
  ChatbotResponseEngineType,
  ChatbotSkillType,
  ChatbotKnowledgeBaseType,
  ChatbotWidgetType,
  ConstraintViolationState,
  ConstraintStatusState,
  ConstraintStatusMapState,
  WholesaleMatchingState,
  PlatformServicesState,
  PlatformServiceType,
} from './CapabilityResolutionService';

// ====================
// BACKEND RESPONSE TYPES (snake_case)
// ====================

interface BackendSubscriptionContext {
  internalStatus: 'trialing' | 'active' | 'past_due' | 'maintenance' | 'frozen' | 'canceled' | 'expired';
  maintenanceState: 'maintenance' | 'freeze' | null;
  isReadOnly: boolean;
  isLimited: boolean;
  writable: boolean;
}

interface BackendConstraintViolation {
  constraint_id: string;
  type: 'requires' | 'recommends' | 'excludes' | 'implies';
  severity: 'block' | 'warn' | 'info';
  source_capability: string;
  source_type: string;
  target_capability: string;
  target_type: string;
  message: string;
  resolution_hint: string;
}

interface BackendConstraintStatus {
  blocked_types: string[];
  warning_types: string[];
  active_violations: string[];
}

interface BackendEffectiveCapabilities {
  tenant_id: string;
  tier: { key: string; name: string; description: string };
  subscription_context: BackendSubscriptionContext;
  effective: {
    commerce: BackendEffectiveCommerce;
    payment_gateway: BackendEffectivePaymentGateway;
    storefront: BackendEffectiveStorefront;
    fulfillment: BackendEffectiveFulfillment;
    product_options: BackendEffectiveProductOptions;
    product_types: BackendEffectiveProductTypes;
    featured: BackendEffectiveFeatured;
    integrations: BackendEffectiveIntegrations;
    quickstart: BackendEffectiveQuickstart;
    storefront_options: BackendEffectiveStorefrontOptions;
    storefront_qr: BackendEffectiveStorefrontQr;
    storefront_gallery: BackendEffectiveStorefrontGallery;
    storefront_hours: BackendEffectiveStorefrontHours;
    faq: BackendEffectiveFaq;
    directory_entry: BackendEffectiveDirectoryEntry;
    crm: BackendEffectiveCrm;
    chatbot: BackendEffectiveChatbot;
    barcode_scan: BackendEffectiveBarcodeScan;
    social_commerce_options: BackendEffectiveSocialCommerceOptions;
    directory_promotion: BackendEffectiveDirectoryPromotion;
    wholesale_matching: BackendEffectiveWholesaleMatching;
    platform_services: BackendEffectivePlatformServices;
  };
  constraint_violations: BackendConstraintViolation[];
  constraint_status: Record<string, BackendConstraintStatus>;
  gates?: {
    tier_hard: Record<string, { capability_enabled: boolean; is_highlighted: boolean; features: Record<string, boolean> }>;
    merchant_soft: Record<string, Record<string, boolean>>;
    org_override?: Record<string, Record<string, boolean>>;
  };
  uncategorized_features: string[];
  purchased_feature_keys?: string[];
  override_feature_keys?: string[];
}

interface BackendEffectiveCommerce {
  enabled: boolean;
  cart_visible: boolean;
  payment_type: CommercePaymentType;
  effective_payment_type: CommercePaymentType;
  effective_cart_visible: boolean;
  checkout_available: boolean;
  checkout_mode: { mode: 'deposit_only' | 'full_payment_only' | 'flexible' | 'disabled'; deposit_percentage?: number; deposit_min_cents?: number; deposit_max_cents?: number };
  merchant_preferences: { deposit_enabled: boolean; full_payment_enabled: boolean };
  is_flexible: boolean;
}

interface BackendEffectivePaymentGateway {
  enabled: boolean;
  allowed_gateways: GatewayType[];
  effective_gateways: GatewayType[];
  checkout_available: boolean;
  merchant_preferences: { gateway_enabled: boolean; stripe_enabled: boolean; paypal_enabled: boolean; square_enabled: boolean; clover_enabled: boolean };
  is_flexible: boolean;
}

interface BackendEffectiveStorefront {
  enabled: boolean;
  type: StorefrontType;
  effective_type: StorefrontType;
  is_flexible: boolean;
  allowed_types: StorefrontType[];
  has_merchant_selection: boolean;
  policies_enabled: boolean;
  merchant_preferences: { storefront_type_enabled: boolean; selected_storefront_type: StorefrontType };
}

interface BackendEffectiveBarcodeScan {
  enabled: boolean;
  allowed_modes: BarcodeScanMode[];
  effective_modes: BarcodeScanMode[];
  is_flexible: boolean;
  scan_available: boolean;
  effective_scan_available: boolean;
  merchant_preferences: { barcode_scan_enabled: boolean; barcode_manual_enabled: boolean; barcode_usb_enabled: boolean; barcode_camera_enabled: boolean };
}

interface BackendEffectiveFulfillment {
  enabled: boolean;
  shows_pickup: boolean;
  shows_delivery: boolean;
  shows_shipping: boolean;
  shows_service: boolean;
  effective_shows_pickup: boolean;
  effective_shows_delivery: boolean;
  effective_shows_shipping: boolean;
  merchant_preferences: { pickup_enabled: boolean; delivery_enabled: boolean; shipping_enabled: boolean };
  is_flexible: boolean;
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  shipping_flat_rate_cents: number | null;
  shipping_min_free_cents: number | null;
  shipping_handling_days: number;
  pickup_ready_time_minutes: number;
  pickup_instructions: string | null;
}

interface BackendEffectiveProductTypes {
  enabled: boolean;
  type: string;
  effective_type: string;
  effective_types: ProductType[];
  is_flexible: boolean;
  allowed_types: ProductType[];
  has_merchant_selection: boolean;
  merchant_preferences: { product_types_enabled: boolean; selected_product_type: string; selected_product_types: ProductType[] };
}

interface BackendEffectiveProductOptions {
  enabled: boolean;
  shows_variants: boolean;
  shows_gallery: boolean;
  shows_video: boolean;
  effective_shows_variants: boolean;
  effective_shows_gallery: boolean;
  effective_shows_video: boolean;
  layout_enabled: boolean;
  allowed_layouts: ProductLayoutType[];
  effective_layout: ProductLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  shows_recently_viewed: boolean;
  shows_qr_codes: boolean;
  shows_recommended: boolean;
  shows_map_display: boolean;
  shows_location_display: boolean;
  shows_hours_display: boolean;
  shows_enhanced_seo: boolean;
  shows_reviews: boolean;
  shows_fulfillment: boolean;
  shows_categories: boolean;
  shows_location_availability: boolean;
  shows_supplier_catalog: boolean;
  effective_shows_supplier_catalog: boolean;
  creation_enabled: boolean;
  sections_enabled: boolean;
  merchant_preferences: Record<string, any>;
  is_flexible: boolean;
}

interface BackendEffectiveFeatured {
  enabled: boolean;
  tenant_enabled: boolean;
  platform_enabled: boolean;
  allowed_tenant_types: FeaturedType[];
  allowed_platform_types: FeaturedType[];
  allowed_types: FeaturedType[];
  effective_tenant_types: FeaturedType[];
  effective_platform_types: FeaturedType[];
  effective_types: FeaturedType[];
  featured_available: boolean;
  effective_featured_available: boolean;
  expiry_monitor_enabled: boolean;
  merchant_preferences: Record<string, boolean>;
  is_flexible: boolean;
}

interface BackendEffectiveIntegrations {
  enabled: boolean;
  pos_enabled: boolean;
  google_enabled: boolean;
  allowed_pos_types: IntegrationType[];
  allowed_google_types: IntegrationType[];
  allowed_types: IntegrationType[];
  effective_pos_types: IntegrationType[];
  effective_google_types: IntegrationType[];
  effective_types: IntegrationType[];
  integrations_available: boolean;
  effective_integrations_available: boolean;
  merchant_preferences: Record<string, boolean>;
  is_flexible: boolean;
}

interface BackendEffectiveQuickstart {
  enabled: boolean;
  is_flexible: boolean;
  product_enabled: boolean;
  allowed_product_types: QuickstartProductType[];
  category_enabled: boolean;
  allowed_category_types: QuickstartCategoryType[];
  ai_enabled: boolean;
  allowed_ai_types: QuickstartAIType[];
  can_use_wizard: boolean;
  can_use_ai_wizard: boolean;
  can_use_category_generator: boolean;
  can_generate_images: boolean;
  can_use_openai: boolean;
  can_use_gemini: boolean;
  can_use_hd_images: boolean;
  merchant_preferences: Record<string, any>;
}

interface BackendEffectiveStorefrontOptions {
  enabled: boolean;
  is_flexible: boolean;
  category_enabled: boolean;
  allowed_category_types: StorefrontOptCategoryType[];
  recommend_enabled: boolean;
  allowed_recommend_types: StorefrontOptRecommendType[];
  recently_viewed_enabled: boolean;
  info_enabled: boolean;
  allowed_info_types: StorefrontOptInfoType[];
  advanced_enabled: boolean;
  allowed_advanced_types: StorefrontOptAdvancedType[];
  layout_enabled: boolean;
  allowed_layouts: StorefrontOptLayoutType[];
  effective_layout: StorefrontOptLayoutType;
  can_show_map_display: boolean;
  can_show_location_display: boolean;
  can_use_category_store: boolean;
  can_use_category_product: boolean;
  can_use_recommend_store: boolean;
  can_use_recommend_products: boolean;
  can_use_recently_viewed: boolean;
  can_use_social_media: boolean;
  can_use_contact: boolean;
  can_use_interactive_maps: boolean;
  can_use_enhanced_seo: boolean;
  can_use_storefront_actions: boolean;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  merchant_preferences: Record<string, any>;
}

interface BackendEffectiveStorefrontQr {
  enabled: boolean;
  is_flexible: boolean;
  qr_enabled: boolean;
  allowed_qr_resolutions: StorefrontOptQRResolutionType[];
  allowed_qr_content_types: StorefrontOptQRContentType[];
  qr_classic_enabled: boolean;
  qr_styled_enabled: boolean;
  allowed_qr_dot_styles: string[];
  allowed_qr_corner_styles: string[];
  qr_custom_colors: boolean;
  qr_gradients: boolean;
  can_use_qr_codes: boolean;
  merchant_preferences: Record<string, any>;
}

interface BackendEffectiveStorefrontGallery {
  enabled: boolean;
  is_flexible: boolean;
  gallery_enabled: boolean;
  allowed_gallery_types: StorefrontOptGalleryType[];
  default_gallery_limit: number;
  gallery_display_mode: StorefrontOptGalleryDisplayMode;
  gallery_carousel_enabled: boolean;
  gallery_magazine_enabled: boolean;
  can_use_magazine_gallery: boolean;
  can_use_gallery: boolean;
  merchant_preferences: Record<string, any>;
}

interface BackendEffectiveStorefrontHours {
  enabled: boolean;
  is_flexible: boolean;
  hours_enabled: boolean;
  allowed_hours_types: StorefrontOptHoursType[];
  hours_display_enabled: boolean;
  can_show_hours_display: boolean;
  can_use_animated_hours: boolean;
  can_show_hours_status: boolean;
  merchant_preferences: Record<string, any>;
}

interface BackendEffectiveFaq {
  enabled: boolean;
  storefront_enabled: boolean;
  product_enabled: boolean;
  templates_enabled: boolean;
  management_enabled: boolean;
  preview_enabled: boolean;
  display_enabled: boolean;
  kb_enabled: boolean;
  allowed_management_types: FaqManagementType[];
  allowed_preview_types: FaqPreviewType[];
  allowed_display_types: FaqDisplayType[];
  allowed_kb_types: FaqKnowledgeBaseType[];
  is_flexible: boolean;
  faq_available: boolean;
  merchant_preferences: { faq_enabled?: boolean | null } | null;
}

interface BackendEffectiveDirectoryEntryMerchantPrefs {
  directory_entry_opt_enabled: boolean;
  directory_entry_layout: string;
  external_link_enabled?: boolean;
}

interface BackendEffectiveDirectoryEntry {
  enabled: boolean;
  is_flexible: boolean;
  layout_enabled: boolean;
  allowed_layouts: string[];
  effective_layout: string;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  can_use_layout_premium: boolean;
  hours_enabled: boolean;
  map_enabled: boolean;
  contact_enabled: boolean;
  gallery_enabled: boolean;
  qr_enabled: boolean;
  social_enabled: boolean;
  seo_enabled: boolean;
  can_show_hours: boolean;
  can_show_map: boolean;
  can_show_contact: boolean;
  can_show_gallery: boolean;
  can_show_qr: boolean;
  can_show_social: boolean;
  can_show_seo: boolean;
  can_show_external_link: boolean;
  external_link_enabled: boolean;
  merchant_preferences: BackendEffectiveDirectoryEntryMerchantPrefs;
}

interface BackendEffectiveCrm {
  enabled: boolean;
  inquiry_product_enabled: boolean;
  inquiry_storefront_enabled: boolean;
  inquiry_directory_enabled: boolean;
  contacts_enabled: boolean;
  ticket_features_enabled: boolean;
  message_features_enabled: boolean;
  customer_tickets_enabled: boolean;
  dashboard_enabled: boolean;
  allowed_inquiry_types: CrmInquiryType[];
  allowed_contact_types: CrmContactType[];
  allowed_ticket_types: CrmTicketType[];
  allowed_message_types: CrmMessageType[];
  allowed_customer_ticket_types: CrmCustomerTicketType[];
  allowed_dashboard_types: CrmDashboardType[];
  is_flexible: boolean;
  crm_available: boolean;
  merchant_preferences: { crm_enabled?: boolean | null } | null;
}

interface BackendEffectiveChatbot {
  enabled: boolean;
  static_enabled: boolean;
  dynamic_enabled: boolean;
  skills_enabled: boolean;
  kb_enabled: boolean;
  widget_enabled: boolean;
  allowed_response_engines: ChatbotResponseEngineType[];
  allowed_skill_types: ChatbotSkillType[];
  allowed_kb_types: ChatbotKnowledgeBaseType[];
  allowed_widget_types: ChatbotWidgetType[];
  is_flexible: boolean;
  chatbot_available: boolean;
  can_use_widget_custom_theme: boolean;
  can_use_widget_skill_cards: boolean;
  can_use_widget_after_hours: boolean;
  merchant_preferences: {
    chatbot_enabled?: boolean | null;
    chatbot_static_on?: boolean | null;
    chatbot_static_enabled?: boolean | null;
    chatbot_dynamic_on?: boolean | null;
    chatbot_dynamic_enabled?: boolean | null;
    chatbot_skills_on?: boolean | null;
    chatbot_skills_enabled?: boolean | null;
    chatbot_kb_on?: boolean | null;
    chatbot_kb_enabled?: boolean | null;
    chatbot_widget_on?: boolean | null;
    chatbot_widget_enabled?: boolean | null;
    chatbot_widget_custom_theme?: boolean | null;
    chatbot_widget_skill_cards?: boolean | null;
    chatbot_widget_after_hours?: boolean | null;
  } | null;
}

interface BackendEffectiveSocialCommerceOptions {
  enabled: boolean;
  is_flexible: boolean;
  meta_enabled: boolean;
  allowed_meta_types: SocialCommerceMetaType[];
  tiktok_enabled: boolean;
  allowed_tiktok_types: SocialCommerceTikTokType[];
  experience_enabled: boolean;
  allowed_experience_types: SocialCommerceExperienceType[];
  can_use_meta_catalog: boolean;
  can_use_meta_shop: boolean;
  can_use_meta_pixel: boolean;
  can_use_tiktok_catalog: boolean;
  can_use_tiktok_shop: boolean;
  can_use_tiktok_pixel: boolean;
  can_use_share_buttons: boolean;
  can_use_social_proof: boolean;
  can_use_abandoned_cart: boolean;
  social_commerce_available: boolean;
  merchant_preferences: Record<string, boolean>;
}

function mapCommerce(b: BackendEffectiveCommerce): CommerceState {
  return {
    enabled: b.enabled,
    cartVisible: b.cart_visible,
    paymentType: b.payment_type,
    effectivePaymentType: b.effective_payment_type,
    effectiveCartVisible: b.effective_cart_visible,
    merchantPreferences: b.merchant_preferences,
    checkoutMode: b.checkout_mode ?? {
      mode: b.effective_payment_type === 'deposit' ? 'deposit_only'
        : b.effective_payment_type === 'full' ? 'full_payment_only'
        : b.effective_payment_type === 'flexible' ? 'flexible'
        : 'disabled',
    },
    isFlexible: b.is_flexible,
    features: {},
  };
}

function mapPaymentGateway(b: BackendEffectivePaymentGateway): PaymentGatewayState {
  return {
    enabled: b.enabled,
    allowedGateways: b.allowed_gateways,
    effectiveGateways: b.effective_gateways,
    merchantPreferences: b.merchant_preferences,
    isFlexible: b.is_flexible,
    checkoutAvailable: b.checkout_available,
    features: {},
  };
}

function mapStorefront(b: BackendEffectiveStorefront): StorefrontState {
  return {
    enabled: b.enabled,
    type: b.type,
    effectiveType: b.effective_type,
    isFlexible: b.is_flexible,
    allowedTypes: b.allowed_types,
    hasMerchantSelection: b.has_merchant_selection,
    policiesEnabled: b.policies_enabled,
    merchantPreferences: b.merchant_preferences,
    features: {},
  };
}

function mapBarcodeScan(b: BackendEffectiveBarcodeScan): BarcodeScanState {
  return {
    enabled: b.enabled,
    allowedModes: b.allowed_modes,
    effectiveModes: b.effective_modes,
    isFlexible: b.is_flexible,
    scanAvailable: b.scan_available,
    effectiveScanAvailable: b.effective_scan_available,
    merchantPreferences: b.merchant_preferences,
    features: {},
  };
}

function mapFulfillment(b: BackendEffectiveFulfillment): FulfillmentState {
  return {
    enabled: b.enabled,
    showsPickup: b.shows_pickup,
    showsDelivery: b.shows_delivery,
    showsShipping: b.shows_shipping,
    showsService: b.shows_service,
    effectiveShowsPickup: b.effective_shows_pickup,
    effectiveShowsDelivery: b.effective_shows_delivery,
    effectiveShowsShipping: b.effective_shows_shipping,
    merchantPreferences: b.merchant_preferences,
    isFlexible: b.is_flexible,
    deliveryRadiusMiles: b.delivery_radius_miles,
    deliveryFeeCents: b.delivery_fee_cents,
    deliveryMinFreeCents: b.delivery_min_free_cents,
    deliveryTimeHours: b.delivery_time_hours,
    shippingFlatRateCents: b.shipping_flat_rate_cents,
    shippingMinFreeCents: b.shipping_min_free_cents,
    shippingHandlingDays: b.shipping_handling_days,
    pickupReadyTimeMinutes: b.pickup_ready_time_minutes,
    pickupInstructions: b.pickup_instructions,
    features: {},
  };
}

function mapProductType(b: BackendEffectiveProductTypes): ProductTypeState {
  return {
    enabled: b.enabled,
    type: b.type as ProductTypeState['type'],
    effectiveType: b.effective_type as ProductTypeState['effectiveType'],
    effectiveTypes: b.effective_types ?? [],
    isFlexible: b.is_flexible,
    allowedTypes: b.allowed_types,
    hasMerchantSelection: b.has_merchant_selection,
    merchantPreferences: {
      product_types_enabled: b.merchant_preferences?.product_types_enabled ?? true,
      selected_product_type: (b.merchant_preferences?.selected_product_type as ProductType | 'none') || 'none',
      selected_product_types: b.merchant_preferences?.selected_product_types ?? [],
    },
    features: {},
  };
}

function mapProductOptions(b: BackendEffectiveProductOptions): ProductOptionsState {
  return {
    enabled: b.enabled,
    creationEnabled: b.creation_enabled ?? true,
    showsVariants: b.shows_variants,
    showsGallery: b.shows_gallery,
    showsVideo: b.shows_video,
    effectiveShowsVariants: b.effective_shows_variants,
    effectiveShowsGallery: b.effective_shows_gallery,
    effectiveShowsVideo: b.effective_shows_video,
    layoutEnabled: b.layout_enabled,
    allowedLayouts: b.allowed_layouts,
    effectiveLayout: b.effective_layout,
    canUseLayoutClassic: b.can_use_layout_classic,
    canUseLayoutEditorial: b.can_use_layout_editorial,
    canUseLayoutImmersive: b.can_use_layout_immersive,
    showsRecentlyViewed: b.shows_recently_viewed,
    showsQRCodes: b.shows_qr_codes,
    showsQRLogo: b.merchant_preferences?.product_opt_qr_logo ?? true,
    showsRecommended: b.shows_recommended,
    showsMapDisplay: b.shows_map_display,
    showsLocationDisplay: b.shows_location_display,
    showsHoursDisplay: b.shows_hours_display,
    showsEnhancedSEO: b.shows_enhanced_seo,
    showsReviews: b.shows_reviews,
    showsFulfillment: b.shows_fulfillment,
    showsCategories: b.shows_categories,
    showsLocationAvailability: b.shows_location_availability,
    sectionsEnabled: b.sections_enabled ?? true,
    effectiveShowsRecentlyViewed: b.shows_recently_viewed,
    effectiveShowsQRCodes: b.shows_qr_codes,
    effectiveShowsQRLogo: b.merchant_preferences?.product_opt_qr_logo ?? true,
    effectiveShowsRecommended: b.shows_recommended,
    effectiveShowsMapDisplay: b.shows_map_display,
    effectiveShowsLocationDisplay: b.shows_location_display,
    effectiveShowsHoursDisplay: b.shows_hours_display,
    effectiveShowsEnhancedSEO: b.shows_enhanced_seo,
    effectiveShowsReviews: b.shows_reviews,
    effectiveShowsFulfillment: b.shows_fulfillment,
    effectiveShowsCategories: b.shows_categories,
    effectiveShowsLocationAvailability: b.shows_location_availability,
    showsSupplierCatalog: b.shows_supplier_catalog ?? false,
    effectiveShowsSupplierCatalog: b.effective_shows_supplier_catalog ?? false,
    merchantPreferences: b.merchant_preferences as any,
    isFlexible: b.is_flexible,
    features: {},
  };
}

function mapFeatured(b: BackendEffectiveFeatured): FeaturedOptionsState {
  return {
    enabled: b.enabled,
    tenantEnabled: b.tenant_enabled,
    platformEnabled: b.platform_enabled,
    allowedTenantTypes: b.allowed_tenant_types,
    allowedPlatformTypes: b.allowed_platform_types,
    allowedTypes: b.allowed_types,
    effectiveTenantTypes: b.effective_tenant_types,
    effectivePlatformTypes: b.effective_platform_types,
    effectiveTypes: b.effective_types,
    merchantPreferences: b.merchant_preferences as any,
    isFlexible: b.is_flexible,
    featuredAvailable: b.featured_available,
    effectiveFeaturedAvailable: b.effective_featured_available,
    expiryMonitorEnabled: b.expiry_monitor_enabled,
    features: {},
  };
}

function mapIntegrations(b: BackendEffectiveIntegrations): IntegrationOptionsState {
  return {
    enabled: b.enabled,
    posEnabled: b.pos_enabled,
    googleEnabled: b.google_enabled,
    allowedPosTypes: b.allowed_pos_types,
    allowedGoogleTypes: b.allowed_google_types,
    allowedTypes: b.allowed_types,
    effectivePosTypes: b.effective_pos_types,
    effectiveGoogleTypes: b.effective_google_types,
    effectiveTypes: b.effective_types,
    merchantPreferences: b.merchant_preferences as any,
    isFlexible: b.is_flexible,
    integrationsAvailable: b.integrations_available,
    effectiveIntegrationsAvailable: b.effective_integrations_available,
    features: {},
  };
}

function mapQuickstart(b: BackendEffectiveQuickstart): QuickstartOptionsState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    productEnabled: b.product_enabled,
    allowedProductTypes: b.allowed_product_types,
    categoryEnabled: b.category_enabled,
    allowedCategoryTypes: b.allowed_category_types,
    aiEnabled: b.ai_enabled,
    allowedAITypes: b.allowed_ai_types,
    canUseWizard: b.can_use_wizard,
    canUseAIWizard: b.can_use_ai_wizard,
    canUseCategoryGenerator: b.can_use_category_generator,
    canGenerateImages: b.can_generate_images,
    canUseOpenAI: b.can_use_openai,
    canUseGemini: b.can_use_gemini,
    canUseHDImages: b.can_use_hd_images,
    merchantPreferences: b.merchant_preferences as any,
    features: {},
  };
}

function mapStorefrontOptions(b: BackendEffectiveStorefrontOptions): StorefrontOptionsState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    categoryEnabled: b.category_enabled,
    allowedCategoryTypes: b.allowed_category_types,
    recommendEnabled: b.recommend_enabled,
    allowedRecommendTypes: b.allowed_recommend_types,
    recentlyViewedEnabled: b.recently_viewed_enabled,
    infoEnabled: b.info_enabled,
    allowedInfoTypes: b.allowed_info_types,
    advancedEnabled: b.advanced_enabled,
    allowedAdvancedTypes: b.allowed_advanced_types,
    layoutEnabled: b.layout_enabled,
    allowedLayouts: b.allowed_layouts,
    effectiveLayout: b.effective_layout,
    canShowMapDisplay: b.can_show_map_display,
    canShowLocationDisplay: b.can_show_location_display,
    canUseCategoryStore: b.can_use_category_store,
    canUseCategoryProduct: b.can_use_category_product,
    canUseRecommendStore: b.can_use_recommend_store,
    canUseRecommendProducts: b.can_use_recommend_products,
    canUseRecentlyViewed: b.can_use_recently_viewed,
    canUseSocialMedia: b.can_use_social_media,
    canUseContact: b.can_use_contact,
    canUseInteractiveMaps: b.can_use_interactive_maps,
    canUseEnhancedSEO: b.can_use_enhanced_seo,
    canUseStorefrontActions: b.can_use_storefront_actions,
    canUseLayoutClassic: b.can_use_layout_classic,
    canUseLayoutEditorial: b.can_use_layout_editorial,
    canUseLayoutImmersive: b.can_use_layout_immersive,
    merchantPreferences: b.merchant_preferences as any,
    features: {},
  };
}

function mapStorefrontQr(b: BackendEffectiveStorefrontQr): StorefrontQrState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    qrEnabled: b.qr_enabled,
    allowedQRResolutions: b.allowed_qr_resolutions,
    allowedQRContentTypes: b.allowed_qr_content_types,
    qrClassicEnabled: b.qr_classic_enabled,
    qrStyledEnabled: b.qr_styled_enabled,
    allowedQRDotStyles: (b.allowed_qr_dot_styles ?? []) as StorefrontOptQRDotStyleType[],
    allowedQRCornerStyles: (b.allowed_qr_corner_styles ?? []) as StorefrontOptQRCornerStyleType[],
    qrCustomColors: b.qr_custom_colors,
    qrGradients: b.qr_gradients,
    canUseQRCodes: b.can_use_qr_codes,
    merchantPreferences: b.merchant_preferences as any,
    features: {},
  };
}

function mapStorefrontGallery(b: BackendEffectiveStorefrontGallery): StorefrontGalleryState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    galleryEnabled: b.gallery_enabled,
    allowedGalleryTypes: b.allowed_gallery_types ?? [],
    defaultGalleryLimit: b.default_gallery_limit ?? 5,
    galleryDisplayMode: (b.gallery_display_mode ?? 'carousel') as StorefrontOptGalleryDisplayMode,
    galleryCarouselEnabled: b.gallery_carousel_enabled,
    galleryMagazineEnabled: b.gallery_magazine_enabled,
    canUseMagazineGallery: b.can_use_magazine_gallery,
    canUseGallery: b.can_use_gallery,
    merchantPreferences: b.merchant_preferences as any,
    features: {},
  };
}

function mapStorefrontHours(b: BackendEffectiveStorefrontHours): StorefrontHoursState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    hoursEnabled: b.hours_enabled,
    allowedHoursTypes: b.allowed_hours_types ?? [],
    hoursDisplayEnabled: b.hours_display_enabled,
    canShowHoursDisplay: b.can_show_hours_display,
    canUseAnimatedHours: b.can_use_animated_hours,
    canShowHoursStatus: b.can_show_hours_status,
    merchantPreferences: b.merchant_preferences as any,
    features: {},
  };
}

function mapDirectoryEntry(b: BackendEffectiveDirectoryEntry): DirectoryEntryOptionsState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    layoutEnabled: b.layout_enabled,
    allowedLayouts: b.allowed_layouts as DirectoryEntryLayoutKey[],
    effectiveLayout: (b.effective_layout as DirectoryEntryLayoutKey) || 'classic',
    canUseLayoutClassic: b.can_use_layout_classic,
    canUseLayoutEditorial: b.can_use_layout_editorial,
    canUseLayoutImmersive: b.can_use_layout_immersive,
    canUseLayoutPremium: b.can_use_layout_premium,
    hoursEnabled: b.hours_enabled,
    mapEnabled: b.map_enabled,
    contactEnabled: b.contact_enabled,
    galleryEnabled: b.gallery_enabled,
    qrEnabled: b.qr_enabled,
    socialEnabled: b.social_enabled,
    seoEnabled: b.seo_enabled,
    canShowHours: b.can_show_hours,
    canShowMap: b.can_show_map,
    canShowContact: b.can_show_contact,
    canShowGallery: b.can_show_gallery,
    canShowQr: b.can_show_qr,
    canShowSocial: b.can_show_social,
    canShowSeo: b.can_show_seo,
    canShowExternalLink: b.can_show_external_link,
    externalLinkEnabled: b.external_link_enabled,
    merchantPreferences: {
      directory_entry_opt_enabled: b.merchant_preferences.directory_entry_opt_enabled,
      directory_entry_layout: (b.merchant_preferences.directory_entry_layout as DirectoryEntryLayoutKey) || 'classic',
      external_link_enabled: b.merchant_preferences.external_link_enabled,
    },
    features: {},
  };
}

function mapFaq(b: BackendEffectiveFaq): FaqOptionsState {
  return {
    enabled: b.enabled,
    storefrontEnabled: b.storefront_enabled,
    productEnabled: b.product_enabled,
    templatesEnabled: b.templates_enabled,
    managementEnabled: b.management_enabled,
    previewEnabled: b.preview_enabled,
    displayEnabled: b.display_enabled,
    kbEnabled: b.kb_enabled,
    allowedManagementTypes: b.allowed_management_types,
    allowedPreviewTypes: b.allowed_preview_types,
    allowedDisplayTypes: b.allowed_display_types,
    allowedKbTypes: b.allowed_kb_types,
    isFlexible: b.is_flexible,
    faqAvailable: b.faq_available,
    merchantPreferences: b.merchant_preferences ?? null,
    features: {},
  };
}

function mapCrm(b: BackendEffectiveCrm): CrmOptionsState {
  return {
    enabled: b.enabled,
    inquiryProductEnabled: b.inquiry_product_enabled,
    inquiryStorefrontEnabled: b.inquiry_storefront_enabled,
    inquiryDirectoryEnabled: b.inquiry_directory_enabled,
    contactsEnabled: b.contacts_enabled,
    ticketFeaturesEnabled: b.ticket_features_enabled,
    messageFeaturesEnabled: b.message_features_enabled,
    customerTicketsEnabled: b.customer_tickets_enabled,
    dashboardEnabled: b.dashboard_enabled,
    allowedInquiryTypes: b.allowed_inquiry_types,
    allowedContactTypes: b.allowed_contact_types,
    allowedTicketTypes: b.allowed_ticket_types,
    allowedMessageTypes: b.allowed_message_types,
    allowedCustomerTicketTypes: b.allowed_customer_ticket_types,
    allowedDashboardTypes: b.allowed_dashboard_types,
    isFlexible: b.is_flexible,
    crmAvailable: b.crm_available,
    merchantPreferences: b.merchant_preferences ?? null,
    features: {},
  };
}

function mapChatbot(b: BackendEffectiveChatbot): ChatbotOptionsState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    staticEnabled: b.static_enabled,
    dynamicEnabled: b.dynamic_enabled,
    skillsEnabled: b.skills_enabled,
    kbEnabled: b.kb_enabled,
    widgetEnabled: b.widget_enabled,
    allowedResponseEngines: b.allowed_response_engines,
    allowedSkillTypes: b.allowed_skill_types,
    allowedKbTypes: b.allowed_kb_types,
    allowedWidgetTypes: b.allowed_widget_types,
    chatbotAvailable: b.chatbot_available,
    canUseWidgetCustomTheme: b.can_use_widget_custom_theme,
    canUseWidgetSkillCards: b.can_use_widget_skill_cards,
    canUseWidgetAfterHours: b.can_use_widget_after_hours,
    merchantPreferences: b.merchant_preferences ?? null,
    features: {},
  };
}

function mapSocialCommerceOptions(b: BackendEffectiveSocialCommerceOptions): SocialCommerceOptionsState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    metaEnabled: b.meta_enabled,
    allowedMetaTypes: b.allowed_meta_types,
    tiktokEnabled: b.tiktok_enabled,
    allowedTikTokTypes: b.allowed_tiktok_types,
    experienceEnabled: b.experience_enabled,
    allowedExperienceTypes: b.allowed_experience_types,
    canUseMetaCatalog: b.can_use_meta_catalog,
    canUseMetaShop: b.can_use_meta_shop,
    canUseMetaPixel: b.can_use_meta_pixel,
    canUseTikTokCatalog: b.can_use_tiktok_catalog,
    canUseTikTokShop: b.can_use_tiktok_shop,
    canUseTikTokPixel: b.can_use_tiktok_pixel,
    canUseShareButtons: b.can_use_share_buttons,
    canUseSocialProof: b.can_use_social_proof,
    canUseAbandonedCart: b.can_use_abandoned_cart,
    socialCommerceAvailable: b.social_commerce_available,
    merchantPreferences: b.merchant_preferences,
    features: {},
  };
}

function mapConstraintViolations(violations: BackendConstraintViolation[]): ConstraintViolationState[] {
  return (violations || []).map(v => ({
    constraintId: v.constraint_id,
    type: v.type,
    severity: v.severity,
    sourceCapability: v.source_capability,
    sourceType: v.source_type,
    targetCapability: v.target_capability,
    targetType: v.target_type,
    message: v.message,
    resolutionHint: v.resolution_hint,
  }));
}

function mapConstraintStatus(status: Record<string, BackendConstraintStatus>): ConstraintStatusMapState {
  const result: ConstraintStatusMapState = {};
  for (const [key, value] of Object.entries(status || {})) {
    result[key] = {
      blockedTypes: value.blocked_types || [],
      warningTypes: value.warning_types || [],
      activeViolations: value.active_violations || [],
    };
  }
  return result;
}

interface BackendEffectiveDirectoryPromotion {
  enabled: boolean;
  allowed_tiers: string[];
  is_flexible: boolean;
}

function mapDirectoryPromotion(b: BackendEffectiveDirectoryPromotion): DirectoryPromotionState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    allowedTiers: (b.allowed_tiers || []) as PromotionTierType[],
  };
}

interface BackendEffectiveWholesaleMatching {
  enabled: boolean;
  tier: 'none' | 'search' | 'full';
  can_check_supplier_match: boolean;
  can_search_faire: boolean;
  can_build_affiliate_link: boolean;
  can_view_brand_partners: boolean;
  is_flexible: boolean;
}

interface BackendEffectivePlatformServices {
  enabled: boolean;
  allowed_services: string[];
  can_use_logo_design: boolean;
  can_use_banner_design: boolean;
  can_use_store_setup: boolean;
  can_use_profile_setup: boolean;
  can_use_seo_optimization: boolean;
  can_use_social_media_kit: boolean;
  is_flexible: boolean;
}

function mapPlatformServices(b: BackendEffectivePlatformServices): PlatformServicesState {
  return {
    enabled: b.enabled,
    allowedServices: (b.allowed_services || []) as PlatformServiceType[],
    canUseLogoDesign: b.can_use_logo_design,
    canUseBannerDesign: b.can_use_banner_design,
    canUseStoreSetup: b.can_use_store_setup,
    canUseProfileSetup: b.can_use_profile_setup,
    canUseSeoOptimization: b.can_use_seo_optimization,
    canUseSocialMediaKit: b.can_use_social_media_kit,
    isFlexible: b.is_flexible,
  };
}

function mapWholesaleMatching(b: BackendEffectiveWholesaleMatching): WholesaleMatchingState {
  return {
    enabled: b.enabled,
    tier: b.tier,
    canCheckSupplierMatch: b.can_check_supplier_match,
    canSearchFaire: b.can_search_faire,
    canBuildAffiliateLink: b.can_build_affiliate_link,
    canViewBrandPartners: b.can_view_brand_partners,
    isFlexible: b.is_flexible,
    features: {},
  };
}

function mapAll(b: BackendEffectiveCapabilities): AllCapabilitiesState {
  return {
    tierKey: b.tier.key,
    tierName: b.tier.name,
    tierDescription: b.tier.description,
    subscriptionContext: b.subscription_context ? {
      internalStatus: b.subscription_context.internalStatus,
      maintenanceState: b.subscription_context.maintenanceState,
      isReadOnly: b.subscription_context.isReadOnly,
      isLimited: b.subscription_context.isLimited,
      writable: b.subscription_context.writable,
    } : {
      internalStatus: 'active',
      maintenanceState: null,
      isReadOnly: false,
      isLimited: false,
      writable: true,
    },
    commerce: mapCommerce(b.effective.commerce),
    paymentGateway: mapPaymentGateway(b.effective.payment_gateway),
    storefront: mapStorefront(b.effective.storefront),
    barcodeScan: mapBarcodeScan(b.effective.barcode_scan),
    fulfillment: mapFulfillment(b.effective.fulfillment),
    productOptions: mapProductOptions(b.effective.product_options),
    productType: mapProductType(b.effective.product_types),
    featuredOptions: mapFeatured(b.effective.featured),
    integrationOptions: mapIntegrations(b.effective.integrations),
    quickstartOptions: mapQuickstart(b.effective.quickstart),
    storefrontOptions: mapStorefrontOptions(b.effective.storefront_options),
    storefrontQr: mapStorefrontQr(b.effective.storefront_qr),
    storefrontGallery: mapStorefrontGallery(b.effective.storefront_gallery),
    storefrontHours: mapStorefrontHours(b.effective.storefront_hours),
    directoryEntryOptions: mapDirectoryEntry(b.effective.directory_entry),
    faqOptions: mapFaq(b.effective.faq),
    crmOptions: mapCrm(b.effective.crm),
    chatbotOptions: mapChatbot(b.effective.chatbot),
    socialCommerceOptions: mapSocialCommerceOptions(b.effective.social_commerce_options),
    directoryPromotion: mapDirectoryPromotion(b.effective.directory_promotion),
    wholesaleMatching: mapWholesaleMatching(b.effective.wholesale_matching),
    platformServices: mapPlatformServices(b.effective.platform_services),
    constraintViolations: mapConstraintViolations(b.constraint_violations),
    constraintStatus: mapConstraintStatus(b.constraint_status),
    uncategorizedFeatures: b.uncategorized_features,
    purchasedFeatureKeys: b.purchased_feature_keys || [],
    overrideFeatureKeys: b.override_feature_keys || [],
  };
}

// ====================
// SERVICE
// ====================

type SsrAuth = { auth0Email?: string; auth0Id?: string };

class UnifiedCapabilityService extends TenantApiSingleton {
  private static instance: UnifiedCapabilityService;
  private capCache = new Map<string, { data: AllCapabilitiesState; expiry: number }>();
  private inFlight = new Map<string, Promise<BackendEffectiveCapabilities | null>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    super('unified-capability-service', { ttl: 15 * 60 * 1000 });
  }

  static getInstance(): UnifiedCapabilityService {
    if (!UnifiedCapabilityService.instance) {
      UnifiedCapabilityService.instance = new UnifiedCapabilityService();
    }
    return UnifiedCapabilityService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['unified-capabilities'];
  }

  async invalidateServiceCaches(_customerId?: string): Promise<void> {
    this.capCache.clear();
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /** Invalidate cached capabilities for a single tenant (call after merchant gate changes) */
  async invalidateTenantCapabilities(tenantId: string): Promise<void> {
    this.capCache.delete(`${tenantId}-auth`);
    this.capCache.delete(`${tenantId}-public`);
    await this.invalidateCache(`unified-caps-${tenantId}-auth`);
    await this.invalidateCache(`unified-caps-${tenantId}-public`);
  }

  private async fetchEffective(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<BackendEffectiveCapabilities | null> {
    const isPublic = options?.isPublic ?? false;
    const ssrAuth = options?.ssrAuth;
    const cachekey = `unified-caps-${tenantId}${isPublic ? '-public' : '-auth'}`;

    // Deduplicate concurrent in-flight requests for the same tenant+scope
    if (this.inFlight.has(cachekey)) {
      return this.inFlight.get(cachekey)!;
    }

    const promise = (async (): Promise<BackendEffectiveCapabilities | null> => {
      try {
        if (isPublic) {
          const endpoint = `/api/public/tenants/${tenantId}/effective-capabilities`;
          const result = await this.makePublicRequest<{ success: boolean; data: BackendEffectiveCapabilities }>(
            endpoint,
            {},
            cachekey,
            this.CACHE_TTL
          );
          if (!result.success) {
            console.error('[UnifiedCapabilityService] Failed to fetch capabilities:', result.error);
            return null;
          }
          return result.data?.data || null;
        } else {
          const endpoint = `/api/tenants/${tenantId}/effective-capabilities`;
          const result = await this.makeDefaultRequest<{ success: boolean; data: BackendEffectiveCapabilities }>(
            endpoint,
            {},
            cachekey,
            this.CACHE_TTL,
            {
              context: AppContext.TENANT,
              isolation: CacheIsolation.TENANT,
              requestType: RequestType.AUTHENTICATED,
              ssrAuth
            }
          );
          if (!result.success) {
            console.error('[UnifiedCapabilityService] Failed to fetch capabilities:', result.error);
            return null;
          }
          return result.data?.data || null;
        }
      } catch (error) {
        console.error('[UnifiedCapabilityService] Error fetching capabilities:', error);
        return null;
      } finally {
        this.inFlight.delete(cachekey);
      }
    })();

    this.inFlight.set(cachekey, promise);
    return promise;
  }

  async getAllCapabilities(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<AllCapabilitiesState> {
    const cacheKey = `${tenantId}${options?.isPublic ? '-public' : '-auth'}`;
    const cached = this.capCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const raw = await this.fetchEffective(tenantId, options);
    if (!raw) {
      throw new Error(`[UnifiedCapabilityService] Unable to resolve capabilities for tenant: ${tenantId}`);
    }

    const mapped = mapAll(raw);
    this.capCache.set(cacheKey, { data: mapped, expiry: Date.now() + this.CACHE_TTL });
    return mapped;
  }

  async getCommerceState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<CommerceState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.commerce;
  }

  async getPaymentGatewayState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<PaymentGatewayState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.paymentGateway;
  }

  async getStorefrontState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.storefront;
  }

  async getBarcodeScanState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<BarcodeScanState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.barcodeScan;
  }

  async getFulfillmentState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<FulfillmentState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.fulfillment;
  }

  async getProductOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<ProductOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.productOptions;
  }

  async getProductTypeState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<ProductTypeState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.productType;
  }

  /** Alias for backward compatibility with old PublicProductOptionsService */
  async getProductOptionFlags(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<ProductOptionsState> {
    return this.getProductOptionsState(tenantId, options);
  }

  async getFeaturedOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<FeaturedOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.featuredOptions;
  }

  async getIntegrationOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<IntegrationOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.integrationOptions;
  }

  async getQuickstartOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<QuickstartOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.quickstartOptions;
  }

  async getStorefrontOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.storefrontOptions;
  }

  async getStorefrontQrState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontQrState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.storefrontQr;
  }

  async getStorefrontGalleryState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontGalleryState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.storefrontGallery;
  }

  async getStorefrontHoursState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontHoursState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.storefrontHours;
  }

  async getDirectoryEntryOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<DirectoryEntryOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.directoryEntryOptions;
  }

  /** Compatibility alias for old PublicStorefrontOptionsService.
   *  Overlays QR/Gallery/Hours from dedicated domain states onto the legacy flags. */
  async getStorefrontOptionFlags(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<StorefrontOptionFlags> {
    const all = await this.getAllCapabilities(tenantId, options);
    const flags = toStorefrontOptionFlags(all.storefrontOptions);

    // Overlay QR from dedicated storefront_qr domain
    if (all.storefrontQr) {
      flags.showQRCodes = all.storefrontQr.canUseQRCodes;
      flags.showQRStyled = all.storefrontQr.qrStyledEnabled;
      flags.qrResolutions = all.storefrontQr.allowedQRResolutions as unknown as string[];
      flags.allowedQRDotStyles = all.storefrontQr.allowedQRDotStyles as unknown as string[];
      flags.allowedQRCornerStyles = all.storefrontQr.allowedQRCornerStyles as unknown as string[];
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
      flags.qrDotColor = qrPrefs?.qr_dot_color;
      flags.qrCornerColor = qrPrefs?.qr_corner_color;
      flags.qrBgColor = qrPrefs?.qr_bg_color;
      flags.qrGradientEnabled = qrPrefs?.qr_gradient_enabled;
      flags.qrGradientStart = qrPrefs?.qr_gradient_start;
      flags.qrGradientEnd = qrPrefs?.qr_gradient_end;
    }

    // Overlay Gallery from dedicated storefront_gallery domain
    if (all.storefrontGallery) {
      flags.galleryDisplayMode = all.storefrontGallery.galleryDisplayMode;
      flags.canUseMagazineGallery = all.storefrontGallery.canUseMagazineGallery;
      if (all.storefrontGallery.defaultGalleryLimit) {
        flags.galleryLimit = all.storefrontGallery.defaultGalleryLimit;
      }
    }

    // Overlay Hours from dedicated storefront_hours domain
    if (all.storefrontHours) {
      flags.showHoursDisplay = all.storefrontHours.canShowHoursDisplay;
      flags.showAnimatedHours = all.storefrontHours.canUseAnimatedHours;
      flags.showHoursStatus = all.storefrontHours.canShowHoursStatus;
    }

    return flags;
  }

  async getFaqOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<FaqOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.faqOptions;
  }

  /** Compatibility alias for old PublicFaqService */
  async getFaqOptionsFlags(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<PublicFaqOptionsFlags> {
    const state = await this.getFaqOptionsState(tenantId, options);
    return toPublicFaqOptionsFlags(state);
  }

  async getCrmOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<CrmOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.crmOptions;
  }

  /** Compatibility alias for old PublicCrmService */
  async getCrmOptionsFlags(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<PublicCrmOptionsFlags> {
    const state = await this.getCrmOptionsState(tenantId, options);
    return toPublicCrmOptionsFlags(state);
  }

  async getChatbotOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<ChatbotOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.chatbotOptions;
  }

  async getSocialCommerceOptionsState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<SocialCommerceOptionsState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.socialCommerceOptions;
  }

  async getDirectoryPromotionState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<DirectoryPromotionState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.directoryPromotion;
  }

  async getPlatformServicesState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<PlatformServicesState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.platformServices;
  }

  async getWholesaleMatchingState(tenantId: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<WholesaleMatchingState> {
    const all = await this.getAllCapabilities(tenantId, options);
    return all.wholesaleMatching;
  }

  async checkFeatureByCapability(tenantId: string, featureKey: string, options?: { isPublic?: boolean; ssrAuth?: SsrAuth }): Promise<boolean | null> {
    const capType = getCapabilityTypeForFeature(featureKey);
    if (!capType) return null;

    const all = await this.getAllCapabilities(tenantId, options);
    const capGroup = (all as any)[capType] as { features: Record<string, boolean> } | undefined;
    if (!capGroup) return false;

    return !!capGroup.features[featureKey];
  }

}

// Lightweight feature prefix mapper (mirrors CapabilityResolutionService)
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
};

function getCapabilityTypeForFeature(featureKey: string): string | null {
  for (const [prefix, capType] of Object.entries(CAPABILITY_FEATURE_PREFIXES)) {
    if (featureKey.startsWith(prefix)) return capType;
  }
  return null;
}

export const unifiedCapabilityService = UnifiedCapabilityService.getInstance();
export default UnifiedCapabilityService;
