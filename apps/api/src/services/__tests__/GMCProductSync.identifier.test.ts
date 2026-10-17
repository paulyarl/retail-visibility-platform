/**
 * convertToGoogleProduct — identifier fallback.
 *
 * Regression guard for store-branded goods. Google requires a GTIN for branded
 * products *unless* the product genuinely has none (private label / store brand),
 * which is declared with `identifierExists: false`.
 *
 * The flag used to be emitted only when gtin, mpn AND brand were all absent, so
 * an independent grocer's own-label item — brand set, no GTIN — synced with a
 * "Missing GTIN" disapproval instead. `brand` is not a substitute for a GTIN.
 *
 * The condition also ignored `upc`/`barcode`, which the same block maps onto
 * `gtin`, so a UPC-only product got a GTIN *and* identifierExists=false.
 */
import { describe, it, expect } from 'vitest';
import { convertToGoogleProduct } from '../GMCProductSync';

const base = {
  id: 'pid-1',
  sku: 'SKU-1',
  name: 'Golden Tropics Plantain Fufu Flour 680g',
  description: 'A gluten-free plantain flour for fufu, soups and baking.',
  price_cents: 499,
  stock_quantity: 5,
  image_url: 'https://cdn.example.com/p.jpg',
};

const build = (overrides: Record<string, unknown> = {}) =>
  convertToGoogleProduct({ ...base, ...overrides }, 'tid-1', 'https://shop.example.com');

describe('convertToGoogleProduct — identifier fallback', () => {
  it('declares identifierExists=false for a store brand with no GTIN or MPN', () => {
    const product = build({ brand: 'Golden Tropics' });

    expect(product.brand).toBe('Golden Tropics');
    expect(product.gtin).toBeUndefined();
    expect(product.identifierExists).toBe(false);
  });

  it('declares identifierExists=false when there is no identifier at all', () => {
    expect(build().identifierExists).toBe(false);
  });

  it('treats upc and barcode as a GTIN, and does not contradict it', () => {
    expect(build({ upc: '012345678905' }).gtin).toBe('012345678905');
    expect(build({ upc: '012345678905' }).identifierExists).toBeUndefined();

    expect(build({ barcode: '012345678905' }).gtin).toBe('012345678905');
    expect(build({ barcode: '012345678905' }).identifierExists).toBeUndefined();
  });

  it('does not declare it when a GTIN is present', () => {
    const product = build({ brand: 'Acme', gtin: '00012345600012' });

    expect(product.gtin).toBe('00012345600012');
    expect(product.identifierExists).toBeUndefined();
  });

  it('does not declare it when an MPN is present', () => {
    const product = build({ brand: 'Acme', mpn: 'MPN-9' });

    expect(product.mpn).toBe('MPN-9');
    expect(product.identifierExists).toBeUndefined();
  });
});
