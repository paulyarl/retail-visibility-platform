/**
 * briefing-topics lib — flattens a campaign's audit briefing into the topics
 * a diagnostic screenshot can be tagged to (Migration 355).
 *
 * Contract under test: the newest non-stub audit of each briefing platform
 * (business_analysis, website_positioning) contributes its issues /
 * positioning_gaps / outreach_problems / benefits as {auditId, kind, index}
 * refs — the exact payload uploadDiagnosticScreenshot +
 * updateFileBriefingTopic send to the API for snapshot resolution.
 */
import { describe, it, expect } from 'vitest';
import type { Audit } from '@/services/MarketingOpsService';
import type { GalleryBriefingTopic } from '@/services/DiagnosticGalleryPublicService';
import {
  flattenBriefingTopics,
  briefingTopicKey,
  briefingTopicTagline,
} from './briefing-topics';

function audit(partial: Partial<Audit> & { audit_data: any }): Audit {
  return {
    id: 'maud-1',
    campaign_id: 'camp-1',
    platform: 'business_analysis',
    review_count: null,
    average_rating: null,
    unaddressed_reviews: null,
    owner_response_rate: null,
    photo_count: null,
    claimed: null,
    active_page: null,
    has_booking: null,
    has_contact_form: null,
    mobile_friendly: null,
    created_at: '2026-10-01T00:00:00Z',
    ...partial,
  } as Audit;
}

const BA_DATA = {
  outreach_problems: [
    { problem: 'Invisible on Maps', hook: 'h', regular: 'r', solution: 'Fix your profile', evidence: 'e', outreach_use: 'u' },
    { problem: 'Reviews unanswered', hook: 'h2' },
  ],
  benefits: ['Show up first', 'Win the click'],
};

const WP_DATA = {
  issues: [
    { issue: 'No booking CTA', conversion_implication: 'Lost calls', severity: 'non_negotiable' },
  ],
  positioning_gaps: [
    { field: 'hours', expected: 'listed', actual: 'missing', gap_description: 'Hours not shown' },
  ],
  outreach_problems: [{ problem: 'Site leaks mobile traffic' }],
};

describe('flattenBriefingTopics', () => {
  it('extracts topics from a business_analysis audit in briefing order', () => {
    const topics = flattenBriefingTopics([audit({ audit_data: BA_DATA })]);
    expect(topics.map((t) => [t.kind, t.ref.index, t.label])).toEqual([
      ['ammunition', 0, 'Invisible on Maps'],
      ['ammunition', 1, 'Reviews unanswered'],
      ['benefit', 0, 'Show up first'],
      ['benefit', 1, 'Win the click'],
    ]);
    expect(topics[0].ref).toEqual({ auditId: 'maud-1', kind: 'ammunition', index: 0 });
    expect(topics[0].key).toBe('maud-1:ammunition:0');
  });

  it('extracts issues + gaps + ammunition from a website_positioning audit', () => {
    const topics = flattenBriefingTopics([
      audit({ platform: 'website_positioning', audit_data: WP_DATA }),
    ]);
    expect(topics.map((t) => [t.kindLabel, t.label])).toEqual([
      ['Issue', 'No booking CTA'],
      ['Gap', 'hours'],
      ['Ammunition', 'Site leaks mobile traffic'],
    ]);
  });

  it('keeps the newest audit per platform, not every run', () => {
    const old = audit({ id: 'maud-old', created_at: '2026-09-01T00:00:00Z', audit_data: BA_DATA });
    const fresh = audit({ id: 'maud-new', created_at: '2026-10-01T00:00:00Z', audit_data: BA_DATA });
    const topics = flattenBriefingTopics([old, fresh]);
    expect(new Set(topics.map((t) => t.ref.auditId))).toEqual(new Set(['maud-new']));
  });

  it('skips stub business_analysis placeholders', () => {
    const stub = audit({
      audit_data: {
        audit_metadata: { source: 'queue_promotion' },
        detected_signals: ['X'],
        outreach_problems: [{ problem: 'never shown' }],
      },
    });
    expect(flattenBriefingTopics([stub])).toEqual([]);
  });

  it('ignores audits of other platforms', () => {
    const gbp = audit({ platform: 'gbp_audit', audit_data: { issues: [{ issue: 'x' }] } });
    expect(flattenBriefingTopics([gbp])).toEqual([]);
  });
});

describe('briefingTopicKey', () => {
  it('matches the option key format', () => {
    expect(briefingTopicKey({ auditId: 'a', kind: 'issue', index: 2 })).toBe('a:issue:2');
  });
});

describe('briefingTopicTagline', () => {
  const topic = (kind: GalleryBriefingTopic['kind'], detail: any): GalleryBriefingTopic => ({
    kind,
    label: 'L',
    detail,
  });

  it('pulls the conversion cost for issues', () => {
    expect(briefingTopicTagline(topic('issue', { conversion_implication: 'Lost calls' }))).toBe('Lost calls');
  });
  it('pulls the description for gaps', () => {
    expect(briefingTopicTagline(topic('gap', { gap_description: 'Hours not shown' }))).toBe('Hours not shown');
  });
  it('prefers the fix for ammunition, falling back to the hook', () => {
    expect(briefingTopicTagline(topic('ammunition', { solution: 'Fix your profile' }))).toBe('Fix your profile');
    expect(briefingTopicTagline(topic('ammunition', { hook: 'Hook line' }))).toBe('Hook line');
  });
  it('returns the benefit text', () => {
    expect(briefingTopicTagline(topic('benefit', { text: 'Show up first' }))).toBe('Show up first');
  });
  it('returns null when the detail field is absent', () => {
    expect(briefingTopicTagline(topic('issue', {}))).toBeNull();
  });
});
