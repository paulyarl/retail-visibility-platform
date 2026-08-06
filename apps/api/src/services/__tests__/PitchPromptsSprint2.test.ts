/**
 * Sprint 2 tests for outreach-pitch prompts — A6 product-visibility
 * header/closer branching.
 *
 * See: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md §5.6
 */
import { describe, it, expect } from 'vitest';

import {
  buildHeaderPrompt,
  buildHeaderPromptForArchetype,
  buildCloserPrompt,
  buildCloserPromptForArchetype,
} from '../outreach-pitch/prompts';

describe('outreach-pitch/prompts — Sprint 2 A6 branching', () => {
  const sampleFieldsJson = JSON.stringify({
    business_name: 'Indy African Market',
    business_category: 'grocery_store',
    city: 'Indianapolis',
    state: 'IN',
    photo_count: 3,
    photo_types: ['logo'],
    has_product_browsing: false,
  }, null, 2);

  // ─── Header ────────────────────────────────────────────────────────────

  describe('buildHeaderPromptForArchetype', () => {
    it('uses the A6 product-visibility preamble for A6', () => {
      const prompt = buildHeaderPromptForArchetype('A6', sampleFieldsJson);

      // A6 preamble references product visibility, not reviews
      expect(prompt).toContain('cannot see the store or its products');
      expect(prompt).toContain('Indy African Market');
      // Should NOT contain the review-management preamble
      expect(prompt).not.toContain('customer reviews are going unanswered');
    });

    it('uses the review-management preamble for A1', () => {
      const prompt = buildHeaderPromptForArchetype('A1', sampleFieldsJson);

      expect(prompt).toContain('customer reviews are going unanswered');
      expect(prompt).toContain('Indy African Market');
      // Should NOT contain the A6 preamble
      expect(prompt).not.toContain('cannot see the store or its products');
    });

    it('uses the review-management preamble for A2', () => {
      const prompt = buildHeaderPromptForArchetype('A2', sampleFieldsJson);
      expect(prompt).toContain('customer reviews are going unanswered');
    });

    it('uses the review-management preamble for A5', () => {
      const prompt = buildHeaderPromptForArchetype('A5', sampleFieldsJson);
      expect(prompt).toContain('customer reviews are going unanswered');
    });

    it('falls back to review-management preamble for unknown archetype', () => {
      const prompt = buildHeaderPromptForArchetype('unknown', sampleFieldsJson);
      expect(prompt).toContain('customer reviews are going unanswered');
    });

    it('A6 header instructs NOT to reference reviews or booking', () => {
      const prompt = buildHeaderPromptForArchetype('A6', sampleFieldsJson);
      expect(prompt).toContain('Do NOT reference reviews or booking');
    });
  });

  // ─── Closer ────────────────────────────────────────────────────────────

  describe('buildCloserPromptForArchetype', () => {
    it('uses the A6 product-visibility closer for A6', () => {
      const prompt = buildCloserPromptForArchetype('A6', sampleFieldsJson, 5);

      expect(prompt).toContain('product visibility plan');
      expect(prompt).toContain('fulfillment pathway');
      expect(prompt).toContain('hours sync');
      expect(prompt).toContain('Indy African Market');
      // Should NOT contain the review-management closer language
      expect(prompt).not.toContain('responses are written and ready');
    });

    it('uses the review-management closer for A1', () => {
      const prompt = buildCloserPromptForArchetype('A1', sampleFieldsJson, 5);

      expect(prompt).toContain('responses are written and ready');
      expect(prompt).toContain('5');
      // Should NOT contain A6 closer language
      expect(prompt).not.toContain('product visibility plan');
    });

    it('uses the review-management closer for A2', () => {
      const prompt = buildCloserPromptForArchetype('A2', sampleFieldsJson, 3);
      expect(prompt).toContain('responses are written and ready');
      expect(prompt).toContain('3');
    });

    it('A6 closer instructs NOT to reference reviews or booking', () => {
      const prompt = buildCloserPromptForArchetype('A6', sampleFieldsJson, 5);
      expect(prompt).toContain('Do NOT reference reviews or booking');
    });

    it('injects remaining count correctly for A6', () => {
      const prompt = buildCloserPromptForArchetype('A6', sampleFieldsJson, 12);
      expect(prompt).toContain('12');
    });
  });

  // ─── Backward compatibility ────────────────────────────────────────────

  describe('backward compatibility', () => {
    it('buildHeaderPrompt (legacy) still works and uses review-management preamble', () => {
      const prompt = buildHeaderPrompt(sampleFieldsJson);
      expect(prompt).toContain('customer reviews are going unanswered');
      expect(prompt).toContain('Indy African Market');
    });

    it('buildCloserPrompt (legacy) still works and injects remaining count', () => {
      const prompt = buildCloserPrompt(sampleFieldsJson, 7);
      expect(prompt).toContain('responses are written and ready');
      expect(prompt).toContain('7');
    });
  });
});
