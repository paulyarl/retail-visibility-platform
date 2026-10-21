import { describe, it, expect } from 'vitest';
import {
  resolveReferrerShelf,
  resolveSecondaryShelves,
  resolveShelfForLabel,
  secondaryCategoryNames,
  shelfHrefFor,
} from './place-shelves';
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

describe('resolveReferrerShelf', () => {
  it('resolves a place/category ref to the canonical label and a market-scoped back link', () => {
    expect(
      resolveReferrerShelf('place/category/african-grocery-store', {
        shelves,
        city: 'Kansas City',
        state: 'MO',
      }),
    ).toEqual({
      surface: 'place_category',
      label: 'African Grocery Store',
      href: '/place/category/african-grocery-store?city=Kansas%20City&state=MO',
      categoryLabel: 'African Grocery Store',
    });
  });

  it('falls back to the national shelf when the market has no listings on it', () => {
    // Grocery Store only has listings in Olathe — a Kansas City listing could
    // not have been clicked from the KC-filtered view of that shelf.
    expect(
      resolveReferrerShelf('place/category/grocery-store', {
        shelves,
        city: 'Kansas City',
        state: 'MO',
      }),
    ).toEqual({
      surface: 'place_category',
      label: 'Grocery Store',
      href: '/place/category/grocery-store',
      categoryLabel: 'Grocery Store',
    });
  });

  it('titleizes an unknown category slug when the index has no entry', () => {
    expect(
      resolveReferrerShelf('place/category/ethiopian-grocery', { shelves }),
    ).toEqual({
      surface: 'place_category',
      label: 'Ethiopian Grocery',
      href: '/place/category/ethiopian-grocery',
      categoryLabel: 'Ethiopian Grocery',
    });
  });

  it('resolves a place/city ref to a city label with no category substitution', () => {
    expect(resolveReferrerShelf('place/city/indianapolis-in', { shelves })).toEqual({
      surface: 'place_city',
      label: 'Indianapolis, IN',
      href: '/place/city/indianapolis-in',
      categoryLabel: null,
    });
  });

  it('resolves the directory surfaces', () => {
    expect(resolveReferrerShelf('directory/home', { shelves })).toEqual({
      surface: 'directory_home',
      label: 'Directory',
      href: '/directory',
      categoryLabel: null,
    });
    expect(resolveReferrerShelf('directory/category/halal-market', { shelves })).toEqual({
      surface: 'directory_category',
      label: 'Halal Market',
      href: '/directory/categories/halal-market',
      categoryLabel: null,
    });
    expect(resolveReferrerShelf('directory/location/indianapolis-in', { shelves })).toEqual({
      surface: 'directory_location',
      label: 'Indianapolis, IN',
      href: '/directory/location/indianapolis-in',
      categoryLabel: null,
    });
    expect(resolveReferrerShelf('directory/store-type/grocery', { shelves })).toEqual({
      surface: 'directory_store_type',
      label: 'Grocery',
      href: '/directory/stores/grocery',
      categoryLabel: null,
    });
  });

  it('returns null for missing or malformed refs', () => {
    expect(resolveReferrerShelf(null, { shelves })).toBeNull();
    expect(resolveReferrerShelf('', { shelves })).toBeNull();
    expect(resolveReferrerShelf('nonsense', { shelves })).toBeNull();
    expect(resolveReferrerShelf('place/bogus/x', { shelves })).toBeNull();
    expect(resolveReferrerShelf('seed_preview/some-shop', { shelves })).toBeNull();
  });
});

describe('resolveSecondaryShelves', () => {
  it('scopes each label to the listing market when the shelf is live there', () => {
    expect(
      resolveSecondaryShelves(['Halal Meat Market'], {
        shelves,
        city: 'Kansas City',
        state: 'MO',
      }),
    ).toEqual([
      { label: 'Halal Meat Market', href: '/place/category/halal-meat-market?city=Kansas%20City&state=MO' },
    ]);
  });

  it('falls back to the national shelf outside the listing market', () => {
    expect(
      resolveSecondaryShelves(['Grocery Store'], {
        shelves,
        city: 'Kansas City',
        state: 'MO',
      }),
    ).toEqual([{ label: 'Grocery Store', href: '/place/category/grocery-store' }]);
  });

  it('renders an unlinked chip for a label with no live shelf', () => {
    expect(resolveSecondaryShelves(['Halal Butcher Counter'], { shelves })).toEqual([
      { label: 'Halal Butcher Counter', href: null },
    ]);
  });

  it('excludes the displayed category and dedupes case-insensitively', () => {
    expect(
      resolveSecondaryShelves(['Grocery Store', 'grocery store', 'Halal Meat Market'], {
        shelves,
        exclude: 'Grocery Store',
      }),
    ).toEqual([{ label: 'Halal Meat Market', href: '/place/category/halal-meat-market' }]);
  });
});

describe('secondaryCategoryNames', () => {
  it('prefers the normalized categories array', () => {
    expect(
      secondaryCategoryNames({
        categories: [
          { name: 'African Grocery Store', isPrimary: true },
          { name: 'Grocery Store', isPrimary: false },
        ],
        secondaryCategories: ['ignored'],
      }),
    ).toEqual(['Grocery Store']);
  });

  it('falls back to the raw secondary list', () => {
    expect(
      secondaryCategoryNames({
        categories: [],
        secondaryCategories: ['Grocery Store', { name: 'Supermarket' }],
      }),
    ).toEqual(['Grocery Store', 'Supermarket']);
  });
});
