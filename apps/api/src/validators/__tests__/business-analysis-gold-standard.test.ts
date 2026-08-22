/**
 * Gold Standard System — Sprint 0 audit schema tests
 *
 * Tests the additive fields added to businessAnalysisSchema:
 *   - platforms.{platform}.profile_url (live profile URL on the platform)
 *   - gap_analysis (gaps between business and gold-standard expected fields)
 *   - quality_gate_results (pass/fail for each gold-standard quality gate)
 *
 * These fields are optional — only present when a gold-standard benchmark
 * was injected into the audit prompt. Existing audits without these fields
 * must still validate (backward compatibility).
 */

import { describe, it, expect } from 'vitest';
import { businessAnalysisSchema } from '../business-analysis.schema';

// Minimal valid audit payload (without the new gold-standard fields).
// Mirrors the baseAudit() shape from business-analysis-schema-sprint1.test.ts
// which is known to pass the schema.
function baseAudit(): any {
  return {
    audit_metadata: {
      audit_date: '2024-06-01',
      requested_business: {
        business_name: 'Indy African Market',
        city: 'Indianapolis',
        state: 'IN',
        category: 'African grocery store',
      },
      identity_status: 'confirmed',
      identity_confidence: 'high',
    },
    summary: 'Test audit',
    platforms: {
      google: {
        profile_status: 'claimed',
        rating: 4.2,
        total_reviews: 12,
        reviews_with_observable_response: 8,
        observable_unanswered_reviews: 4,
        observable_unanswered_negative_reviews: 1,
        observable_unanswered_positive_reviews: 3,
        observable_response_rate_percent: 67,
      },
    },
    website: {
      url: 'https://example.com',
      status: 'working',
      mobile_friendly: 'yes',
    },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
  };
}

describe('businessAnalysisSchema — Gold Standard additive fields (Sprint 0)', () => {
  it('validates a baseline audit without gold-standard fields (backward compat)', () => {
    const result = businessAnalysisSchema.safeParse(baseAudit());
    expect(result.success).toBe(true);
  });

  it('validates an audit with profile_url on platform entries', () => {
    const audit = baseAudit();
    audit.platforms.google.profile_url = 'https://www.google.com/maps/place/Test+Business';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('validates an audit with gap_analysis', () => {
    const audit = baseAudit();
    audit.gap_analysis = {
      gaps: [
        {
          platform: 'google',
          field: 'primary_category',
          expected: 'African goods store',
          actual: 'Grocery store',
          gap_description: 'Category is too generic',
          severity: 'non_negotiable',
        },
        {
          platform: 'google',
          field: 'photo_count',
          expected: '10+',
          actual: '3',
          gap_description: 'Too few photos',
          severity: 'recommended',
        },
      ],
      summary: '2 gaps found: 1 non-negotiable, 1 recommended',
    };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('validates an audit with quality_gate_results', () => {
    const audit = baseAudit();
    audit.quality_gate_results = {
      results: [
        {
          platform: 'google',
          gate: 'primary_category',
          passed: false,
          severity: 'non_negotiable',
          notes: 'Category is too generic',
        },
        {
          platform: 'google',
          gate: 'has_logo',
          passed: true,
          severity: 'recommended',
          notes: 'Logo present',
        },
      ],
      summary: '1/2 gates passed',
    };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('validates an audit with all gold-standard fields together', () => {
    const audit = baseAudit();
    audit.platforms.google.profile_url = 'https://www.google.com/maps/place/Test+Business';
    audit.gap_analysis = {
      gaps: [
        { platform: 'google', field: 'primary_category', expected: 'African goods store', actual: 'Grocery store', gap_description: 'Too generic', severity: 'non_negotiable' },
      ],
      summary: '1 gap found',
    };
    audit.quality_gate_results = {
      results: [
        { platform: 'google', gate: 'primary_category', passed: false, severity: 'non_negotiable' },
      ],
      summary: '0/1 gates passed',
    };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('accepts null profile_url', () => {
    const audit = baseAudit();
    audit.platforms.google.profile_url = null;
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('accepts gap_analysis with empty gaps array', () => {
    const audit = baseAudit();
    audit.gap_analysis = { gaps: [], summary: 'No gaps found' };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('allows passthrough on gap_analysis entries', () => {
    const audit = baseAudit();
    audit.gap_analysis = {
      gaps: [
        { platform: 'google', field: 'test', expected: 'a', actual: 'b', gap_description: 'd', severity: 'recommended', future_field: true },
      ],
      summary: '1 gap',
    };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });
});
