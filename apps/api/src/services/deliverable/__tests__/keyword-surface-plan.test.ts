/**
 * Keyword Surface Plan — pure-helper tests.
 *
 * The Arsema / Ethiopian Eritrean Store fixture is the real case that
 * motivated the section: a business known by two names at one address, whose
 * second listing existed to put keyword-bearing tokens into a name field.
 */
import { describe, it, expect } from 'vitest';
import {
  buildKeywordSurfacePlan,
  extractIdentityTokens,
  formatKeywordPlacements,
  formatDuplicateListingNote,
} from '../keyword-surface-plan';

describe('extractIdentityTokens', () => {
  it('drops structural noise and single-character fragments', () => {
    expect(extractIdentityTokens(['Arsema G Food Mart LLC'])).toEqual(['arsema', 'food']);
  });

  it('keeps distinctive trade terms like merkato', () => {
    expect(extractIdentityTokens(['African Merkato'])).toEqual(['african', 'merkato']);
  });

  it('preserves first-seen order and dedupes across names', () => {
    expect(extractIdentityTokens(['Arsema Food Mart', 'Arsema G Food Mart LLC'])).toEqual([
      'arsema',
      'food',
    ]);
  });
});

describe('buildKeywordSurfacePlan', () => {
  const plan = buildKeywordSurfacePlan({
    businessName: 'Arsema G Food Mart LLC',
    category: 'African Grocery Store',
    secondaryCategories: ['Ethiopian Grocery Store', 'International Grocery Store'],
    nameVariations: ['Arsema Food Mart'],
    platformDisplayedNames: ['Arsema Food Mart'],
    alternateProfiles: [{ platform: 'google', name: 'Ethiopian Eritrean Store' }],
    observedAttributes: [
      { platform: 'google', key: 'snap_ebt', label: 'SNAP/EBT' },
      { platform: 'google', key: 'delivery', label: 'Delivery' },
    ],
    productCategories: ['injera', 'berbere'],
    hasDuplicateListing: true,
  });

  it('keeps only the real-world name on the name placement', () => {
    const name = plan.placements.find((p) => p.field === 'name');
    expect(name?.tokens).toEqual(['Arsema G Food Mart LLC']);
    expect(name?.guidance).toContain('must not go');
  });

  it('surfaces the alternate names, excluding the canonical one', () => {
    expect(plan.alternateNames).toEqual(['Arsema Food Mart', 'Ethiopian Eritrean Store']);
    expect(plan.alternateProfileNames).toEqual(['Ethiopian Eritrean Store']);
  });

  it('extracts identity tokens across names and category vocabulary', () => {
    expect(plan.tokens).toEqual(
      expect.arrayContaining(['arsema', 'food', 'ethiopian', 'eritrean', 'african', 'grocery']),
    );
    expect(plan.tokens).not.toContain('mart');
    expect(plan.tokens).not.toContain('llc');
  });

  it('places categories and attributes on their own fields', () => {
    expect(plan.placements.find((p) => p.field === 'categories')?.tokens).toEqual([
      'African Grocery Store',
      'Ethiopian Grocery Store',
      'International Grocery Store',
    ]);
    expect(plan.placements.find((p) => p.field === 'attributes')?.tokens).toEqual([
      'SNAP/EBT',
      'Delivery',
    ]);
  });

  it('uses observed product terms for the products field', () => {
    expect(plan.placements.find((p) => p.field === 'products')?.tokens).toEqual(['injera', 'berbere']);
  });

  it('emits every placement field the deliverable walks', () => {
    expect(plan.placements.map((p) => p.field)).toEqual([
      'name',
      'categories',
      'services',
      'products',
      'description',
      'attributes',
    ]);
  });

  it('names the second listing in the duplicate note', () => {
    const note = formatDuplicateListingNote(plan);
    expect(note).toContain('Ethiopian Eritrean Store');
    expect(note).toContain('one profile, every token');
  });

  it('stays silent when no second listing was observed', () => {
    const clean = buildKeywordSurfacePlan({ businessName: 'Solo Shop LLC', category: 'Grocery Store' });
    expect(clean.hasDuplicateListing).toBe(false);
    expect(formatDuplicateListingNote(clean)).toBe('');
  });

  it('renders placements as a field / token / guidance block', () => {
    const rendered = formatKeywordPlacements(plan);
    expect(rendered).toContain('Primary + additional categories: African Grocery Store');
    expect(rendered).toContain('Business name: Arsema G Food Mart LLC');
  });
});
