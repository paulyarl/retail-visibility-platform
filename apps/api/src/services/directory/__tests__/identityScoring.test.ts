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
  evidenceStateDisputes,
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

  it('treats a corroborator disagreement on a NAP field as drift, not a conflict', () => {
    // Google agrees, Yelp disagrees — both are directory corroborators on an
    // identity field, so Yelp's value is DRIFT (reportable/repairable), never a
    // conflict. Drift is excluded from purity, so it does not penalize the score.
    const s = scoreField(
      field('address', '123 Main St', [
        src('Google', 'major_aggregator', 'google', true),
        src('Yelp', 'secondary_aggregator', 'yelp', false),
      ]),
    );
    expect(s.conflictWeight).toBe(0);
    expect(s.driftWeight).toBeGreaterThan(0);
    // purity 1 (no conflict) × magnitude 0.5 (2/4) = 50.
    expect(s.score).toBe(50);
  });

  it('penalizes an AUTHORITATIVE conflict on a NAP field via purity', () => {
    // Two government sources disagree on the address — that IS an identity
    // conflict (government owns the identity dimension).
    const s = scoreField(
      field('address', '123 Main St', [
        src('IN SoS', 'authoritative', 'registry:in', true),
        src('County registry', 'authoritative', 'registry:county', false),
      ]),
    );
    expect(s.conflictWeight).toBeGreaterThan(0);
    expect(s.driftWeight).toBe(0);
    expect(s.score).toBeLessThan(100);
  });

  it('scores zero when there is no resolved value', () => {
    const s = scoreField(field('phone', null, [src('Google', 'major_aggregator', 'google')]));
    expect(s.score).toBe(0);
  });

  it('lets an operator authority adjudicate a field conflict', () => {
    // Two government sources disagree; an operator-supplied owner source (an
    // authority for identity) agrees — the operator is a peer of the analyst,
    // so the disagreement is adjudicated down to drift, not a conflict.
    const s = scoreField(
      field('name', 'Istanbul Super Market', [
        src('IN SoS', 'authoritative', 'registry:in', true),
        src('County registry', 'authoritative', 'registry:county', false),
        { ...src('Owner phone call', 'first_party', 'owner', true), manual: true },
      ]),
    );
    expect(s.conflictWeight).toBe(0);
    expect(s.driftWeight).toBeGreaterThan(0);
    expect(s.adjudicated).toBe(true);
    expect(s.adjudicatedBy).toBe('Owner phone call');
  });

  it('does not let a non-authority operator row adjudicate', () => {
    // A manual directory row is a corroborator, not an authority for identity —
    // it cannot adjudicate the government conflict.
    const s = scoreField(
      field('name', 'Istanbul Super Market', [
        src('County registry', 'authoritative', 'registry:county', false),
        { ...src('Some Directory', 'secondary_aggregator', 'some-directory', true), manual: true },
      ]),
    );
    expect(s.conflictWeight).toBeGreaterThan(0);
    expect(s.adjudicated).toBe(false);
  });
});

describe('evidenceStateDisputes', () => {
  it('treats owner_disputed / conflicting as disagreement, everything else as agreement', () => {
    expect(evidenceStateDisputes('owner_disputed')).toBe(true);
    expect(evidenceStateDisputes('conflicting')).toBe(true);
    expect(evidenceStateDisputes('owner_confirmed')).toBe(false);
    expect(evidenceStateDisputes('observed')).toBe(false);
    expect(evidenceStateDisputes(null)).toBe(false);
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

  it('guarantees a strong single-platform presence — depth alone seeds', () => {
    // 1 strong Google: a major aggregator corroborating the required fields is
    // enough — the strength bar, not breadth, decides. One dimension must not
    // block a high-signal platform.
    const corroborated = [src('Google', 'major_aggregator', 'google')];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', corroborated),
        field('address', '123 Main St', corroborated),
      ],
    });
    expect(p.gate.satisfiedCount).toBe(1);
    expect(p.gate.earned).toBe(false);
    expect(p.gate.guaranteed).toBe(true);
    expect(p.gate.decision).toBe('guaranteed');
    expect(p.band).toBe('ready');
    expect(p.pushRecommended).toBe(true);
  });

  it('seeds on platform presence alone — no recent activity required', () => {
    // Presence alone is sufficient: with no recency signal the supporting
    // strength is 0, yet Google's presence weight still reaches the bar.
    const corroborated = [src('Google', 'major_aggregator', 'google')];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', corroborated),
        field('address', '123 Main St', corroborated),
      ],
    });
    expect(p.gate.supportingStrength).toBe(0);
    expect(p.gate.dimensionStrength).toBe(2);
    expect(p.gate.decision).toBe('guaranteed');
    expect(p.pushRecommended).toBe(true);
  });

  it('counts supporting activity toward the strength bar', () => {
    // A secondary aggregator (weight 1) is too weak on presence alone, but
    // proven recent activity (reviews / ratings / recent comments → the
    // operational recency axis) lifts it over the bar. Third-party sources do
    // not need to be category-recognizable to count.
    const corroborated = [src('Manta', 'secondary_aggregator', 'manta')];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', corroborated),
        field('address', '123 Main St', corroborated),
      ],
    });
    expect(p.gate.supportingStrength).toBe(1);
    expect(p.gate.totalStrength).toBe(2);
    expect(p.gate.decision).toBe('guaranteed');
  });

  it('scales a platform source by its resolved signal weight', () => {
    // Google at signal weight 0.5 contributes 1 instead of 2 — a mid-signal
    // platform's presence alone no longer clears the bar, but proven recent
    // activity still lifts it over.
    const weighted = () => [{ ...src('Google', 'major_aggregator', 'google'), signalWeight: 0.5 }];
    const quiet = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', weighted()),
        field('address', '123 Main St', weighted()),
      ],
    });
    expect(quiet.gate.dimensionStrength).toBe(1);
    expect(quiet.gate.decision).toBe('blocked');

    const active = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', weighted()),
        field('address', '123 Main St', weighted()),
      ],
    });
    expect(active.gate.totalStrength).toBe(2);
    expect(active.gate.decision).toBe('guaranteed');
  });

  it('treats an unresolved weight as 1 — legacy byte-identity', () => {
    const bare = () => [src('Google', 'major_aggregator', 'google')];
    const nulled = () => [{ ...src('Google', 'major_aggregator', 'google'), signalWeight: null }];
    const input = (sources: () => any[]) => ({
      identityStatus: 'confirmed' as const,
      operationalStatus: 'active' as const,
      fields: [
        field('name', 'Arsema Market', sources()),
        field('address', '123 Main St', sources()),
      ],
    });
    expect(scoreIdentityPacket(input(nulled)).gate.totalStrength)
      .toBe(scoreIdentityPacket(input(bare)).gate.totalStrength);
  });

  it('blocks a single weak source with neither breadth nor depth', () => {
    // One secondary aggregator and no activity — below the strength bar and
    // short of 2 dimensions, so nothing earns, guarantees, or rescues.
    const corroborated = [src('Manta', 'secondary_aggregator', 'manta')];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', corroborated),
        field('address', '123 Main St', corroborated),
      ],
    });
    expect(p.gate.satisfiedCount).toBe(1);
    expect(p.gate.decision).toBe('blocked');
    expect(p.gate.blockers).toContain('insufficient_dimensions');
    expect(p.pushRecommended).toBe(false);
  });

  it('earns on two dimensions and guarantees on strength', () => {
    // Identity (government) + operational (directory) = 2 dimensions → earned;
    // the registry's weight lifts total strength to the guarantee bar.
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('phone', '555-0100', [src('Google', 'major_aggregator', 'google')]),
      ],
    });
    expect(p.gate.satisfiedCount).toBe(2);
    expect(p.gate.earned).toBe(true);
    expect(p.gate.totalStrength).toBeGreaterThanOrEqual(6);
    expect(p.gate.decision).toBe('guaranteed');
    expect(p.band).toBe('ready');
    expect(p.pushRecommended).toBe(true);
  });

  it('rescues a seed short of earning when the owner confirms — but not a veto', () => {
    // One weak directory source + no activity — short of earning AND below the
    // guarantee bar; an owner_confirmed capture
    // rescues it (owner is the fifth axis).
    const owner = { ...src('Owner phone call', 'first_party', 'owner', true), manual: true, evidenceState: 'owner_confirmed' as const };
    const weak = [src('Manta', 'secondary_aggregator', 'manta')];
    const rescued = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', [...weak, owner]),
        field('address', '123 Main St', weak),
      ],
    });
    expect(rescued.gate.satisfiedCount).toBe(1);
    expect(rescued.gate.earned).toBe(false);
    expect(rescued.gate.guaranteed).toBe(false);
    expect(rescued.gate.ownerOverRule).toBe(true);
    expect(rescued.gate.decision).toBe('rescued');
    expect(rescued.pushRecommended).toBe(true);

    // Owner cannot rescue a veto (mismatched identity).
    const vetoed = scoreIdentityPacket({
      identityStatus: 'mismatched',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', [...weak, owner]),
        field('address', '123 Main St', weak),
      ],
    });
    expect(vetoed.gate.ownerOverRule).toBe(false);
    expect(vetoed.gate.decision).toBe('blocked');
    expect(vetoed.pushRecommended).toBe(false);
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

  it('vetoes when an authoritative source conflicts on a required field', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Arsema Market', [src('IN SoS', 'authoritative', 'registry:in')]),
        field('address', '123 Main St', [
          src('IN SoS', 'authoritative', 'registry:in', true),
          src('County registry', 'authoritative', 'registry:county', false),
        ]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).toContain('required_field_conflict');
    expect(p.band).toBe('blocked');
  });

  it('does NOT veto when an authoritative conflict is outvoted on signal weight', () => {
    // Spec §2: the veto is a comparison — conflictSignalWeight >= agreement.
    // A thin-weight registry disagreeing (0.05 × 4 = 0.2) against a strong
    // registry + Google agreeing (3.6 + 1.9 = 5.5) cannot block: it reports.
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Istanbul Super Market', [
          { ...src('USDA', 'authoritative', 'usda', true), signalWeight: 0.9 },
          { ...src('Google', 'major_aggregator', 'google', true), signalWeight: 0.95 },
          { ...src('County registry', 'authoritative', 'registry:county', false), signalWeight: 0.05 },
        ]),
        field('address', '745 S Gammon Rd', [
          { ...src('USDA', 'authoritative', 'usda', true), signalWeight: 0.9 },
        ]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).not.toContain('required_field_conflict');
    expect(p.qcSignals.map((s) => s.code)).toContain('conflict_outvoted_name');
    // The disagreement still drags the score — outvoted, not invisible.
    expect(p.fields.find((f) => f.field === 'name')!.conflictWeight).toBeGreaterThan(0);
  });

  it('still vetoes when the weighted conflict meets or beats the agreement', () => {
    // A high-weight authority disagreeing (4) against a weaker agreement
    // (0.5 × 4 = 2) — the record is genuinely contested, so it gates.
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Istanbul Super Market', [
          { ...src('USDA', 'authoritative', 'usda', true), signalWeight: 0.5 },
          { ...src('County registry', 'authoritative', 'registry:county', false), signalWeight: 1 },
        ]),
        field('address', '745 S Gammon Rd', [src('USDA', 'authoritative', 'usda')]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).toContain('required_field_conflict');
    expect(p.band).toBe('blocked');
  });

  it('does NOT veto on a corroborator-only NAP disagreement — it is drift', () => {
    // The Istanbul case: directory corroborators disagree on name/address while
    // government evidence carries identity. Drift is reportable, not a veto.
    const corroborated = [
      src('Google', 'major_aggregator', 'google', true),
      src('Yelp', 'secondary_aggregator', 'yelp', false),
    ];
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Istanbul Super Market', [src('USDA', 'authoritative', 'usda'), ...corroborated]),
        field('address', '745 S Gammon Rd', [src('USDA', 'authoritative', 'usda'), ...corroborated]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).not.toContain('required_field_conflict');
    expect(p.qcSignals.map((s) => s.code)).toContain('nap_drift_name');
    expect(p.qcSignals.map((s) => s.code)).toContain('nap_drift_address');
  });

  it('lets an operator authority clear a required-field conflict veto', () => {
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'active',
      fields: [
        field('name', 'Istanbul Super Market', [
          src('County registry', 'authoritative', 'registry:county', false),
          { ...src('Owner phone call', 'first_party', 'owner', true), manual: true },
        ]),
        field('address', '745 S Gammon Rd', [src('USDA', 'authoritative', 'usda')]),
      ],
    });
    expect(p.vetoes.map((v) => v.code)).not.toContain('required_field_conflict');
    expect(p.qcSignals.map((s) => s.code)).toContain('conflict_adjudicated_name');
  });

  it('earns — but does not guarantee — on two weak dimensions', () => {
    // Name from a directory corroborator (operational, weight 1) + address
    // from a community source (location, weight 0.5) = two dimensions →
    // earned, but total strength 1.5 is below the bar → review, not ready.
    // The weakest-link score stays low; it no longer gates on its own.
    const p = scoreIdentityPacket({
      identityStatus: 'confirmed',
      operationalStatus: 'unable_to_verify',
      fields: [
        field('name', 'Arsema Market', [src('Manta', 'secondary_aggregator', 'manta')]),
        field('address', '123 Main St', [src('Neighborhood bulletin', 'inferred', 'nb')]),
      ],
    });
    expect(p.identityScore).toBeLessThan(50);
    expect(p.gate.satisfiedCount).toBe(2);
    expect(p.gate.earned).toBe(true);
    expect(p.gate.guaranteed).toBe(false);
    expect(p.gate.decision).toBe('earned');
    expect(p.band).toBe('review');
    expect(p.pushRecommended).toBe(true);
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
