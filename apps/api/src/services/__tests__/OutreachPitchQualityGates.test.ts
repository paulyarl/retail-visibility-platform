import { describe, it, expect } from 'vitest';
import { runCloserQualityGate, runHeaderQualityGate } from '../outreach-pitch/quality-gates';

// ─── Closer Quality Gate ─────────────────────────────────────────────────

describe('runCloserQualityGate — archetype-aware itch keywords', () => {
  it('A1: accepts a closer that references "responses"', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are written and ready to deliver today.',
      'A1',
    );
    expect(result.passed).toBe(true);
  });

  it('A1: accepts a closer that references "replies"', () => {
    const result = runCloserQualityGate(
      "I've drafted replies to the other 4 unanswered reviews — ready when you are.",
      'A1',
    );
    expect(result.passed).toBe(true);
  });

  it('A2: accepts a closer that references "negative"', () => {
    const result = runCloserQualityGate(
      'The remaining 4 negative-review responses are written and ready today.',
      'A2',
    );
    expect(result.passed).toBe(true);
  });

  it('A3: accepts a closer that references "directories" (no "responses"/"replies")', () => {
    const result = runCloserQualityGate(
      'The full listing reconciliation — across 4 directories — is ready today.',
      'A3',
    );
    expect(result.passed).toBe(true);
  });

  it('A3: accepts a closer that references "profiles"', () => {
    const result = runCloserQualityGate(
      "The other 4 profiles are unclaimed — let's get them claimed and repaired today.",
      'A3',
    );
    expect(result.passed).toBe(true);
  });

  it('A4: accepts a closer that references "fix" (no "responses"/"replies")', () => {
    const result = runCloserQualityGate(
      'The full CTA fix — booking button, click-to-call, and the 4 follow-on tweaks — is ready today.',
      'A4',
    );
    expect(result.passed).toBe(true);
  });

  it('A5: accepts the closer that triggered the original bug report', () => {
    // This is the exact closer the operator used that was wrongly rejected:
    // "I've drafted the other 4 pieces. Ready when you are."
    const result = runCloserQualityGate(
      "I've drafted the other 4 pieces. Ready when you are.",
      'A5',
    );
    expect(result.passed).toBe(true);
  });

  it('A5: accepts a closer that references "listings"', () => {
    const result = runCloserQualityGate(
      'The full fix — listings and the 4 review responses — is ready today.',
      'A5',
    );
    expect(result.passed).toBe(true);
  });

  it('A6: accepts a closer that references "visibility plan" (no "responses"/"replies")', () => {
    const result = runCloserQualityGate(
      'The full product visibility plan — photos, catalog, and the 4 sections — is ready today.',
      'A6',
    );
    expect(result.passed).toBe(true);
  });

  it('A6: accepts a closer that references "store"', () => {
    const result = runCloserQualityGate(
      "I've drafted the other 4 pieces of the visibility plan. Ready when you are.",
      'A6',
    );
    expect(result.passed).toBe(true);
  });

  it('A6: rejects a closer that only references "responses" (off-archetype)', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are written and ready to deliver today.',
      'A6',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('photos'))).toBe(true);
  });

  it('rejects a closer with no archetype keyword at all', () => {
    const result = runCloserQualityGate(
      'The remaining 4 items are ready today.',
      'A3',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('listings'))).toBe(true);
  });

  it('rejects a closer with no number', () => {
    const result = runCloserQualityGate(
      'The remaining responses are written and ready to deliver today.',
      'A1',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('number'))).toBe(true);
  });

  it('rejects a closer over 25 words', () => {
    const longCloser =
      'The remaining 4 responses are written and ready to deliver today and I would love to share them with you at your earliest convenience because they really do make a difference for your business reputation online.';
    const result = runCloserQualityGate(longCloser, 'A1');
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('25 words'))).toBe(true);
  });

  it('rejects a closer with an exclamation point', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are ready today!',
      'A1',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('Exclamation'))).toBe(true);
  });

  it('rejects a closer with pricing', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are ready for $299 today.',
      'A1',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('pricing'))).toBe(true);
  });
});

describe('runCloserQualityGate — backward compatibility (no archetype)', () => {
  it('falls back to A1 keywords when archetype is omitted', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are written and ready to deliver today.',
    );
    expect(result.passed).toBe(true);
  });

  it('rejects a non-review closer when archetype is omitted (legacy behavior)', () => {
    const result = runCloserQualityGate(
      "I've drafted the other 4 pieces. Ready when you are.",
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('responses'))).toBe(true);
  });

  it('falls back to A1 keywords when archetype is unknown', () => {
    const result = runCloserQualityGate(
      'The remaining 4 responses are written and ready to deliver today.',
      'ZZZ',
    );
    expect(result.passed).toBe(true);
  });
});

// ─── Header Quality Gate ─────────────────────────────────────────────────

describe('runHeaderQualityGate — archetype-aware signal reference', () => {
  it('A1: accepts a header that references "reviews"', () => {
    const result = runHeaderQualityGate(
      "3 of your 8 completed review responses",
      'A1',
    );
    expect(result.passed).toBe(true);
  });

  it('A3: accepts a header that references "listings" (no "reviews")', () => {
    const result = runHeaderQualityGate(
      'Your listings across Google, Yelp, and Facebook',
      'A3',
    );
    expect(result.passed).toBe(true);
  });

  it('A4: accepts a header that references "website" (no "reviews")', () => {
    const result = runHeaderQualityGate(
      'Your website, with one fix suggested',
      'A4',
    );
    expect(result.passed).toBe(true);
  });

  it('A5: accepts a header that references "listings" and "reviews"', () => {
    const result = runHeaderQualityGate(
      'Your listings and your reviews',
      'A5',
    );
    expect(result.passed).toBe(true);
  });

  it('A6: accepts a header that references "store" (no "reviews")', () => {
    const result = runHeaderQualityGate(
      "What your store looks like online",
      'A6',
    );
    expect(result.passed).toBe(true);
  });

  it('A6: rejects a header that references "reviews" (off-topic for A6)', () => {
    const result = runHeaderQualityGate(
      'Your unanswered Google reviews',
      'A6',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('reviews or booking'))).toBe(true);
  });

  it('A6: rejects a header that references "booking" (off-topic for A6)', () => {
    const result = runHeaderQualityGate(
      'Your booking button is missing',
      'A6',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('reviews or booking'))).toBe(true);
  });

  it('A3: rejects a header that references no archetype keyword', () => {
    const result = runHeaderQualityGate(
      'Quick note about your business',
      'A3',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('listings'))).toBe(true);
  });

  it('rejects a header with spam trigger "free"', () => {
    const result = runHeaderQualityGate(
      'Free preview of your listings',
      'A3',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('spam trigger'))).toBe(true);
  });

  it('rejects a header over 60 chars', () => {
    const result = runHeaderQualityGate(
      'Your listings across Google, Yelp, Facebook, and many more directories today',
      'A3',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('too long'))).toBe(true);
  });

  it('rejects a header with an exclamation point', () => {
    const result = runHeaderQualityGate(
      'Your listings are wrong!',
      'A3',
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('Exclamation'))).toBe(true);
  });
});

describe('runHeaderQualityGate — backward compatibility (no archetype)', () => {
  it('does not run archetype-aware checks when archetype is omitted', () => {
    // A header with no review/listing keyword should pass the legacy gate
    // (only length/spam/forbidden/exclamation/emoji checks apply).
    const result = runHeaderQualityGate('Quick note about your business');
    expect(result.passed).toBe(true);
  });

  it('still rejects spam triggers when archetype is omitted', () => {
    const result = runHeaderQualityGate('Free preview of your business');
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('spam trigger'))).toBe(true);
  });
});
