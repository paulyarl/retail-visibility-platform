/**
 * MarketingBusinessTypeService tests — Sprint 1 (Universal Recalibration)
 *
 * Verifies the business-type classifier resolution precedence:
 *   1. Agent-emitted audit_data.business_type (if valid)
 *   2. Category mapping via mkt_business_type_categories table
 *   3. null (unable to classify)
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ─────────────────────────────────────────────────────────
// vi.mock factories are hoisted above imports, so we use vi.hoisted() to
// define the mock object in a way that's accessible from the hoisted factory.

const { mockBusinessTypeCategories } = vi.hoisted(() => ({
  mockBusinessTypeCategories: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_business_type_categories: mockBusinessTypeCategories,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import AFTER mocks are set up
import { MarketingBusinessTypeService } from '../MarketingBusinessTypeService';
import type { BusinessAnalysisAuditData } from '../outreach-openers/archetype-selection';

// ─── Fixtures ────────────────────────────────────────────────────────────

function auditWithBusinessType(type: string | null): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    business_type: type as any,
    platforms: { google: { profile_status: 'claimed' } as any },
    combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
  };
}

function auditWithCategory(category: string): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    audit_metadata: {
      audit_date: '2024-06-01',
      requested_business: { business_name: 'Test', city: 'Indy', state: 'IN', category },
      matched_business: { business_name: 'Test', category },
      identity_status: 'confirmed',
      identity_confidence: 'high',
    },
    platforms: { google: { profile_status: 'claimed' } as any },
    combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
  };
}

function auditWithGoogleCategory(googleCategory: string): BusinessAnalysisAuditData {
  return {
    summary: 'test',
    platforms: { google: { profile_status: 'claimed', primary_category: googleCategory } as any },
    combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 },
    website: { url: 'https://example.com', status: 'working' },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Sprint 1 — MarketingBusinessTypeService.resolveBusinessType', () => {
  let service: MarketingBusinessTypeService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get a fresh instance — the singleton may have cached state from prior tests
    // but since resolveBusinessType is stateless, this is fine.
    service = MarketingBusinessTypeService.getInstance();
  });

  it('returns agent-emitted "product" when business_type is present and valid', async () => {
    const result = await service.resolveBusinessType(auditWithBusinessType('product'));
    expect(result).toBe('product');
    // Should NOT query the DB when agent-emitted type is valid
    expect(mockBusinessTypeCategories.findUnique).not.toHaveBeenCalled();
  });

  it('returns agent-emitted "hybrid" without DB query', async () => {
    const result = await service.resolveBusinessType(auditWithBusinessType('hybrid'));
    expect(result).toBe('hybrid');
    expect(mockBusinessTypeCategories.findUnique).not.toHaveBeenCalled();
  });

  it('returns agent-emitted "service" without DB query', async () => {
    const result = await service.resolveBusinessType(auditWithBusinessType('service'));
    expect(result).toBe('service');
    expect(mockBusinessTypeCategories.findUnique).not.toHaveBeenCalled();
  });

  it('falls through to category mapping when business_type is "unable_to_verify"', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'african grocery store',
      business_type: 'product',
      is_active: true,
    });
    const result = await service.resolveBusinessType({
      ...auditWithBusinessType('unable_to_verify'),
      audit_metadata: {
        audit_date: '2024-06-01',
        requested_business: { business_name: 'Test', city: 'Indy', state: 'IN', category: 'African grocery store' },
        matched_business: { business_name: 'Test', category: 'African grocery store' },
        identity_status: 'confirmed',
        identity_confidence: 'high',
      },
    });
    expect(result).toBe('product');
    expect(mockBusinessTypeCategories.findUnique).toHaveBeenCalledWith({
      where: { category: 'african grocery store' },
    });
  });

  it('falls through to category mapping when business_type is null', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'bakery',
      business_type: 'product',
      is_active: true,
    });
    const result = await service.resolveBusinessType(auditWithCategory('Bakery'));
    expect(result).toBe('product');
    expect(mockBusinessTypeCategories.findUnique).toHaveBeenCalledWith({
      where: { category: 'bakery' },
    });
  });

  it('falls through to category mapping when business_type is absent', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'hvac contractor',
      business_type: 'service',
      is_active: true,
    });
    const result = await service.resolveBusinessType(auditWithCategory('HVAC Contractor'));
    expect(result).toBe('service');
  });

  it('uses google.primary_category when matched_business.category is absent', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'african restaurant',
      business_type: 'hybrid',
      is_active: true,
    });
    const result = await service.resolveBusinessType(auditWithGoogleCategory('African Restaurant'));
    expect(result).toBe('hybrid');
    expect(mockBusinessTypeCategories.findUnique).toHaveBeenCalledWith({
      where: { category: 'african restaurant' },
    });
  });

  it('prefers matched_business.category over google.primary_category', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'african grocery store',
      business_type: 'product',
      is_active: true,
    });
    const audit = auditWithCategory('African Grocery Store');
    (audit.platforms!.google as any).primary_category = 'Grocery Store';
    const result = await service.resolveBusinessType(audit);
    expect(result).toBe('product');
    expect(mockBusinessTypeCategories.findUnique).toHaveBeenCalledWith({
      where: { category: 'african grocery store' },
    });
  });

  it('returns null when no category is available and business_type is absent', async () => {
    const result = await service.resolveBusinessType({
      summary: 'test',
      platforms: { google: { profile_status: 'claimed' } as any },
      combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 },
      website: { url: 'https://example.com', status: 'working' },
      nap_consistency: { overall_status: 'consistent' },
      digital_opportunity_score: { score: 5 },
      high_attention: false,
      recommended_tier: 'tier_2',
      data_quality: { confidence: 'high' },
    });
    expect(result).toBeNull();
    expect(mockBusinessTypeCategories.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when category table has no matching row', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue(null);
    const result = await service.resolveBusinessType(auditWithCategory('Unknown Category'));
    expect(result).toBeNull();
  });

  it('returns null when matching row is inactive', async () => {
    mockBusinessTypeCategories.findUnique.mockResolvedValue({
      category: 'old category',
      business_type: 'product',
      is_active: false,
    });
    const result = await service.resolveBusinessType(auditWithCategory('Old Category'));
    expect(result).toBeNull();
  });

  it('returns null when auditData is null', async () => {
    const result = await service.resolveBusinessType(null);
    expect(result).toBeNull();
  });

  it('returns null when auditData is undefined', async () => {
    const result = await service.resolveBusinessType(undefined);
    expect(result).toBeNull();
  });

  it('returns null when DB query throws (graceful degradation)', async () => {
    mockBusinessTypeCategories.findUnique.mockRejectedValue(new Error('DB connection lost'));
    const result = await service.resolveBusinessType(auditWithCategory('African Grocery Store'));
    expect(result).toBeNull();
  });
});

describe('Sprint 1 — MarketingBusinessTypeService.isProductOrHybrid', () => {
  const service = MarketingBusinessTypeService.getInstance();

  it('returns true for "product"', () => {
    expect(service.isProductOrHybrid('product')).toBe(true);
  });

  it('returns true for "hybrid"', () => {
    expect(service.isProductOrHybrid('hybrid')).toBe(true);
  });

  it('returns false for "service"', () => {
    expect(service.isProductOrHybrid('service')).toBe(false);
  });

  it('returns false for null (unknown)', () => {
    expect(service.isProductOrHybrid(null)).toBe(false);
  });
});
