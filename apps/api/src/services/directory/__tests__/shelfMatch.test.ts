/**
 * ShelfMatch helper tests — multi-category shelf placement (spec §3.1).
 *
 * The shelf-match rule: a published seed listing is a member of shelf S when
 * its primary category equals S (case-insensitive) OR one of its
 * secondary_categories equals S. Unregistered categories fall back to the
 * name-derived slug of the primary only.
 */
import { describe, it, expect } from 'vitest';
import {
  categoryNameToSlug,
  resolveShelfBySlug,
  shelfNameMatchSql,
  shelfSlugFallbackSql,
} from '../shelfMatch';

describe('categoryNameToSlug', () => {
  it('lowercases and dashes a canonical category name', () => {
    expect(categoryNameToSlug('African Grocery Store')).toBe('african-grocery-store');
  });

  it('strips non-alphanumeric characters', () => {
    expect(categoryNameToSlug('Health & Beauty')).toBe('health-beauty');
  });

  it('collapses whitespace to single dashes', () => {
    expect(categoryNameToSlug('Auto   Repair')).toBe('auto-repair');
  });

  it('returns empty string for null/undefined', () => {
    expect(categoryNameToSlug(null)).toBe('');
    expect(categoryNameToSlug(undefined)).toBe('');
  });
});

describe('shelfNameMatchSql', () => {
  it('matches the primary category case-insensitively', () => {
    const sql = shelfNameMatchSql(3);
    expect(sql).toContain('LOWER(dps.category) = LOWER($1)'.replace('$1', '$3'));
  });

  it('matches any secondary_categories entry case-insensitively', () => {
    const sql = shelfNameMatchSql(2);
    expect(sql).toContain('unnest(dll.secondary_categories)');
    expect(sql).toContain('LOWER(sc) = LOWER($2)');
  });

  it('skips null entries in the secondary array', () => {
    expect(shelfNameMatchSql(1)).toContain('sc IS NOT NULL');
  });
});

describe('shelfSlugFallbackSql', () => {
  it('normalizes the primary category name to a slug for comparison', () => {
    const sql = shelfSlugFallbackSql(3);
    expect(sql).toContain("REPLACE(REPLACE(LOWER(dps.category), '[^a-z0-9 ]', ''), ' ', '-')");
    expect(sql).toContain('= LOWER($3)');
  });
});

describe('resolveShelfBySlug', () => {
  const makePool = (rows: any[]) => ({
    query: async () => ({ rows }),
  });

  it('returns the canonical name and slug for a registered category', async () => {
    const shelf = await resolveShelfBySlug(
      makePool([{ name: 'African Grocery Store', slug: 'african-grocery-store' }]),
      'african-grocery-store',
    );
    expect(shelf).toEqual({ name: 'African Grocery Store', slug: 'african-grocery-store' });
  });

  it('returns null when the slug is not registered', async () => {
    expect(await resolveShelfBySlug(makePool([]), 'not-a-category')).toBeNull();
    expect(await resolveShelfBySlug(makePool([{}]), 'not-a-category')).toBeNull();
  });

  it('falls back to the requested slug when the row has no slug', async () => {
    const shelf = await resolveShelfBySlug(makePool([{ name: 'Grocery' }]), 'grocery');
    expect(shelf).toEqual({ name: 'Grocery', slug: 'grocery' });
  });
});
