/**
 * Unit tests for Profile Repair Output Schemas & OUTPUT_SCHEMA_REGISTRY
 */

import { describe, it, expect } from 'vitest';
import {
  profileRepairTriageSchema,
  profileRepairAuditSchema,
  citationRepairPackageSchema,
  PROFILE_REPAIR_TRIAGE_SCHEMA_NAME,
  PROFILE_REPAIR_AUDIT_SCHEMA_NAME,
  CITATION_REPAIR_PACKAGE_SCHEMA_NAME,
} from '../profile-repair-output.schema';
import { resolveOutputSchema } from '../market-analysis.schema';

describe('profileRepairTriageSchema', () => {
  it('validates a well-formed triage briefing output', () => {
    const valid = {
      profile_repair_triage: {
        severity_score: 8,
        recommended_track: 'escalated',
        issue_type_confirmed: 'suspension',
        scope: {
          summary: 'Google Business Profile is suspended.',
          broken_platforms: ['Google'],
          drift_details: '',
          missing_assets: [],
        },
        viability: {
          pursuit_recommendation: 'pursue_with_caveats',
          rationale: 'Suspension is severe but recoverable with evidence.',
        },
        pitch: {
          primary_angle: 'Your Google profile is offline — customers can\'t find you.',
          opener_hook: 'Your Google Business Profile has been suspended, which means customers searching for you on Google Maps get nothing.',
          pain_points: ['No Google Maps presence', 'Lost calls and visits'],
          marketplace_positioning: 'Underexposed on the primary discovery platform.',
        },
        risks: ['Appeal may take 2-3 weeks', 'Hard suspension may require video verification'],
        outreach_problems: [
          {
            problem: 'Customers searching for the business on Google find nothing — the profile is suspended.',
            regular: 'Your Google Business Profile is suspended, so customers looking for you on Google Maps hit a dead end.',
            hook: 'Quick check — Google your own business name right now. Nothing comes up, and that\'s what every customer sees too.',
            solution: 'Claim the listing and run the reinstatement appeal with the required evidence.',
            evidence: 'audit_results: Google profile_status=suspended',
            outreach_use: 'Cold-call opener',
          },
        ],
        rationale: 'Profile is suspended on Google Maps, blocking phone calls and visits.',
        escalation_signals: ['suspension'],
        standard_signals: [],
      },
    };

    const parsed = profileRepairTriageSchema.parse(valid);
    expect(parsed.profile_repair_triage.severity_score).toBe(8);
    expect(parsed.profile_repair_triage.recommended_track).toBe('escalated');
    expect(parsed.profile_repair_triage.scope.summary).toContain('suspended');
    expect(parsed.profile_repair_triage.viability.pursuit_recommendation).toBe('pursue_with_caveats');
    expect(parsed.profile_repair_triage.pitch.opener_hook).toContain('suspended');
  });

  it('rejects invalid severity_score outside 1-10 range', () => {
    const invalid = {
      profile_repair_triage: {
        severity_score: 15,
        recommended_track: 'standard',
        issue_type_confirmed: 'nap_drift',
        scope: { summary: 'test', broken_platforms: [], drift_details: '', missing_assets: [] },
        viability: { pursuit_recommendation: 'pursue', rationale: 'test' },
        pitch: { primary_angle: 'test', opener_hook: 'test', pain_points: [], marketplace_positioning: 'test' },
        risks: [],
        rationale: 'Invalid score',
      },
    };

    expect(() => profileRepairTriageSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid recommended_track', () => {
    const invalid = {
      profile_repair_triage: {
        severity_score: 5,
        recommended_track: 'unknown_track',
        issue_type_confirmed: 'nap_drift',
        scope: { summary: 'test', broken_platforms: [], drift_details: '', missing_assets: [] },
        viability: { pursuit_recommendation: 'pursue', rationale: 'test' },
        pitch: { primary_angle: 'test', opener_hook: 'test', pain_points: [], marketplace_positioning: 'test' },
        risks: [],
        rationale: 'Invalid track',
      },
    };

    expect(() => profileRepairTriageSchema.parse(invalid)).toThrow();
  });

  // outreach_problems boundary tests — required .min(1), no .max()
  // (the ≤3 cap is a prompt-level ranking rule, not a validator rule).
  const triageBase = () => ({
    profile_repair_triage: {
      severity_score: 6,
      recommended_track: 'standard',
      issue_type_confirmed: 'nap_drift',
      scope: { summary: 'test', broken_platforms: [], drift_details: '', missing_assets: [] },
      viability: { pursuit_recommendation: 'pursue', rationale: 'test' },
      pitch: { primary_angle: 'test', opener_hook: 'test', pain_points: [], marketplace_positioning: 'test' },
      risks: [],
      rationale: 'test',
    },
  });
  const entry = () => ({
    problem: 'p', regular: 'r', hook: 'h',
    solution: 's', evidence: 'e', outreach_use: 'u',
  });

  it('rejects a triage briefing with no outreach_problems field', () => {
    expect(() => profileRepairTriageSchema.parse(triageBase())).toThrow();
  });

  it('rejects a triage briefing with an empty outreach_problems array', () => {
    const v = triageBase();
    (v.profile_repair_triage as any).outreach_problems = [];
    expect(() => profileRepairTriageSchema.parse(v)).toThrow();
  });

  it('accepts a triage briefing with 1 outreach_problems entry', () => {
    const v = triageBase();
    (v.profile_repair_triage as any).outreach_problems = [entry()];
    expect(() => profileRepairTriageSchema.parse(v)).not.toThrow();
  });

  it('accepts a triage briefing with 3 outreach_problems entries', () => {
    const v = triageBase();
    (v.profile_repair_triage as any).outreach_problems = [entry(), entry(), entry()];
    expect(() => profileRepairTriageSchema.parse(v)).not.toThrow();
  });

  it('accepts a triage briefing with 4 outreach_problems entries (cap is prompt-level)', () => {
    const v = triageBase();
    (v.profile_repair_triage as any).outreach_problems = [entry(), entry(), entry(), entry()];
    expect(() => profileRepairTriageSchema.parse(v)).not.toThrow();
  });

  it('rejects an outreach_problems entry missing a required key', () => {
    const v = triageBase();
    (v.profile_repair_triage as any).outreach_problems = [{ problem: 'p', regular: 'r' }];
    expect(() => profileRepairTriageSchema.parse(v)).toThrow();
  });
});

describe('profileRepairAuditSchema', () => {
  it('validates a well-formed per-issue repair briefing and passes through extra fields', () => {
    const valid = {
      profile_repair_audit: {
        severityScore: 4,
        issueType: 'nap_drift',
        scope: {
          summary: 'Google and Yelp show a stale phone number.',
          affected_platforms: ['Google', 'Yelp'],
          specifics: 'Google shows (816) 555-1234 but canonical is (816) 555-9999.',
        },
        impact: {
          primary_consequence: 'Customers are calling the wrong number.',
          estimated_reach_loss: 'Moderate — affects Google and Yelp users.',
          competitive_gap: 'Competitors with consistent NAP appear in more local pack results.',
        },
        pitch: {
          opener_hook: 'When customers search for you on Google, they get the wrong phone number.',
          pain_points: ['Lost calls', 'Customers reach disconnected line'],
          value_preview: 'We\'ll correct your phone across Google and Yelp so customers reach you every time.',
        },
        risks: ['Owner may have intentionally changed the number'],
        outreach_problems: [
          {
            problem: 'Customers who call the listed number reach a disconnected line.',
            regular: 'The phone number on your Google and Yelp listings is an old one, so calls aren\'t reaching you.',
            hook: 'When\'s the last time you dialed the number shown on your own Google listing? That\'s the number your customers are dialing.',
            solution: 'Claim the listing and correct the phone across Google and Yelp.',
            evidence: 'audit_results: Google displayed_phone (816) 555-1234 vs canonical (816) 555-9999',
            outreach_use: 'Cold-call opener',
          },
        ],
      },
    };

    const parsed = profileRepairAuditSchema.parse(valid);
    expect(parsed.profile_repair_audit.severityScore).toBe(4);
    expect(parsed.profile_repair_audit.issueType).toBe('nap_drift');
    expect(parsed.profile_repair_audit.scope.affected_platforms).toEqual(['Google', 'Yelp']);
    expect(parsed.profile_repair_audit.impact.primary_consequence).toContain('wrong number');
    expect(parsed.profile_repair_audit.pitch.value_preview).toContain('correct your phone');
  });

  it('rejects missing severityScore or issueType', () => {
    const missing = {
      profile_repair_audit: {
        scope: { summary: 'test', affected_platforms: [], specifics: '' },
        impact: { primary_consequence: 'test' },
        pitch: { opener_hook: 'test', pain_points: [], value_preview: 'test' },
        risks: [],
      },
    };

    expect(() => profileRepairAuditSchema.parse(missing)).toThrow();
  });

  it('rejects missing scope/impact/pitch structured fields', () => {
    const missingStructured = {
      profile_repair_audit: {
        severityScore: 4,
        issueType: 'nap_drift',
      },
    };

    expect(() => profileRepairAuditSchema.parse(missingStructured)).toThrow();
  });

  // outreach_problems boundary tests — required .min(1) on the dedicated
  // schema; a repair briefing with zero problems is a failed run.
  const auditBase = () => ({
    profile_repair_audit: {
      severityScore: 4,
      issueType: 'nap_drift',
      scope: { summary: 'test', affected_platforms: [], specifics: '' },
      impact: { primary_consequence: 'test' },
      pitch: { opener_hook: 'test', pain_points: [], value_preview: 'test' },
      risks: [],
    },
  });
  const entry = () => ({
    problem: 'p', regular: 'r', hook: 'h',
    solution: 's', evidence: 'e', outreach_use: 'u',
  });

  it('rejects a per-issue briefing with no outreach_problems field', () => {
    expect(() => profileRepairAuditSchema.parse(auditBase())).toThrow();
  });

  it('rejects a per-issue briefing with an empty outreach_problems array', () => {
    const v = auditBase();
    (v.profile_repair_audit as any).outreach_problems = [];
    expect(() => profileRepairAuditSchema.parse(v)).toThrow();
  });

  it('accepts 1 and 4 entries (min 1, no validator-level max)', () => {
    const one = auditBase();
    (one.profile_repair_audit as any).outreach_problems = [entry()];
    expect(() => profileRepairAuditSchema.parse(one)).not.toThrow();

    const four = auditBase();
    (four.profile_repair_audit as any).outreach_problems = [entry(), entry(), entry(), entry()];
    expect(() => profileRepairAuditSchema.parse(four)).not.toThrow();
  });
});

describe('citationRepairPackageSchema', () => {
  it('validates deliverableText and submissionGuide', () => {
    const valid = {
      deliverableText: 'Canonical NAP:\nName: Acme\nAddress: 123 Main St\nPhone: 555-1234',
      submissionGuide: 'Step 1: Check Apple Maps\nStep 2: Check Google',
    };

    const parsed = citationRepairPackageSchema.parse(valid);
    expect(parsed.deliverableText).toContain('Canonical NAP');
    expect(parsed.submissionGuide).toContain('Step 1');
  });

  it('rejects missing fields', () => {
    expect(() => citationRepairPackageSchema.parse({ deliverableText: 'text only' })).toThrow();
  });
});

describe('resolveOutputSchema with profile repair schemas', () => {
  it('resolves profile_repair_triage', () => {
    const resolved = resolveOutputSchema(PROFILE_REPAIR_TRIAGE_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved?.auditPlatform).toBeNull();
    expect(resolved?.promptSuffix).toContain('profile_repair_triage');
  });

  it('resolves profile_repair_audit', () => {
    const resolved = resolveOutputSchema(PROFILE_REPAIR_AUDIT_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved?.auditPlatform).toBeNull();
    expect(resolved?.promptSuffix).toContain('profile_repair_audit');
  });

  it('resolves citation_repair_package', () => {
    const resolved = resolveOutputSchema(CITATION_REPAIR_PACKAGE_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved?.auditPlatform).toBeNull();
    expect(resolved?.promptSuffix).toContain('deliverableText');
  });
});
