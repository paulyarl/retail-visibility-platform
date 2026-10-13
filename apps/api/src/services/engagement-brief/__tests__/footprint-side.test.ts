/**
 * Footprint-density side classifier — spec:
 * docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md §"The side".
 *
 * Acceptance criteria pinned here:
 *   - stamped in code, carries inputs_used + classifier_version
 *   - unclassifiable footprint resolves to 'emerging' (recommended default)
 *   - a single social channel with recent activity does NOT classify
 *     identically to a dormant one (activity, not channel count)
 *   - deterministic: same input → same output
 *   - audience (review volume) does NOT affect the side — surface routes
 *     (decided 2026-10-13: the platform's priorities are surface/presence)
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFootprintSide,
  FOOTPRINT_SIDE_CLASSIFIER_VERSION,
  COMPETITIVE_DENSITY_THRESHOLD,
} from '../footprint-side';
import type { BusinessAnalysisAuditData } from '../../outreach-openers/archetype-selection';

const NOW = new Date('2026-10-13T12:00:00Z');
const RECENT = '2026-10-10';
const STALE = '2025-01-01';

function audit(partial: Partial<BusinessAnalysisAuditData>): BusinessAnalysisAuditData {
  return {
    combined_review_metrics: {
      observable_unanswered_reviews: 0,
      observable_unanswered_rate_percent: 0,
      observable_unanswered_negative_reviews: 0,
    },
    ...partial,
  } as BusinessAnalysisAuditData;
}

describe('classifyFootprintSide', () => {
  it('unclassifiable footprint resolves to emerging with score 0', () => {
    for (const input of [null, undefined, {} as any, audit({})]) {
      const r = classifyFootprintSide(input as any, NOW);
      expect(r.side).toBe('emerging');
      expect(r.density_score).toBe(0);
      expect(r.inputs_used).toEqual([]);
      expect(r.classifier_version).toBe(FOOTPRINT_SIDE_CLASSIFIER_VERSION);
    }
  });

  it('a dormant lone social channel scores lower than an active one', () => {
    const dormant = classifyFootprintSide(
      audit({
        channels_scanned: [
          { channel: 'facebook', rendered: true, last_activity: STALE },
        ],
      }),
      NOW,
    );
    const active = classifyFootprintSide(
      audit({
        channels_scanned: [
          {
            channel: 'instagram',
            rendered: true,
            last_activity: RECENT,
            notable_activity: ['9,320 followers, weekly posts'],
          },
        ],
      }),
      NOW,
    );

    // Not identical: activity evidence separates them (spec acceptance).
    expect(active.density_score).toBeGreaterThan(dormant.density_score);
    expect(dormant.inputs_used).toContain('channels_scanned[facebook].rendered');
    expect(active.inputs_used).toContain(
      `channels_scanned[instagram].last_activity=${RECENT}`,
    );
    expect(active.inputs_used).toContain('channels_scanned[instagram].notable_activity');
    // A lone active social page is still an emerging footprint.
    expect(active.side).toBe('emerging');
    expect(dormant.side).toBe('emerging');
  });

  it('a working owned site anchors the score without a channel entry', () => {
    const r = classifyFootprintSide(
      audit({
        website: { url: 'https://example.com', status: 'working' },
      }),
      NOW,
    );
    expect(r.density_score).toBe(4);
    expect(r.inputs_used).toContain('website.status=working');
    expect(r.side).toBe('emerging');
  });

  it('a rendered owned_site channel entry anchors when the website block is thin', () => {
    const r = classifyFootprintSide(
      audit({
        website: { status: 'unable_to_verify' },
        channels_scanned: [{ channel: 'owned_site', rendered: true }],
      }),
      NOW,
    );
    // One surface, one contribution: the +4 anchor only — owned_site is
    // excluded from the rendered-channel points so it never double-counts.
    expect(r.density_score).toBe(4);
    expect(r.inputs_used).toContain('channels_scanned[owned_site].rendered');
  });

  it('social/builder website URLs do not anchor', () => {
    const r = classifyFootprintSide(
      audit({
        website: { url: 'https://instagram.com/shop', status: 'working' },
      }),
      NOW,
    );
    expect(r.density_score).toBe(0);
    expect(r.inputs_used).not.toContain('website.status=working');
  });

  it('the Dreamcast-shaped audit scores a real multi-surface footprint', () => {
    const r = classifyFootprintSide(
      audit({
        website: { url: 'https://dreamcastmarket.com', status: 'broken' },
        channels_scanned: [
          {
            channel: 'instagram',
            rendered: true,
            last_activity: RECENT,
            notable_activity: ['9,320 followers'],
            offers_observed: ['free delivery over $200'],
          },
          { channel: 'apple_maps', rendered: true },
          { channel: 'directory', rendered: true, url: 'https://mapquest.com/...' },
          { channel: 'whatsapp', rendered: false, access_barrier: 'login_wall' },
        ],
        platforms: {
          // total_reviews deliberately absent — audience volume is not a
          // routing input (only profile_status + rating are read).
          google: { profile_status: 'unclaimed', rating: 4.6 },
        },
      }),
      NOW,
    );
    // 3 rendered channels (6) + recent (1) + notable (1) + rated platform (1)
    // = 9 — a real footprint short of competitive: presence still leads.
    expect(r.density_score).toBe(9);
    expect(r.side).toBe('emerging');
    // login-walled whatsapp contributes nothing but the attempt is upstream.
    expect(r.inputs_used).not.toContain('channels_scanned[whatsapp].rendered');
  });

  it('a dense footprint classifies competitive', () => {
    const r = classifyFootprintSide(
      audit({
        website: { url: 'https://example.com', status: 'working' },
        channels_scanned: [
          { channel: 'google', rendered: true, last_activity: RECENT, notable_activity: ['82 photos'] },
          { channel: 'yelp', rendered: true, last_activity: RECENT },
          { channel: 'facebook', rendered: true, last_activity: RECENT, notable_activity: ['weekly posts'] },
          { channel: 'instagram', rendered: true },
        ],
        platforms: {
          google: { profile_status: 'claimed', rating: 4.8, total_reviews: 212 },
          yelp: { profile_status: 'claimed', rating: 4.2, total_reviews: 95 },
          facebook: { profile_status: 'claimed' },
        },
        combined_review_metrics: {
          observable_total_reviews: 307,
          observable_unanswered_reviews: 0,
          observable_unanswered_rate_percent: 0,
          observable_unanswered_negative_reviews: 0,
        },
      }),
      NOW,
    );
    expect(r.side).toBe('competitive');
    expect(r.density_score).toBeGreaterThanOrEqual(COMPETITIVE_DENSITY_THRESHOLD);
    // 307 reviews is in the fixture but never scored — audience is not a
    // routing input (decided 2026-10-13).
    expect(r.inputs_used).not.toContain(
      'combined_review_metrics.observable_total_reviews=307',
    );
  });

  it('review volume does not move the side — surface routes', () => {
    const surface = {
      channels_scanned: [
        { channel: 'instagram', rendered: true, last_activity: RECENT },
        { channel: 'facebook', rendered: true, last_activity: RECENT },
      ],
    };
    const quiet = classifyFootprintSide(audit({ ...surface }), NOW);
    const loud = classifyFootprintSide(
      audit({
        ...surface,
        combined_review_metrics: {
          observable_total_reviews: 612,
          observable_unanswered_reviews: 0,
          observable_unanswered_rate_percent: 0,
          observable_unanswered_negative_reviews: 0,
        },
      }),
      NOW,
    );
    expect(loud.density_score).toBe(quiet.density_score);
    expect(loud.side).toBe(quiet.side);
    expect(loud.inputs_used).toEqual(quiet.inputs_used);
  });

  it('not_attempted channels contribute nothing', () => {
    const r = classifyFootprintSide(
      audit({
        channels_scanned: [
          { channel: 'tiktok', rendered: false, access_barrier: 'not_attempted' },
          { channel: 'yelp', rendered: false, access_barrier: 'not_attempted' },
        ],
      }),
      NOW,
    );
    expect(r.density_score).toBe(0);
    expect(r.side).toBe('emerging');
  });

  it('is deterministic — same input, same output', () => {
    const data = audit({
      channels_scanned: [
        { channel: 'instagram', rendered: true, last_activity: RECENT },
      ],
    });
    expect(classifyFootprintSide(data, NOW)).toEqual(classifyFootprintSide(data, NOW));
  });
});
