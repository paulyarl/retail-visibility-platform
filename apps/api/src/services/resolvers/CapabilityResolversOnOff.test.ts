import { describe, it, expect } from 'vitest';
import { resolveProductOptions } from './ProductOptionsResolver';
import { resolveChatbotOptions } from './ChatbotOptionsResolver';
import { resolveQuickstartOptions } from './QuickstartOptionsResolver';
import { resolveFeaturedOptions } from './FeaturedOptionsResolver';
import { resolveIntegrationOptions } from './IntegrationOptionsResolver';
import { resolveCrmOptions } from './CrmOptionsResolver';
import { resolveFaqOptions } from './FaqOptionsResolver';
import { resolveStorefrontOptions } from './StorefrontOptionsResolver';
import { resolveSocialCommerceOptions } from './SocialCommerceOptionsResolver';
import { resolveDirectoryEntryOptions } from './DirectoryEntryOptionsResolver';

describe('Phase 5 resolvers _on/_off fallback', () => {
  describe('ProductOptionsResolver', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = resolveProductOptions({
        product_options_enabled: true,
        product_options_creation_on: true,
        product_options_creation_enabled: false,
        product_options_creation_off: false,
        product_options_creation_disabled: false,
      }, {});
      expect(result.creation_enabled).toBe(true);
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = resolveProductOptions({
        product_options_enabled: true,
        product_options_layout_enabled: true,
      }, {});
      expect(result.layout_enabled).toBe(true);
      expect(result.allowed_layouts).toContain('classic');
    });
  });

  describe('ChatbotOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveChatbotOptions({
        chatbot_enabled: true,
        chatbot_static_on: true,
        chatbot_dynamic_on: true,
        chatbot_skills_on: true,
        chatbot_kb_on: true,
        chatbot_widget_on: true,
      }, {});
      expect(onResult.static_enabled).toBe(true);
      expect(onResult.dynamic_enabled).toBe(true);
      expect(onResult.skills_enabled).toBe(true);
      expect(onResult.kb_enabled).toBe(true);
      expect(onResult.widget_enabled).toBe(true);

      const legacyResult = resolveChatbotOptions({
        chatbot_enabled: true,
        chatbot_static_enabled: true,
        chatbot_dynamic_enabled: false,
        chatbot_skills_enabled: false,
        chatbot_kb_enabled: false,
        chatbot_widget_enabled: true,
      }, {});
      expect(legacyResult.static_enabled).toBe(true);
      expect(legacyResult.widget_enabled).toBe(true);
    });
  });

  describe('QuickstartOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveQuickstartOptions({
        quickstart_enabled: true,
        quickstart_product_on: true,
        quickstart_category_on: true,
        quickstart_ai_on: true,
      }, {});
      expect(onResult.product_enabled).toBe(true);
      expect(onResult.category_enabled).toBe(true);
      expect(onResult.ai_enabled).toBe(true);
      expect(onResult.allowed_product_types).toContain('wizard');
      expect(onResult.allowed_category_types).toContain('category_generator');
      expect(onResult.allowed_ai_types).toContain('ai_openai');

      const legacyResult = resolveQuickstartOptions({
        quickstart_enabled: true,
        quickstart_product_enabled: true,
        quickstart_category_enabled: true,
        quickstart_ai_enabled: true,
      }, {});
      expect(legacyResult.product_enabled).toBe(true);
      expect(legacyResult.allowed_ai_types).toContain('image_hd');
    });
  });

  describe('FeaturedOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveFeaturedOptions({
        featured_enabled: true,
        featured_tenant_on: true,
        featured_platform_on: true,
      }, {});
      expect(onResult.enabled).toBe(true);
      expect(onResult.allowed_tenant_types).toContain('new_arrival');
      expect(onResult.allowed_platform_types).toContain('bestseller');

      const legacyResult = resolveFeaturedOptions({
        featured_enabled: true,
        featured_tenant_enabled: true,
        featured_platform_enabled: true,
      }, {});
      expect(legacyResult.allowed_tenant_types).toContain('sale');
      expect(legacyResult.allowed_platform_types).toContain('recommended');
    });
  });

  describe('IntegrationOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveIntegrationOptions({
        integration_enabled: true,
        integration_pos_on: true,
        integration_google_on: true,
      }, {});
      expect(onResult.pos_enabled).toBe(true);
      expect(onResult.google_enabled).toBe(true);
      expect(onResult.allowed_pos_types).toContain('clover');
      expect(onResult.allowed_google_types).toContain('gbp');

      const legacyResult = resolveIntegrationOptions({
        integration_enabled: true,
        integration_pos_enabled: true,
        integration_google_enabled: true,
      }, {});
      expect(legacyResult.allowed_pos_types).toContain('square');
      expect(legacyResult.allowed_google_types).toContain('gmc_sync');
    });
  });

  describe('CrmOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveCrmOptions({
        crm_enabled: true,
        crm_inquiry_product_on: true,
        crm_inquiry_storefront_on: true,
        crm_inquiry_directory_on: true,
      }, {});
      expect(onResult.inquiry_product_enabled).toBe(true);
      expect(onResult.inquiry_storefront_enabled).toBe(true);
      expect(onResult.inquiry_directory_enabled).toBe(true);
      expect(onResult.allowed_inquiry_types).toContain('crm_inquiry_product_on');
      expect(onResult.allowed_inquiry_types).toContain('crm_inquiry_storefront_on');
      expect(onResult.allowed_inquiry_types).toContain('crm_inquiry_directory_on');

      const legacyResult = resolveCrmOptions({
        crm_enabled: true,
        crm_inquiry_product_enabled: true,
        crm_inquiry_storefront_enabled: true,
        crm_inquiry_directory_enabled: true,
      }, {});
      expect(legacyResult.inquiry_product_enabled).toBe(true);
      expect(legacyResult.allowed_inquiry_types).toContain('crm_inquiry_product_enabled');
    });
  });

  describe('FaqOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveFaqOptions({
        faq_enabled: true,
        faq_storefront_on: true,
        faq_product_on: true,
        faq_templates_on: true,
        faq_management_on: true,
        faq_preview_on: true,
        faq_display_on: true,
        faq_kb_on: true,
      }, {});
      expect(onResult.storefront_enabled).toBe(true);
      expect(onResult.product_enabled).toBe(true);
      expect(onResult.templates_enabled).toBe(true);
      expect(onResult.management_enabled).toBe(true);
      expect(onResult.preview_enabled).toBe(true);
      expect(onResult.display_enabled).toBe(true);
      expect(onResult.kb_enabled).toBe(true);
      expect(onResult.allowed_management_types).toContain('faq_management_hub');
      expect(onResult.allowed_kb_types).toContain('faq_kb_rag_retrieval');

      const legacyResult = resolveFaqOptions({
        faq_enabled: true,
        faq_storefront_enabled: true,
        faq_product_enabled: true,
        faq_templates_enabled: true,
        faq_management_enabled: true,
        faq_preview_enabled: true,
        faq_display_enabled: true,
        faq_kb_enabled: true,
      }, {});
      expect(legacyResult.allowed_display_types).toContain('faq_display_storefront_accordion');
    });
  });

  describe('StorefrontOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveStorefrontOptions({
        storefront_opt_enabled: true,
        storefront_opt_hours_on: true,
        storefront_opt_category_on: true,
        storefront_opt_recommend_on: true,
        storefront_opt_info_on: true,
        storefront_opt_qr_on: true,
        storefront_opt_gallery_on: true,
        storefront_opt_advanced_on: true,
        storefront_opt_layout_on: true,
      }, {});
      expect(onResult.hours_enabled).toBe(true);
      expect(onResult.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
      expect(onResult.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
      expect(onResult.allowed_qr_resolutions).toContain('qr_codes_1024');
      expect(onResult.allowed_gallery_types).toContain('image_gallery_10');
      expect(onResult.advanced_enabled).toBe(true);
      expect(onResult.info_enabled).toBe(true);

      const legacyResult = resolveStorefrontOptions({
        storefront_opt_enabled: true,
        storefront_opt_hours_enabled: true,
        storefront_opt_layout_enabled: true,
      }, {});
      expect(legacyResult.allowed_hours_types).toEqual(['hours_animated', 'hours_status']);
      expect(legacyResult.allowed_layouts).toEqual(['classic', 'editorial', 'immersive']);
    });
  });

  describe('SocialCommerceOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveSocialCommerceOptions({
        social_commerce_enabled: true,
        social_commerce_meta_on: true,
        social_commerce_tiktok_on: true,
      }, { social_commerce_meta_catalog: true, social_commerce_tiktok_shop: true } as any);
      expect(onResult.meta_enabled).toBe(true);
      expect(onResult.tiktok_enabled).toBe(true);
      expect(onResult.allowed_meta_types).toContain('social_commerce_meta_catalog');
      expect(onResult.allowed_tiktok_types).toContain('social_commerce_tiktok_shop');

      const legacyResult = resolveSocialCommerceOptions({
        social_commerce_enabled: true,
        social_commerce_meta_enabled: true,
        social_commerce_tiktok_enabled: true,
      }, { social_commerce_meta_catalog: true, social_commerce_tiktok_shop: true } as any);
      expect(legacyResult.meta_enabled).toBe(true);
      expect(legacyResult.tiktok_enabled).toBe(true);
    });
  });

  describe('DirectoryEntryOptionsResolver', () => {
    it('uses _on group keys and falls back to _enabled', () => {
      const onResult = resolveDirectoryEntryOptions({
        directory_entry_enabled: true,
        directory_entry_layout_on: true,
        directory_entry_hours_on: true,
        directory_entry_map_on: true,
        directory_entry_contact_on: true,
        directory_entry_gallery_on: true,
        directory_entry_qr_on: true,
        directory_entry_social_on: true,
        directory_entry_seo_on: true,
      }, { hours_display: true, map_display: true, storefront_contact: true, storefront_social_media: true, enhanced_seo: true } as any);
      expect(onResult.layout_enabled).toBe(true);
      expect(onResult.allowed_layouts).toContain('premium');
      expect(onResult.hours_enabled).toBe(true);
      expect(onResult.map_enabled).toBe(true);
      expect(onResult.contact_enabled).toBe(true);
      expect(onResult.social_enabled).toBe(true);
      expect(onResult.seo_enabled).toBe(true);

      const legacyResult = resolveDirectoryEntryOptions({
        directory_entry_enabled: true,
        directory_entry_layout_enabled: true,
        directory_entry_hours_enabled: true,
      }, { hours_display: true } as any);
      expect(legacyResult.allowed_layouts).toContain('immersive');
      expect(legacyResult.hours_enabled).toBe(true);
    });
  });
});
