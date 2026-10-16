import { describe, it, expect } from 'vitest';
import { focusLabelFor, focusOptionsFor } from './footprintFocus';

// The structured-slot Focus Info dropdown was a static five (NAP+W + Claim
// Status). These pin the archetype-aware expansion: identity options are
// always offered, the problem-family options are filtered to what each
// archetype's briefing raises.

const values = (opts: { value: string }[]) => opts.map((o) => o.value);

describe('focusOptionsFor — archetype-aware focus options', () => {
  it('always offers the five identity options (NAP+W + Claim Status)', () => {
    for (const archetype of ['A5', 'A3', 'A8'] as const) {
      expect(values(focusOptionsFor(archetype).identity)).toEqual([
        'name',
        'address',
        'phone',
        'website',
        'claim_status',
      ]);
    }
  });

  it('A5 offers the multi-signal problem focuses (category, reviews, products, cta, presence, photos)', () => {
    const problem = values(focusOptionsFor('A5').problem);
    expect(problem).toContain('category');
    expect(problem).toContain('reviews');
    expect(problem).toContain('products');
    expect(problem).toContain('cta');
    expect(problem).toContain('presence');
    expect(problem).toContain('photos');
    expect(problem).toContain('other');
  });

  it('A3 (listing drift) offers presence but not the review/product/CTA focuses', () => {
    const problem = values(focusOptionsFor('A3').problem);
    expect(problem).toContain('category');
    expect(problem).toContain('presence');
    expect(problem).not.toContain('reviews');
    expect(problem).not.toContain('products');
    expect(problem).not.toContain('cta');
    expect(problem).not.toContain('suspended');
  });

  it('A8 (presence) offers suspended + presence + photos but not reviews/products/cta', () => {
    const problem = values(focusOptionsFor('A8').problem);
    expect(problem).toContain('suspended');
    expect(problem).toContain('presence');
    expect(problem).toContain('photos');
    expect(problem).not.toContain('reviews');
    expect(problem).not.toContain('products');
    expect(problem).not.toContain('cta');
  });

  it('the always-available problem focuses appear for every archetype', () => {
    for (const archetype of ['A5', 'A3', 'A8'] as const) {
      const problem = values(focusOptionsFor(archetype).problem);
      expect(problem).toContain('category');
      expect(problem).toContain('description');
      expect(problem).toContain('hours');
      expect(problem).toContain('other');
    }
  });
});

describe('focusLabelFor', () => {
  it('returns the human label for a value', () => {
    expect(focusLabelFor('category')).toBe('Category');
    expect(focusLabelFor('claim_status')).toBe('Claim Status');
    expect(focusLabelFor('suspended')).toBe('Suspended / duplicate');
  });

  it('falls back to "focus" when unset', () => {
    expect(focusLabelFor(undefined)).toBe('focus');
  });
});
