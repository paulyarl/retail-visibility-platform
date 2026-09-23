import { describe, it, expect } from 'vitest';
import { resolveShelfForLabel, shelfHrefFor } from './place-shelves';
import type { PlaceCategory } from '@/services/PlacesBrowsePublicService';

/**
 * Shelf index shaped like the live GET /api/public/directory/places response
 * (the Kansas City proving-ground shelves).
 */
const shelves: PlaceCategory[] = [
  {
    category: 'African Grocery Store',
    slug: 'african-grocery-store',
    categoryId: 'cat_a',
    iconEmoji: '🏪',
    parentId: null,
    level: 0,
    placeCount: 2,
    cities: [
      { city: 'Indianapolis', state: 'IN', placeCount: 1 },
      { city: 'Kansas City', state: 'MO', placeCount: 1 },
    ],
  },
  {
    category: 'Halal Meat Market',
    slug: 'halal-meat-market',
    categoryId: 'cat_b',
    iconEmoji: null,
    parentId: null,
    level: 0,
    placeCount: 1,
    cities: [{ city: 'Kansas City', state: 'MO', placeCount: 1 }],
  },
  {
    category: 'Grocery Store',
    slug: 'grocery-store',
    categoryId: 'cat_c',
    iconEmoji: null,
    parentId: null,
    level: 0,
    placeCount: 1,
    cities: [{ city: 'Olathe', state: 'KS', placeCount: 1 }],
  },
];

describe('resolveShelfForLabel', () => {
  it('resolves a related category to its shelf with the market count', () => {
    expect(resolveShelfForLabel('Halal Meat Market', 'Kansas City', 'MO', shelves))
      .toEqual({ slug: 'halal-meat-market', count: 1 });
  });

  it('matches case- and whitespace-insensitively', () => {
    expect(resolveShelfForLabel('  african grocery store ', 'Kansas City', 'MO', shelves))
      .toEqual({ slug: 'african-grocery-store', count: 1 });
  });

  it('returns null for a label with no listings in this market', () => {
    // Grocery Store has listings — but only in Olathe, not Kansas City.
    expect(resolveShelfForLabel('Grocery Store', 'Kansas City', 'MO', shelves)).toBeNull();
  });

  it('returns null for a taxonomy label that is not a shelf at all', () => {
    expect(resolveShelfForLabel('Halal Butcher Counter', 'Kansas City', 'MO', shelves)).toBeNull();
  });

  it('does not merge a narrower label into a broader shelf', () => {
    // 'Somali Grocery' is a sub-category label; the shelf is 'Somali Grocery Store'.
    expect(resolveShelfForLabel('Somali Grocery', 'Kansas City', 'MO', shelves)).toBeNull();
  });

  it('falls back to the national count when no city is selected', () => {
    expect(resolveShelfForLabel('Grocery Store', undefined, undefined, shelves))
      .toEqual({ slug: 'grocery-store', count: 1 });
  });

  it('distinguishes same-name cities by state', () => {
    expect(resolveShelfForLabel('African Grocery Store', 'Kansas City', 'KS', shelves)).toBeNull();
    expect(resolveShelfForLabel('African Grocery Store', 'Kansas City', 'MO', shelves))
      .toEqual({ slug: 'african-grocery-store', count: 1 });
  });

  it('returns null for an empty label', () => {
    expect(resolveShelfForLabel('   ', 'Kansas City', 'MO', shelves)).toBeNull();
  });
});

describe('shelfHrefFor', () => {
  it('carries city + state as query params', () => {
    expect(shelfHrefFor('halal-meat-market', 'Kansas City', 'MO'))
      .toBe('/place/category/halal-meat-market?city=Kansas%20City&state=MO');
  });

  it('omits the state param when absent', () => {
    expect(shelfHrefFor('halal-meat-market', 'Kansas City')).toBe(
      '/place/category/halal-meat-market?city=Kansas%20City',
    );
  });

  it('drops the query entirely without a city (national shelf)', () => {
    expect(shelfHrefFor('halal-meat-market')).toBe('/place/category/halal-meat-market');
  });
});
