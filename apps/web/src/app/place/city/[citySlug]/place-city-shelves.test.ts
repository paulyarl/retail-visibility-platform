/**
 * buildShelfSections — the seed city shelf dedupe contract. A business on
 * multiple shelves (primary + secondaries, spec §3.1) must be carded exactly
 * once (its first shelf) and appear as a compact repeat on the shelves after.
 */
import { describe, it, expect } from 'vitest';
import { buildShelfSections } from './place-city-shelves';

const baraka = { id: 'b1', businessName: 'Baraka Market' };
const other = { id: 'b2', businessName: 'Other Market' };

// Mirrors the API's city grouping: a place lands in its primary shelf group
// AND each secondary shelf group.
const categories = [
  { category: 'African Grocery Store', slug: 'african-grocery-store', iconEmoji: '🛒', places: [baraka] },
  { category: 'Halal Grocery Store', slug: 'halal-grocery-store', iconEmoji: null, places: [baraka] },
  { category: 'International Grocery Store', slug: 'international-grocery-store', iconEmoji: null, places: [baraka, other] },
];

describe('buildShelfSections', () => {
  it('cards a multi-shelf business once and repeats it as compact rows', () => {
    const sections = buildShelfSections(categories);

    // First shelf: full card.
    expect(sections[0].fresh.map((p) => p.id)).toEqual(['b1']);
    expect(sections[0].repeats).toEqual([]);

    // Repeat shelves: no card, listed as a repeat.
    expect(sections[1].fresh).toEqual([]);
    expect(sections[1].repeats.map((p) => p.id)).toEqual(['b1']);

    // Mixed shelf: the new business is carded, the seen one repeats.
    expect(sections[2].fresh.map((p) => p.id)).toEqual(['b2']);
    expect(sections[2].repeats.map((p) => p.id)).toEqual(['b1']);
  });

  it('preserves shelf metadata (name, slug, icon, member count)', () => {
    const [first] = buildShelfSections(categories);
    expect(first.category).toBe('African Grocery Store');
    expect(first.slug).toBe('african-grocery-store');
    expect(first.iconEmoji).toBe('🛒');
    expect(first.places).toHaveLength(1);
  });

  it('is a no-op for single-shelf businesses', () => {
    const sections = buildShelfSections([
      { category: 'Grocery Store', slug: 'grocery-store', iconEmoji: null, places: [baraka, other] },
    ]);
    expect(sections[0].fresh).toHaveLength(2);
    expect(sections[0].repeats).toEqual([]);
  });
});
