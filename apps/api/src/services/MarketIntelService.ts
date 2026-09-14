/**
 * MarketIntelService — Seed Market Intel Sidebar (Phase 0+)
 *
 * Resolves the market intelligence for a seed (business) page and produces
 * the card payloads for the sidebar. Phase 0 ships the slug→audit resolver
 * (§8.4) and the fallback derivation (§8.5.4); Phase 1+ adds the teaser
 * summary, partial, and full content methods.
 *
 * Resolution chain (§8.4):
 *   slug → directory_listings_list (slug)
 *        → directory_presence_seeds (listing_id)
 *        → directory_seed_campaign_links (seed_id — prefer link_role='primary')
 *        → mkt_campaigns_list
 *        → mkt_audits_list WHERE platform = 'business_analysis'
 *          ORDER BY created_at DESC LIMIT 1
 *
 * Returns null cleanly at every missing link — the sidebar degrades to
 * `hasAudit: false` rather than throwing.
 *
 * Pattern: singleton extends BaseService
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';

// ─── Constants ───────────────────────────────────────────────────────────

/** The audit platform value that identifies a business-analysis audit. */
const BUSINESS_ANALYSIS_PLATFORM = 'business_analysis';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Resolved audit for a seed page. `null` when any link in the §8.4 chain is
 * missing — the sidebar renders `hasAudit: false` in that case.
 */
export interface ResolvedSeedAudit {
  /** mkt_audits_list.id */
  auditId: string;
  /** mkt_campaigns_list.id the audit belongs to */
  campaignId: string;
  /** directory_presence_seeds.id the campaign is linked to */
  seedId: string;
  /** directory_listings_list.id the seed belongs to */
  listingId: string;
  /** The parsed audit_data JSONB (may be null if the audit row has no data). */
  auditData: unknown;
  /** When the audit row was created (used to pick the latest on ties). */
  createdAt: Date;
}

/**
 * Derived opportunity count per §8.5.4. Prefers `market_opportunities.length`
 * when the audit has the structured array; falls back to
 * `gap_analysis.gaps.length` (mapping `severity` to `impact`) until re-audits
 * land. Returns 0 when neither is present.
 */
export interface DerivedOpportunityCount {
  count: number;
  /** True when the structured `market_opportunities` array drove the count. */
  fromStructured: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────

export class MarketIntelService extends BaseService {
  private static instance: MarketIntelService;

  static getInstance(): MarketIntelService {
    if (!MarketIntelService.instance) {
      MarketIntelService.instance = new MarketIntelService();
    }
    return MarketIntelService.instance;
  }

  // ─── Slug → audit resolution (§8.4) ────────────────────────────────────

  /**
   * Resolve a place slug to its latest business_analysis audit.
   *
   * Walks the §8.4 chain: listing → seed → campaign link (primary) →
   * campaign → audit. Returns `null` at the first missing link — never
   * throws on a missing row. Throws only on unexpected DB errors (those
   * propagate so the route handler can 500).
   *
   * @param businessSlug The `directory_listings_list.slug` to resolve.
   */
  async resolveSeedAuditBySlug(businessSlug: string): Promise<ResolvedSeedAudit | null> {
    if (!businessSlug) return null;

    // 1. listing → listing_id
    const listing = await this.prisma.directory_listings_list.findFirst({
      where: { slug: businessSlug },
      select: { id: true },
    });
    if (!listing) return null;

    // 2. listing_id → seed
    const seed = await this.prisma.directory_presence_seeds.findUnique({
      where: { listing_id: listing.id },
      select: { id: true },
    });
    if (!seed) return null;

    // 3. seed_id → campaign link (prefer primary)
    const campaignLink = await this.prisma.directory_seed_campaign_links.findFirst({
      where: { seed_id: seed.id },
      orderBy: [{ link_role: 'asc' }], // 'primary' < 'secondary' lexicographically
      select: { campaign_id: true },
    });
    if (!campaignLink) return null;

    // 4. campaign_id → latest business_analysis audit
    const audit = await this.prisma.mkt_audits_list.findFirst({
      where: {
        campaign_id: campaignLink.campaign_id,
        platform: BUSINESS_ANALYSIS_PLATFORM,
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        campaign_id: true,
        audit_data: true,
        created_at: true,
      },
    });
    if (!audit) return null;

    return {
      auditId: audit.id,
      campaignId: audit.campaign_id,
      seedId: seed.id,
      listingId: listing.id,
      auditData: audit.audit_data,
      createdAt: audit.created_at,
    };
  }

  // ─── Fallback derivation (§8.5.4) ──────────────────────────────────────

  /**
   * Derive the growth-opportunity count for the teaser card.
   *
   * Prefers the structured `market_opportunities` array (Phase 0 schema
   * addition). Falls back to `gap_analysis.gaps.length` until re-audits
   * land — the fallback maps `severity` to `impact` (`non_negotiable` →
   * HIGH, `recommended` → MEDIUM) so the card copy stays honest about the
   * source ("signals identified by analysis," not "research data").
   *
   * @param auditData The parsed `mkt_audits_list.audit_data` JSONB, or null.
   */
  deriveOpportunityCount(auditData: unknown): DerivedOpportunityCount {
    if (!auditData || typeof auditData !== 'object') {
      return { count: 0, fromStructured: false };
    }
    const data = auditData as Record<string, unknown>;

    // Prefer the structured array.
    const opportunities = data.market_opportunities;
    if (Array.isArray(opportunities)) {
      return { count: opportunities.length, fromStructured: true };
    }

    // Fallback: gap_analysis.gaps.length (§8.5.4).
    const gapAnalysis = data.gap_analysis as { gaps?: unknown[] } | undefined;
    const gaps = gapAnalysis?.gaps;
    if (Array.isArray(gaps)) {
      return { count: gaps.length, fromStructured: false };
    }

    return { count: 0, fromStructured: false };
  }

  /**
   * Read the structured signal checklist, if present.
   *
   * Returns `null` when the audit has no `signal_checklist` array — the
   * "How It Stacks Up" card renders `available: false` (teaser copy:
   * "Category signal evaluation pending") per §8.5.4.
   *
   * @param auditData The parsed `mkt_audits_list.audit_data` JSONB, or null.
   */
  readSignalChecklist(
    auditData: unknown,
  ): Array<{ signal: string; met: boolean | null; evidence: string | null }> | null {
    if (!auditData || typeof auditData !== 'object') return null;
    const data = auditData as Record<string, unknown>;
    const checklist = data.signal_checklist;
    if (!Array.isArray(checklist)) return null;
    return checklist as Array<{ signal: string; met: boolean | null; evidence: string | null }>;
  }
}
