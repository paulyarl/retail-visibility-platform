/**
 * Discovery Verdict — two-lane triage pure-function tests.
 *
 * deriveDiscoverySignals translates Category Discovery evidence (INT_*
 * codes, competitive_weaknesses, bronze_attribution, candidate field
 * absences) into canonical audit-family signal codes for the partial-verdict
 * lane. §S1 is preserved: INT_* codes are NEVER emitted — only their mapped
 * RA/DS/WC/CP/VP equivalents.
 *
 * computeSeedConfidence scores a discovery prospect's seed-worthiness
 * (identity corroboration, fit, location, provenance, NAP) — the confidence
 * meter toward a directory seed.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveDiscoverySignals,
  computeSeedConfidence,
} from '../discovery-verdict';

describe('deriveDiscoverySignals', () => {
  it('maps INT_* codes with audit-family equivalents — and never emits INT_*', () => {
    const { signals, contributions } = deriveDiscoverySignals({
      discoverySignals: ['INT_LOW_VISIBILITY', 'INT_MISSING_WEBSITE', 'INT_HIDDEN_TRUST'],
    });
    expect(signals).toContain('DS_MISSING_PROFILE');
    expect(signals).toContain('WC_MISSING_WEBSITE');
    // INT_HIDDEN_TRUST is an identity/positive signal — no defect equivalent.
    expect(signals).not.toContain('INT_HIDDEN_TRUST');
    expect(signals.every((s) => !s.startsWith('INT_'))).toBe(true);
    expect(contributions.find((c) => c.code === 'DS_MISSING_PROFILE')?.via).toBe('int_signal');
  });

  it('maps competitive weakness keys (the pitch wedge) into audit signals', () => {
    const { signals, contributions } = deriveDiscoverySignals({
      competitiveWeaknesses: [
        { weakness_key: 'website_gap', basis: 'no website on any profile' },
        { weakness_key: 'nap_drift', basis: 'address differs on Yelp' },
        { weakness_key: 'thin_media_surface' },
        { weakness_key: 'review_response_absent' },
        { weakness_key: 'unclaimed_secondary_profiles' },
      ],
    });
    expect(signals).toEqual(expect.arrayContaining([
      'WC_MISSING_WEBSITE',
      'CP_NAP_NAME_DRIFT',
      'DS_PHOTO_DEFICIT',
      'RA_UNADDRESSED_POSITIVE_BACKLOG',
      'DS_CLAIMED_STATUS',
    ]));
    const wc = contributions.find((c) => c.code === 'WC_MISSING_WEBSITE');
    expect(wc?.via).toBe('weakness_key');
    expect(wc?.ref).toBe('website_gap');
    expect(wc?.basis).toBe('no website on any profile');
  });

  it('maps bronze reason keys into audit signals', () => {
    const { signals } = deriveDiscoverySignals({
      bronzeAttribution: [
        { reason_key: 'no_website_or_contact' },
        { reason_key: 'stale_or_missing_hours' },
        { reason_key: 'unclaimed_profile' },
      ],
    });
    expect(signals).toEqual(expect.arrayContaining([
      'WC_MISSING_WEBSITE',
      'CP_MISSING_CONTACT_INFO',
      'DS_OUTDATED_HOURS',
      'DS_CLAIMED_STATUS',
    ]));
  });

  it('leaves hunt-mechanism reasons and unknown keys unmapped', () => {
    const { signals } = deriveDiscoverySignals({
      bronzeAttribution: [
        { reason_key: 'trade_manifest_only' },
        { reason_key: 'wholesale_or_hybrid_role' },
        { reason_key: 'some_future_reason' },
      ],
      competitiveWeaknesses: [{ weakness_key: 'some_future_weakness' }],
      discoverySignals: ['INT_FUTURE_CODE'],
      website: 'https://real-site.example.com',
      phone: '555-1234',
      reviewCount: 200,
    });
    expect(signals).toEqual([]);
  });

  it('derives field-level observations (website absent, low review volume, no contact path)', () => {
    const { signals } = deriveDiscoverySignals({
      website: null,
      phone: null,
      reviewCount: 8,
    });
    expect(signals).toEqual(expect.arrayContaining([
      'WC_MISSING_WEBSITE',
      'CP_MISSING_CONTACT_INFO',
      'RA_LOW_REVIEW_VOLUME',
    ]));
  });

  it('classifies a social-page website as third-party domain, not missing', () => {
    const { signals } = deriveDiscoverySignals({
      website: 'facebook.com/some-biz',
      phone: '555-1234',
    });
    expect(signals).toContain('WC_THIRD_PARTY_DOMAIN');
    expect(signals).not.toContain('WC_MISSING_WEBSITE');
    expect(signals).not.toContain('CP_MISSING_CONTACT_INFO');
  });

  it('classifies a free builder subdomain', () => {
    const { signals } = deriveDiscoverySignals({
      website: 'https://myshop.wixsite.com/home',
      phone: '555-1234',
    });
    expect(signals).toContain('WC_BUILDER_SUBDOMAIN');
    expect(signals).not.toContain('WC_MISSING_WEBSITE');
  });

  it('dedupes codes emitted by multiple findings', () => {
    const { signals, contributions } = deriveDiscoverySignals({
      discoverySignals: ['INT_LOW_VISIBILITY'],
      competitiveWeaknesses: [{ weakness_key: 'single_platform_concentration' }],
      bronzeAttribution: [{ reason_key: 'no_mainstream_profile' }],
    });
    expect(signals.filter((s) => s === 'DS_MISSING_PROFILE')).toHaveLength(1);
    // All three findings are recorded as provenance for the same code.
    expect(contributions.filter((c) => c.code === 'DS_MISSING_PROFILE')).toHaveLength(3);
  });
});

describe('computeSeedConfidence', () => {
  it('scores a well-corroborated in-market prospect high', () => {
    const result = computeSeedConfidence({
      identityConfidence: 'high',
      categoryFit: 'verified',
      locationStatus: 'inside_city',
      businessSeekPriority: 'high',
      discoverySignals: ['INT_MULTISOURCE_IDENTITY', 'INT_ACTIVE_OPERATIONAL_EVIDENCE'],
      provenanceCount: 3,
      ownershipType: 'independent',
      hasAddress: true,
      hasPhone: true,
      hasWebsite: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.band).toBe('high');
  });

  it('scores a thin single-source prospect low', () => {
    const result = computeSeedConfidence({
      identityConfidence: 'low',
      categoryFit: 'probable',
      locationStatus: 'metro_area',
      discoverySignals: ['INT_SINGLE_SOURCE'],
      provenanceCount: 1,
      hasAddress: true,
    });
    expect(result.band).toBe('low');
    expect(result.score).toBeLessThan(40);
  });

  it('floors at zero for out-of-market chains', () => {
    const result = computeSeedConfidence({
      identityConfidence: 'high',
      categoryFit: 'verified',
      locationStatus: 'outside_market',
      ownershipType: 'national_chain',
      discoverySignals: ['INT_MULTISOURCE_IDENTITY'],
      provenanceCount: 4,
    });
    expect(result.score).toBe(0);
    expect(result.band).toBe('insufficient');
  });

  it('verification outcome outweighs discovery heuristics', () => {
    const operational = computeSeedConfidence({
      identityConfidence: 'medium',
      categoryFit: 'probable',
      verificationOutcome: 'operational',
    });
    const closed = computeSeedConfidence({
      identityConfidence: 'medium',
      categoryFit: 'probable',
      verificationOutcome: 'closed',
    });
    expect(operational.score).toBeGreaterThan(closed.score);
    expect(closed.score).toBe(0);
  });

  it('returns factors explaining the score', () => {
    const result = computeSeedConfidence({
      identityConfidence: 'high',
      categoryFit: 'insufficient',
      discoverySignals: ['INT_SINGLE_SOURCE'],
    });
    expect(result.factors).toContainEqual({ label: 'identity_confidence: high', delta: 30 });
    expect(result.factors).toContainEqual({ label: 'category_fit: insufficient', delta: -20 });
    expect(result.factors).toContainEqual({ label: 'single source only', delta: -10 });
  });
});
