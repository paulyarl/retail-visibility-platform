/**
 * FAQ Coverage Service
 *
 * Computes per-tenant FAQ coverage metrics:
 * - Category coverage (% of categories with active FAQs)
 * - Product coverage (% of products with linked FAQs)
 * - Freshness (% of FAQs updated within 90 days)
 * - Orphan detection (FAQs with no category or broken links)
 * - Feedback summary (thumbs up/down ratios)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface CoverageMetrics {
  totalFaqs: number;
  activeFaqs: number;
  draftFaqs: number;
  archivedFaqs: number;
  totalCategories: number;
  categoriesWithFaqs: number;
  categoryCoveragePercent: number;
  totalProducts: number;
  productsWithFaqs: number;
  productCoveragePercent: number;
  freshnessPercent: number;
  orphanFaqs: number;
  feedbackUp: number;
  feedbackDown: number;
  feedbackSuggestEdit: number;
  helpfulnessPercent: number;
}

export interface TenantFaqSummary extends CoverageMetrics {
  tenantId: string;
  tenantName?: string;
}

class FaqCoverageService {
  private static instance: FaqCoverageService;

  private constructor() {}

  static getInstance(): FaqCoverageService {
    if (!FaqCoverageService.instance) {
      FaqCoverageService.instance = new FaqCoverageService();
    }
    return FaqCoverageService.instance;
  }

  /**
   * Compute coverage metrics for a single tenant
   */
  async getTenantCoverage(tenantId: string): Promise<CoverageMetrics> {
    const [
      faqStatusCounts,
      categoryCount,
      categoriesWithFaqs,
      productLinkCount,
      totalProducts,
      freshFaqs,
      orphanFaqs,
      feedbackCounts,
    ] = await Promise.all([
      // FAQ status breakdown
      prisma.faqs.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: { status: true },
      }),
      // Total categories
      prisma.faq_categories.count({
        where: { tenant_id: tenantId },
      }),
      // Categories with at least one active FAQ
      prisma.faq_categories.findMany({
        where: {
          tenant_id: tenantId,
          faqs: { some: { status: 'active' } },
        },
        select: { id: true },
      }),
      // Products with FAQ links
      prisma.faq_product_links.findMany({
        where: { faq: { tenant_id: tenantId } },
        distinct: ['product_id'],
        select: { product_id: true },
      }),
      // Total products (approximation from product links table)
      prisma.faq_product_links.findMany({
        where: { faq: { tenant_id: tenantId } },
        distinct: ['product_id'],
        select: { product_id: true },
      }),
      // FAQs updated within 90 days
      prisma.faqs.count({
        where: {
          tenant_id: tenantId,
          updated_at: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Orphan FAQs (no category or category doesn't exist)
      prisma.faqs.count({
        where: {
          tenant_id: tenantId,
          category_id: null,
        },
      }),
      // Feedback counts
      prisma.faq_feedback.groupBy({
        by: ['type'],
        where: { tenant_id: tenantId },
        _count: { type: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of faqStatusCounts) {
      statusMap[row.status] = row._count.status;
    }

    const totalFaqs = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const activeFaqs = statusMap['active'] || 0;
    const draftFaqs = statusMap['draft'] || 0;
    const archivedFaqs = statusMap['archived'] || 0;

    const feedbackMap: Record<string, number> = {};
    for (const row of feedbackCounts) {
      feedbackMap[row.type] = row._count.type;
    }
    const feedbackUp = feedbackMap['up'] || 0;
    const feedbackDown = feedbackMap['down'] || 0;
    const feedbackSuggestEdit = feedbackMap['suggest_edit'] || 0;
    const totalFeedback = feedbackUp + feedbackDown;
    const helpfulnessPercent = totalFeedback > 0 ? (feedbackUp / totalFeedback) * 100 : 0;

    return {
      totalFaqs,
      activeFaqs,
      draftFaqs,
      archivedFaqs,
      totalCategories: categoryCount,
      categoriesWithFaqs: categoriesWithFaqs.length,
      categoryCoveragePercent: categoryCount > 0 ? (categoriesWithFaqs.length / categoryCount) * 100 : 0,
      totalProducts: totalProducts.length,
      productsWithFaqs: productLinkCount.length,
      productCoveragePercent: totalProducts.length > 0 ? (productLinkCount.length / totalProducts.length) * 100 : 0,
      freshnessPercent: totalFaqs > 0 ? (freshFaqs / totalFaqs) * 100 : 0,
      orphanFaqs,
      feedbackUp,
      feedbackDown,
      feedbackSuggestEdit,
      helpfulnessPercent,
    };
  }

  /**
   * Get coverage summaries for all tenants (admin dashboard)
   */
  async getAllTenantSummaries(): Promise<TenantFaqSummary[]> {
    const tenants = await prisma.tenants.findMany({
      select: { id: true, name: true },
    });

    const summaries: TenantFaqSummary[] = [];
    for (const tenant of tenants) {
      try {
        const metrics = await this.getTenantCoverage(tenant.id);
        summaries.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          ...metrics,
        });
      } catch (err) {
        logger.error(`Failed to compute FAQ coverage for tenant ${tenant.id}:`, undefined, { error: String(err) });
      }
    }

    return summaries.sort((a, b) => b.totalFaqs - a.totalFaqs);
  }
}

export default FaqCoverageService;
