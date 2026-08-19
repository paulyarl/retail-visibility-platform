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
