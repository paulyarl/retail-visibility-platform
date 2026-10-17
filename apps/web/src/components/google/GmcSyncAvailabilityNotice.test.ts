import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GmcSyncAvailabilityNotice, { resolveGmcSyncNoticeCopy } from './GmcSyncAvailabilityNotice';

describe('resolveGmcSyncNoticeCopy', () => {
  it('routes a storefront gap to the storefront-type settings, not an upgrade', () => {
    const copy = resolveGmcSyncNoticeCopy('storefront_type_required', 'tid-1');
    expect(copy.title).toBe('Choose your storefront type');
    expect(copy.action?.href).toBe('/t/tid-1/settings/storefront-type-options');
    expect(`${copy.title} ${copy.body}`).not.toMatch(/upgrade/i);
  });

  it('routes a product-type gap to the product-types settings, not an upgrade', () => {
    const copy = resolveGmcSyncNoticeCopy('product_types_ineligible', 'tid-1');
    expect(copy.action?.href).toBe('/t/tid-1/settings/product-types');
    expect(`${copy.title} ${copy.body}`).not.toMatch(/upgrade/i);
  });

  it('keeps the upgrade wording for genuine plan limits', () => {
    for (const reason of ['integration_not_in_plan', 'storefront_type_ineligible']) {
      const copy = resolveGmcSyncNoticeCopy(reason, 'tid-1');
      expect(copy.title).toBe('Not included in your plan');
      expect(copy.action?.href).toBe('/t/tid-1/settings/subscription');
    }
  });

  it('reports an unverifiable gate as a transient failure with no action', () => {
    const copy = resolveGmcSyncNoticeCopy('error', 'tid-1');
    expect(copy.title).toBe('Sync temporarily unavailable');
    expect(copy.action).toBeUndefined();
  });

  it('falls back to the plan notice when the reason is unknown', () => {
    expect(resolveGmcSyncNoticeCopy(null, 'tid-1').title).toBe('Not included in your plan');
    expect(resolveGmcSyncNoticeCopy(undefined, 'tid-1').title).toBe('Not included in your plan');
  });
});

describe('GmcSyncAvailabilityNotice', () => {
  it('renders the fixable-gap guidance', () => {
    const html = renderToStaticMarkup(
      createElement(GmcSyncAvailabilityNotice, { tenantId: 'tid-1', reason: 'storefront_type_required' }),
    );
    expect(html).toContain('Choose your storefront type');
    expect(html).toContain('/t/tid-1/settings/storefront-type-options');
  });

  it('renders the plan-limit guidance', () => {
    const html = renderToStaticMarkup(
      createElement(GmcSyncAvailabilityNotice, { tenantId: 'tid-1', reason: 'integration_not_in_plan' }),
    );
    expect(html).toContain('Not included in your plan');
  });
});
