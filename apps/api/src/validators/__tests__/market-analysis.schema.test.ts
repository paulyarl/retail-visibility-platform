/**
 * Unit tests for the canonical market-analysis output schema (G5, G17, G18).
 *
 * Verifies:
 *   - Valid JSON with number fields passes.
 *   - String-encoded numbers ("4.2") are coerced (G5).
 *   - Percent-suffixed strings ("85%") are stripped and coerced (G5).
 *   - Invalid shape returns field-level Zod issues.
 *   - The registry resolves market_analysis and returns null for unknown.
 */

import { describe, it, expect } from 'vitest';
import {
  marketAnalysisSchema,
  MARKET_ANALYSIS_SCHEMA_NAME,
  resolveOutputSchema,
  OUTPUT_SCHEMA_REGISTRY,
} from '../market-analysis.schema';

const validOutput = {
  market_analysis: {
    location: 'Plainfield, IL',
    industry: 'HVAC',
    total_approximate_businesses: 47,
    average_gbp_metrics: {
      average_rating: 4.2,
      average_review_count: 28,
    },
    gbp_claimed_percentage: 62,
    website_presence_percentage: 55,
    top_5_competitors: [
      { name: 'Acme HVAC', approximate_rating: 4.5, approximate_review_count: 120, location_status: 'Plainfield' },
      { name: 'Beta Heating', approximate_rating: 4.1, approximate_review_count: 88, location_status: 'Plainfield' },
    ],
    common_pain_points: ['No website', 'Unclaimed GBP'],
    opportunity_gaps: ['Underserved north side'],
    recommended_outreach_angle: 'Lead with GBP optimization — 38% unclaimed.',
  },
};

describe('marketAnalysisSchema', () => {
  it('accepts valid JSON with number fields', () => {
    const result = marketAnalysisSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('coerces string-encoded numbers ("4.2") to numbers (G5)', () => {
    const input = {
      ...validOutput,
      market_analysis: {
        ...validOutput.market_analysis,
        total_approximate_businesses: '47',
        average_gbp_metrics: {
          average_rating: '4.2',
          average_review_count: '28',
        },
      },
    };
    const result = marketAnalysisSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market_analysis.total_approximate_businesses).toBe(47);
      expect(result.data.market_analysis.average_gbp_metrics.average_rating).toBe(4.2);
    }
  });

  it('strips "%" and coerces percentage strings (G5)', () => {
    const input = {
      ...validOutput,
      market_analysis: {
        ...validOutput.market_analysis,
        gbp_claimed_percentage: '62%',
        website_presence_percentage: '55%',
      },
    };
    const result = marketAnalysisSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market_analysis.gbp_claimed_percentage).toBe(62);
      expect(result.data.market_analysis.website_presence_percentage).toBe(55);
    }
  });

  it('rejects missing recommended_outreach_angle with field-level issue', () => {
    const input = {
      market_analysis: {
        ...validOutput.market_analysis,
        recommended_outreach_angle: undefined,
      },
    };
    const result = marketAnalysisSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('recommended_outreach_angle'))).toBe(true);
    }
  });

  it('rejects empty top_5_competitors array', () => {
    const input = {
      ...validOutput,
      market_analysis: {
        ...validOutput.market_analysis,
        top_5_competitors: [],
      },
    };
    const result = marketAnalysisSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric rating that cannot be coerced', () => {
    const input = {
      ...validOutput,
      market_analysis: {
        ...validOutput.market_analysis,
        average_gbp_metrics: { average_rating: 'not-a-number', average_review_count: 28 },
      },
    };
    const result = marketAnalysisSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('OUTPUT_SCHEMA_REGISTRY / resolveOutputSchema', () => {
  it('resolves market_analysis with validator, auditPlatform, and promptSuffix', () => {
    const resolved = resolveOutputSchema(MARKET_ANALYSIS_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved!.auditPlatform).toBe('category_analysis');
    expect(resolved!.promptSuffix).toContain('market_analysis');
    expect(resolved!.promptSuffix).toContain('recommended_outreach_angle');
  });

  it('returns null for unknown schema name', () => {
    expect(resolveOutputSchema('nonexistent')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(resolveOutputSchema(null)).toBeNull();
    expect(resolveOutputSchema(undefined)).toBeNull();
  });

  it('registry contains market_analysis entry', () => {
    expect(OUTPUT_SCHEMA_REGISTRY[MARKET_ANALYSIS_SCHEMA_NAME]).toBeDefined();
  });
});
