import { describe, it, expect } from 'vitest';
import {
  sanitizeExternalPostCopy,
  buildGbpPostSuggestPrompt,
  featureKeyToTopic,
  GBP_POST_MAX_CHARS,
} from '../lib/google/gbp-post-suggest';

describe('sanitizeExternalPostCopy', () => {
  it('strips code fences', () => {
    const { summary } = sanitizeExternalPostCopy('```\nCome see our fall specials!\n```');
    expect(summary).toBe('Come see our fall specials!');
  });

  it('strips markdown and warns', () => {
    const { summary, warnings } = sanitizeExternalPostCopy('**Big sale** on ~~old~~ new stock');
    expect(summary).toContain('Big sale');
    expect(summary).toContain('new stock');
    expect(warnings.some((w) => w.includes('markdown'))).toBe(true);
  });

  it('removes hashtags', () => {
    const { summary, warnings } = sanitizeExternalPostCopy('Fresh bread daily! #bakery #fresh');
    expect(summary).not.toContain('#');
    expect(warnings.some((w) => w.includes('hashtag'))).toBe(true);
  });

  it('converts markdown links and warns about CTA', () => {
    const { summary, warnings } = sanitizeExternalPostCopy('Order [online now](https://x.test)!');
    expect(summary).toContain('online now (https://x.test)');
    expect(warnings.some((w) => w.includes('CTA'))).toBe(true);
  });

  it('caps at GBP max length', () => {
    const { summary, warnings } = sanitizeExternalPostCopy('x'.repeat(2000));
    expect(summary.length).toBeLessThanOrEqual(GBP_POST_MAX_CHARS);
    expect(warnings.some((w) => w.includes('GBP limit'))).toBe(true);
  });

  it('warns past ideal length without trimming', () => {
    const { summary, warnings } = sanitizeExternalPostCopy('x'.repeat(800));
    expect(summary.length).toBe(800);
    expect(warnings.some((w) => w.includes('truncates'))).toBe(true);
  });
});

describe('buildGbpPostSuggestPrompt', () => {
  it('includes photo, tone, theme, cta, topic lines', () => {
    const prompt = buildGbpPostSuggestPrompt({
      businessName: 'Acme Grocery',
      category: 'grocery store',
      photoDescription: 'a display of fresh produce',
      tone: 'urgent',
      theme: 'problem_solution',
      cta: 'visit',
      topic: 'weekly specials flyer',
    });
    expect(prompt).toContain('Acme Grocery');
    expect(prompt).toContain('fresh produce');
    expect(prompt).toContain('problem');
    expect(prompt).toContain('visit in person');
    expect(prompt).toContain('weekly specials flyer');
    expect(prompt).toContain('urgency');
  });
});

describe('featureKeyToTopic', () => {
  it('prefers marketing name', () => {
    expect(featureKeyToTopic('flyer_recurring', 'Recurring Flyers')).toBe('Recurring Flyers');
  });
  it('humanizes the key without a marketing name', () => {
    expect(featureKeyToTopic('flyer_recurring')).toBe('recurring');
  });
});
