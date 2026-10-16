import { describe, it, expect } from 'vitest';
import { renderPitchText, FOOTPRINT_FOCUS_LABELS, type ReviewPair } from '../pitch-renderer';

// The preview slots are architecture-aware of the briefing's
// regular → hook → fix pattern: each slot may carry the two spoken lines
// (`regular`, `hook`) captured verbatim from the campaign's outreach
// problems, rendered above the fix. Both are optional and additive, so a
// legacy pitch (no spoken lines) renders byte-identically.

const freeTextPair = (over: Partial<ReviewPair> = {}): ReviewPair => ({
  review_text: 'Customers never see the store',
  response_text: 'Claim the profile and set the right category',
  response_source: 'ai',
  is_negative_first: true,
  ...over,
});

const structuredPair = (over: Partial<ReviewPair> = {}): ReviewPair => ({
  platform_name: 'Google',
  profile_url: 'https://g.page/example',
  focus_attribute: 'category',
  current_value: 'Convenience store',
  correct_value: 'African goods store',
  evidence_label: 'Current State',
  fix_label: 'Proposed Fix',
  response_source: 'ai',
  is_negative_first: true,
  ...over,
});

const render = (pairs: ReviewPair[]) =>
  renderPitchText({
    openerText: 'opener',
    headerText: null,
    reviewPairs: pairs,
    closerText: null,
    contactText: null,
  });

describe('renderPitchText — briefing regular/hook lines', () => {
  it('renders Regular and Hook between the evidence and the fix (free-text slot)', () => {
    const text = render([
      freeTextPair({ regular: 'The plain line.', hook: 'The hook line.' }),
    ]);
    expect(text).toContain('Regular: "The plain line."');
    expect(text).toContain('Hook: "The hook line."');
    // Regular precedes Hook precedes the fix.
    expect(text.indexOf('Regular:')).toBeLessThan(text.indexOf('Hook:'));
    expect(text.indexOf('Hook:')).toBeLessThan(text.indexOf('Owner Response Message:'));
  });

  it('renders Regular and Hook between Current State and Proposed Fix (structured slot)', () => {
    const text = render([
      structuredPair({ regular: 'Filed as a convenience store.', hook: 'Search injera near me.' }),
    ]);
    expect(text).toContain('Regular: "Filed as a convenience store."');
    expect(text).toContain('Hook: "Search injera near me."');
    expect(text.indexOf('Inconsistent Info (Category)')).toBeLessThan(text.indexOf('Regular:'));
    expect(text.indexOf('Hook:')).toBeLessThan(text.indexOf('Proposed Fix:'));
  });

  it('omits the spoken lines entirely when blank (legacy pitch unchanged)', () => {
    const text = render([freeTextPair()]);
    expect(text).not.toContain('Regular:');
    expect(text).not.toContain('Hook:');
  });

  it('renders Regular alone when only regular is set', () => {
    const text = render([freeTextPair({ regular: 'Only the regular.' })]);
    expect(text).toContain('Regular: "Only the regular."');
    expect(text).not.toContain('Hook:');
  });
});

describe('renderPitchText — extended footprint focus vocabulary', () => {
  it('labels the problem-family focus attributes (category, presence, suspended)', () => {
    const text = render([structuredPair({ focus_attribute: 'category' })]);
    expect(text).toContain('Inconsistent Info (Category)');
    expect(text).toContain('Correct Info (Category)');

    const presence = render([structuredPair({ focus_attribute: 'presence' })]);
    expect(presence).toContain('Inconsistent Info (Profile presence)');

    const suspended = render([structuredPair({ focus_attribute: 'suspended' })]);
    expect(suspended).toContain('Inconsistent Info (Suspended / duplicate)');
  });

  it('labels every focus attribute in the catalog', () => {
    for (const [value, label] of Object.entries(FOOTPRINT_FOCUS_LABELS)) {
      const text = render([structuredPair({ focus_attribute: value as any })]);
      expect(text).toContain(`Inconsistent Info (${label})`);
    }
  });
});
