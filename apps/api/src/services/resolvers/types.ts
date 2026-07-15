/**
 * Effective Capability Resolver — Types
 *
 * Shared types for the unified capabilities resolution system.
 * These mirror the frontend CapabilityResolutionService interfaces
 * but are server-native and omit client-only fields.
 */

// ====================
// CORE
// ====================

export interface TierInfo {
  key: string;
  name: string;
  description: string;
}

export interface CapabilityGroup {
  capability_enabled: boolean;
  is_highlighted: boolean;
  features: Record<string, boolean>;
}

export interface RawCapabilitiesInput {
  tier_key: string;
  tier_name: string;
  tier_description: string;
  capabilities: Record<string, CapabilityGroup>;
  uncategorized_features: string[];
  purchased_feature_keys?: string[];
  override_feature_keys?: string[];
}

// ====================
// MERCHANT SETTINGS (flat union of all settings tables)
// ====================

export interface MerchantSettingsBundle {
  commerce: CommerceMerchantSettings | null;
  paymentGateway: PaymentGatewayMerchantSettings | null;
  storefrontType: StorefrontTypeMerchantSettings | null;
  fulfillment: FulfillmentMerchantSettings | null;
  productType: ProductTypeMerchantSettings | null;
  productOptions: ProductOptionsMerchantSettings | null;
  featuredOptions: FeaturedOptionsMerchantSettings | null;
  integrationOptions: IntegrationOptionsMerchantSettings | null;
  quickstartOptions: QuickstartOptionsMerchantSettings | null;
  storefrontOptions: StorefrontOptionsMerchantSettings | null;
  storefrontQr: StorefrontQrMerchantSettings | null;
  storefrontGallery: StorefrontGalleryMerchantSettings | null;
  storefrontHours: StorefrontHoursMerchantSettings | null;
  storefrontLayouts: StorefrontLayoutMerchantSettings | null;
  storefrontMaps: StorefrontMapsMerchantSettings | null;
  directoryEntry: DirectoryEntryMerchantSettings | null;
  faqOptions: FaqOptionsMerchantSettings | null;
  crmOptions: CrmOptionsMerchantSettings | null;
  chatbotOptions: ChatbotOptionsMerchantSettings | null;
  barcodeScan: BarcodeScanMerchantSettings | null;
  socialCommerceOptions: SocialCommerceOptionsMerchantSettings | null;
  wholesaleMatching: WholesaleMatchingMerchantSettings | null;
}

export interface CommerceMerchantSettings {
  deposit_enabled?: boolean | null;
  full_payment_enabled?: boolean | null;
  deposit_percentage?: number | null;
  deposit_min_cents?: number | null;
  deposit_max_cents?: number | null;
  auto_confirm_orders?: boolean | null;
  order_confirmation_minutes?: number | null;
  show_payment_options?: boolean | null;
  require_payment_upfront?: boolean | null;
  allow_payment_on_pickup?: boolean | null;
  notify_on_payment?: boolean | null;
  notify_on_deposit?: boolean | null;
  notify_on_fulfillment?: boolean | null;
}

export interface PaymentGatewayMerchantSettings {
  gateway_enabled?: boolean | null;
  stripe_enabled?: boolean | null;
  paypal_enabled?: boolean | null;
  square_enabled?: boolean | null;
  clover_enabled?: boolean | null;
}

export interface StorefrontTypeMerchantSettings {
  storefront_type_enabled?: boolean | null;
  selected_storefront_type?: string | null;
}

export interface FulfillmentMerchantSettings {
  pickup_enabled?: boolean | null;
  pickup_instructions?: string | null;
  pickup_ready_time_minutes?: number | null;
  delivery_enabled?: boolean | null;
  delivery_radius_miles?: number | null;
  delivery_fee_cents?: number | null;
  delivery_min_free_cents?: number | null;
  delivery_time_hours?: number | null;
  shipping_enabled?: boolean | null;
  shipping_flat_rate_cents?: number | null;
  shipping_min_free_cents?: number | null;
  shipping_handling_days?: number | null;
}

export interface ProductTypeMerchantSettings {
  product_types_enabled?: boolean | null;
  selected_product_type?: string | null;
  selected_product_types?: string[] | null;
}

export interface ProductOptionsMerchantSettings {
  product_variant_enabled?: boolean | null;
  product_gallery_enabled?: boolean | null;
  product_video_enabled?: boolean | null;
  product_layout?: string | null;
  product_opt_recently_viewed?: boolean | null;
  product_opt_qr_codes?: boolean | null;
  product_opt_qr_logo?: boolean | null;
  product_opt_recommended?: boolean | null;
  product_opt_map_display?: boolean | null;
  product_opt_location_display?: boolean | null;
  product_opt_hours_display?: boolean | null;
  product_opt_enhanced_seo?: boolean | null;
  product_opt_reviews?: boolean | null;
  product_opt_fulfillment?: boolean | null;
  product_opt_categories?: boolean | null;
  product_opt_location_availability?: boolean | null;
  product_opt_supplier_catalog?: boolean | null;
  product_options_enabled?: boolean | null;
  product_options_disabled?: boolean | null;
  page_type?: string | null;
}

export interface FeaturedOptionsMerchantSettings {
  featured_enabled?: boolean | null;
  featured_store_selection?: boolean | null;
  featured_new_arrival?: boolean | null;
  featured_seasonal?: boolean | null;
  featured_sale?: boolean | null;
  featured_staff_pick?: boolean | null;
  featured_clearance?: boolean | null;
  featured_featured?: boolean | null;
  featured_bestseller?: boolean | null;
  featured_trending?: boolean | null;
  featured_recommended?: boolean | null;
  featured_random_featured?: boolean | null;
  featured_expiry_monitor?: boolean | null;
}

export interface IntegrationOptionsMerchantSettings {
  integration_enabled?: boolean | null;
  integration_clover?: boolean | null;
  integration_square?: boolean | null;
  integration_gbp?: boolean | null;
  integration_google_shopping?: boolean | null;
  integration_google_merchant_center?: boolean | null;
  integration_gmc_sync?: boolean | null;
}

export interface QuickstartOptionsMerchantSettings {
  quickstart_enabled?: boolean | null;
  quickstart_wizard?: boolean | null;
  quickstart_image_gen?: boolean | null;
  quickstart_category_generator?: boolean | null;
  quickstart_wizard_ai?: boolean | null;
  quickstart_ai_openai?: boolean | null;
  quickstart_ai_gemini?: boolean | null;
  quickstart_image_hd?: boolean | null;
  default_text_model?: string | null;
  default_image_model?: string | null;
  default_image_quality?: string | null;
}

export interface StorefrontGalleryMerchantSettings {
  gallery_enabled?: boolean | null;
  gallery_display_mode?: string | null;
  image_gallery_5?: boolean | null;
  image_gallery_10?: boolean | null;
  image_gallery_15?: boolean | null;
  default_gallery_limit?: number | null;
}

export interface StorefrontHoursMerchantSettings {
  hours_enabled?: boolean | null;
  hours_display?: boolean | null;
  hours_animated?: boolean | null;
  hours_status?: boolean | null;
}

export interface StorefrontQrMerchantSettings {
  qr_enabled?: boolean | null;
  qr_classic_enabled?: boolean | null;
  qr_styled_enabled?: boolean | null;
  qr_dot_type?: string | null;
  qr_corner_type?: string | null;
  qr_dot_color?: string | null;
  qr_corner_color?: string | null;
  qr_bg_color?: string | null;
  qr_gradient_enabled?: boolean | null;
  qr_gradient_start?: string | null;
  qr_gradient_end?: string | null;
  qr_codes_512?: boolean | null;
  qr_codes_1024?: boolean | null;
  qr_codes_2048?: boolean | null;
  default_qr_resolution?: string | null;
  qr_product?: boolean | null;
  qr_store?: boolean | null;
  qr_logo?: boolean | null;
  qr_directory?: boolean | null;
}

export interface StorefrontOptionsMerchantSettings {
  storefront_opt_enabled?: boolean | null;
  map_display?: boolean | null;
  location_display?: boolean | null;
  category_store?: boolean | null;
  category_product?: boolean | null;
  recommend_store?: boolean | null;
  recommend_products?: boolean | null;
  recently_viewed?: boolean | null;
  storefront_social_media?: boolean | null;
  storefront_contact?: boolean | null;
  interactive_maps?: boolean | null;
  enhanced_seo?: boolean | null;
  storefront_actions?: boolean | null;
}

export interface StorefrontLayoutMerchantSettings {
  layouts_enabled?: boolean | null;
  storefront_layout?: string | null;
}

export interface DirectoryEntryMerchantSettings {
  directory_entry_opt_enabled?: boolean | null;
  directory_entry_layout?: string | null;
  hours_display?: boolean | null;
  map_display?: boolean | null;
  location_display?: boolean | null;
  storefront_social_media?: boolean | null;
  storefront_contact?: boolean | null;
  interactive_maps?: boolean | null;
  enhanced_seo?: boolean | null;
  external_link_enabled?: boolean | null;
  gallery_display_mode?: string | null;
}

export type DirectoryEntryLayoutType = 'classic' | 'editorial' | 'immersive' | 'premium';

export interface FaqOptionsMerchantSettings {
  faq_enabled?: boolean | null;
}

export interface CrmOptionsMerchantSettings {
  crm_enabled?: boolean | null;
}

// CRM group-gate feature keys are tracked as tier features; these types reflect the
// canonical _on naming and legacy _enabled aliases used in allowed_inquiry_types.

export interface ChatbotOptionsMerchantSettings {
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
}

export interface BarcodeScanMerchantSettings {
  barcode_scan_enabled?: boolean | null;
  barcode_manual_enabled?: boolean | null;
  barcode_usb_enabled?: boolean | null;
  barcode_camera_enabled?: boolean | null;
  default_scan_mode?: string | null;
}

export interface SocialCommerceOptionsMerchantSettings {
  social_commerce_enabled?: boolean | null;
  social_commerce_meta_on?: boolean | null;
  social_commerce_meta_enabled?: boolean | null;
  social_commerce_meta_catalog?: boolean | null;
  social_commerce_meta_shop?: boolean | null;
  social_commerce_meta_pixel?: boolean | null;
  social_commerce_tiktok_on?: boolean | null;
  social_commerce_tiktok_enabled?: boolean | null;
  social_commerce_tiktok_catalog?: boolean | null;
  social_commerce_tiktok_shop?: boolean | null;
  social_commerce_tiktok_pixel?: boolean | null;
  social_commerce_share_buttons?: boolean | null;
  social_commerce_social_proof?: boolean | null;
  social_commerce_abandoned_cart?: boolean | null;
}

// ====================
// EFFECTIVE (RESOLVED) STATE
// ====================

export type CommercePaymentType = 'full' | 'deposit' | 'flexible' | 'none';

export interface EffectiveCommerce {
  enabled: boolean;
  cart_visible: boolean;
  payment_type: CommercePaymentType;
  effective_payment_type: CommercePaymentType;
  effective_cart_visible: boolean;
  checkout_available: boolean;
  checkout_mode: { mode: 'deposit_only' | 'full_payment_only' | 'flexible' | 'disabled'; deposit_percentage?: number; deposit_min_cents?: number; deposit_max_cents?: number };
  /** Merchant preference state preserved for settings pages */
  merchant_preferences: { deposit_enabled: boolean; full_payment_enabled: boolean };
  is_flexible: boolean;
}

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';

export interface EffectivePaymentGateway {
  enabled: boolean;
  allowed_gateways: GatewayType[];
  effective_gateways: GatewayType[];
  checkout_available: boolean;
  merchant_preferences: { gateway_enabled: boolean; stripe_enabled: boolean; paypal_enabled: boolean; square_enabled: boolean; clover_enabled: boolean };
  is_flexible: boolean;
}

export type StorefrontTypeValue = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

export interface EffectiveStorefront {
  enabled: boolean;
  type: StorefrontTypeValue;
  effective_type: StorefrontTypeValue;
  is_flexible: boolean;
  allowed_types: StorefrontTypeValue[];
  has_merchant_selection: boolean;
  policies_enabled: boolean;
  merchant_preferences: { storefront_type_enabled: boolean; selected_storefront_type: StorefrontTypeValue };
}

export type BarcodeScanMode = 'scan' | 'manual' | 'usb' | 'camera' | 'none';

export interface EffectiveBarcodeScan {
  enabled: boolean;
  allowed_modes: BarcodeScanMode[];
  effective_modes: BarcodeScanMode[];
  is_flexible: boolean;
  scan_available: boolean;
  effective_scan_available: boolean;
  merchant_preferences: { barcode_scan_enabled: boolean; barcode_manual_enabled: boolean; barcode_usb_enabled: boolean; barcode_camera_enabled: boolean };
}

export interface EffectiveFulfillment {
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
  /** Delivery configuration from merchant settings */
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  /** Shipping configuration from merchant settings */
  shipping_flat_rate_cents: number | null;
  shipping_min_free_cents: number | null;
  shipping_handling_days: number;
  /** Pickup configuration from merchant settings */
  pickup_ready_time_minutes: number;
  pickup_instructions: string | null;
}

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';
export type ProductTypeValue = ProductType | 'flexible' | 'none';
export type ProductLayoutType = 'classic' | 'editorial' | 'immersive';

export interface EffectiveProductType {
  enabled: boolean;
  type: ProductTypeValue;
  effective_type: ProductTypeValue;
  effective_types: ProductType[];
  is_flexible: boolean;
  allowed_types: ProductType[];
  has_merchant_selection: boolean;
  merchant_preferences: {
    product_types_enabled: boolean;
    selected_product_type: ProductTypeValue;
    selected_product_types: ProductType[];
  };
}

export interface EffectiveProductOptions {
  enabled: boolean;
  // ── Creation group ──
  creation_enabled: boolean;
  shows_variants: boolean;
  shows_gallery: boolean;
  shows_video: boolean;
  effective_shows_variants: boolean;
  effective_shows_gallery: boolean;
  effective_shows_video: boolean;
  // ── Layout group ──
  layout_enabled: boolean;
  allowed_layouts: ProductLayoutType[];
  effective_layout: ProductLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  // ── Sections group ──
  sections_enabled: boolean;
  shows_recently_viewed: boolean;
  shows_qr_codes: boolean;
  shows_qr_logo: boolean;
  shows_recommended: boolean;
  shows_map_display: boolean;
  shows_location_display: boolean;
  shows_hours_display: boolean;
  shows_enhanced_seo: boolean;
  shows_reviews: boolean;
  shows_fulfillment: boolean;
  shows_categories: boolean;
  shows_location_availability: boolean;
  // ── Effective section flags (tier-allowed AND merchant-enabled) ──
  effective_shows_recently_viewed: boolean;
  effective_shows_qr_codes: boolean;
  effective_shows_qr_logo: boolean;
  effective_shows_recommended: boolean;
  effective_shows_map_display: boolean;
  effective_shows_location_display: boolean;
  effective_shows_hours_display: boolean;
  effective_shows_enhanced_seo: boolean;
  effective_shows_reviews: boolean;
  effective_shows_fulfillment: boolean;
  effective_shows_categories: boolean;
  effective_shows_location_availability: boolean;
  // ── Supplier catalog (creation group) ──
  shows_supplier_catalog: boolean;
  effective_shows_supplier_catalog: boolean;
  merchant_preferences: Record<string, any>;
  is_flexible: boolean;
}

export type FeaturedType =
  | 'store_selection' | 'new_arrival' | 'seasonal' | 'sale'
  | 'staff_pick' | 'clearance' | 'featured'
  | 'bestseller' | 'trending' | 'recommended' | 'random_featured';

export interface EffectiveFeatured {
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

export type IntegrationType =
  | 'clover' | 'square' | 'gbp'
  | 'google_shopping' | 'google_merchant_center' | 'gmc_sync'
  | 'propagation_gbp';

export interface EffectiveIntegrations {
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

export type QuickstartProductType = 'wizard' | 'image_gen';
export type QuickstartCategoryType = 'category_generator';
export type QuickstartAIType = 'ai_openai' | 'ai_gemini' | 'wizard_ai' | 'image_hd';

export interface EffectiveQuickstart {
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

export interface EffectiveDirectoryEntryOptions {
  enabled: boolean;
  is_flexible: boolean;
  layout_enabled: boolean;
  allowed_layouts: DirectoryEntryLayoutType[];
  effective_layout: DirectoryEntryLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  can_use_layout_premium: boolean;
  // Section effective flags
  hours_enabled: boolean;
  map_enabled: boolean;
  contact_enabled: boolean;
  gallery_enabled: boolean;
  qr_enabled: boolean;
  social_enabled: boolean;
  seo_enabled: boolean;
  // Tier-gated availability (separate from merchant-gated effective state)
  can_show_hours: boolean;
  can_show_map: boolean;
  can_show_contact: boolean;
  can_show_gallery: boolean;
  can_show_qr: boolean;
  can_show_social: boolean;
  can_show_seo: boolean;
  // External link — tier-gated availability + effective state (tier AND merchant)
  can_show_external_link: boolean;
  external_link_enabled: boolean;
  merchant_preferences: Record<string, any>;
}

export type StorefrontOptHoursType = 'hours_animated' | 'hours_status';
export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact' | 'interactive_maps';
export type StorefrontOptQRResolutionType = 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
export type StorefrontOptQRContentType = 'qr_product' | 'qr_store' | 'qr_logo' | 'qr_directory';
export type StorefrontOptQRDotStyleType = 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type StorefrontOptQRCornerStyleType = 'dot' | 'extra-rounded' | 'rounded';
export type StorefrontOptGalleryType = 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15';
export type StorefrontOptGalleryDisplayMode = 'carousel' | 'magazine';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';
export type StorefrontOptLayoutType = 'classic' | 'editorial' | 'immersive';

export interface EffectiveStorefrontQr {
  enabled: boolean;
  is_flexible: boolean;
  qr_enabled: boolean;
  allowed_qr_resolutions: StorefrontOptQRResolutionType[];
  allowed_qr_content_types: StorefrontOptQRContentType[];
  qr_classic_enabled: boolean;
  qr_styled_enabled: boolean;
  allowed_qr_dot_styles: StorefrontOptQRDotStyleType[];
  allowed_qr_corner_styles: StorefrontOptQRCornerStyleType[];
  qr_custom_colors: boolean;
  qr_gradients: boolean;
  can_use_qr_codes: boolean;
  merchant_preferences: Record<string, any>;
}

export interface EffectiveStorefrontGallery {
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

export interface EffectiveStorefrontHours {
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

export interface EffectiveStorefrontOptions {
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
  can_use_category_store: boolean;
  can_use_category_product: boolean;
  can_use_recommend_store: boolean;
  can_use_recommend_products: boolean;
  can_use_recently_viewed: boolean;
  can_use_social_media: boolean;
  can_use_contact: boolean;
  can_use_enhanced_seo: boolean;
  can_use_storefront_actions: boolean;
  merchant_preferences: Record<string, any>;
}

export type StorefrontLayoutType = 'classic' | 'editorial' | 'immersive';

export interface EffectiveStorefrontLayouts {
  enabled: boolean;
  is_flexible: boolean;
  layout_enabled: boolean;
  allowed_layouts: StorefrontLayoutType[];
  effective_layout: StorefrontLayoutType;
  can_use_layout_classic: boolean;
  can_use_layout_editorial: boolean;
  can_use_layout_immersive: boolean;
  merchant_preferences: { layouts_enabled: boolean; storefront_layout: string };
}

export interface StorefrontMapsMerchantSettings {
  maps_enabled?: boolean | null;
  interactive_maps?: boolean | null;
  map_display?: boolean | null;
  location_display?: boolean | null;
}

export interface EffectiveStorefrontMaps {
  enabled: boolean;
  is_flexible: boolean;
  maps_enabled: boolean;
  can_show_map_display: boolean;
  can_show_location_display: boolean;
  can_use_interactive_maps: boolean;
  merchant_preferences: Record<string, any>;
}

export type FaqManagementType =
  | 'faq_management_hub' | 'faq_management_templates' | 'faq_management_import'
  | 'faq_management_wizard_inline' | 'faq_management_bulk_actions'
  | 'faq_management_reorder' | 'faq_management_search';

export type FaqPreviewType =
  | 'faq_preview_bot' | 'faq_preview_gap_report' | 'faq_preview_auto_suggest';

export type FaqDisplayType =
  | 'faq_display_storefront_accordion' | 'faq_display_product_accordion'
  | 'faq_display_search_overlay' | 'faq_display_feedback'
  | 'faq_display_bot_handoff' | 'faq_display_markdown' | 'faq_display_deep_link';

export type FaqKnowledgeBaseType =
  | 'faq_kb_static_lookup' | 'faq_kb_rag_retrieval' | 'faq_kb_product_scoped'
  | 'faq_kb_auto_sync' | 'faq_kb_coverage_metrics';

export interface EffectiveFaq {
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
  merchant_preferences: FaqOptionsMerchantSettings | null;
}

export type CrmInquiryType =
  | 'crm_inquiry_product_on' | 'crm_inquiry_product_enabled'
  | 'crm_inquiry_storefront_on' | 'crm_inquiry_storefront_enabled'
  | 'crm_inquiry_directory_on' | 'crm_inquiry_directory_enabled'
  | 'crm_inquiry_anonymous'
  | 'crm_inquiry_customer' | 'crm_inquiry_assignment' | 'crm_inquiry_auto_response';

export type CrmContactType = 'crm_contact_management' | 'crm_contact_import' | 'crm_contact_sync';
export type CrmTicketType = 'crm_ticket_priority' | 'crm_ticket_assignment' | 'crm_ticket_templates' | 'crm_ticket_escalation';
export type CrmMessageType = 'crm_message_rich_text' | 'crm_message_attachments' | 'crm_message_templates';
export type CrmCustomerTicketType = 'crm_customer_tickets';
export type CrmDashboardType = 'crm_dashboard_analytics' | 'crm_requests_hub';

export interface EffectiveCrm {
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
  merchant_preferences: CrmOptionsMerchantSettings | null;
}

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

export interface EffectiveChatbot {
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
  merchant_preferences: ChatbotOptionsMerchantSettings | null;
}

// ====================
// SOCIAL COMMERCE OPTIONS
// ====================

export type SocialCommerceMetaType =
  | 'social_commerce_meta_catalog' | 'social_commerce_meta_shop' | 'social_commerce_meta_pixel';

export type SocialCommerceTikTokType =
  | 'social_commerce_tiktok_catalog' | 'social_commerce_tiktok_shop' | 'social_commerce_tiktok_pixel';

export type SocialCommerceExperienceType =
  | 'social_commerce_share_buttons' | 'social_commerce_social_proof' | 'social_commerce_abandoned_cart';

export interface EffectiveSocialCommerceOptions {
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

// ====================
// ORGANIZATION OPTIONS
// ====================

export type OrgTabKey =
  | 'overview' | 'locations' | 'propagation' | 'capabilities'
  | 'team' | 'commerce' | 'billing';

export type OrgPanelKey =
  | 'task_checklist' | 'quick_links' | 'system_status'
  | 'recommendations' | 'crm_summary';

export type OrgPropagationType =
  | 'org_propagation_products' | 'org_propagation_categories'
  | 'org_propagation_business_info' | 'org_propagation_settings';

export interface EffectiveOrgOptions {
  enabled: boolean;
  is_flexible: boolean;
  allowed_tabs: OrgTabKey[];
  allowed_panels: OrgPanelKey[];
  allowed_propagation_types: OrgPropagationType[];
  org_available: boolean;
}

// ====================
// CROSS-CAPABILITY CONSTRAINTS (CCL)
// ====================

export type ConstraintType = 'requires' | 'recommends' | 'excludes' | 'implies';
export type ConstraintSeverity = 'block' | 'warn' | 'info';

export interface ConstraintViolation {
  constraint_id: string;
  type: ConstraintType;
  severity: ConstraintSeverity;
  source_capability: string;
  source_type: string;
  target_capability: string;
  target_type: string;
  message: string;
  resolution_hint: string;
}

export interface ConstraintStatus {
  blocked_types: string[];
  warning_types: string[];
  active_violations: string[];
}

export type ConstraintStatusMap = Record<string, ConstraintStatus>;

// ====================
// DIRECTORY PROMOTION
// ====================

export type PromotionTier = 'basic' | 'premium' | 'featured';

export type WholesaleMatchingTier = 'none' | 'search' | 'full';

export interface EffectiveWholesaleMatching {
  enabled: boolean;
  tier: WholesaleMatchingTier;
  can_check_supplier_match: boolean;
  can_search_faire: boolean;
  can_build_affiliate_link: boolean;
  can_view_brand_partners: boolean;
  is_flexible: boolean;
}

export interface WholesaleMatchingMerchantSettings {
  wholesale_matching_enabled?: boolean | null;
}

// ====================
// PLATFORM SERVICES
// ====================

export type PlatformServiceType =
  | 'logo_design'
  | 'banner_design'
  | 'store_setup'
  | 'profile_setup'
  | 'seo_optimization'
  | 'social_media_kit';

export interface EffectivePlatformServices {
  enabled: boolean;
  allowed_services: PlatformServiceType[];
  can_use_logo_design: boolean;
  can_use_banner_design: boolean;
  can_use_store_setup: boolean;
  can_use_profile_setup: boolean;
  can_use_seo_optimization: boolean;
  can_use_social_media_kit: boolean;
  is_flexible: boolean;
}

export interface EffectiveDirectoryPromotion {
  enabled: boolean;
  allowed_tiers: PromotionTier[];
  is_flexible: boolean;
}

// ====================
// SALES FUNNELS
// ====================

export type FunnelStepType = 'order_bump' | 'upsell' | 'downsell' | 'oto';

export interface EffectiveFunnel {
  enabled: boolean;
  builder_enabled: boolean;
  allowed_steps: FunnelStepType[];
  can_use_order_bump: boolean;
  can_use_upsell: boolean;
  can_use_downsell: boolean;
  can_use_oto: boolean;
  is_flexible: boolean;
}

// ====================
// SUBSCRIPTION CONTEXT
// ====================

export interface SubscriptionContext {
  internalStatus: 'trialing' | 'active' | 'past_due' | 'maintenance' | 'frozen' | 'canceled' | 'expired';
  maintenanceState: 'maintenance' | 'freeze' | null;
  isReadOnly: boolean;   // frozen || canceled || expired
  isLimited: boolean;    // maintenance || past_due
  writable: boolean;     // !isReadOnly (convenience for frontend)
}

// ====================
// TOP-LEVEL RESPONSE
// ====================

export interface EffectiveCapabilities {
  tenant_id: string;
  tier: TierInfo;
  subscription_context: SubscriptionContext;
  effective: {
    commerce: EffectiveCommerce;
    payment_gateway: EffectivePaymentGateway;
    storefront: EffectiveStorefront;
    fulfillment: EffectiveFulfillment;
    product_types: EffectiveProductType;
    product_options: EffectiveProductOptions;
    featured: EffectiveFeatured;
    integrations: EffectiveIntegrations;
    quickstart: EffectiveQuickstart;
    storefront_options: EffectiveStorefrontOptions;
    storefront_qr: EffectiveStorefrontQr;
    storefront_gallery: EffectiveStorefrontGallery;
    storefront_hours: EffectiveStorefrontHours;
    storefront_layouts: EffectiveStorefrontLayouts;
    storefront_maps: EffectiveStorefrontMaps;
    directory_entry: EffectiveDirectoryEntryOptions;
    faq: EffectiveFaq;
    crm: EffectiveCrm;
    chatbot: EffectiveChatbot;
    barcode_scan: EffectiveBarcodeScan;
    org_options: EffectiveOrgOptions;
    social_commerce_options: EffectiveSocialCommerceOptions;
    directory_promotion: EffectiveDirectoryPromotion;
    wholesale_matching: EffectiveWholesaleMatching;
    platform_services: EffectivePlatformServices;
    funnel: EffectiveFunnel;
  };
  constraint_violations: ConstraintViolation[];
  constraint_status: ConstraintStatusMap;
  gates?: {
    tier_hard: Record<string, CapabilityGroup>;
    merchant_soft: Record<string, Record<string, boolean>>;
    org_override?: Record<string, Record<string, boolean>>;
  };
  uncategorized_features: string[];
  purchased_feature_keys?: string[];
}
