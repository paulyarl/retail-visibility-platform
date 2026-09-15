/**
 * seed-report-lint tests (§17.1, §4.3, §4.7)
 *
 * Verifies the claim-safety lint gates that run before a report version is
 * published:
 * - claim_cta_gating: operator-internal statuses must not expose a CTA
 * - fact_provenance: every identity fact needs provenance or a derived note
 * - signal_evidence_basis: INT_* signals need basis + source_observation_ids
 * - absence_not_negative: absence states must not render as false
 * - pain_separation: owner-reported pain stays out of platform evidence
 * - no_answer_not_negative: disconnected outcomes can't produce verified facts
 * - peer_effect_gating: peer language requires a real metric
 * - lintNarrativeText: banned phrase detection
 * - evaluateClaimHookEligibility: §5.2 gate reasons
 */

import { describe, it, expect } from 'vitest';
import {
  lintReport,
  lintNarrativeText,
  claimCtaGatingRule,
  factProvenanceRule,
  signalEvidenceBasisRule,
  absenceNotNegativeRule,
  painSeparationRule,
  noAnswerNotNegativeRule,
  peerEffectGatingRule,
} from '../seed-report-lint';
import { evaluateClaimHookEligibility, computeDeltaSummary } from '../seed-report-dto.schema';
import type { SeedIntelligenceReport, ReportFact } from '../seed-report-dto.schema';

// ─── Fixture builder ─────────────────────────────────────────────────────

const fact = (overrides: Partial<ReportFact> = {}): ReportFact => ({
  field: 'test',
  value: 'Test Value',
  state: 'observed',
  confidence: 'high',
  source_observation_ids: ['obs-1'],
  owner_verified_at: null,
  display_note: null,
  ...overrides,
});

const baseReport = (overrides: Partial<SeedIntelligenceReport> = {}): SeedIntelligenceReport => ({
  report_id: 'rpt-test',
  seed_id: 'seed-test',
  version: 1,
  status: 'provisional',
  report_mode: 'free',
  generated_at: '2025-01-01T00:00:00Z',
  generated_from: {
    prompt_templates: [],
    source_snapshot_ids: [],
    evidence_ids: [],
  },
  evidence_count: 1,
  unresolved_count: 0,
  owner_verification_count: 0,
  business_identity: {
    business_name: fact({ field: 'business_name', value: 'Acme Auto' }),
    address: fact({ field: 'address', value: '123 Main St' }),
    phone: fact({ field: 'phone', value: '317-555-0100' }),
    website: fact({ field: 'website', value: 'https://acme.test' }),
    city: fact({ field: 'city', value: 'Indianapolis' }),
    state: fact({ field: 'state', value: 'IN' }),
    owner_name: fact({ field: 'owner_name', value: null, state: 'not_found_during_discovery', confidence: 'unknown', source_observation_ids: [], display_note: 'Not found during discovery' }),
    ownership_type: fact({ field: 'ownership_type', value: null, state: 'not_checked', confidence: 'unknown', source_observation_ids: [], display_note: 'Not checked' }),
  },
  source_summary: {
    sources_checked_count: 3,
    sources_with_evidence_count: 2,
    source_types: [],
    identity_signals_count: 4,
    name_variants_count: 1,
    address_variants_count: 1,
    unresolved_count: 0,
  },
  identity_reconciliation: {
    canonical_candidate: null,
    alternate_names: [],
    alternate_addresses: [],
    alternate_phones: [],
    conflicts: [],
    identity_confidence: 'high',
  },
  market_classification: {
    category: 'Auto Repair',
    subcategory: null,
    category_fit: 'verified',
    location_status: 'inside_city',
    ownership_type: null,
    category_profile_context: null,
    operational_signals: [],
  },
  platform_presence: { platforms: [] },
  category_fit: {
    category: 'Auto Repair',
    subcategory: null,
    category_fit: 'verified',
    basis: [],
    source_observation_ids: [],
  },
  intelligence_signals: { signals: [] },
  verification_activity: { events: [] },
  claim_summary: {
    claim_status: 'unclaimed',
    claim_url: null,
    claim_benefits: [],
    owner_confirmation_count: 0,
    owner_correction_count: 0,
  },
  next_actions: {
    primary_cta: 'claim',
    cta_eligible: true,
    cta_disabled_reason: null,
    suggested_actions: [],
  },
  ...overrides,
});

// ─── claim_cta_gating ─────────────────────────────────────────────────────

describe('claimCtaGatingRule (§17.1)', () => {
  it('passes when a provisional report exposes a CTA', () => {
    expect(claimCtaGatingRule.check(baseReport())).toEqual([]);
  });

  it('errors when insufficient_evidence report has cta_eligible=true', () => {
    const report = baseReport({ status: 'insufficient_evidence' });
    const findings = claimCtaGatingRule.check(report);
    expect(findings.some((f) => f.path === 'next_actions.cta_eligible')).toBe(true);
    expect(findings.some((f) => f.path === 'next_actions.primary_cta')).toBe(true);
  });

  it('errors when requires_identity_review report has a primary_cta', () => {
    const report = baseReport({
      status: 'requires_identity_review',
      next_actions: { primary_cta: 'claim', cta_eligible: false, cta_disabled_reason: null, suggested_actions: [] },
    });
    const findings = claimCtaGatingRule.check(report);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe('next_actions.primary_cta');
  });

  it('passes when internal status has CTA fully disabled', () => {
    const report = baseReport({
      status: 'insufficient_evidence',
      next_actions: { primary_cta: null, cta_eligible: false, cta_disabled_reason: 'Insufficient evidence', suggested_actions: [] },
    });
    expect(claimCtaGatingRule.check(report)).toEqual([]);
  });
});

// ─── fact_provenance ──────────────────────────────────────────────────────

describe('factProvenanceRule (§17.1)', () => {
  it('passes when every fact has source_observation_ids', () => {
    expect(factProvenanceRule.check(baseReport())).toEqual([]);
  });

  it('passes when a fact has a display_note instead of provenance', () => {
    const report = baseReport();
    report.business_identity.website = fact({
      field: 'website',
      value: null,
      state: 'not_found_during_discovery',
      confidence: 'unknown',
      source_observation_ids: [],
      display_note: 'Not found during discovery',
    });
    expect(factProvenanceRule.check(report)).toEqual([]);
  });

  it('errors when a fact has neither provenance nor a display note', () => {
    const report = baseReport();
    report.business_identity.phone = fact({
      field: 'phone',
      value: '317-555-9999',
      source_observation_ids: [],
      display_note: null,
    });
    const findings = factProvenanceRule.check(report);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe('business_identity.phone');
  });
});

// ─── signal_evidence_basis ────────────────────────────────────────────────

describe('signalEvidenceBasisRule (§17.1, §6.7)', () => {
  it('errors when a signal has no basis', () => {
    const report = baseReport();
    report.intelligence_signals.signals = [
      { code: 'INT_MISSING_WEBSITE', label: 'Missing website', basis: '', source_observation_ids: ['obs-1'] },
    ];
    const findings = signalEvidenceBasisRule.check(report);
    expect(findings.some((f) => f.path?.includes('basis'))).toBe(true);
  });

  it('errors when a signal has no source_observation_ids', () => {
    const report = baseReport();
    report.intelligence_signals.signals = [
      { code: 'INT_MISSING_WEBSITE', label: 'Missing website', basis: 'No website observed', source_observation_ids: [] },
    ];
    const findings = signalEvidenceBasisRule.check(report);
    expect(findings.some((f) => f.path?.includes('source_observation_ids'))).toBe(true);
  });

  it('passes for a well-formed signal', () => {
    const report = baseReport();
    report.intelligence_signals.signals = [
      { code: 'INT_MISSING_WEBSITE', label: 'Missing website', basis: 'No website observed in 3 sources', source_observation_ids: ['obs-1'] },
    ];
    expect(signalEvidenceBasisRule.check(report)).toEqual([]);
  });
});

// ─── absence_not_negative ─────────────────────────────────────────────────

describe('absenceNotNegativeRule (§4.3)', () => {
  it('errors when a not_found fact has value=false', () => {
    const report = baseReport();
    report.business_identity.website = fact({
      field: 'website',
      value: false,
      state: 'not_found_during_discovery',
      confidence: 'unknown',
      display_note: 'Not found during discovery',
    });
    const findings = absenceNotNegativeRule.check(report);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe('business_identity.website.value');
  });

  it('passes when a not_found fact has value=null', () => {
    const report = baseReport();
    report.business_identity.website = fact({
      field: 'website',
      value: null,
      state: 'not_found_during_discovery',
      confidence: 'unknown',
      source_observation_ids: [],
      display_note: 'Not found during discovery',
    });
    expect(absenceNotNegativeRule.check(report)).toEqual([]);
  });
});

// ─── pain_separation ──────────────────────────────────────────────────────

describe('painSeparationRule (§17.1, §11.4 rule 7)', () => {
  it('errors when owner-reported pain text appears in business_identity', () => {
    const report = baseReport();
    report.business_identity.business_name = fact({ field: 'business_name', value: 'customers cannot find us online' });
    report.verification_activity.events = [
      {
        date: '2025-01-01',
        channel: 'phone',
        purpose: 'verification',
        contact_outcome: 'connected',
        facts_confirmed: [],
        facts_corrected: [],
        facts_disputed: [],
        owner_reported_pain: 'customers cannot find us online',
        claim_response: null,
        next_action: null,
      },
    ];
    const findings = painSeparationRule.check(report);
    expect(findings).toHaveLength(1);
  });

  it('passes when pain stays in the verification event only', () => {
    const report = baseReport();
    report.verification_activity.events = [
      {
        date: '2025-01-01',
        channel: 'phone',
        purpose: 'verification',
        contact_outcome: 'connected',
        facts_confirmed: [],
        facts_corrected: [],
        facts_disputed: [],
        owner_reported_pain: 'customers cannot find us online',
        claim_response: null,
        next_action: null,
      },
    ];
    expect(painSeparationRule.check(report)).toEqual([]);
  });
});

// ─── no_answer_not_negative ───────────────────────────────────────────────

describe('noAnswerNotNegativeRule (§17.1, §11.4 rule 8)', () => {
  it('errors when a no_answer event carries confirmed facts', () => {
    const report = baseReport();
    report.verification_activity.events = [
      {
        date: '2025-01-01',
        channel: 'phone',
        purpose: 'verification',
        contact_outcome: 'no_answer',
        facts_confirmed: ['phone'],
        facts_corrected: [],
        facts_disputed: [],
        owner_reported_pain: null,
        claim_response: null,
        next_action: null,
      },
    ];
    const findings = noAnswerNotNegativeRule.check(report);
    expect(findings).toHaveLength(1);
  });

  it('passes when a no_answer event carries no verified facts', () => {
    const report = baseReport();
    report.verification_activity.events = [
      {
        date: '2025-01-01',
        channel: 'phone',
        purpose: 'verification',
        contact_outcome: 'no_answer',
        facts_confirmed: [],
        facts_corrected: [],
        facts_disputed: [],
        owner_reported_pain: null,
        claim_response: null,
        next_action: 'retry',
      },
    ];
    expect(noAnswerNotNegativeRule.check(report)).toEqual([]);
  });
});

// ─── peer_effect_gating ───────────────────────────────────────────────────

describe('peerEffectGatingRule (§10.1.1)', () => {
  it('errors on peer language without a metric', () => {
    const report = baseReport();
    report.market_classification.category_profile_context =
      'Comparable businesses in your area are being claimed rapidly.';
    const findings = peerEffectGatingRule.check(report);
    expect(findings).toHaveLength(1);
  });

  it('passes on peer language with a measured metric', () => {
    const report = baseReport();
    report.market_classification.category_profile_context =
      'Comparable businesses: 14 of 20 in this category have been claimed.';
    expect(peerEffectGatingRule.check(report)).toEqual([]);
  });

  it('passes when there is no peer language', () => {
    const report = baseReport();
    report.market_classification.category_profile_context = 'Category fit verified via registry.';
    expect(peerEffectGatingRule.check(report)).toEqual([]);
  });
});

// ─── lintNarrativeText ────────────────────────────────────────────────────

describe('lintNarrativeText (§4.7)', () => {
  it('flags banned negative-finding phrases', () => {
    const findings = lintNarrativeText('This business has no website and is not on Google.');
    expect(findings.some((f) => f.rule === 'banned_negative_finding')).toBe(true);
  });

  it('flags banned alarmist phrases', () => {
    const findings = lintNarrativeText('You are losing customers to competitors every day.');
    expect(findings.some((f) => f.rule === 'banned_alarmist')).toBe(true);
  });

  it('flags filler phrases as warnings', () => {
    const findings = lintNarrativeText("In today's digital world, every business needs visibility.");
    const filler = findings.filter((f) => f.rule === 'banned_filler');
    expect(filler.length).toBeGreaterThan(0);
    expect(filler[0].severity).toBe('warning');
  });

  it('passes clean text', () => {
    expect(lintNarrativeText('We found your business on three public directories.')).toEqual([]);
  });
});

// ─── lintReport aggregate ─────────────────────────────────────────────────

describe('lintReport', () => {
  it('passes a well-formed report', () => {
    const result = lintReport(baseReport());
    expect(result.passed).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('fails when any error-severity finding exists', () => {
    const report = baseReport({ status: 'insufficient_evidence' });
    const result = lintReport(report);
    expect(result.passed).toBe(false);
  });
});

// ─── evaluateClaimHookEligibility (§5.2) ──────────────────────────────────

describe('evaluateClaimHookEligibility (§5.2)', () => {
  const eligibleInput = {
    status: 'provisional' as const,
    identityConfidence: 'high' as const,
    locationStatus: 'inside_city' as const,
    sourceObservationCount: 3,
    hasUnresolvedIdentityConflict: false,
  };

  it('returns eligible for a clean provisional report', () => {
    const result = evaluateClaimHookEligibility(eligibleInput);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects operator-internal statuses', () => {
    for (const status of ['requires_identity_review', 'insufficient_evidence'] as const) {
      const result = evaluateClaimHookEligibility({ ...eligibleInput, status });
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toContain(status);
    }
  });

  it('rejects low identity confidence', () => {
    const result = evaluateClaimHookEligibility({ ...eligibleInput, identityConfidence: 'low' });
    expect(result.eligible).toBe(false);
  });

  it('rejects outside_market location', () => {
    const result = evaluateClaimHookEligibility({ ...eligibleInput, locationStatus: 'outside_market' });
    expect(result.eligible).toBe(false);
  });

  it('rejects zero source observations', () => {
    const result = evaluateClaimHookEligibility({ ...eligibleInput, sourceObservationCount: 0 });
    expect(result.eligible).toBe(false);
  });

  it('rejects unresolved identity conflicts', () => {
    const result = evaluateClaimHookEligibility({ ...eligibleInput, hasUnresolvedIdentityConflict: true });
    expect(result.eligible).toBe(false);
  });

  it('accumulates multiple reasons', () => {
    const result = evaluateClaimHookEligibility({
      status: 'insufficient_evidence',
      identityConfidence: 'low',
      locationStatus: 'outside_market',
      sourceObservationCount: 0,
      hasUnresolvedIdentityConflict: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBe(5);
  });
});

// ─── computeDeltaSummary (§5.4) ──────────────────────────────────────────

describe('computeDeltaSummary', () => {
  it('returns an empty delta for the first version (no prior)', () => {
    const delta = computeDeltaSummary(null, baseReport({ version: 1 }));
    expect(delta.prior_version).toBeNull();
    expect(delta.meaningful).toBe(false);
    expect(delta.changes).toHaveLength(0);
  });

  it('detects a corrected identity field as meaningful', () => {
    const prior = baseReport({ version: 1 });
    const current = baseReport({
      version: 2,
      business_identity: {
        ...prior.business_identity,
        phone: fact({ field: 'phone', value: '317-555-9999', state: 'owner_corrected' }),
      },
    });
    const delta = computeDeltaSummary(prior, current);
    expect(delta.meaningful).toBe(true);
    expect(delta.identity_changes).toContain('phone');
    expect(delta.prior_version).toBe(1);
  });

  it('detects new sources as meaningful', () => {
    const prior = baseReport({ version: 1 });
    const current = baseReport({
      version: 2,
      source_summary: {
        ...prior.source_summary,
        source_types: [{ source_type: 'directory', source_name: 'Yelp', role: 'discovery', observation_count: 2 }],
      },
    });
    const delta = computeDeltaSummary(prior, current);
    expect(delta.meaningful).toBe(true);
    expect(delta.new_sources).toContain('Yelp');
  });

  it('detects new owner verifications as meaningful', () => {
    const delta = computeDeltaSummary(
      baseReport({ version: 1, owner_verification_count: 1 }),
      baseReport({ version: 2, owner_verification_count: 3 }),
    );
    expect(delta.meaningful).toBe(true);
    expect(delta.new_owner_verifications).toBe(2);
  });

  it('detects a newly available claim path as meaningful', () => {
    const prior = baseReport({
      version: 1,
      next_actions: { primary_cta: null, cta_eligible: false, cta_disabled_reason: 'x', suggested_actions: [] },
    });
    const current = baseReport({
      version: 2,
      next_actions: { primary_cta: 'claim', cta_eligible: true, cta_disabled_reason: null, suggested_actions: [] },
    });
    const delta = computeDeltaSummary(prior, current);
    expect(delta.claim_newly_available).toBe(true);
    expect(delta.meaningful).toBe(true);
  });

  it('detects new signals as meaningful', () => {
    const current = baseReport({
      version: 2,
      intelligence_signals: {
        signals: [{ code: 'INT_MULTI_SOURCE_CONFIRMED', label: 'x', basis: 'b', source_observation_ids: ['o1'] }],
      },
    });
    const delta = computeDeltaSummary(baseReport({ version: 1 }), current);
    expect(delta.new_signals).toContain('INT_MULTI_SOURCE_CONFIRMED');
    expect(delta.meaningful).toBe(true);
  });

  it('is not meaningful when nothing report-visible changed', () => {
    const delta = computeDeltaSummary(baseReport({ version: 1 }), baseReport({ version: 2 }));
    expect(delta.meaningful).toBe(false);
    expect(delta.changes).toHaveLength(0);
    expect(delta.prior_version).toBe(1);
  });

  it('records a status transition without making it meaningful unless it reaches complete', () => {
    const delta = computeDeltaSummary(
      baseReport({ version: 1, status: 'provisional' }),
      baseReport({ version: 2, status: 'provisional' }),
    );
    expect(delta.status_changed).toBe(false);

    const toComplete = computeDeltaSummary(
      baseReport({ version: 1, status: 'provisional' }),
      baseReport({ version: 2, status: 'complete' }),
    );
    expect(toComplete.status_changed).toBe(true);
    expect(toComplete.meaningful).toBe(true);
  });
});
