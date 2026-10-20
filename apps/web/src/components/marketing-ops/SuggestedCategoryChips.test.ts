import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SuggestedCategoryChips from './SuggestedCategoryChips';

const suggestions = [
  { category: 'African Grocery Store', confidence: 'medium' as const, is_known_category: true, basis: ['ChamberofCommerce.com: African goods store listing'] },
  { category: 'Fresh Food Market', confidence: 'low' as const, is_known_category: false, basis: ['Google Business Profile: Fresh food market'] },
  { category: 'Halal Grocery', confidence: 'medium' as const, is_known_category: false },
];

const render = (overrides: Record<string, any> = {}) =>
  renderToStaticMarkup(
    createElement(SuggestedCategoryChips, {
      campaignId: 'mcamp-x4pfvikq',
      businessName: 'Janjai Redlight Market Inc',
      suggestions,
      currentCategory: 'Grocery Store',
      currentSecondaryCategories: [],
      ...overrides,
    }),
  );

describe('SuggestedCategoryChips', () => {
  it('offers + Secondary for suggestions not yet on the campaign', () => {
    const html = render();
    expect(html).toContain('Suggested categories:');
    expect(html).toContain('African Grocery Store');
    expect(html).toContain('Fresh Food Market');
    expect(html).toContain('+ Secondary');
    expect(html).toContain('(new)');
  });

  it('marks a suggestion that is already the primary category', () => {
    const html = render({ currentCategory: 'African Grocery Store' });
    expect(html).toContain('>Primary<');
  });

  it('marks a suggestion already in secondary categories, case-insensitively', () => {
    const html = render({ currentSecondaryCategories: ['fresh food market'] });
    expect(html).toContain('>Secondary<');
  });

  it('renders nothing without suggestions', () => {
    expect(render({ suggestions: [] })).toBe('');
  });
});
