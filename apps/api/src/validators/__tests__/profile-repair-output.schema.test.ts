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
  it('validates a well-formed triage output', () => {
    const valid = {
      profile_repair_triage: {
        severity_score: 8,
        recommended_track: 'escalated',
        issue_type_confirmed: 'suspension',
        rationale: 'Profile is suspended on Google Maps, blocking phone calls and visits.',
        escalation_signals: ['suspension'],
        standard_signals: [],
      },
    };

    const parsed = profileRepairTriageSchema.parse(valid);
    expect(parsed.profile_repair_triage.severity_score).toBe(8);
    expect(parsed.profile_repair_triage.recommended_track).toBe('escalated');
  });

  it('rejects invalid severity_score outside 1-10 range', () => {
    const invalid = {
      profile_repair_triage: {
        severity_score: 15,
        recommended_track: 'standard',
        issue_type_confirmed: 'nap_drift',
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
        rationale: 'Invalid track',
      },
    };

    expect(() => profileRepairTriageSchema.parse(invalid)).toThrow();
  });
});

describe('profileRepairAuditSchema', () => {
  it('validates per-issue audit output and passes through extra fields', () => {
    const valid = {
      profile_repair_audit: {
        severityScore: 4,
        issueType: 'nap_drift',
        inconsistentPlatforms: ['Apple Maps', 'Bing'],
        recommendedFixes: ['Fix phone on Apple Maps'],
        openerAngle: 'Customers are calling the wrong phone number',
      },
    };

    const parsed = profileRepairAuditSchema.parse(valid);
    expect(parsed.profile_repair_audit.severityScore).toBe(4);
    expect(parsed.profile_repair_audit.issueType).toBe('nap_drift');
    expect((parsed.profile_repair_audit as any).inconsistentPlatforms).toEqual(['Apple Maps', 'Bing']);
  });

  it('rejects missing severityScore or issueType', () => {
    const missing = {
      profile_repair_audit: {
        openerAngle: 'Missing severity',
      },
    };

    expect(() => profileRepairAuditSchema.parse(missing)).toThrow();
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
