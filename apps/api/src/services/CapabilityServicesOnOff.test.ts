import { describe, it, expect } from 'vitest';
import ProductOptionsService from './ProductOptionsService';
import StorefrontOptionsService from './StorefrontOptionsService';
import FaqOptionsService from './FaqOptionsService';
import CrmOptionsService from './CrmOptionsService';
import QuickstartOptionsService from './QuickstartOptionsService';
import FeaturedOptionsService from './FeaturedOptionsService';
import IntegrationOptionsService from './IntegrationOptionsService';

describe('Phase 5 services _on/_off fallback', () => {
  describe('ProductOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = ProductOptionsService.getInstance().resolveFromFeatures({
        product_options_enabled: true,
        product_options_creation_on: true,
        product_options_creation_enabled: false,
        product_options_creation_off: false,
        product_options_creation_disabled: false,
      });
      expect(result.creationEnabled).toBe(true);
      expect(result.showsVariants).toBe(true);
      expect(result.showsGallery).toBe(true);
    });

    it('enables capability when only a group _on gate is present without product_options_enabled', () => {
      const result = ProductOptionsService.getInstance().resolveFromFeatures({
        product_options_creation_on: true,
      });
      expect(result.enabled).toBe(true);
      expect(result.creationEnabled).toBe(true);
      expect(result.showsVariants).toBe(true);
    });

    it('enables capability when only a legacy group _enabled gate is present', () => {
      const result = ProductOptionsService.getInstance().resolveFromFeatures({
        product_options_layout_enabled: true,
      });
      expect(result.enabled).toBe(true);
      expect(result.layoutEnabled).toBe(true);
      expect(result.allowedLayouts).toContain('classic');
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = ProductOptionsService.getInstance().resolveFromFeatures({
        product_options_enabled: true,
        product_options_layout_enabled: true,
      });
      expect(result.layoutEnabled).toBe(true);
      expect(result.allowedLayouts).toContain('classic');
    });

    it('respects _off group keys', () => {
      const result = ProductOptionsService.getInstance().resolveFromFeatures({
        product_options_enabled: true,
        product_options_creation_on: true,
        product_options_creation_off: true,
      });
      expect(result.creationEnabled).toBe(false);
    });
  });

  describe('StorefrontOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = StorefrontOptionsService.getInstance().resolveFromFeatures({
        storefront_opt_enabled: true,
        storefront_opt_category_on: true,
        storefront_opt_category_enabled: false,
        storefront_opt_category_off: false,
        storefront_opt_category_disabled: false,
      });
      expect(result.categoryEnabled).toBe(true);
      expect(result.allowedCategoryTypes).toContain('category_store');
      expect(result.allowedCategoryTypes).toContain('category_product');
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = StorefrontOptionsService.getInstance().resolveFromFeatures({
        storefront_opt_enabled: true,
        storefront_opt_category_enabled: true,
      });
      expect(result.categoryEnabled).toBe(true);
      expect(result.allowedCategoryTypes).toContain('category_store');
    });

    it('respects _off group keys', () => {
      const result = StorefrontOptionsService.getInstance().resolveFromFeatures({
        storefront_opt_enabled: true,
        storefront_opt_category_on: true,
        storefront_opt_category_off: true,
      });
      expect(result.categoryEnabled).toBe(false);
    });
  });

  describe('FaqOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = FaqOptionsService.getInstance().resolveFromFeatures({
        faq_enabled: true,
        faq_management_on: true,
        faq_management_enabled: false,
        faq_management_off: false,
        faq_management_disabled: false,
      });
      expect(result.managementEnabled).toBe(true);
      expect(result.allowedManagementTypes.length).toBeGreaterThan(0);
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = FaqOptionsService.getInstance().resolveFromFeatures({
        faq_enabled: true,
        faq_display_enabled: true,
      });
      expect(result.displayEnabled).toBe(true);
      expect(result.allowedDisplayTypes.length).toBeGreaterThan(0);
    });

    it('respects _off group keys', () => {
      const result = FaqOptionsService.getInstance().resolveFromFeatures({
        faq_enabled: true,
        faq_management_on: true,
        faq_management_off: true,
      });
      expect(result.managementEnabled).toBe(false);
    });
  });

  describe('CrmOptionsService', () => {
    it('prefers _on over legacy _enabled inquiry group gates', () => {
      const result = CrmOptionsService.getInstance().resolveFromFeatures({
        crm_enabled: true,
        crm_inquiry_product_on: true,
        crm_inquiry_product_enabled: false,
      });
      expect(result.inquiryProductEnabled).toBe(true);
    });

    it('falls back to _enabled inquiry group gates when _on is absent', () => {
      const result = CrmOptionsService.getInstance().resolveFromFeatures({
        crm_enabled: true,
        crm_inquiry_storefront_enabled: true,
      });
      expect(result.inquiryStorefrontEnabled).toBe(true);
    });
  });

  describe('QuickstartOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = QuickstartOptionsService.getInstance().resolveFromFeatures({
        quickstart_enabled: true,
        quickstart_product_on: true,
        quickstart_product_enabled: false,
        quickstart_product_off: false,
        quickstart_product_disabled: false,
      });
      expect(result.productEnabled).toBe(true);
      expect(result.allowedProductTypes).toContain('wizard');
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = QuickstartOptionsService.getInstance().resolveFromFeatures({
        quickstart_enabled: true,
        quickstart_category_enabled: true,
      });
      expect(result.categoryEnabled).toBe(true);
      expect(result.allowedCategoryTypes).toContain('category_generator');
    });

    it('respects _off group keys', () => {
      const result = QuickstartOptionsService.getInstance().resolveFromFeatures({
        quickstart_enabled: true,
        quickstart_product_on: true,
        quickstart_product_off: true,
      });
      expect(result.productEnabled).toBe(false);
    });
  });

  describe('FeaturedOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = FeaturedOptionsService.getInstance().resolveFromFeatures({
        featured_enabled: true,
        featured_tenant_on: true,
        featured_tenant_enabled: false,
        featured_tenant_off: false,
        featured_tenant_disabled: false,
      });
      expect(result.tenantEnabled).toBe(true);
      expect(result.allowedTenantTypes).toContain('featured');
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = FeaturedOptionsService.getInstance().resolveFromFeatures({
        featured_enabled: true,
        featured_platform_enabled: true,
      });
      expect(result.platformEnabled).toBe(true);
      expect(result.allowedPlatformTypes).toContain('bestseller');
    });

    it('respects _off group keys', () => {
      const result = FeaturedOptionsService.getInstance().resolveFromFeatures({
        featured_enabled: true,
        featured_tenant_on: true,
        featured_tenant_off: true,
      });
      expect(result.tenantEnabled).toBe(false);
    });
  });

  describe('IntegrationOptionsService', () => {
    it('prefers _on over legacy _enabled group gates', () => {
      const result = IntegrationOptionsService.getInstance().resolveFromFeatures({
        integration_enabled: true,
        integration_pos_on: true,
        integration_pos_enabled: false,
        integration_pos_off: false,
        integration_pos_disabled: false,
      });
      expect(result.posEnabled).toBe(true);
      expect(result.allowedPosTypes).toContain('clover');
    });

    it('falls back to _enabled group gates when _on is absent', () => {
      const result = IntegrationOptionsService.getInstance().resolveFromFeatures({
        integration_enabled: true,
        integration_google_enabled: true,
      });
      expect(result.googleEnabled).toBe(true);
      expect(result.allowedGoogleTypes).toContain('gbp');
    });

    it('respects _off group keys', () => {
      const result = IntegrationOptionsService.getInstance().resolveFromFeatures({
        integration_enabled: true,
        integration_pos_on: true,
        integration_pos_off: true,
      });
      expect(result.posEnabled).toBe(false);
    });
  });
});
