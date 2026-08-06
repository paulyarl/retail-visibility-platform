/**
 * MarketingBusinessTypeService — business-type classifier
 *
 * Maps GBP primary_category / matched_business.category strings to a
 * business_type classification ('service' | 'product' | 'hybrid') used by:
 *   - signal-extractor.ts: business-type-sensitive thresholds (e.g. DS_PHOTO_DEFICIT <5 vs <10)
 *   - archetype-selection.ts: A6 (Product Visibility Gap) only fires for product/hybrid
 *
 * Resolution precedence:
 *   1. Agent-emitted audit_data.business_type (if present and not 'unable_to_verify')
 *   2. Category mapping from mkt_business_type_categories table
 *   3. null (unable to classify — A6 won't fire, service-business routing unchanged)
 *
 * Pattern: singleton extends BaseService (mirrors MarketingPlaybookCatalogService).
 * Stateless reference-table lookup — no caching needed (small table, negligible cost).
 *
 * Sprint 1 — Universal Recalibration.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { BusinessAnalysisAuditData } from './outreach-openers/archetype-selection';

export type BusinessType = 'service' | 'product' | 'hybrid';

const VALID_BUSINESS_TYPES: ReadonlySet<string> = new Set(['service', 'product', 'hybrid']);

export class MarketingBusinessTypeService extends BaseService {
  private static instance: MarketingBusinessTypeService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingBusinessTypeService {
    if (!MarketingBusinessTypeService.instance) {
      MarketingBusinessTypeService.instance = new MarketingBusinessTypeService();
    }
    return MarketingBusinessTypeService.instance;
  }

  /**
   * Resolve the business type from audit data.
   *
   * Precedence:
   *   1. audit_data.business_type (agent-emitted field, if valid)
   *   2. Category mapping via mkt_business_type_categories table
   *      (uses audit_metadata.matched_business.category or
   *       platforms.google.primary_category, lowercased)
   *   3. null (unable to classify)
   *
   * Returns null when the business type cannot be determined. Callers
   * (extractor, archetype selection) treat null as "unknown" — A6 won't
   * fire and service-business thresholds apply.
   */
  async resolveBusinessType(auditData: BusinessAnalysisAuditData | null | undefined): Promise<BusinessType | null> {
    if (!auditData) return null;

    // 1. Agent-emitted business_type field
    const agentType = (auditData as any).business_type;
    if (typeof agentType === 'string' && VALID_BUSINESS_TYPES.has(agentType)) {
      return agentType as BusinessType;
    }

    // 2. Category mapping
    const category = this.extractCategory(auditData);
    if (!category) return null;

    try {
      const row = await this.prisma.mkt_business_type_categories.findUnique({
        where: { category },
      });
      if (row && row.is_active && VALID_BUSINESS_TYPES.has(row.business_type)) {
        return row.business_type as BusinessType;
      }
    } catch (err) {
      logger.warn('MarketingBusinessTypeService: failed to query mkt_business_type_categories', undefined, {
        category,
        error: (err as Error)?.message,
      });
    }

    return null;
  }

  /**
   * Extract a lowercased category string from audit data.
   * Tries matched_business.category first, then google.primary_category.
   */
  private extractCategory(auditData: BusinessAnalysisAuditData): string | null {
    const matched = auditData.audit_metadata?.matched_business?.category;
    if (typeof matched === 'string' && matched.trim()) {
      return matched.trim().toLowerCase();
    }
    const googleCategory = auditData.platforms?.google?.primary_category;
    if (typeof googleCategory === 'string' && googleCategory.trim()) {
      return googleCategory.trim().toLowerCase();
    }
    return null;
  }

  /**
   * Check if a business type is product or hybrid (i.e., has inventory).
   * Convenience predicate used by the signal extractor and archetype selection.
   */
  isProductOrHybrid(type: BusinessType | null): boolean {
    return type === 'product' || type === 'hybrid';
  }
}
