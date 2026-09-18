/**
 * Platform Availability Verification — scoring amendments (§6.3, §6.4).
 *
 * Covers the validator changes and the coverage gate that suppresses the tier
 * when too few render controls rendered for the assessment to mean anything.
 *
 * Spec: docs/LocalBiz/AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC.md
 */
import { describe, it, expect } from 'vitest';
import {
  businessAnalysisSchema,
  applyRenderControlCoverageGate,
  MIN_RENDER_CONTROL_COVERAGE_FOR_TIER,
} from '../../validators/business-analysis.schema';

function baseAudit(): any {
  return {
    audit_metadata: {
      audit_date: '2026-09-18',
      requested_business: {
        business_name: 'Istanbul Supermarket',
        city: 'Madison',
        state: 'WI',
        category: 'Middle Eastern grocery store',
      },
      identity_status: 'confirmed',
      identity_confidence: 'high',
    },
    summary: 'Test audit',
    platforms: {
      google: {
        profile_status: 'unable_to_verify',
        rating: 0,
        total_reviews: 0,
        reviews_with_observable_response: 0,
        observable_unanswered_reviews: 0,
        observable_unanswered_negative_reviews: 0,
        observable_unanswered_positive_reviews: 0,
        observable_response_rate_percent: 0,
      },
    },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'major_inconsistencies' },
    digital_opportunity_score: { score: 1 },
    high_attention: false,
    recommended_tier: 'tier_3',
    estimated_monthly_service_fee: { minimum: 300, maximum: 750, currency: 'USD' },
    data_quality: { confidence: 'medium' },
  };
}

function renderControl(platform: string, controlRendered: boolean, determination: string): any {
  return {
    platform,
    business_profile_url: `https://example.com/${platform}`,
    business_rendered: false,
    control_business: 'Destiny African Market',
    control_url: `https://example.com/control/${platform}`,
    control_rendered: controlRendered,
    access_barrier: controlRendered ? 'none' : 'js_required',
    determination,
  };
}

describe('B3 — action_classification nullability', () => {
  it('accepts action_classification: null (not computed)', () => {
    const audit = baseAudit();
    audit.alignment_scoring = { action_classification: null };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alignment_scoring?.action_classification).toBeNull();
    }
  });

  it('still accepts a computed classification', () => {
    const audit = baseAudit();
    audit.alignment_scoring = { action_classification: 'BALANCED_HEALTHY' };
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});

describe('B4 — recommended_tier nullability', () => {
  it('accepts recommended_tier: null (suppressed)', () => {
    const audit = baseAudit();
    audit.recommended_tier = null;
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recommended_tier).toBeNull();
    }
  });

  it('accepts an omitted recommended_tier', () => {
    const audit = baseAudit();
    delete audit.recommended_tier;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('still rejects an unknown tier value', () => {
    const audit = baseAudit();
    audit.recommended_tier = 'tier_9';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });
});

describe('§6.4 — render-control coverage gate', () => {
  it('leaves the audit untouched when render_controls is absent (legacy audits)', () => {
    const audit = baseAudit();
    const out = applyRenderControlCoverageGate(audit);
    expect(out.recommended_tier).toBe('tier_3');
    expect(out.estimated_monthly_service_fee).toEqual({ minimum: 300, maximum: 750, currency: 'USD' });
    expect(out.render_control_coverage).toBeUndefined();
  });

  it('leaves the audit untouched when render_controls is an empty array', () => {
    const audit = baseAudit();
    audit.render_controls = [];
    const out = applyRenderControlCoverageGate(audit);
    expect(out.recommended_tier).toBe('tier_3');
    expect(out.render_control_coverage).toBeUndefined();
  });

  it('suppresses tier + fee when no control rendered', () => {
    const audit = baseAudit();
    audit.render_controls = [
      renderControl('google', false, 'unable_to_verify'),
      renderControl('yelp', false, 'unable_to_verify'),
      renderControl('facebook', false, 'unable_to_verify'),
      renderControl('bbb', false, 'unable_to_verify'),
    ];
    const out = applyRenderControlCoverageGate(audit);
    expect(out.recommended_tier).toBeNull();
    expect(out.estimated_monthly_service_fee).toBeUndefined();
    expect(out.render_control_coverage).toEqual({
      attempted: 4,
      rendered: 0,
      rate: 0,
      tier_suppressed: true,
    });
  });

  it('keeps the tier when coverage meets the threshold', () => {
    const audit = baseAudit();
    audit.render_controls = [
      renderControl('google', true, 'platform_available'),
      renderControl('yelp', true, 'platform_available'),
      renderControl('facebook', true, 'business_specific_failure'),
      renderControl('bbb', true, 'business_specific_failure'),
    ];
    const out = applyRenderControlCoverageGate(audit);
    expect(out.recommended_tier).toBe('tier_3');
    expect(out.estimated_monthly_service_fee).toBeDefined();
    expect(out.render_control_coverage.tier_suppressed).toBe(false);
    expect(out.render_control_coverage.rate).toBe(1);
  });

  it('treats exactly the threshold as sufficient (strictly-below suppresses)', () => {
    const audit = baseAudit();
    audit.render_controls = [
      renderControl('google', true, 'platform_available'),
      renderControl('yelp', true, 'platform_available'),
      renderControl('facebook', false, 'unable_to_verify'),
      renderControl('bbb', false, 'unable_to_verify'),
    ];
    const out = applyRenderControlCoverageGate(audit);
    expect(out.render_control_coverage.rate).toBe(MIN_RENDER_CONTROL_COVERAGE_FOR_TIER);
    expect(out.render_control_coverage.tier_suppressed).toBe(false);
    expect(out.recommended_tier).toBe('tier_3');
  });

  it('suppresses when coverage falls just below the threshold', () => {
    const audit = baseAudit();
    audit.render_controls = [
      renderControl('google', true, 'platform_available'),
      renderControl('yelp', false, 'unable_to_verify'),
      renderControl('facebook', false, 'unable_to_verify'),
      renderControl('bbb', false, 'unable_to_verify'),
    ];
    const out = applyRenderControlCoverageGate(audit);
    expect(out.render_control_coverage.rate).toBe(0.25);
    expect(out.render_control_coverage.tier_suppressed).toBe(true);
    expect(out.recommended_tier).toBeNull();
  });

  it('the gated audit still validates (null tier + derived coverage field)', () => {
    const audit = baseAudit();
    audit.render_controls = [renderControl('google', false, 'unable_to_verify')];
    const gated = applyRenderControlCoverageGate(audit);
    const result = businessAnalysisSchema.safeParse(gated);
    expect(result.success).toBe(true);
  });
});
