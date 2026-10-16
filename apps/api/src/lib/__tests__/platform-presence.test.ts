/**
 * Platform presence — the shared delegate.
 *
 * This module replaced FOUR independent derivations of "which platforms is this
 * business on", each of which shipped a defect: a Yelp listing asserted for a
 * business with none, an absent Yelp and BBB reported as platforms the business
 * was ON (inverting A8's presence map), and "Bbb" / "Apple maps" rendered into
 * prompts and owner-facing PDFs.
 */
import { describe, it, expect } from 'vitest';
import {
  platformPresence,
  platformLabel,
  platformLabels,
  platformShortLabel,
  platformShortLabels,
} from '../platform-presence';

const audit = (overrides: Record<string, unknown> = {}) =>
  ({
    platforms: {
      google: { profile_status: 'likely_claimed', data_status: 'complete' },
      yelp: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
      facebook: { profile_status: 'likely_claimed', data_status: 'partial' },
      bbb: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
    },
    render_controls: [
      { platform: 'google', determination: 'platform_available' },
      { platform: 'facebook', determination: 'platform_available' },
      { platform: 'yelp', determination: 'business_specific_failure' },
      { platform: 'bbb', determination: 'business_specific_failure' },
      { platform: 'apple_maps', determination: 'business_specific_failure' },
      { platform: 'bing', determination: 'business_specific_failure' },
    ],
    ...overrides,
  } as any);

describe('platformLabel', () => {
  it('renders acronyms and snake_case keys correctly', () => {
    expect(platformLabel('google')).toBe('Google Business Profile');
    expect(platformLabel('bbb')).toBe('BBB');
    expect(platformLabel('apple_maps')).toBe('Apple Maps');
    expect(platformLabel('bing')).toBe('Bing');
    // Unknown keys still humanize rather than dropping.
    expect(platformLabel('some_new_platform')).toBe('Some new platform');
    expect(platformLabels(['yelp', 'bbb'])).toEqual(['Yelp', 'BBB']);
  });

  it('carries a second, conversational register', () => {
    // The consolidation surfaced that one label cannot serve both a field list
    // ("Google Business Profile") and a spoken sentence ("across Google, …").
    expect(platformShortLabel('google')).toBe('Google');
    expect(platformShortLabel('bbb')).toBe('BBB');
    expect(platformShortLabels(['google', 'facebook'])).toEqual(['Google', 'Facebook']);
  });
});

describe('platformPresence', () => {
  it('requires a claim verdict for presence — unable_to_verify attributes nothing', () => {
    const p = platformPresence(audit());
    expect(p.presentKeys).toEqual(['google', 'facebook']);
    expect(p.claimedKeys).toEqual(['google', 'facebook']);
    expect(p.unclaimedKeys).toEqual([]);
    // The absence of a finding is neither present nor unclaimed.
    expect(p.presentKeys).not.toContain('yelp');
    expect(p.unclaimedKeys).not.toContain('yelp');
  });

  it('separates unclaimed from claimed while counting both as present', () => {
    const p = platformPresence(
      audit({
        platforms: {
          google: { profile_status: 'claimed', data_status: 'complete' },
          facebook: { profile_status: 'unclaimed', data_status: 'partial' },
        },
      }),
    );
    expect(p.presentKeys).toEqual(['google', 'facebook']);
    expect(p.claimedKeys).toEqual(['google']);
    expect(p.unclaimedKeys).toEqual(['facebook']);
  });

  it('collects verified absence from data_status and render controls', () => {
    const p = platformPresence(audit());
    // Yelp + BBB from `data_status`, plus the non-primary platforms that carry
    // only a render-control attempt.
    expect(p.missingKeys.sort()).toEqual(['apple_maps', 'bbb', 'bing', 'yelp']);
  });

  it('never reports a verified-present or restricted platform as missing', () => {
    const p = platformPresence(
      audit({
        platforms: {
          google: { profile_status: 'claimed', data_status: 'complete' },
          facebook: { profile_status: 'unable_to_verify', data_status: 'restricted' },
        },
        render_controls: [
          { platform: 'google', determination: 'business_specific_failure' },
          { platform: 'facebook', determination: 'business_specific_failure' },
        ],
      }),
    );
    expect(p.missingKeys).toEqual([]);
    expect(p.restrictedKeys).toEqual(['facebook']);
  });

  it('reports evidenced platforms only when the block rendered', () => {
    const p = platformPresence(audit());
    expect(p.evidencedKeys).toEqual(['google', 'facebook']);
  });

  it('tolerates a missing or empty payload', () => {
    for (const input of [null, undefined, {}, { platforms: {} }]) {
      const p = platformPresence(input as any);
      expect(p).toEqual({
        presentKeys: [],
        claimedKeys: [],
        unclaimedKeys: [],
        missingKeys: [],
        restrictedKeys: [],
        evidencedKeys: [],
      });
    }
  });
});
