/**
 * identityScoring — pure identity-packet scoring tests.
 *
 * Covers:
 *   - tier weighting (authoritative outranks aggregators)
 *   - independence discount (aggregator echo cannot inflate a score)
 *   - conflict purity penalty
 *   - weakest-link aggregation over required fields
 *   - operational recency + call-verdict override
 *   - hard vetoes outranking any score
 *   - QC signal emission
 *   - recommendation bands
 */

import { describe, it, expect } from 'vitest';
import {
  scoreField,
  scoreOperational,
  scoreIdentityPacket,
  type IdentityFieldEvidence,
  type IdentitySourceRef,
  type IdentitySourceTier,
} from '../identityScoring';

const src = (
  name: string,
  tier: IdentitySourceTier,
  group: string,
  agrees = true,
): IdentitySourceRef => ({ name, tier, independenceGroup: group, agrees });

const field = (
  f: IdentityFieldEvidence['field'],
  value: string | null,
  sources: IdentitySourceRef[],
): IdentityFieldEvidence => ({ field: f, value, sources });

describe('scoreField', () => {
  it('gives a lone authoritative source full magnitude', () => {
    const s = scoreField(field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]));
    expect(s.score).toBe(100);
    expect(s.independentSources).toBe(1);
  });

  it('ranks a lone authoritative source above a lone aggregator', () => {
    const auth = scoreField(field('name', 'X', [src('IN SoS', 'authoritative', 'registry:in')]));
    const agg = scoreField(field('name', 'X', [src('Google', 'major_aggregator', 'google')]));
    expect(auth.score).toBeGreaterThan(agg.score);
  });

  it('discounts repeat sources in the same independence group', () => {
    // Three aggregators that all derive from Google — echo, not corroboration.
    const echoed = scoreField(
      field('name', 'X', [
        src('Google', 'major_aggregator', 'google'),
        src('Manta', 'secondary_aggregator', 'google'),
        src('Yelp', 'secondary_aggregator', 'google'),
      ]),
    );
    const independent = scoreField(
      field('name', 'X', [
        src('Google', 'major_aggregator', 'google'),
        src('Yelp', 'secondary_aggregator', 'yelp'),
        src('BBB', 'secondary_aggregator', 'bbb'),
      ]),
    );
    expect(independent.agreementWeight).toBeGreaterThan(echoed.agreementWeight);
    expect(independent.independentSources).toBe(3);
    expect(echoed.independentSources).toBe(1);
  });

  it('penalizes conflicting sources via purity', () => {
    const s = scoreField(
      field('address', '123 Main St', [
        src('Google', 'major_aggregator', 'google', true),
        src('Yelp', 'secondary_aggregator', 'yelp', false),
      ]),
    );
    expect(s.conflictWeight).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(100);
  });

  it('scores zero when there is no resolved value', () => {
    const s = scoreField(field('phone', null, [src('Google', 'major_aggregator', 'google')]));
    expect(s.score).toBe(0);
  });
});

describe('scoreOperational', () => {
  it('maps audit status to a recency score', () => {
    expect(scoreOperational('active')).toBe(100);
    expect(scoreOperational('likely_active')).toBe(70);
    expect(scoreOperational('inactive')).toBe(0);
    expect(scoreOperational('unable_to_verify')).toBe(0);
  });

  it('lets a call verdict override the audit in either direction', () => {
    expect(scoreOperational('inactive', true)).toBe(100);
    expect(scoreOperational('active', false)).toBe(0);
  });
});

describe('scoreIdentityPacket', () => {
  const strongFields = () => [
    field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
    field('address', '123 Main St', [src('IN SoS', 'authoritative', 'registry:in')]),
    field('phone', '555-0100', [src('Google', 'major_aggregator', 'google')]),
    field('website', 'https://arsema.example', [src('Owner site', 'first_party', 'owner')]),
  ];

  it('recommends push when identity is strong and operational is confirmed', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: strongFields(),
    });
    expect(p.band).toBe('ready');
    expect(p.pushRecommended).toBe(true);
    expect(p.vetoes).toHaveLength(0);
    expect(p.identityScore).toBe(100);
    expect(p.operationalScore).toBe(100);
  });

  it('drops to review when identity is moderate', () => {
    // Two independent aggregators agree on both required fields (weight 3/4 →
    // 75), but no registry/first-party evidence and no phone/website.
    const corroborated = [
      src('Google', 'major_aggregator', 'google'),
      src('Yelp', 'secondary_aggregator', 'yelp'),
    ];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', corroborated),
        field('address', '123 Main St', corroborated),
      ],
    });
    expect(p.identityScore).toBeGreaterThanOrEqual(50);
    expect(p.identityScore).toBeLessThan(80);
    expect(p.band).toBe('review');
    expect(p.pushRecommended).toBe(false);
  });

  it('vetoes on mismatched identity regardless of score', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'mismatched',
      operationalStatus: 'active',
      fields: strongFields(),
    });
    expect(p.vetoes.map((v) => v.code)).toContain('identity_mismatch');
    expect(p.band).toBe('blocked');
  });

  it('vetoes when a required field is missing', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')])],
    });
    expect(p.vetoes.map((v) => v.code)).toContain('missing_required_field');
    expect(p.identityScore).toBe(0);
    expect(p.band).toBe('blocked');
  });

  it('vetoes when a required field conflicts', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [
          src('Google', 'major_aggregator', 'google', true),
          src('Yelp', 'secondary_aggregator', 'yelp', false),
        ]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).toContain('required_field_conflict');
    expect(p.band).toBe('blocked');
  });

  it('applies weakest-link — a strong name cannot hide a weak address', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [src('Manta', 'secondary_aggregator', 'manta')]),
      ],
    });
    // Address (one secondary aggregator = weight 1/4 → 25) drives the score.
    expect(p.identityScore).toBeLessThan(50);
    expect(p.band).toBe('blocked');
  });

  it('penalizes missing important fields', () => {
    const withPhone = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('phone', '555-0100', [src('Google', 'major_aggregator', 'google')]),
        field('website', 'https://arsema.example', [src('Owner site', 'first_party', 'owner')]),
      ],
    });
    const without = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [src('IN SoS', 'authoritative', 'registry:in')]),
      ],
    });
    expect(without.identityScore).toBeLessThan(withPhone.identityScore);
  });

  it('emits QC signals for missing fields, low recency, and thin corroboration', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'ambiguous',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', [src('Google', 'major_aggregator', 'google')]),
        field('address', '123 Main St', [src('Google', 'major_aggregator', 'google')]),
      ],
    });
    const codes = p.qcSignals.map((s) => s.code);
    expect(codes).toContain('identity_ambiguous');
    expect(codes).toContain('missing_phone');
    expect(codes).toContain('missing_website');
    expect(codes).toContain('missing_hours');
    expect(codes).toContain('low_operational_recency');
    expect(codes).toContain('no_authoritative_source');
  });

  it('flags unsourced SNAP without vetoing the seed', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      snapSourced: false,
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('snap_ebt', 'yes', [src('Category guess', 'inferred', 'inferred:category')]),
      ],
    });
    expect(p.qcSignals.map((s) => s.code)).toContain('snap_unsourced');
    expect(p.vetoes).toHaveLength(0);
  });
});
