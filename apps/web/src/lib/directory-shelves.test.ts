import { describe, expect, it } from 'vitest';
import {
  directoryShelfHrefFor,
  resolveDirectoryShelfForLabel,
  type DirectoryShelfIndexEntry,
} from './directory-shelves';

const SHELVES: DirectoryShelfIndexEntry[] = [
  { name: 'Grocery Stores', slug: 'grocery-stores', storeCount: 12 },
  { name: 'Halal Meat Markets', slug: 'halal-meat-markets', storeCount: 4 },
  { name: 'Bookstores', slug: 'bookstores', storeCount: 0 },
];

describe('resolveDirectoryShelfForLabel', () => {
  it('resolves an exact-name label to its shelf slug and count', () => {
    expect(resolveDirectoryShelfForLabel('Grocery Stores', SHELVES)).toEqual({
      slug: 'grocery-stores',
      count: 12,
    });
  });

  it('matches case-insensitively and trims whitespace', () => {
    expect(resolveDirectoryShelfForLabel('  halal meat markets ', SHELVES)).toEqual({
      slug: 'halal-meat-markets',
      count: 4,
    });
  });

  it('returns null for a shelf with no published listings', () => {
    expect(resolveDirectoryShelfForLabel('Bookstores', SHELVES)).toBeNull();
  });

  it('returns null for a label that matches no shelf', () => {
    expect(resolveDirectoryShelfForLabel('Halal meat market', SHELVES)).toBeNull();
  });

  it('returns null for blank labels and missing slugs', () => {
    expect(resolveDirectoryShelfForLabel('   ', SHELVES)).toBeNull();
    expect(
      resolveDirectoryShelfForLabel('Grocery Stores', [
        { name: 'Grocery Stores', slug: '', storeCount: 3 },
      ]),
    ).toBeNull();
  });

  it('returns null against an empty shelf index', () => {
    expect(resolveDirectoryShelfForLabel('Grocery Stores', [])).toBeNull();
  });
});

describe('directoryShelfHrefFor', () => {
  it('builds the national directory category URL', () => {
    expect(directoryShelfHrefFor('grocery-stores')).toBe('/directory/categories/grocery-stores');
  });
});
