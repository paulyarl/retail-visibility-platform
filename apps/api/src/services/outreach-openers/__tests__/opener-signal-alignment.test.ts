/**
 * Opener ↔ audit alignment.
 *
 * The playbook briefings read the audit's STRUCTURED fields (`data_status`,
 * `render_controls`, `alternate_profiles`); the opener extractors read key
 * presence. These two tests pin the two places that gap produced a wrong
 * opener for the Arsema prospect:
 *
 *   1. `platforms_with_listings` was keyed on platform-block PRESENCE. The
 *      audit always emits all four blocks (google/yelp/facebook/bbb are
 *      schema-required), so the list was effectively constant and the A3/A5
 *      openers told an owner they "show up differently across Yelp, Google and
 *      Facebook" when no Yelp listing existed.
 *
 *   2. `DS_MISSING_PROFILE` was a blanket crisis for ANY absent platform, so a
 *      missing Yelp page outranked a duplicated Google identity that split 30
 *      reviews across two listings — inverting which finding the opener leads
 *      with, in a category where zero Yelp presence is the norm.
 */
import { describe, it, expect } from 'vitest';
import {
  extractA3Fields,
  extractA5Fields,
  extractA8Fields,
  type CommonFields,
} from '../field-extractors';
import { computeSignalSeverity, computePrimarySignalSeverity } from '../signal-magnitude';
import type { BusinessAnalysisAuditData } from '../archetype-selection';

const common: CommonFields = {
  business_name: 'Arsema G Food Mart LLC',
  contact_name: null,
  tone: 'short informal',
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 603-3274',
  website_url: 'https://arsemamart.square.site/',
  business_origin: null,
  triggered_signals: [],
  primary_signal_severity: 'material',
  strongest_co_occurring: null,
};

function baseAudit(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: {
      google: { profile_status: 'likely_claimed', data_status: 'complete' },
      yelp: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
      facebook: { profile_status: 'likely_claimed', data_status: 'partial' },
      bbb: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
    } as any,
    combined_review_metrics: {
      observable_unanswered_reviews: 30,
      observable_unanswered_rate_percent: 100,
      observable_unanswered_negative_reviews: 0,
    },
    website: { url: 'https://arsemamart.square.site/', status: 'working' },
    nap_consistency: { overall_status: 'major_inconsistencies' },
    ...overrides,
  };
}

describe('platforms_with_listings — keyed on the audit, not on block presence', () => {
  it('excludes a platform verified absent', () => {
    // Yelp and BBB are `unavailable` — no listing exists. The opener must not
    // claim the business "shows up differently across Yelp".
    expect(extractA3Fields(baseAudit(), common).platforms_with_listings).toEqual([
      'Google',
      'Facebook',
    ]);
    expect(extractA5Fields(baseAudit(), common).platforms_with_listings).toEqual([
      'Google',
      'Facebook',
    ]);
  });

  it('excludes a restricted profile — it exists, but not to the public', () => {
    const audit = baseAudit({
      platforms: {
        google: { profile_status: 'claimed', data_status: 'complete' },
        facebook: { profile_status: 'unable_to_verify', data_status: 'restricted' },
        yelp: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
      } as any,
    });
    expect(extractA5Fields(audit, common).platforms_with_listings).toEqual(['Google']);
  });

  it('falls back to key-presence when no block carries a status', () => {
    // Legacy audits (and any model that leaves data_status unset) must keep
    // the old list rather than rendering an empty one.
    const audit = baseAudit({
      platforms: { google: { profile_status: 'claimed' }, yelp: {}, facebook: {} } as any,
    });
    expect(extractA5Fields(audit, common).platforms_with_listings).toEqual([
      'Google',
      'Yelp',
      'Facebook',
    ]);
  });
});

describe('DS_MISSING_PROFILE severity — depends on WHICH platform is absent', () => {
  it('is material when only non-Google platforms are absent', () => {
    // yelp + bbb unavailable, google complete.
    expect(computeSignalSeverity('DS_MISSING_PROFILE', baseAudit())).toBe('material');
  });

  it('is crisis when Google itself is absent', () => {
    const audit = baseAudit({
      platforms: {
        google: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
        facebook: { profile_status: 'likely_claimed', data_status: 'partial' },
      } as any,
    });
    expect(computeSignalSeverity('DS_MISSING_PROFILE', audit)).toBe('crisis');
  });

  it('preserves the crisis default when no platform is identifiable as absent', () => {
    const audit = baseAudit({
      platforms: { google: { profile_status: 'claimed' }, yelp: {} } as any,
    });
    expect(computeSignalSeverity('DS_MISSING_PROFILE', audit)).toBe('crisis');
  });

  it('keeps a duplicate listing at material, so it is not outranked by an absent Yelp page', () => {
    const audit = baseAudit();
    expect(computeSignalSeverity('DS_DUPLICATE_LISTING', audit)).toBe('material');
    expect(computeSignalSeverity('DS_MISSING_PROFILE', audit)).toBe('material');
  });
});

describe('A8 primary severity — same platform-aware rule', () => {
  // The A8 archetype owns profile presence. Its primary severity selects the
  // crisis-framing preamble, so the same blanket "any absent platform is a
  // crisis" assumption there would still lead an A8 opener on a
  // category-normal absence.
  const withDetected = (
    detected: string[],
    platforms: Record<string, unknown>,
    renderControls: Array<Record<string, unknown>> = [],
  ) =>
    baseAudit({
      platforms: platforms as any,
      detected_signals: detected,
      render_controls: renderControls as any,
    } as any);

  it('is material, not crisis, when only non-Google platforms are absent', () => {
    const audit = withDetected(
      ['DS_MISSING_PROFILE', 'DS_DUPLICATE_LISTING'],
      {
        google: { profile_status: 'likely_claimed', data_status: 'complete' },
        yelp: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
        facebook: { profile_status: 'likely_claimed', data_status: 'partial' },
        bbb: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
      },
      [
        { platform: 'google', determination: 'platform_available' },
        { platform: 'yelp', determination: 'business_specific_failure' },
        { platform: 'bbb', determination: 'business_specific_failure' },
        { platform: 'apple_maps', determination: 'business_specific_failure' },
        { platform: 'bing', determination: 'business_specific_failure' },
      ],
    );
    expect(computePrimarySignalSeverity('A8', audit)).toBe('material');
  });

  it('is crisis when Google itself is absent', () => {
    const audit = withDetected(
      ['DS_MISSING_PROFILE'],
      {
        google: { profile_status: 'unable_to_verify', data_status: 'unavailable' },
        facebook: { profile_status: 'likely_claimed', data_status: 'partial' },
      },
      [{ platform: 'google', determination: 'business_specific_failure' }],
    );
    expect(computePrimarySignalSeverity('A8', audit)).toBe('crisis');
  });

  it('is crisis on genuine invisibility regardless of platform detail', () => {
    const audit = withDetected(
      ['DS_ZERO_INDEXED_PRESENCE'],
      { google: { profile_status: 'unable_to_verify', data_status: 'unavailable' } },
    );
    expect(computePrimarySignalSeverity('A8', audit)).toBe('crisis');

    const suspended = withDetected(
      ['DS_PROFILE_SUSPENDED'],
      { google: { profile_status: 'claimed', data_status: 'complete' } },
    );
    expect(computePrimarySignalSeverity('A8', suspended)).toBe('crisis');
  });

  it('is crisis when no platform is present at all', () => {
    const audit = withDetected(
      [],
      { google: { profile_status: 'unable_to_verify', data_status: 'unavailable' } },
    );
    expect(computePrimarySignalSeverity('A8', audit)).toBe('crisis');
  });
});

describe('A8 presence map — verified absence is not presence', () => {
  it('does not put an unverified or absent platform in present_platforms', () => {
    // Yelp and BBB are `unavailable` with profile_status `unable_to_verify`.
    // The old `else` bucket made them PRESENT, and the delete that follows then
    // erased their render-control-confirmed absence — so A8's presence map said
    // the business was on the two platforms it is verified missing from.
    const audit = baseAudit({
      detected_signals: ['DS_MISSING_PROFILE'],
      render_controls: [
        { platform: 'google', determination: 'platform_available' },
        { platform: 'facebook', determination: 'platform_available' },
        { platform: 'yelp', determination: 'business_specific_failure' },
        { platform: 'bbb', determination: 'business_specific_failure' },
      ],
    } as any);
    const fields = extractA8Fields(audit, common);

    expect(fields.present_platforms).toEqual(['Google Business Profile', 'Facebook']);
    expect(fields.present_platforms).not.toContain('Yelp');
    expect(fields.missing_platforms).toContain('Yelp');
    expect(fields.missing_platforms).toContain('BBB');
  });

  it('still treats a claimed platform as present and unclaimed as unclaimed', () => {
    const audit = baseAudit({
      platforms: {
        google: { profile_status: 'claimed', data_status: 'complete' },
        facebook: { profile_status: 'unclaimed', data_status: 'partial' },
      } as any,
    });
    const fields = extractA8Fields(audit, common);

    expect(fields.present_platforms).toEqual(['Google Business Profile']);
    expect(fields.unclaimed_platforms).toEqual(['Facebook']);
  });
});

describe('remaining archetype severities read the audit, not a placeholder', () => {
  it('RA_UNADDRESSED_POSITIVE_BACKLOG scales with the count', () => {
    const withPositive = (n: number) =>
      baseAudit({
        combined_review_metrics: {
          observable_unanswered_reviews: n,
          observable_unanswered_positive_reviews: n,
          observable_unanswered_negative_reviews: 0,
        },
      } as any);

    // 30 unanswered five-star reviews is the strongest finding on this prospect.
    expect(computeSignalSeverity('RA_UNADDRESSED_POSITIVE_BACKLOG', withPositive(30))).toBe('crisis');
    expect(computeSignalSeverity('RA_UNADDRESSED_POSITIVE_BACKLOG', withPositive(10))).toBe('material');
    expect(computeSignalSeverity('RA_UNADDRESSED_POSITIVE_BACKLOG', withPositive(2))).toBe('borderline');
  });

  it('A2 severity comes from the observed negative backlog, not supporting_review_count', () => {
    // The audit directive tells the model to leave supporting_review_count
    // null, so the old read pinned every A2 campaign at material.
    const withThemesOnly = baseAudit({
      negative_review_themes: [{ theme: 'Service quality', supporting_review_count: null }],
    } as any);
    expect(computePrimarySignalSeverity('A2', withThemesOnly)).toBe('borderline');

    const withBacklog = baseAudit({
      combined_review_metrics: {
        observable_unanswered_reviews: 12,
        observable_unanswered_positive_reviews: 0,
        observable_unanswered_negative_reviews: 12,
      },
    } as any);
    expect(computePrimarySignalSeverity('A2', withBacklog)).toBe('crisis');

    const bbbSuppressed = baseAudit({ detected_signals: ['RA_BBB_GRADE_SUPPRESSION'] } as any);
    expect(computePrimarySignalSeverity('A2', bbbSuppressed)).toBe('crisis');
  });

  it('A6 treats a present-but-broken URL as a crisis, not a healthy website', () => {
    const broken = baseAudit({
      website: { url: 'https://arsemamart.square.site/', status: 'broken' },
    } as any);
    expect(computePrimarySignalSeverity('A6', broken)).toBe('crisis');

    const working = baseAudit({
      website: { url: 'https://arsemamart.square.site/', status: 'working' },
    } as any);
    expect(computePrimarySignalSeverity('A6', working)).toBe('material');

    const noSite = baseAudit({ website: { url: null, status: 'none_found' } } as any);
    expect(computePrimarySignalSeverity('A6', noSite)).toBe('crisis');
  });
});
