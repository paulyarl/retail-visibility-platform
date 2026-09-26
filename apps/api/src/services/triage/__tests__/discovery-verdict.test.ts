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
  discoveryDoubtMarkers,
  discoveryOperationalStatus,
  seedTiltForSignal,
  loadSignalSeedWiring,
  type SignalSeedWiring,
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

  it('resolves model-invented reason keys through the alias table', () => {
    // Real scan output (Milwaukee emerging scan) invented non-catalog keys;
    // the alias map recovers the defect signal the scan was describing while
    // the contribution keeps the original key for provenance.
    const { signals, contributions } = deriveDiscoverySignals({
      bronzeAttribution: [
        { reason_key: 'rename_residue_splits_the_discovery_trace', basis: 'two trade names at one address' },
        { reason_key: 'community_directory_only_presence' },
      ],
    });
    expect(signals).toEqual(expect.arrayContaining(['CP_NAP_NAME_DRIFT', 'DS_MISSING_PROFILE']));
    expect(contributions.map((c) => c.ref)).toEqual(
      expect.arrayContaining(['rename_residue_splits_the_discovery_trace', 'community_directory_only_presence']),
    );
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

describe('discoveryDoubtMarkers', () => {
  it('returns no markers for a clean strong discovery', () => {
    expect(
      discoveryDoubtMarkers({
        identityConfidence: 'high',
        categoryFit: 'verified',
        locationStatus: 'inside_city',
        discoverySignals: ['INT_MULTISOURCE_IDENTITY', 'INT_ACTIVE_OPERATIONAL_EVIDENCE'],
      }),
    ).toEqual([]);
  });

  it('flags identity/scope doubt from every carrier', () => {
    const markers = discoveryDoubtMarkers({
      identityConfidence: 'low',
      categoryFit: 'insufficient',
      locationStatus: 'outside_market',
      businessSeekPriority: 'hold',
      discoverySignals: ['INT_POSSIBLE_CATEGORY_MISALIGNMENT', 'INT_SINGLE_SOURCE'],
      bronzeAttribution: [{ reason_key: 'alternate_identity' }],
      competitiveWeaknesses: [{ weakness_key: 'nap_drift' }, { weakness_key: 'category_drift' }],
    });
    expect(markers).toEqual(
      expect.arrayContaining([
        'identity_confidence_low',
        'category_fit_insufficient',
        'outside_market',
        'seek_priority_hold',
        'category_misalignment',
        'single_source',
        'alternate_identity',
        'nap_drift',
        'category_drift',
      ]),
    );
  });

  it('resolves invented bronze keys through the alias table', () => {
    // 'rename_residue_splits_the_discovery_trace' aliases to
    // 'alternate_identity' — the doubt is honored even when the model
    // improvised the reason key.
    expect(
      discoveryDoubtMarkers({
        bronzeAttribution: [{ reason_key: 'rename_residue_splits_the_discovery_trace' }],
      }),
    ).toContain('alternate_identity');
  });

  it('does not flag hunt-mechanism reasons or healthy assessments', () => {
    expect(
      discoveryDoubtMarkers({
        identityConfidence: 'medium',
        categoryFit: 'probable',
        locationStatus: 'adjacent_city',
        businessSeekPriority: 'medium',
        bronzeAttribution: [{ reason_key: 'no_mainstream_profile' }],
        competitiveWeaknesses: [{ weakness_key: 'website_gap' }],
      }),
    ).toEqual([]);
  });
});

describe('discoveryOperationalStatus', () => {
  it('lifts to likely_active on proven recent activity', () => {
    expect(discoveryOperationalStatus(['INT_ACTIVE_OPERATIONAL_EVIDENCE'])).toBe('likely_active');
    expect(discoveryOperationalStatus(['INT_RECENT_BUSINESS_EVIDENCE'])).toBe('likely_active');
  });

  it('stays silent without operational signals', () => {
    expect(discoveryOperationalStatus(['INT_MULTISOURCE_IDENTITY'])).toBeNull();
    expect(discoveryOperationalStatus([])).toBeNull();
    expect(discoveryOperationalStatus(null)).toBeNull();
  });
});

// ─── Registry playbook wiring (migration-308 pattern) ────────────────────
//
// The qualification-lane mirror of triage's signal playbook preferences: a
// detected signal's declared primary_playbook/secondary_playbook resolves to
// the routed playbook's archetype, which tilts the signal's seed semantics —
// visibility-gap playbooks (A4/A6/A7) corroborate the seed's purpose, a
// listing-drift playbook (A3) expresses identity doubt, reputation arcs
// (A1/A2/A5) are neutral.

describe('signal seed wiring (registry playbook preferences)', () => {
  /** Build a wiring row as loadSignalSeedWiring resolves it. */
  const wired = (
    code: string,
    primary: { pb: string; archetype: string } | null,
    secondary: { pb: string; archetype: string } | null = null,
  ): SignalSeedWiring => ({
    code,
    primaryPlaybook: primary?.pb ?? null,
    secondaryPlaybook: secondary?.pb ?? null,
    primaryArchetype: primary?.archetype ?? null,
    secondaryArchetype: secondary?.archetype ?? null,
  });

  describe('seedTiltForSignal', () => {
    it('maps routed archetypes to tilts — primary wins outright', () => {
      expect(seedTiltForSignal(wired('INT_X', { pb: 'PB-08', archetype: 'A7' }))).toBe('visibility');
      expect(seedTiltForSignal(wired('INT_X', { pb: 'PB-07', archetype: 'A6' }))).toBe('visibility');
      expect(seedTiltForSignal(wired('INT_X', { pb: 'PB-04', archetype: 'A4' }))).toBe('visibility');
      expect(seedTiltForSignal(wired('INT_X', { pb: 'PB-02', archetype: 'A3' }))).toBe('doubt');
      expect(seedTiltForSignal(wired('INT_X', { pb: 'PB-01', archetype: 'A1' }))).toBe('neutral');
    });

    it('a secondary-only route only flags doubt — visibility fallback scores nothing', () => {
      expect(seedTiltForSignal(wired('INT_X', null, { pb: 'PB-02', archetype: 'A3' }))).toBe('doubt');
      expect(seedTiltForSignal(wired('INT_X', null, { pb: 'PB-08', archetype: 'A7' }))).toBeNull();
    });

    it('returns null without wiring — callers fall back to canonical defaults', () => {
      expect(seedTiltForSignal(undefined)).toBeNull();
      expect(seedTiltForSignal(wired('INT_X', null, null))).toBeNull();
    });
  });

  describe('computeSeedConfidence with signal wiring', () => {
    const strong = {
      identityConfidence: 'high',
      categoryFit: 'verified',
      locationStatus: 'inside_city',
      discoverySignals: ['INT_VERTICAL_SOURCE_DISCOVERY'],
    };

    it('a visibility-tilted route adds a positive factor', () => {
      const plain = computeSeedConfidence(strong);
      const wiredResult = computeSeedConfidence({
        ...strong,
        signalWiring: [wired('INT_VERTICAL_SOURCE_DISCOVERY', { pb: 'PB-08', archetype: 'A7' })],
      });
      expect(wiredResult.score).toBe(plain.score + 5);
      expect(wiredResult.factors).toContainEqual({
        label: 'INT_VERTICAL_SOURCE_DISCOVERY → PB-08 (visibility gap)',
        delta: 5,
      });
    });

    it('a drift-tilted route subtracts', () => {
      const result = computeSeedConfidence({
        ...strong,
        signalWiring: [wired('INT_VERTICAL_SOURCE_DISCOVERY', { pb: 'PB-02', archetype: 'A3' })],
      });
      expect(result.factors).toContainEqual({
        label: 'INT_VERTICAL_SOURCE_DISCOVERY → PB-02 (identity-drift route)',
        delta: -5,
      });
    });

    it('declared wiring overrides the canonical term for that code', () => {
      const result = computeSeedConfidence({
        discoverySignals: ['INT_SINGLE_SOURCE'],
        signalWiring: [wired('INT_SINGLE_SOURCE', { pb: 'PB-08', archetype: 'A7' })],
      });
      // The canonical 'single source only' −10 is suppressed; the declared
      // visibility route contributes its own +5.
      expect(result.factors).not.toContainEqual({ label: 'single source only', delta: -10 });
      expect(result.factors).toContainEqual({
        label: 'INT_SINGLE_SOURCE → PB-08 (visibility gap)',
        delta: 5,
      });
    });

    it('a neutral route suppresses the canonical term entirely', () => {
      const result = computeSeedConfidence({
        discoverySignals: ['INT_ACTIVE_OPERATIONAL_EVIDENCE'],
        signalWiring: [wired('INT_ACTIVE_OPERATIONAL_EVIDENCE', { pb: 'PB-01', archetype: 'A1' })],
      });
      expect(result.factors).not.toContainEqual({ label: 'operational evidence', delta: 10 });
      expect(result.factors.every((f) => !f.label.includes('INT_ACTIVE'))).toBe(true);
    });
  });

  describe('discoveryDoubtMarkers with signal wiring', () => {
    it('flags a drift-routed signal as doubt — even an uncataloged code', () => {
      const markers = discoveryDoubtMarkers({
        discoverySignals: ['INT_SEASONAL_OPERATION'],
        signalWiring: [wired('INT_SEASONAL_OPERATION', { pb: 'PB-02', archetype: 'A3' })],
      });
      expect(markers).toContain('route_int_seasonal_operation');
    });

    it('visibility and reputation routes add no doubt', () => {
      const markers = discoveryDoubtMarkers({
        discoverySignals: ['INT_X'],
        signalWiring: [
          wired('INT_X', { pb: 'PB-08', archetype: 'A7' }, { pb: 'PB-01', archetype: 'A1' }),
        ],
      });
      expect(markers).toEqual([]);
    });

    it('canonical doubt is additive — a visibility route never un-flags it', () => {
      const markers = discoveryDoubtMarkers({
        discoverySignals: ['INT_SINGLE_SOURCE'],
        signalWiring: [wired('INT_SINGLE_SOURCE', { pb: 'PB-08', archetype: 'A7' })],
      });
      expect(markers).toContain('single_source');
      expect(markers).not.toContain('route_int_single_source');
    });
  });

  describe('loadSignalSeedWiring', () => {
    it('resolves declared prefs to playbook archetypes; skips unwired signals', async () => {
      const fake = {
        mkt_signal_registry: {
          findMany: async () => [
            { code: 'INT_SEASONAL_OPERATION', primary_playbook: 'PB-08', secondary_playbook: 'PB-02' },
            { code: 'INT_NO_PREF', primary_playbook: null, secondary_playbook: null },
          ],
        },
        mkt_playbook_catalog: {
          findMany: async () => [
            { code: 'PB-08', archetype: 'A7' },
            { code: 'PB-02', archetype: 'A3' },
          ],
        },
      };
      const wiring = await loadSignalSeedWiring(fake, ['INT_SEASONAL_OPERATION', 'INT_NO_PREF']);
      expect(wiring).toEqual([
        {
          code: 'INT_SEASONAL_OPERATION',
          primaryPlaybook: 'PB-08',
          secondaryPlaybook: 'PB-02',
          primaryArchetype: 'A7',
          secondaryArchetype: 'A3',
        },
      ]);
    });

    it('returns empty for no codes', async () => {
      const fake = {
        mkt_signal_registry: { findMany: async () => { throw new Error('should not be called'); } },
        mkt_playbook_catalog: { findMany: async () => [] },
      };
      expect(await loadSignalSeedWiring(fake, [])).toEqual([]);
    });
  });
});
