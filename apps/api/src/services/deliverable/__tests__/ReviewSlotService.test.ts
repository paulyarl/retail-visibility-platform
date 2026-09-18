/**
 * Unit tests for ReviewSlotService intake mapping (G-1b).
 *
 * The audit emits no verbatim review text, so ingest now sources reviews from
 * the operator-pasted review intake. This covers the mapping contract.
 */

import { describe, it, expect } from 'vitest';
import { reviewCandidatesFromIntake } from '../ReviewSlotService';

describe('reviewCandidatesFromIntake (G-1b)', () => {
  it('maps intake reviews to slot candidates, preserving verbatim text', () => {
    const out = reviewCandidatesFromIntake({
      reviews: [
        {
          platform: 'google', text: 'Diagnostic fee was ridiculous.', rating: 1,
          date: '2024-02-10', author: 'Jennifer', sentiment: 'negative',
          is_negative_first: true, answered: false,
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      platform: 'google',
      text: 'Diagnostic fee was ridiculous.',
      rating: 1,
      author: 'Jennifer',
      sentiment: 'negative',
      isNegativeFirst: true,
      theme: null,
    });
  });

  it('drops answered reviews', () => {
    const out = reviewCandidatesFromIntake({
      reviews: [
        { text: 'Already handled.', answered: true },
        { text: 'Still unanswered.', answered: false },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Still unanswered.');
  });

  it('drops blank/whitespace-only text', () => {
    const out = reviewCandidatesFromIntake({ reviews: [{ text: '   ' }, { text: '' }] });
    expect(out).toHaveLength(0);
  });

  it('applies defaults for absent optional fields', () => {
    const out = reviewCandidatesFromIntake({ reviews: [{ text: 'Good work.' }] });
    expect(out[0]).toMatchObject({
      platform: 'unknown',
      rating: null,
      author: null,
      sentiment: 'neutral',
      isNegativeFirst: false,
    });
  });

  it('handles an empty/absent reviews array', () => {
    expect(reviewCandidatesFromIntake({})).toEqual([]);
    expect(reviewCandidatesFromIntake({ reviews: [] })).toEqual([]);
  });
});
