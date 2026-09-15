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
import { MarketContextLoader } from './intelligence/MarketContextLoader';

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
  /** directory_listings_list.business_name — for the teaser payload */
  businessName: string | null;
  /** directory_presence_seeds.category — drives MarketContextLoader */
  category: string | null;
  /** directory_presence_seeds.city — drives MarketContextLoader */
  city: string | null;
  /** directory_presence_seeds.state — drives MarketContextLoader */
  state: string | null;
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

    // 1. listing → listing_id + business_name
    const listing = await this.prisma.directory_listings_list.findFirst({
      where: { slug: businessSlug },
      select: { id: true, business_name: true },
    });
    if (!listing) return null;

    // 2. listing_id → seed (id + category/city/state for MarketContextLoader)
    const seed = await this.prisma.directory_presence_seeds.findUnique({
      where: { listing_id: listing.id },
      select: { id: true, category: true, city: true, state: true },
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
      businessName: listing.business_name,
      category: seed.category,
      city: seed.city,
      state: seed.state,
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

  /**
   * Read the Tier-C-safe `public_narrative` from the audit output (§1.1).
   * Returns `null` when absent — the layout keeps its existing
   * description/disclaimer fallback chain.
   */
  readPublicNarrative(auditData: unknown): string | null {
    if (!auditData || typeof auditData !== 'object') return null;
    const data = auditData as Record<string, unknown>;
    const narrative = data.public_narrative;
    return typeof narrative === 'string' && narrative.trim().length > 0 ? narrative : null;
  }

  /**
   * Read the structured `market_opportunities` array (§8.5).
   * Returns `[]` when absent — callers fall back to `gap_analysis.gaps`.
   */
  readMarketOpportunities(
    auditData: unknown,
  ): Array<{ title: string; description: string | null; impact: string | null }> {
    if (!auditData || typeof auditData !== 'object') return [];
    const data = auditData as Record<string, unknown>;
    const opportunities = data.market_opportunities;
    if (!Array.isArray(opportunities)) return [];
    return opportunities as Array<{ title: string; description: string | null; impact: string | null }>;
  }

  /**
   * Read `gap_analysis.gaps` for the §8.5.4 fallback. Each gap carries a
   * `field` (the missing capability) and a `severity` (`non_negotiable` |
   * `recommended`). Returns `[]` when absent.
   */
  readGapAnalysisGaps(
    auditData: unknown,
  ): Array<{ field: string | null; severity: string | null }> {
    if (!auditData || typeof auditData !== 'object') return [];
    const data = auditData as Record<string, unknown>;
    const gapAnalysis = data.gap_analysis as { gaps?: unknown[] } | undefined;
    const gaps = gapAnalysis?.gaps;
    if (!Array.isArray(gaps)) return [];
    return gaps as Array<{ field: string | null; severity: string | null }>;
  }

  /**
   * Read the full `gap_analysis` object (gold-standard benchmark comparison)
   * for the "How It Stacks Up" full view. Returns `null` when absent.
   */
  readGapAnalysis(auditData: unknown): Record<string, unknown> | null {
    if (!auditData || typeof auditData !== 'object') return null;
    const data = auditData as Record<string, unknown>;
    const gapAnalysis = data.gap_analysis;
    if (!gapAnalysis || typeof gapAnalysis !== 'object') return null;
    return gapAnalysis as Record<string, unknown>;
  }

  // ─── Teaser summary (§4.1) ─────────────────────────────────────────────

  /**
   * Build the public teaser summary payload for the seed page sidebar.
   *
   * Resolves the audit via §8.4, loads market context via
   * `MarketContextLoader`, and derives teaser counts with the §8.5.4
   * fallback. Returns `hasAudit: false` when the resolution chain breaks
   * — the sidebar renders a "no intel available" state, not an error.
   *
   * @param businessSlug The `directory_listings_list.slug` for the place page.
   */
  async getTeaserSummary(businessSlug: string): Promise<MarketIntelTeaserSummary> {
    const resolved = await this.resolveSeedAuditBySlug(businessSlug);

    // No audit → sidebar still renders, cards show available: false.
    if (!resolved) {
      return {
        businessSlug,
        businessName: null,
        hasAudit: false,
        publicNarrative: null,
        cards: {
          growthOpportunities: { available: false, teaser: 'No growth opportunities spotted yet', count: 0 },
          howItStacksUp: { available: false, teaser: 'Signal check still in progress' },
          fullReport: { available: false, teaser: 'Complete market analysis with recommendations' },
          claimBusiness: { available: true, teaser: 'Own this business? Claim it to see the full picture — free.' },
        },
      };
    }

    // Load market context (5-min TTL inside MarketContextLoader).
    const marketCtx = await MarketContextLoader.getInstance().loadMarketContext(
      resolved.category ?? '',
      resolved.city,
      resolved.state,
    );

    // public_narrative — Tier-C-safe audit field rendered in the About
    // section (§1.1). Falls back to null when absent; the layout keeps its
    // existing description/disclaimer fallback chain.
    const publicNarrative = this.readPublicNarrative(resolved.auditData);

    // Growth Opportunities — §8.5.4 fallback derivation.
    const oppCount = this.deriveOpportunityCount(resolved.auditData);
    const growthAvailable = oppCount.count > 0;
    const growthTeaser = `${oppCount.count} actionable gap${oppCount.count !== 1 ? 's' : ''} spotted`;

    // How It Stacks Up — signal checklist (structured array).
    const checklist = this.readSignalChecklist(resolved.auditData);
    let stacksAvailable: boolean;
    let stacksTeaser: string;
    if (checklist && checklist.length > 0) {
      const met = checklist.filter((s) => s.met === true).length;
      stacksAvailable = true;
      stacksTeaser = `Meets ${met} of ${checklist.length} category signals`;
    } else {
      // Fallback: category signals exist in context but no per-business
      // evaluation yet (re-audits haven't landed). Card renders available:
      // false with the "pending" teaser copy per §8.5.4.
      stacksAvailable = false;
      stacksTeaser = 'Signal check still in progress';
    }

    return {
      businessSlug,
      businessName: resolved.businessName,
      hasAudit: true,
      publicNarrative,
      cards: {
        growthOpportunities: {
          available: growthAvailable,
          teaser: growthTeaser,
          count: oppCount.count,
        },
        howItStacksUp: {
          available: stacksAvailable,
          teaser: stacksTeaser,
        },
        fullReport: {
          available: true,
          teaser: 'Complete market analysis with recommendations',
        },
        claimBusiness: {
          available: true,
          teaser: 'Own this business? Claim it to see the full picture — free.',
        },
      },
    };
  }

  // ─── Partial content (§4.2) ───────────────────────────────────────────

  /**
   * Number of growth-opportunity items shown to a free (logged-in)
   * shopper before the rest lock. Spec §3.1 partial view shows 2 items
   * + "1 more opportunity".
   */
  static readonly PARTIAL_OPPORTUNITY_LIMIT = 2;

  /**
   * Build the partial-content payload for a logged-in free shopper.
   *
   * Phase 2: any authenticated customer qualifies (spec §4.2 —
   * `requireCustomerAuth` only, no `requirePlatformContext`). The
   * `customerId` is accepted for Phase 3 access-tier resolution but
   * unused here.
   *
   * Returns `available: false` cards when the audit or structured fields
   * are missing — the sidebar degrades to the teaser state, not an error.
   *
   * @param businessSlug The `directory_listings_list.slug` for the place page.
   * @param _customerId   Reserved for Phase 3 access-tier resolution.
   */
  async getPartialContent(
    businessSlug: string,
    _customerId: string,
  ): Promise<MarketIntelPartialContent> {
    const resolved = await this.resolveSeedAuditBySlug(businessSlug);

    if (!resolved) {
      return {
        businessSlug,
        hasAudit: false,
        growthOpportunities: { items: [], lockedCount: 0, available: false },
        howItStacksUp: { signals: [], available: false },
      };
    }

    // Growth Opportunities — top N items unlocked, rest locked.
    const opportunities = this.readMarketOpportunities(resolved.auditData);
    let growthItems: Array<{ title: string; impact: string | null; locked: boolean }>;
    let lockedCount: number;
    let growthAvailable: boolean;

    if (opportunities.length > 0) {
      const limit = MarketIntelService.PARTIAL_OPPORTUNITY_LIMIT;
      growthItems = opportunities.map((opp, i) => ({
        title: opp.title,
        impact: opp.impact,
        locked: i >= limit,
      }));
      lockedCount = Math.max(0, opportunities.length - limit);
      growthAvailable = true;
    } else {
      // Fallback: gap_analysis.gaps (§8.5.4) — title from the gap field,
      // impact mapped from severity.
      const gaps = this.readGapAnalysisGaps(resolved.auditData);
      if (gaps.length > 0) {
        const limit = MarketIntelService.PARTIAL_OPPORTUNITY_LIMIT;
        growthItems = gaps.map((gap, i) => ({
          title: gap.field ?? 'Growth opportunity identified',
          impact: gap.severity === 'non_negotiable' ? 'HIGH' : 'MEDIUM',
          locked: i >= limit,
        }));
        lockedCount = Math.max(0, gaps.length - limit);
        growthAvailable = true;
      } else {
        growthItems = [];
        lockedCount = 0;
        growthAvailable = false;
      }
    }

    // How It Stacks Up — full signal checklist (short by design).
    const checklist = this.readSignalChecklist(resolved.auditData);
    let signals: Array<{ signal: string; met: boolean | null }>;
    let stacksAvailable: boolean;
    if (checklist && checklist.length > 0) {
      signals = checklist.map((s) => ({ signal: s.signal, met: s.met }));
      stacksAvailable = true;
    } else {
      signals = [];
      stacksAvailable = false;
    }

    return {
      businessSlug,
      hasAudit: true,
      growthOpportunities: {
        items: growthItems,
        lockedCount,
        available: growthAvailable,
      },
      howItStacksUp: {
        signals,
        available: stacksAvailable,
      },
    };
  }

  // ─── Full content (§4.3) ─────────────────────────────────────────────

  /**
   * Build the full-content payload for a paid tenant or claimed owner.
   *
   * Phase 3: the route handler checks access via
   * `MarketIntelAccessService.canAccessFull` before calling this. This
   * method assumes access is granted — it does NOT re-check.
   *
   * Returns the complete audit-derived intelligence: all growth
   * opportunities (unlocked), the full signal checklist with evidence,
   * the gold-standard gap analysis, and the market context summary.
   *
   * @param businessSlug The `directory_listings_list.slug` for the place page.
   */
  async getFullContent(businessSlug: string): Promise<MarketIntelFullContent> {
    const resolved = await this.resolveSeedAuditBySlug(businessSlug);

    if (!resolved) {
      return {
        businessSlug,
        businessName: null,
        hasAudit: false,
        growthOpportunities: { items: [], available: false },
        howItStacksUp: { signals: [], available: false },
        gapAnalysis: null,
        marketContext: null,
      };
    }

    // Growth Opportunities — all items, unlocked.
    const opportunities = this.readMarketOpportunities(resolved.auditData);
    let growthItems: Array<{ title: string; description: string | null; impact: string | null }>;
    let growthAvailable: boolean;
    if (opportunities.length > 0) {
      growthItems = opportunities;
      growthAvailable = true;
    } else {
      const gaps = this.readGapAnalysisGaps(resolved.auditData);
      if (gaps.length > 0) {
        growthItems = gaps.map((g) => ({
          title: g.field ?? 'Growth opportunity identified',
          description: null,
          impact: g.severity === 'non_negotiable' ? 'HIGH' : 'MEDIUM',
        }));
        growthAvailable = true;
      } else {
        growthItems = [];
        growthAvailable = false;
      }
    }

    // How It Stacks Up — full signal checklist with evidence.
    const checklist = this.readSignalChecklist(resolved.auditData);
    let signals: Array<{ signal: string; met: boolean | null; evidence: string | null }>;
    let stacksAvailable: boolean;
    if (checklist && checklist.length > 0) {
      signals = checklist;
      stacksAvailable = true;
    } else {
      signals = [];
      stacksAvailable = false;
    }

    // Gold-standard gap analysis (raw, for the "How It Stacks Up" full view).
    const gapAnalysis = this.readGapAnalysis(resolved.auditData);

    // Market context summary (category + location intelligence).
    const marketLoader = MarketContextLoader.getInstance();
    const marketCtx = await marketLoader.loadMarketContext(
      resolved.category ?? '',
      resolved.city,
      resolved.state,
    );

    return {
      businessSlug,
      businessName: resolved.businessName,
      hasAudit: true,
      growthOpportunities: {
        items: growthItems,
        available: growthAvailable,
      },
      howItStacksUp: {
        signals,
        available: stacksAvailable,
      },
      gapAnalysis,
      marketContext: {
        hasCategoryIntelligence: marketLoader.hasCategoryIntelligence(marketCtx.category),
        hasLocationIntelligence: marketLoader.hasLocationIntelligence(marketCtx.location),
        category: marketCtx.category ?? null,
        location: marketCtx.location ?? null,
      },
    };
  }

  // ─── Category surface (§12.3) ─────────────────────────────────────────
  // No audit chain — the enrichment context IS the intel.

  /**
   * Category teaser summary (§12.3). The category enrichment context
   * is the intelligence — no audit chain needed.
   *
   * @param categorySlug  The category key (e.g. "indian-grocery").
   * @param city           City name or "__all__" for national.
   * @param state          State code (required when city !== "__all__").
   */
  async getCategoryTeaserSummary(
    categorySlug: string,
    city: string,
    state: string | null,
  ): Promise<CategoryMarketIntelTeaser> {
    const marketLoader = MarketContextLoader.getInstance();
    const marketCtx = await marketLoader.loadMarketContext(categorySlug, city, state);
    const cat = marketCtx.category;
    const hasCat = marketLoader.hasCategoryIntelligence(cat);

    const signalCount = cat.category_signals?.length ?? 0;
    const hasProfile = Boolean(cat.category_profile);
    const hasDensity = Boolean(cat.market_density);

    return {
      surfaceType: 'category',
      categorySlug,
      city,
      state,
      hasIntelligence: hasCat,
      cards: {
        categorySignals: {
          available: signalCount > 0,
          teaser: signalCount > 0
            ? `What strong looks like here — ${signalCount} signal${signalCount !== 1 ? 's' : ''} tracked`
            : 'Still gathering signals for this category',
          count: signalCount,
        },
        categoryProfile: {
          available: hasProfile,
          teaser: hasProfile
            ? 'Business model, customer base, competitive landscape'
            : 'Still building the profile for this category',
        },
        marketDensity: {
          available: hasDensity,
          teaser: hasDensity
            ? cat.market_density!
            : 'Still sizing up this market',
        },
        addYourBusiness: {
          available: true,
          teaser: 'List your business in this category',
        },
        fullReport: {
          available: hasCat,
          teaser: 'Download the full category market brief',
        },
      },
    };
  }

  /**
   * Category full content (§12.3). Returns the complete category
   * intelligence context for paid/admin viewers.
   */
  async getCategoryFullContent(
    categorySlug: string,
    city: string,
    state: string | null,
  ): Promise<CategoryMarketIntelFull> {
    const marketLoader = MarketContextLoader.getInstance();
    const marketCtx = await marketLoader.loadMarketContext(categorySlug, city, state);
    const cat = marketCtx.category;
    const hasCat = marketLoader.hasCategoryIntelligence(cat);

    return {
      surfaceType: 'category',
      categorySlug,
      city,
      state,
      hasIntelligence: hasCat,
      categorySignals: cat.category_signals ?? [],
      categoryProfile: cat.category_profile ?? null,
      marketDensity: cat.market_density ?? null,
      categorySummary: cat.category_summary ?? null,
      prospectSignals: cat.prospect_signals ?? [],
      marketContext: {
        hasCategoryIntelligence: hasCat,
        hasLocationIntelligence: marketLoader.hasLocationIntelligence(marketCtx.location),
        category: cat,
        location: marketCtx.location,
      },
    };
  }

  // ─── City surface (§12.3) ─────────────────────────────────────────────
  // No audit chain — the location enrichment context IS the intel.

  /**
   * City teaser summary (§12.3). The location enrichment context is
   * the intelligence — no audit chain needed.
   *
   * @param city   City name.
   * @param state  State code.
   */
  async getCityTeaserSummary(
    city: string,
    state: string,
  ): Promise<CityMarketIntelTeaser> {
    const marketLoader = MarketContextLoader.getInstance();
    const loc = await marketLoader.loadLocationContext(city, state);
    const hasLoc = marketLoader.hasLocationIntelligence(loc);

    const gapCount = loc.market_gaps?.length ?? 0;
    const hasMetro = Boolean(loc.metro_dynamics?.length);
    const hasSummary = Boolean(loc.market_summary);
    const hasProfile = Boolean(loc.city_profile);

    return {
      surfaceType: 'city',
      city,
      state,
      hasIntelligence: hasLoc,
      cards: {
        marketGaps: {
          available: gapCount > 0,
          teaser: gapCount > 0
            ? `${gapCount} thing${gapCount === 1 ? '' : 's'} ${city} could use more of`
            : 'Still mapping the gaps in this market',
          count: gapCount,
        },
        metroDynamics: {
          available: hasMetro || hasProfile,
          teaser: hasMetro || hasProfile
            ? `How ${city} fits into the wider metro area`
            : 'Metro context still being gathered',
        },
        marketSummary: {
          available: hasSummary,
          teaser: hasSummary
            ? loc.market_summary!.slice(0, 120) + (loc.market_summary!.length > 120 ? '...' : '')
            : 'City overview still coming together',
        },
        addYourBusiness: {
          available: true,
          teaser: `List your business in ${city}`,
        },
        fullReport: {
          available: hasLoc,
          teaser: 'Download the full city market brief',
        },
      },
    };
  }

  /**
   * City full content (§12.3). Returns the complete location
   * intelligence context for paid/admin viewers.
   */
  async getCityFullContent(
    city: string,
    state: string,
  ): Promise<CityMarketIntelFull> {
    const marketLoader = MarketContextLoader.getInstance();
    const loc = await marketLoader.loadLocationContext(city, state);
    const hasLoc = marketLoader.hasLocationIntelligence(loc);

    return {
      surfaceType: 'city',
      city,
      state,
      hasIntelligence: hasLoc,
      marketGaps: loc.market_gaps ?? [],
      metroDynamics: loc.metro_dynamics ?? [],
      cityProfile: loc.city_profile ?? null,
      marketSummary: loc.market_summary ?? null,
      notableAreas: loc.notable_areas ?? [],
      marketContext: {
        hasLocationIntelligence: hasLoc,
        location: loc,
      },
    };
  }
}

// ─── Teaser summary types (§4.1) ──────────────────────────────────────────

export interface MarketIntelTeaserSummary {
  businessSlug: string;
  businessName: string | null;
  hasAudit: boolean;
  /** Tier-C-safe audit narrative for the About section (§1.1). */
  publicNarrative: string | null;
  cards: {
    growthOpportunities: {
      available: boolean;
      teaser: string;
      count: number;
    };
    howItStacksUp: {
      available: boolean;
      teaser: string;
    };
    fullReport: {
      available: boolean;
      teaser: string;
    };
    claimBusiness: {
      available: boolean;
      teaser: string;
    };
  };
}

// ─── Partial content types (§4.2) ─────────────────────────────────────────

export interface MarketIntelPartialContent {
  businessSlug: string;
  hasAudit: boolean;
  growthOpportunities: {
    items: Array<{ title: string; impact: string | null; locked: boolean }>;
    lockedCount: number;
    available: boolean;
  };
  howItStacksUp: {
    signals: Array<{ signal: string; met: boolean | null }>;
    available: boolean;
  };
}

// ─── Full content types (§4.3) ────────────────────────────────────────────

export interface MarketIntelFullContent {
  businessSlug: string;
  businessName: string | null;
  hasAudit: boolean;
  growthOpportunities: {
    items: Array<{ title: string; description: string | null; impact: string | null }>;
    available: boolean;
  };
  howItStacksUp: {
    signals: Array<{ signal: string; met: boolean | null; evidence: string | null }>;
    available: boolean;
  };
  /** Gold-standard gap analysis (raw, for the full "How It Stacks Up" view). */
  gapAnalysis: Record<string, unknown> | null;
  /** Category + location intelligence summary. */
  marketContext: {
    hasCategoryIntelligence: boolean;
    hasLocationIntelligence: boolean;
    category: unknown;
    location: unknown;
  } | null;
}

// ─── Category surface types (§12.3) ────────────────────────────────────────

export interface CategoryMarketIntelTeaser {
  surfaceType: 'category';
  categorySlug: string;
  city: string;
  state: string | null;
  hasIntelligence: boolean;
  cards: {
    categorySignals: { available: boolean; teaser: string; count: number };
    categoryProfile: { available: boolean; teaser: string };
    marketDensity: { available: boolean; teaser: string };
    addYourBusiness: { available: boolean; teaser: string };
    fullReport: { available: boolean; teaser: string };
  };
}

export interface CategoryMarketIntelFull {
  surfaceType: 'category';
  categorySlug: string;
  city: string;
  state: string | null;
  hasIntelligence: boolean;
  categorySignals: string[];
  categoryProfile: unknown | null;
  marketDensity: string | null;
  categorySummary: string | null;
  prospectSignals: string[];
  marketContext: {
    hasCategoryIntelligence: boolean;
    hasLocationIntelligence: boolean;
    category: unknown;
    location: unknown;
  };
}

// ─── City surface types (§12.3) ────────────────────────────────────────────

export interface CityMarketIntelTeaser {
  surfaceType: 'city';
  city: string;
  state: string;
  hasIntelligence: boolean;
  cards: {
    marketGaps: { available: boolean; teaser: string; count: number };
    metroDynamics: { available: boolean; teaser: string };
    marketSummary: { available: boolean; teaser: string };
    addYourBusiness: { available: boolean; teaser: string };
    fullReport: { available: boolean; teaser: string };
  };
}

export interface CityMarketIntelFull {
  surfaceType: 'city';
  city: string;
  state: string;
  hasIntelligence: boolean;
  marketGaps: unknown[];
  metroDynamics: unknown[];
  cityProfile: unknown | null;
  marketSummary: string | null;
  notableAreas: string[];
  marketContext: {
    hasLocationIntelligence: boolean;
    location: unknown;
  };
}
