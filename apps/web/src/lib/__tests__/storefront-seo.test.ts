import { describe, expect, it } from 'vitest';

import { buildStorefrontSchema, storefrontTypeLabel } from '../storefront-seo';

describe('storefrontTypeLabel', () => {
  it('maps each storefront type to its schema type', () => {
    expect(storefrontTypeLabel('retail').schemaType).toBe('Store');
    expect(storefrontTypeLabel('online').schemaType).toBe('OnlineStore');
    expect(storefrontTypeLabel('service').schemaType).toBe('Service');
  });

  it('falls back to retail for unknown or missing types', () => {
    expect(storefrontTypeLabel('nonsense').schemaType).toBe('Store');
    expect(storefrontTypeLabel(null).title).toBe('Store Catalog');
    expect(storefrontTypeLabel(undefined).title).toBe('Store Catalog');
  });
});

describe('buildStorefrontSchema', () => {
  it('emits a schema.org object with the mapped type', () => {
    const schema = buildStorefrontSchema({
      type: 'online',
      businessName: 'Baraka International Market',
      description: 'Shop online from Baraka.',
    });
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('OnlineStore');
    expect(schema.name).toBe('Baraka International Market');
  });

  it('strips null/empty address fields rather than emitting nulls', () => {
    const schema = buildStorefrontSchema({
      type: 'retail',
      businessName: 'Baraka',
      description: 'Browse products from Baraka.',
      address: {
        streetAddress: '123 Main St',
        addressLocality: 'Indianapolis',
        addressRegion: null,
        postalCode: '',
        addressCountry: 'US',
      },
    });
    expect(schema.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main St',
      addressLocality: 'Indianapolis',
      addressCountry: 'US',
    });
  });

  it('omits the address entirely when every field is empty', () => {
    const schema = buildStorefrontSchema({
      type: 'retail',
      businessName: 'Baraka',
      description: 'Browse products from Baraka.',
      address: { streetAddress: '', addressLocality: null },
    });
    expect(schema.address).toBeUndefined();
  });

  it('drops blank keywords and joins the rest', () => {
    const schema = buildStorefrontSchema({
      type: 'retail',
      businessName: 'Baraka',
      description: 'Browse products from Baraka.',
      keywords: ['grocery', '  ', 'halal'],
    });
    expect(schema.keywords).toBe('grocery, halal');
  });
});
