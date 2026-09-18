/**
 * Unit tests for the deliverable quality + repetition gates.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §5.5, §7.4
 */

import { describe, it, expect } from 'vitest';
import { runDeliverableQualityGate, runRepetitionGate } from '../deliverable-quality-gate';

const CLEAN = 'Your Google profile lists an outdated phone number. Correct it once here and we use that single record to update Google, Yelp, and Facebook so customers reach you.';

describe('runDeliverableQualityGate', () => {
  it('passes clean owner-facing copy', () => {
    expect(runDeliverableQualityGate('nap_report', CLEAN).passed).toBe(true);
  });

  it('fails empty content', () => {
    const r = runDeliverableQualityGate('nap_report', '');
    expect(r.passed).toBe(false);
    expect(r.issues).toContain('content is empty');
  });

  it('flags exclamation marks', () => {
    const r = runDeliverableQualityGate('seo_content', `${CLEAN} Great news!`);
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => /exclamation/i.test(i))).toBe(true);
  });

  it('flags hype superlatives', () => {
    const r = runDeliverableQualityGate('lead_magnet', `${CLEAN} We are the best in town.`);
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => /superlative/i.test(i))).toBe(true);
  });

  it('flags pricing absent from the source material', () => {
    const r = runDeliverableQualityGate('service_menu', `${CLEAN} Plans start at $99.`, 'no prices here');
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => /pricing not present/i.test(i))).toBe(true);
  });

  it('allows pricing present in the source material', () => {
    const r = runDeliverableQualityGate('service_menu', `${CLEAN} Plans start at $99.`, 'tier: $99');
    expect(r.issues.some((i) => /pricing not present/i.test(i))).toBe(false);
  });

  it('flags suspiciously short content', () => {
    const r = runDeliverableQualityGate('gbp_audit', 'Short.');
    expect(r.issues.some((i) => /very short/i.test(i))).toBe(true);
  });
});

describe('runRepetitionGate', () => {
  it('passes when there is no prior outreach', () => {
    expect(runRepetitionGate(CLEAN, '').passed).toBe(true);
  });

  it('flags near-verbatim reuse of an opener line', () => {
    const prior = 'Opener: When customers search for your category, Google Maps sends them to a competitor because your profile phone number is out of date.';
    const content = `${CLEAN}\nWhen customers search for your category, Google Maps sends them to a competitor because your profile phone number is out of date.`;
    const r = runRepetitionGate(content, prior);
    expect(r.passed).toBe(false);
    expect(r.issues[0]).toMatch(/repeats prior outreach/i);
  });

  it('passes distinct copy', () => {
    const prior = 'Opener: Your Yelp listing shows a disconnected number.';
    const r = runRepetitionGate(CLEAN, prior);
    expect(r.passed).toBe(true);
  });
});
