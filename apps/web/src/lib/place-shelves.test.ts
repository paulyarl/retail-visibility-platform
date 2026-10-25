import { describe, it, expect } from 'vitest';
import { resolveShelfForLabel } from './place-shelves';
import type { PlaceCategory } from '@/services/PlacesBrowsePublicService';

const shelf = (
  category: string,
  slug: string,
  placeCount = 1,
  cities: PlaceCategory['cities'] = [],
): PlaceCategory => ({
  category,
  slug,
  categoryId: null,
  iconEmoji: null,
  parentId: null,
  level: null,
  placeCount,
  cities,
});

// Mirrors the prod shelf set behind the category-page screenshots.
const SHELVES: PlaceCategory[] = [
  shelf('African Grocery Store', 'african-grocery-store', 68, [
    { city: 'Indianapolis', state: 'IN', placeCount: 46 },
    { city: 'Fort Wayne', state: 'IN', placeCount: 11 },
  ]),
  shelf('African Goods Store', 'african-goods-store', 3),
  shelf('Caribbean Grocery Store', 'caribbean-grocery-store', 2),
  shelf('Ethiopian Grocery Store', 'ethiopian-grocery-store', 5),
  shelf('Somali Grocery Store', 'somali-grocery-store', 4),
  shelf('Halal Grocery Store', 'halal-grocery-store', 7),
  shelf('Halal Meat Market', 'halal-meat-market', 2),
  shelf('International Grocery Store', 'international-grocery-store', 16),
  shelf('American Grocery Store', 'american-grocery-store', 1),
  shelf('West African Grocery', 'west-african-grocery', 4),
  shelf('Asian Grocery Store', 'asian-grocery-store', 0),
];

describe('resolveShelfForLabel — exact match', () => {
  it('resolves the canonical name and returns its count', () => {
    expect(resolveShelfForLabel('African Grocery Store', undefined, undefined, SHELVES))
      .toEqual({ slug: 'african-grocery-store', count: 68 });
  });

  it('is case-insensitive and trims', () => {
    expect(resolveShelfForLabel('  caribbean grocery STORE ', undefined, undefined, SHELVES))
      .toEqual({ slug: 'caribbean-grocery-store', count: 2 });
  });

  it('scopes the count to the market when city is given', () => {
    expect(resolveShelfForLabel('African Grocery Store', 'Indianapolis', 'IN', SHELVES))
      .toEqual({ slug: 'african-grocery-store', count: 46 });
  });
});

describe('resolveShelfForLabel — normalized alias', () => {
  it('strips a trailing parenthetical qualifier', () => {
    expect(resolveShelfForLabel('African Grocery Store (unverified)', undefined, undefined, SHELVES))
      .toEqual({ slug: 'african-grocery-store', count: 68 });
  });

  it('strips analyst language annotations', () => {
    const shelves = [shelf('African Market', 'african-market', 2)];
    expect(resolveShelfForLabel('African market [English]', undefined, undefined, shelves))
      .toEqual({ slug: 'african-market', count: 2 });
  });

  it('folds plurals', () => {
    const shelves = [shelf('Specialty Food Store', 'specialty-food-store', 3)];
    expect(resolveShelfForLabel('Specialty Food Stores', undefined, undefined, shelves))
      .toEqual({ slug: 'specialty-food-store', count: 3 });
  });
});

describe('resolveShelfForLabel — head-subset alias', () => {
  it('aliases tail-noun variants: "halal market" → halal-grocery-store', () => {
    expect(resolveShelfForLabel('Halal market', undefined, undefined, SHELVES))
      .toEqual({ slug: 'halal-grocery-store', count: 7 });
  });

  it('aliases compound qualifier labels: "Somali and East African halal market" → somali-grocery-store', () => {
    expect(resolveShelfForLabel('Somali and East African halal market', undefined, undefined, SHELVES))
      .toEqual({ slug: 'somali-grocery-store', count: 4 });
  });

  it('aliases "Ethiopian and Eritrean market" → ethiopian-grocery-store', () => {
    expect(resolveShelfForLabel('Ethiopian and Eritrean market', undefined, undefined, SHELVES))
      .toEqual({ slug: 'ethiopian-grocery-store', count: 5 });
  });

  it('refuses first-token misalignment: "Latin American grocery store" ≠ american-grocery-store', () => {
    expect(resolveShelfForLabel('Latin American grocery store', undefined, undefined, SHELVES)).toBeNull();
  });

  it('aliases "african market" → african-grocery-store (goods store excluded by its goods head token)', () => {
    expect(resolveShelfForLabel('African market', undefined, undefined, SHELVES))
      .toEqual({ slug: 'african-grocery-store', count: 68 });
  });

  it('stays cold when heads tie ambiguously at the same depth', () => {
    const shelves = [
      shelf('Halal Store', 'halal-store', 2),
      shelf('Halal Market', 'halal-market', 4),
    ];
    // Both heads reduce to [halal] — no unique winner, better cold than wrong.
    expect(resolveShelfForLabel('Halal', undefined, undefined, shelves)).toBeNull();
  });

  it('prefers the longest unique head: "african restaurant" beats the bare african shelves', () => {
    const shelves = [...SHELVES, shelf('African Restaurant', 'african-restaurant', 1)];
    expect(resolveShelfForLabel('African restaurant', undefined, undefined, shelves))
      .toEqual({ slug: 'african-restaurant', count: 1 });
  });

  it('stays cold for labels with no matching head', () => {
    expect(resolveShelfForLabel('Congolese and Central African grocery', undefined, undefined, SHELVES)).toBeNull();
    expect(resolveShelfForLabel('Pan-African grocery', undefined, undefined, SHELVES)).toBeNull();
    expect(resolveShelfForLabel('Ethnic grocery store', undefined, undefined, SHELVES)).toBeNull();
  });
});

describe('resolveShelfForLabel — count gate', () => {
  it('stays cold on a live-but-empty shelf', () => {
    expect(resolveShelfForLabel('Asian Grocery Store', undefined, undefined, SHELVES)).toBeNull();
  });

  it('stays cold when the shelf is empty in the requested market', () => {
    expect(resolveShelfForLabel('Caribbean Grocery Store', 'Indianapolis', 'IN', SHELVES)).toBeNull();
  });
});
