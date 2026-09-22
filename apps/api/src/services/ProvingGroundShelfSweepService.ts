import { BaseService } from './BaseService';
import {
  normalizeCategoryKey,
  normalizeReferenceCity,
  normalizeReferenceState,
} from './intelligence/IntelligenceProfileService';
import CategoryMarketEnrichmentService from './CategoryMarketEnrichmentService';
import LocationMarketEnrichmentService from './LocationMarketEnrichmentService';
import { MarketingCampaignService } from './MarketingCampaignService';
import { ConflictError } from '../middleware/errorHandler';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

/**
 * ProvingGroundShelfSweepService — PG shelf coverage sweep.
 *
 * The gap this closes: category enrichment is keyed one row per
 * (category_key, city, state), and every existing producer targets a single
 * market — a PG's own (category, city, state) via the cockpit buttons, or one
 * profile's category on activation. A prospect's secondary categories never
 * reach the enrichment pipeline, so their public shelf pages render without
 * enrichment (market: null).
 *
 * One click on a proving ground sweeps the full declared + discovered domain:
 *
 *   category markets =
 *     (pg.category ∪ pg.secondary_categories)              — declared
 *       × ({pg.city,pg.state} ∪ pg.member_geos)
 *     ∪ per-prospect (prospect categories × prospect geo)  — discovered
 *       where prospect categories = queue.category
 *         ∪ snapshot.identified_category ∪ snapshot.secondary_categories
 *         ∪ processed/source campaign {category, secondary_categories}
 *         ∪ linked listing.secondary_categories
 *
 *   location markets = distinct geos across the same inputs.
 *
 * Classification per category market:
 *   covered          — a directory_category_enrichment row already exists
 *                      (first-fill only: the sweep NEVER overwrites rows)
 *   campaign_exists  — an active directory_enrichment campaign (single-market
 *                      signature or a prior set's shelf_sweep payload) covers it
 *   enriched         — enrichMarket() wrote it deterministically (profile
 *                      exists — the free path)
 *   needs_ai         — no row, no campaign, no profile → routed into one
 *                      spawned directory_enrichment child campaign carrying
 *                      the residual set in discovery_context.shelf_sweep
 *   skipped / error  — invalid market or enrich failure (partial success)
 *
 * Location markets: covered → else enrichLocation() deterministic baseline
 * (no profile needed). Category pass runs first so location aggregates pick
 * up freshly written category rows; enrichMarket already resyncs the
 * location row per enriched market, so the location pass only fills cities
 * no category pass produced.
 *
 * National row: the ('__location__','__all__','__all__') row is derived
 * state over every covered market — listings publish/unpublish and national
 * category packets land between sweeps, so its coverage fact layer goes
 * stale silently. Unlike the city pass (first-fill only), the national
 * refresh runs on EVERY sweep: enrichNational is a cheap aggregate
 * recompute that preserves campaign-applied copy.
 */

const LOCATION_SENTINEL_KEY = '__location__';

// Stages that do NOT count as "an active campaign covers this market" —
// mirrors the structural-duplicate guardrail's inactive set (AGENTS.md).
const INACTIVE_STAGES = new Set(['lost', 'dead', 'closed', 'resolved_and_closed']);

export interface SweepMarket {
  category: string;
  categoryKey: string;
  city: string;
  state: string;
}

export interface CategoryMarketOutcome extends SweepMarket {
  status: 'covered' | 'campaign_exists' | 'enriched' | 'needs_ai' | 'skipped' | 'error';
  detail?: string;
  listingsEnriched?: number;
}

export interface LocationMarketOutcome {
  city: string;
  state: string;
  status: 'covered' | 'enriched' | 'skipped' | 'error';
  detail?: string;
}

export interface ShelfSweepReport {
  provingGroundId: string;
  domain: {
    categories: string[];
    geos: Array<{ city: string; state: string | null }>;
  };
  categoryMarkets: CategoryMarketOutcome[];
  locationMarkets: LocationMarketOutcome[];
  /** Refresh outcome for the ('__location__','__all__','__all__') row —
   *  separate from locationMarkets (which is the per-city first-fill pass). */
  nationalLocation: LocationMarketOutcome | null;
  needsAi: SweepMarket[];
  sweepCampaign: {
    id: string;
    created: boolean;
    marketCount: number;
    mergedMarkets?: number;
  } | null;
}

function marketKey(categoryKey: string, city: string, state: string): string {
  return `${categoryKey}|${city.toLowerCase()}|${state.toLowerCase()}`;
}

function toSweepMarket(category: string, city: string, state: string): SweepMarket | null {
  const categoryKey = normalizeCategoryKey(category);
  const normalizedCity = normalizeReferenceCity(city);
  const normalizedState = normalizeReferenceState(state);
  if (!categoryKey || !normalizedCity || !normalizedState) return null;
  return { category: category.trim(), categoryKey, city: normalizedCity, state: normalizedState };
}

/** Pull the shelf_sweep market list off a campaign's discovery_context (passthrough field). */
function sweepMarketsOf(campaign: { discovery_context?: unknown }): SweepMarket[] {
  const dc = campaign.discovery_context as any;
  const raw = dc?.shelf_sweep?.markets;
  if (!Array.isArray(raw)) return [];
  const out: SweepMarket[] = [];
  for (const m of raw) {
    const sm = toSweepMarket(String(m?.category ?? ''), String(m?.city ?? ''), String(m?.state ?? ''));
    if (sm) out.push(sm);
  }
  return out;
}

class ProvingGroundShelfSweepService extends BaseService {
  private static instance: ProvingGroundShelfSweepService;

  private constructor() {
    super();
  }

  static getInstance(): ProvingGroundShelfSweepService {
    if (!ProvingGroundShelfSweepService.instance) {
      ProvingGroundShelfSweepService.instance = new ProvingGroundShelfSweepService();
    }
    return ProvingGroundShelfSweepService.instance;
  }

  async sweep(
    provingGroundId: string,
    opts: { createCampaign?: boolean; enrichedBy?: string | null } = {},
    ctx?: RequestCtx,
  ): Promise<ShelfSweepReport> {
    const pg = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: provingGroundId },
    });
    if (!pg) throw new Error(`Proving ground ${provingGroundId} not found`);
    if (pg.campaign_category !== 'proving_ground') {
      throw new Error(`Campaign ${provingGroundId} is not a proving ground (campaign_category=${pg.campaign_category})`);
    }

    // ── 1. Domain union ──────────────────────────────────────────────────
    const domainCategories = new Map<string, string>(); // normalized → display
    const addCategory = (c?: string | null) => {
      const key = normalizeCategoryKey(c ?? '');
      if (key && !domainCategories.has(key)) domainCategories.set(key, (c ?? '').trim());
    };
    addCategory(pg.category);
    for (const c of pg.secondary_categories ?? []) addCategory(c);

    const domainGeos = new Map<string, { city: string; state: string | null }>();
    const addGeo = (city?: string | null, state?: string | null) => {
      const nc = normalizeReferenceCity(city);
      if (!nc) return;
      const ns = normalizeReferenceState(state);
      const key = `${nc.toLowerCase()}|${(ns ?? '').toLowerCase()}`;
      if (!domainGeos.has(key)) domainGeos.set(key, { city: nc, state: ns });
    };
    addGeo(pg.city, pg.state);
    for (const g of (Array.isArray(pg.member_geos) ? pg.member_geos : []) as Array<{ city?: string; state?: string | null }>) {
      addGeo(g?.city, g?.state);
    }

    const marketPairs = new Map<string, SweepMarket>();
    const addMarket = (category?: string | null, city?: string | null, state?: string | null) => {
      const sm = toSweepMarket(category ?? '', city ?? '', state ?? '');
      if (!sm) return;
      marketPairs.set(marketKey(sm.categoryKey, sm.city, sm.state), sm);
    };

    // Declared domain cartesian.
    for (const cat of domainCategories.values()) {
      for (const geo of domainGeos.values()) {
        addMarket(cat, geo.city, geo.state);
      }
    }

    // Discovered: per-prospect categories × prospect geo.
    const queueRows = await this.prisma.mkt_prospect_queue.findMany({
      where: { proving_ground_id: provingGroundId },
      select: {
        category: true, city: true, state: true,
        seed_id: true, processed_campaign_id: true, source_campaign_id: true,
        business_snapshot: true,
      },
    });

    const memberCampaignIds = Array.from(new Set(
      queueRows.flatMap((q) => [q.processed_campaign_id, q.source_campaign_id]).filter(Boolean) as string[],
    ));
    const memberCampaigns = memberCampaignIds.length
      ? await this.prisma.mkt_campaigns_list.findMany({
          where: { id: { in: memberCampaignIds } },
          select: { id: true, category: true, secondary_categories: true, city: true, state: true },
        })
      : [];
    const campaignById = new Map(memberCampaigns.map((c) => [c.id, c]));

    const seedIds = Array.from(new Set(queueRows.map((q) => q.seed_id).filter(Boolean) as string[]));
    const seedListings = seedIds.length
      ? await this.prisma.directory_presence_seeds.findMany({
          where: { id: { in: seedIds } },
          select: { id: true, category: true, listing_id: true },
        })
      : [];
    const seedById = new Map(seedListings.map((s) => [s.id, s]));
    const listingIds = Array.from(new Set(seedListings.map((s) => s.listing_id)));
    const listings = listingIds.length
      ? await this.prisma.directory_listings_list.findMany({
          where: { id: { in: listingIds } },
          select: { id: true, secondary_categories: true },
        })
      : [];
    const listingById = new Map(listings.map((l) => [l.id, l]));

    for (const q of queueRows) {
      const prospectCats = new Set<string>();
      const addProspectCat = (c?: string | null) => { if ((c ?? '').trim()) prospectCats.add((c as string).trim()); };

      addProspectCat(pg.category);
      addProspectCat(q.category);
      const snap = (q.business_snapshot ?? {}) as any;
      addProspectCat(snap.identified_category);
      for (const c of Array.isArray(snap.secondary_categories) ? snap.secondary_categories : []) addProspectCat(c);

      for (const cid of [q.processed_campaign_id, q.source_campaign_id]) {
        const mc = cid ? campaignById.get(cid) : undefined;
        if (!mc) continue;
        addProspectCat(mc.category);
        for (const c of mc.secondary_categories ?? []) addProspectCat(c);
      }

      const seed = q.seed_id ? seedById.get(q.seed_id) : undefined;
      if (seed) {
        addProspectCat(seed.category);
        const listing = listingById.get(seed.listing_id);
        for (const c of listing?.secondary_categories ?? []) addProspectCat(c);
      }

      const geoCity = q.city ?? campaignById.get(q.processed_campaign_id ?? '')?.city ?? null;
      const geoState = q.state ?? campaignById.get(q.processed_campaign_id ?? '')?.state ?? null;
      addGeo(geoCity, geoState);
      for (const cat of prospectCats) addMarket(cat, geoCity, geoState);
    }

    const categoryMarkets = Array.from(marketPairs.values());
    const locationGeos = Array.from(domainGeos.values())
      .filter((g) => g.city && g.state) as Array<{ city: string; state: string }>;

    // ── 2. Coverage reads (one batch each) ───────────────────────────────
    const existingRows = await this.prisma.directory_category_enrichment.findMany({
      where: {
        OR: [
          ...categoryMarkets.map((m) => ({ category_key: m.categoryKey, city: m.city, state: m.state })),
          ...locationGeos.map((g) => ({ category_key: LOCATION_SENTINEL_KEY, city: g.city, state: g.state })),
        ],
      },
      select: { category_key: true, city: true, state: true },
    });
    const covered = new Set(
      existingRows.map((r) => marketKey(r.category_key, r.city, r.state)),
    );

    // Active enrichment campaigns — single-market signatures plus any
    // shelf_sweep payload a prior set campaign carries.
    const activeCampaigns = await this.prisma.mkt_campaigns_list.findMany({
      where: { campaign_category: 'directory_enrichment' },
      select: { id: true, scope: true, category: true, city: true, state: true, stage: true, discovery_context: true },
    });
    const campaignCovered = new Set<string>();
    for (const c of activeCampaigns) {
      if (INACTIVE_STAGES.has((c.stage ?? '').toLowerCase())) continue;
      if ((c.scope ?? '').toLowerCase() === 'category') {
        const sm = toSweepMarket(c.category ?? '', c.city ?? '', c.state ?? '');
        if (sm) campaignCovered.add(marketKey(sm.categoryKey, sm.city, sm.state));
      }
      for (const m of sweepMarketsOf(c)) {
        campaignCovered.add(marketKey(m.categoryKey, m.city, m.state));
      }
    }

    // ── 3. Category pass — free deterministic path first ─────────────────
    const outcomes: CategoryMarketOutcome[] = [];
    const needsAi: SweepMarket[] = [];
    for (const m of categoryMarkets) {
      const key = marketKey(m.categoryKey, m.city, m.state);
      if (covered.has(key)) {
        outcomes.push({ ...m, status: 'covered' });
        continue;
      }
      if (campaignCovered.has(key)) {
        outcomes.push({ ...m, status: 'campaign_exists' });
        continue;
      }
      try {
        const result = await CategoryMarketEnrichmentService.getInstance().enrichMarket(
          m.category, m.city, m.state,
          { triggerSource: 'pg_sweep', enrichedBy: opts.enrichedBy ?? undefined },
          ctx,
        );
        if (result.skipReasons?.no_active_profile) {
          outcomes.push({ ...m, status: 'needs_ai' });
          needsAi.push(m);
        } else if (result.skipReasons?.invalid_market) {
          outcomes.push({ ...m, status: 'skipped', detail: 'invalid_market' });
        } else {
          outcomes.push({ ...m, status: 'enriched', listingsEnriched: result.listingsEnriched });
          covered.add(key);
        }
      } catch (err) {
        outcomes.push({ ...m, status: 'error', detail: (err as Error).message });
      }
    }

    // ── 4. Location pass — fill cities the category pass didn't produce ──
    const locationOutcomes: LocationMarketOutcome[] = [];
    for (const g of locationGeos) {
      const key = marketKey(LOCATION_SENTINEL_KEY, g.city, g.state);
      if (covered.has(key)) {
        locationOutcomes.push({ city: g.city, state: g.state, status: 'covered' });
        continue;
      }
      try {
        const result = await LocationMarketEnrichmentService.enrichLocation(
          g.city, g.state,
          { triggerSource: 'pg_sweep', enrichedBy: opts.enrichedBy ?? null },
          ctx,
        );
        if (result) {
          locationOutcomes.push({ city: g.city, state: g.state, status: 'enriched' });
        } else {
          locationOutcomes.push({ city: g.city, state: g.state, status: 'skipped', detail: 'invalid_market' });
        }
      } catch (err) {
        locationOutcomes.push({ city: g.city, state: g.state, status: 'error', detail: (err as Error).message });
      }
    }

    // ── 4b. National location row — refresh every sweep ──────────────────
    // Derived state over all covered markets: the sentinel routes to
    // enrichNational, which recomputes the coverage fact layer and merges it
    // into context without reverting campaign-applied copy. Runs even when
    // the row already exists — this is a refresh, not a first-fill.
    let nationalLocation: ShelfSweepReport['nationalLocation'] = null;
    try {
      const national = await LocationMarketEnrichmentService.enrichLocation(
        '__all__', '__all__',
        { triggerSource: 'pg_sweep', enrichedBy: opts.enrichedBy ?? null },
        ctx,
      );
      nationalLocation = {
        city: '__all__',
        state: '__all__',
        status: national ? 'enriched' : 'skipped',
        detail: national ? 'coverage refresh' : 'no row written',
      };
    } catch (err) {
      nationalLocation = {
        city: '__all__',
        state: '__all__',
        status: 'error',
        detail: (err as Error).message,
      };
    }

    // ── 5. Residual set → one directory_enrichment child campaign ────────
    // The anchor signature is needsAi[0]'s market — those markets have no
    // covering active campaign by construction, so the structural-duplicate
    // guardrail can only collide with a prior SET campaign anchored on the
    // same market, which we then merge into.
    let sweepCampaign: ShelfSweepReport['sweepCampaign'] = null;
    if (needsAi.length > 0 && opts.createCampaign !== false) {
      const anchor = needsAi[0];
      const payload = {
        shelf_sweep: {
          proving_ground_id: provingGroundId,
          swept_at: new Date().toISOString(),
          markets: needsAi.map((m) => ({ category: m.category, city: m.city, state: m.state })),
        },
      };
      try {
        const created = await MarketingCampaignService.getInstance().createCampaign({
          scope: 'category',
          campaignCategory: 'directory_enrichment',
          category: anchor.category,
          city: anchor.city,
          state: anchor.state,
          title: `Category Set Enrichment — ${needsAi.length} markets — ${pg.title || pg.category || 'PG'}`,
          parentCampaignId: provingGroundId,
          discoveryContext: payload as any,
        }, ctx);
        sweepCampaign = { id: created.id, created: true, marketCount: needsAi.length };
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        // A live set campaign under this PG already holds the anchor —
        // merge the residual markets into its shelf_sweep payload.
        const children = await this.prisma.mkt_campaigns_list.findMany({
          where: {
            parent_campaign_id: provingGroundId,
            campaign_category: 'directory_enrichment',
          },
          select: { id: true, stage: true, discovery_context: true },
        });
        const existingSet = children.find(
          (c) => !INACTIVE_STAGES.has((c.stage ?? '').toLowerCase()) && sweepMarketsOf(c).length > 0,
        );
        if (!existingSet) throw err;
        const existing = sweepMarketsOf(existingSet);
        const existingKeys = new Set(existing.map((m) => marketKey(m.categoryKey, m.city, m.state)));
        const fresh = needsAi.filter((m) => !existingKeys.has(marketKey(m.categoryKey, m.city, m.state)));
        if (fresh.length > 0) {
          const dc = (existingSet.discovery_context ?? {}) as any;
          await this.prisma.mkt_campaigns_list.update({
            where: { id: existingSet.id },
            data: {
              discovery_context: {
                ...dc,
                shelf_sweep: {
                  ...(dc.shelf_sweep ?? {}),
                  proving_ground_id: provingGroundId,
                  swept_at: new Date().toISOString(),
                  markets: [
                    ...existing.map((m) => ({ category: m.category, city: m.city, state: m.state })),
                    ...fresh.map((m) => ({ category: m.category, city: m.city, state: m.state })),
                  ],
                },
              } as any,
              updated_at: new Date(),
            },
          });
        }
        sweepCampaign = { id: existingSet.id, created: false, marketCount: existing.length + fresh.length, mergedMarkets: fresh.length };
      }
    }

    logger.info('ProvingGroundShelfSweepService.sweep', ctx, {
      provingGroundId,
      markets: categoryMarkets.length,
      enriched: outcomes.filter((o) => o.status === 'enriched').length,
      covered: outcomes.filter((o) => o.status === 'covered').length,
      needsAi: needsAi.length,
      locationsEnriched: locationOutcomes.filter((o) => o.status === 'enriched').length,
      nationalLocationStatus: nationalLocation?.status ?? null,
      sweepCampaignId: sweepCampaign?.id ?? null,
    });

    return {
      provingGroundId,
      domain: {
        categories: Array.from(domainCategories.values()),
        geos: Array.from(domainGeos.values()),
      },
      categoryMarkets: outcomes,
      locationMarkets: locationOutcomes,
      nationalLocation,
      needsAi,
      sweepCampaign,
    };
  }
}

export default ProvingGroundShelfSweepService.getInstance();
