import { describe, it, expect } from 'vitest';
import { resolvePaymentGateway } from './PaymentGatewayResolver';
import { resolveFulfillment } from './FulfillmentResolver';
import { resolveBarcodeScan } from './BarcodeScanResolver';
import { resolveProductOptions } from './ProductOptionsResolver';
import { resolveFeaturedOptions } from './FeaturedOptionsResolver';
import { resolveIntegrationOptions } from './IntegrationOptionsResolver';
import { resolveQuickstartOptions } from './QuickstartOptionsResolver';
import { resolveStorefrontOptions } from './StorefrontOptionsResolver';
import { resolveFaqOptions } from './FaqOptionsResolver';
import { resolveCrmOptions } from './CrmOptionsResolver';

describe('PaymentGatewayResolver', () => {
  it('disables everything when tier does not allow payment gateway', () => {
    const result = resolvePaymentGateway({}, null);
    expect(result.enabled).toBe(false);
    expect(result.checkout_available).toBe(false);
    expect(result.effective_gateways).toEqual([]);
  });

  it('enables stripe only when tier allows and merchant prefers it', () => {
    const result = resolvePaymentGateway(
      { payment_gateway_enabled: true, payment_gateway_stripe: true },
      { gateway_enabled: true, stripe_enabled: true, paypal_enabled: false }
    );
    expect(result.enabled).toBe(true);
    expect(result.effective_gateways).toEqual(['stripe']);
    expect(result.checkout_available).toBe(true);
  });

  it('allows all supported gateways when tier is flexible', () => {
    const result = resolvePaymentGateway(
      { payment_gateway_enabled: true, payment_gateway_flexible: true },
      { gateway_enabled: true, stripe_enabled: true, paypal_enabled: true, square_enabled: true, clover_enabled: true }
    );
    expect(result.is_flexible).toBe(true);
    expect(result.effective_gateways).toEqual(['stripe', 'paypal', 'square', 'clover']);
  });

  it('forces off a gateway when merchant disables it', () => {
    const result = resolvePaymentGateway(
      { payment_gateway_enabled: true, payment_gateway_stripe: true, payment_gateway_paypal: true },
      { gateway_enabled: true, stripe_enabled: true, paypal_enabled: false }
    );
    expect(result.effective_gateways).toEqual(['stripe']);
  });
});

describe('FulfillmentResolver', () => {
  it('returns disabled when tier has no fulfillment features', () => {
    const result = resolveFulfillment({}, null);
    expect(result.enabled).toBe(false);
    expect(result.effective_shows_pickup).toBe(false);
  });

  it('enables pickup when tier allows and merchant prefers it', () => {
    const result = resolveFulfillment(
      { fulfillment_enabled: true, fulfillment_pickup: true },
      { pickup_enabled: true }
    );
    expect(result.enabled).toBe(true);
    expect(result.shows_pickup).toBe(true);
    expect(result.effective_shows_pickup).toBe(true);
  });

  it('disables pickup when merchant turns it off', () => {
    const result = resolveFulfillment(
      { fulfillment_enabled: true, fulfillment_pickup: true },
      { pickup_enabled: false }
    );
    expect(result.effective_shows_pickup).toBe(false);
  });
});

describe('BarcodeScanResolver', () => {
  it('returns disabled when tier has no barcode features', () => {
    const result = resolveBarcodeScan({}, null);
    expect(result.enabled).toBe(false);
    expect(result.effective_scan_available).toBe(false);
  });

  it('allows manual and usb when tier features allow them', () => {
    const result = resolveBarcodeScan(
      { barcode_enabled: true, barcode_manual: true, barcode_usb: true },
      { barcode_manual_enabled: true, barcode_usb_enabled: true }
    );
    expect(result.enabled).toBe(true);
    expect(result.effective_modes).toContain('manual');
    expect(result.effective_modes).toContain('usb');
  });

  it('filters out modes disabled by merchant', () => {
    const result = resolveBarcodeScan(
      { barcode_enabled: true, barcode_manual: true, barcode_usb: true },
      { barcode_manual_enabled: true, barcode_usb_enabled: false }
    );
    expect(result.effective_modes).toEqual(['manual']);
  });
});

describe('ProductOptionsResolver', () => {
  it('returns disabled when tier has no product features', () => {
    const result = resolveProductOptions({}, null);
    expect(result.enabled).toBe(false);
  });

  it('allows physical and digital when tier supports them', () => {
    const result = resolveProductOptions(
      { product_enabled: true, product_physical: true, product_digital: true },
      { product_physical_enabled: true, product_digital_enabled: true }
    );
    expect(result.enabled).toBe(true);
    expect(result.effective_types).toContain('physical');
    expect(result.effective_types).toContain('digital');
  });

  it('defaults layout to classic', () => {
    const result = resolveProductOptions(
      { product_enabled: true, product_layout_classic: true },
      null
    );
    expect(result.effective_layout).toBe('classic');
  });
});

describe('FeaturedOptionsResolver', () => {
  it('returns enabled and all types when tier has no featured config (fail-open)', () => {
    const result = resolveFeaturedOptions({}, null);
    expect(result.enabled).toBe(true);
    expect(result.allowed_types).toContain('store_selection');
    expect(result.allowed_types).toContain('bestseller');
  });

  it('exposes tenant types when tier allows them', () => {
    const result = resolveFeaturedOptions(
      { featured_enabled: true, featured_sale: true, featured_new_arrival: true },
      { featured_sale: true, featured_new_arrival: false }
    );
    expect(result.enabled).toBe(true);
    expect(result.effective_types).toContain('sale');
    expect(result.effective_types).not.toContain('new_arrival');
  });
});

describe('IntegrationOptionsResolver', () => {
  it('returns disabled when tier has no integration features', () => {
    const result = resolveIntegrationOptions({}, null);
    expect(result.enabled).toBe(false);
  });

  it('exposes pos and google integrations when tier allows', () => {
    const result = resolveIntegrationOptions(
      { integration_enabled: true, integration_clover: true, integration_gbp: true },
      { integration_clover: true, integration_gbp: true }
    );
    expect(result.enabled).toBe(true);
    expect(result.effective_types).toContain('clover');
    expect(result.effective_types).toContain('gbp');
  });
});

describe('QuickstartOptionsResolver', () => {
  it('returns disabled when tier has no quickstart features', () => {
    const result = resolveQuickstartOptions({}, null);
    expect(result.enabled).toBe(false);
  });

  it('allows wizard when tier supports it and merchant enables it', () => {
    const result = resolveQuickstartOptions(
      { quickstart_enabled: true, quickstart_wizard: true },
      { quickstart_wizard: true }
    );
    expect(result.can_use_wizard).toBe(true);
  });
});

describe('StorefrontOptionsResolver', () => {
  it('returns disabled when tier has no storefront options', () => {
    const result = resolveStorefrontOptions({}, null);
    expect(result.enabled).toBe(false);
  });

  it('enables category when tier supports it', () => {
    const result = resolveStorefrontOptions(
      { storefront_opt_enabled: true, storefront_opt_category_on: true },
      { category_store: true }
    );
    expect(result.category_enabled).toBe(true);
    expect(result.allowed_category_types).toContain('category_store');
  });
});

describe('FaqOptionsResolver', () => {
  it('returns disabled when tier has no faq features', () => {
    const result = resolveFaqOptions({});
    expect(result.enabled).toBe(false);
  });

  it('enables faq when tier supports it', () => {
    const result = resolveFaqOptions({ faq_enabled: true, faq_display_storefront_accordion: true });
    expect(result.enabled).toBe(true);
    expect(result.faq_available).toBe(true);
  });
});

describe('CrmOptionsResolver', () => {
  it('returns disabled when tier has no crm features', () => {
    const result = resolveCrmOptions({});
    expect(result.enabled).toBe(false);
  });

  it('enables inquiry features when tier supports them', () => {
    const result = resolveCrmOptions({
      crm_enabled: true,
      crm_inquiry_product_enabled: true,
      crm_contact_management: true,
    });
    expect(result.enabled).toBe(true);
    expect(result.inquiry_product_enabled).toBe(true);
    expect(result.contacts_enabled).toBe(true);
  });
});
