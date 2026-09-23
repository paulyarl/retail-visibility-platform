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
 *   covered          — a directory_category_enrichment row exists AND was
 *                      applied by a campaign run (composer_version >= 2):
 *                      the market already carries the AI packet
 *   baseline         — a row exists but is deterministic-only
 *                      (composer_version < 2). The row is left untouched
 *                      (the sweep NEVER overwrites rows itself) and the
 *                      market is queued into the sweep campaign so the SET
 *                      prompt upgrades it to the AI packet
 *   campaign_exists  — an active directory_enrichment campaign (single-market
 *                      signature or a prior set's shelf_sweep payload) covers it
 *   enriched         — enrichMarket() wrote a deterministic baseline
 *                      (profile exists — the free path); also queued into the
 *                      set campaign for the AI upgrade
 *   needs_ai         — no row, no campaign, no profile → routed into one
 *                      spawned directory_enrichment child campaign carrying
 *                      the set in discovery_context.shelf_sweep
 *   skipped / error  — invalid market or enrich failure (partial success)
 *
 * The spawned SET campaign carries every market not already AI-enriched or
 * covered by a live campaign — baseline + enriched + needs_ai — so one
 * category_set_enrichment execution enriches the PG's whole category set.
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

// composer_version=2 marks rows written by a directory_enrichment campaign
// run (applyEnrichmentPacket's CAMPAIGN_COMPOSER_VERSION in
// CategoryMarketEnrichmentService). Rows below it are deterministic
// baselines — real coverage, but still queued into the SET campaign.
const AI_COMPOSER_VERSION = 2;

export interface SweepMarket {
  category: string;
  categoryKey: string;
  city: string;
  state: string;
}

export interface CategoryMarketOutcome extends SweepMarket {
  status: 'covered' | 'baseline' | 'campaign_exists' | 'enriched' | 'needs_ai' | 'skipped' | 'error';
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
    /** True when the domain was already fully claimed and this campaign
     *  absorbed the other claimants' markets (anchor consolidation). */
    consolidated?: boolean;
    /** True when nothing changed — an existing campaign already carries
     *  the domain; surfaced so the UI can link it. */
    existing?: boolean;
    /** True when the surviving campaign's signature moved to the
     *  preferred anchor (sweep-child migration). */
    migrated?: boolean;
    closedCampaignIds?: string[];
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
    opts: { createCampaign?: boolean; enrichedBy?: string | null; queueEntryIds?: string[] } = {},
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
    // Queue linkage mirrors the cockpit list / stage-distribution union
    // (migrations 262 + 282): direct proving_ground_id membership OR'd with
    // source_campaign_id pointing at the PG or one of its direct children —
    // intelligence-lane entries are never stamped proving_ground_id, so
    // filtering on that column alone misses the whole tree's queue.
    const treeChildren = await this.prisma.mkt_campaigns_list.findMany({
      where: { parent_campaign_id: provingGroundId },
      select: { id: true },
    });
    const treeIds = [provingGroundId, ...treeChildren.map((c) => c.id)];

    const queueRows = await this.prisma.mkt_prospect_queue.findMany({
      where: {
        OR: [
          { proving_ground_id: provingGroundId },
          { source_campaign_id: { in: treeIds } },
        ],
        // Dismissed prospects were operator-rejected — their categories and
        // geos must not widen the sweep domain.
        status: { not: 'dismissed' },
        // Selective sweep: intersect the selection with the tree linkage —
        // ids outside the tree simply match nothing.
        ...(opts.queueEntryIds?.length ? { id: { in: opts.queueEntryIds } } : {}),
      },
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

    // Prospect geo frequency — mixed-market PGs (no declared city/state)
    // anchor their sweep campaign on the dominant prospect geo.
    const geoCounts = new Map<string, { city: string; state: string | null; count: number }>();

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
      const normGeoCity = normalizeReferenceCity(geoCity);
      if (normGeoCity) {
        const gk = `${normGeoCity.toLowerCase()}|${(normalizeReferenceState(geoState) ?? '').toLowerCase()}`;
        const entry = geoCounts.get(gk) ?? { city: normGeoCity, state: normalizeReferenceState(geoState), count: 0 };
        entry.count += 1;
        geoCounts.set(gk, entry);
      }
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
      select: { category_key: true, city: true, state: true, composer_version: true },
    });
    // marketKey → composer_version. Rows at AI_COMPOSER_VERSION were applied
    // by a campaign run and count as fully covered; anything lower is a
    // deterministic baseline that still goes into the set campaign.
    const covered = new Map(
      existingRows.map((r) => [marketKey(r.category_key, r.city, r.state), r.composer_version ?? 1]),
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
      const existingVersion = covered.get(key);
      if (existingVersion !== undefined && existingVersion >= AI_COMPOSER_VERSION) {
        outcomes.push({ ...m, status: 'covered' });
        continue;
      }
      if (campaignCovered.has(key)) {
        outcomes.push({ ...m, status: 'campaign_exists' });
        continue;
      }
      if (existingVersion !== undefined) {
        // Deterministic baseline row — leave it in place and queue the
        // market for the SET campaign's AI packet.
        outcomes.push({ ...m, status: 'baseline' });
        needsAi.push(m);
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
          covered.set(key, 1);
          needsAi.push(m);
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

    // ── 5. Set payload → one directory_enrichment child campaign ────────
    // Anchor = the PG's own signature: pg.category × the PG's declared
    // market; mixed-market PGs (no declared city/state) adopt the dominant
    // prospect geo. If the anchor market is already claimed by an active
    // child of this PG, the payload folds INTO that child — it becomes the
    // set campaign and its own market joins the set for the AI packet.
    // Conflicts with campaigns outside the PG tree fall through to the next
    // anchor candidate (payload markets carrying the PG category, then the
    // home-geo payload market, then the first). When the whole domain is
    // already claimed by PG children, a consolidation pass still runs: the
    // child claiming the preferred anchor absorbs every claimant's markets
    // and the superseded campaigns close — one SET campaign per PG.
    const keyOf = (m: SweepMarket) => marketKey(m.categoryKey, m.city, m.state);
    const pgCategoryKey = normalizeCategoryKey(pg.category ?? '');
    let anchorGeoCity = normalizeReferenceCity(pg.city);
    let anchorGeoState = normalizeReferenceState(pg.state);
    if (!anchorGeoCity || !anchorGeoState) {
      const top = [...geoCounts.values()].sort((a, b) => b.count - a.count)[0];
      if (top) { anchorGeoCity = top.city; anchorGeoState = top.state; }
    }
    const anchorCity = anchorGeoCity;
    const anchorState = anchorGeoState;
    const anchorMarket: SweepMarket | null =
      pgCategoryKey && anchorCity && anchorState
        ? { category: (pg.category ?? '').trim(), categoryKey: pgCategoryKey, city: anchorCity, state: anchorState }
        : null;
    const inAnchorGeo = (m: SweepMarket) =>
      !!anchorCity && !!anchorState
      && m.city.toLowerCase() === anchorCity.toLowerCase()
      && m.state.toLowerCase() === anchorState.toLowerCase();

    // Active PG-child enrichment campaigns and the markets each claims —
    // its scope='category' signature plus any shelf_sweep payload markets.
    const pgChildren = await this.prisma.mkt_campaigns_list.findMany({
      where: {
        parent_campaign_id: provingGroundId,
        campaign_category: 'directory_enrichment',
      },
      select: { id: true, stage: true, scope: true, category: true, city: true, state: true, discovery_context: true },
    });
    const activeChildren = pgChildren.filter((c) => !INACTIVE_STAGES.has((c.stage ?? '').toLowerCase()));
    const claimedOf = (c: (typeof activeChildren)[number]): SweepMarket[] => {
      const out: SweepMarket[] = [];
      if ((c.scope ?? '').toLowerCase() === 'category') {
        const sm = toSweepMarket(c.category ?? '', c.city ?? '', c.state ?? '');
        if (sm) out.push(sm);
      }
      out.push(...sweepMarketsOf(c));
      return out;
    };
    const domainKeys = new Set(categoryMarkets.map(keyOf));
    // Children that claim at least one swept-domain market — the set that
    // gets folded into the winning campaign. Unrelated children are left
    // alone.
    const claimants = activeChildren.filter((c) => claimedOf(c).some((m) => domainKeys.has(keyOf(m))));
    // A sweep-created child carries discovery_context.shelf_sweep — the PG
    // spawned it for this purpose, so it is the preferred survivor: the
    // sweep "migrates" its signature to the correct anchor rather than
    // folding it away into an older campaign.
    const isSweepChild = (c: (typeof activeChildren)[number]) =>
      !!(c.discovery_context as any)?.shelf_sweep;
    const signatureKey = (c: (typeof activeChildren)[number]): string | null => {
      if ((c.scope ?? '').toLowerCase() !== 'category') return null;
      const sm = toSweepMarket(c.category ?? '', c.city ?? '', c.state ?? '');
      return sm ? keyOf(sm) : null;
    };
    // True when a campaign OUTSIDE the fold set claims this market key —
    // migrating a signature onto it would mint a live duplicate.
    const claimedByOutsider = (key: string, keepIds: Set<string>) =>
      activeCampaigns.some((c) => {
        if (INACTIVE_STAGES.has((c.stage ?? '').toLowerCase())) return false;
        if (keepIds.has(c.id)) return false;
        if ((c.scope ?? '').toLowerCase() === 'category') {
          const sm = toSweepMarket(c.category ?? '', c.city ?? '', c.state ?? '');
          if (sm && keyOf(sm) === key) return true;
        }
        return sweepMarketsOf(c).some((m) => keyOf(m) === key);
      });

    const dedupe = (markets: SweepMarket[]): SweepMarket[] => {
      const seen = new Set<string>();
      return markets.filter((m) => {
        const k = keyOf(m);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };

    // Fold every claimant's claimed markets (plus extras) into the target
    // campaign's shelf_sweep payload and close the superseded children.
    // When `migrate` is set the target's signature moves to that market —
    // the sweep child keeps its identity but takes the correct anchor.
    // Returns the union actually carried by the target.
    const foldInto = async (
      target: (typeof activeChildren)[number],
      extras: SweepMarket[],
      migrate?: SweepMarket | null,
    ) => {
      const others = claimants.filter((c) => c.id !== target.id);
      const union = dedupe([
        ...claimedOf(target),
        ...(migrate ? [migrate] : []),
        ...extras,
        ...others.flatMap(claimedOf),
      ]);
      const dc = (target.discovery_context ?? {}) as any;
      await this.prisma.mkt_campaigns_list.update({
        where: { id: target.id },
        data: {
          ...(migrate
            ? { category: migrate.category, city: migrate.city, state: migrate.state }
            : {}),
          discovery_context: {
            ...dc,
            shelf_sweep: {
              ...(dc.shelf_sweep ?? {}),
              proving_ground_id: provingGroundId,
              swept_at: new Date().toISOString(),
              markets: union.map((m) => ({ category: m.category, city: m.city, state: m.state })),
            },
          } as any,
          updated_at: new Date(),
        },
      });
      for (const o of others) {
        const odc = (o.discovery_context ?? {}) as any;
        await this.prisma.mkt_campaigns_list.update({
          where: { id: o.id },
          data: {
            stage: 'closed',
            discovery_context: {
              ...odc,
              shelf_sweep: {
                ...(odc.shelf_sweep ?? {}),
                superseded_by: target.id,
              },
            } as any,
            updated_at: new Date(),
          },
        });
      }
      return union;
    };

    let sweepCampaign: ShelfSweepReport['sweepCampaign'] = null;
    if (needsAi.length > 0 && opts.createCampaign !== false) {
      const candidates: SweepMarket[] = [];
      if (anchorMarket) candidates.push(anchorMarket);
      candidates.push(...needsAi.filter((m) => m.categoryKey === pgCategoryKey));
      candidates.push(...needsAi.filter(inAnchorGeo));
      candidates.push(needsAi[0]);
      const seenKeys = new Set<string>();
      const ordered = candidates.filter((c) => {
        const k = keyOf(c);
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      });

      let lastErr: unknown = null;
      for (const anchor of ordered) {
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
          // A claimant holding other domain markets folds into the new set
          // campaign — one SET campaign per PG.
          const others = claimants.filter((c) => c.id !== created.id);
          if (others.length > 0) {
            const union = await foldInto(created as any, needsAi);
            sweepCampaign = { id: created.id, created: true, marketCount: union.length, mergedMarkets: union.length - needsAi.length };
          } else {
            sweepCampaign = { id: created.id, created: true, marketCount: needsAi.length };
          }
          break;
        } catch (err) {
          if (!(err instanceof ConflictError)) throw err;
          lastErr = err;
          // Merge targets under this PG — the sweep's own child survives:
          // it gets migrated onto the anchor and absorbs the rest. Else the
          // child claiming this anchor's market, else any claimant.
          const anchorKey = keyOf(anchor);
          const anchorChild = claimants.find((c) => claimedOf(c).some((m) => keyOf(m) === anchorKey));
          const sweepChild = claimants.find(isSweepChild);
          const target = sweepChild ?? anchorChild ?? claimants[0];
          if (!target) continue; // conflict came from outside the tree — try the next anchor

          const others = claimants.filter((c) => c.id !== target.id);
          const keepIds = new Set([target.id, ...others.map((o) => o.id)]);
          // Migrate the target's signature onto this anchor when nothing
          // outside the fold claims it (the in-fold claimant is closing).
          const migrate =
            signatureKey(target) !== anchorKey && !claimedByOutsider(anchorKey, keepIds)
              ? anchor
              : null;
          const baseCount = dedupe(claimedOf(target)).length;
          const union = await foldInto(target, needsAi, migrate);
          sweepCampaign = {
            id: target.id,
            created: false,
            marketCount: union.length,
            mergedMarkets: union.length - baseCount,
            ...(migrate ? { migrated: true } : {}),
            ...(others.length ? { closedCampaignIds: others.map((o) => o.id) } : {}),
          };
          break;
        }
      }
      if (!sweepCampaign && lastErr) throw lastErr;
    } else if (needsAi.length === 0 && opts.createCampaign !== false && claimants.length > 0) {
      // ── Consolidation: every swept market is already claimed by a PG
      // child. The sweep's own child is the preferred survivor — the PG
      // spawned it for this, so it migrates onto the preferred anchor
      // (pg.category × PG market / dominant prospect geo) and absorbs the
      // other claimants' markets; they close as superseded. Without a
      // sweep child the anchor claimant absorbs instead. Nothing to fold
      // → just link the existing carrier.
      const anchorKey = anchorMarket ? keyOf(anchorMarket) : null;
      const anchorChild = anchorKey
        ? claimants.find((c) => claimedOf(c).some((m) => keyOf(m) === anchorKey))
        : undefined;
      const target = claimants.find(isSweepChild) ?? anchorChild ?? claimants[0];
      const others = claimants.filter((c) => c.id !== target.id);
      const keepIds = new Set([target.id, ...others.map((o) => o.id)]);
      // Re-anchor only when the anchor market is either unclaimed or
      // claimed by an in-fold child (which is closing) — never duplicate
      // a signature an outside campaign holds.
      const migrate =
        anchorMarket && signatureKey(target) !== anchorKey && !claimedByOutsider(anchorKey!, keepIds)
          ? anchorMarket
          : null;
      if (others.length > 0 || migrate) {
        const baseCount = dedupe(claimedOf(target)).length;
        const union = await foldInto(target, [], migrate);
        sweepCampaign = {
          id: target.id,
          created: false,
          marketCount: union.length,
          mergedMarkets: union.length - baseCount,
          consolidated: true,
          ...(migrate ? { migrated: true } : {}),
          ...(others.length ? { closedCampaignIds: others.map((o) => o.id) } : {}),
        };
      } else {
        // Correctly anchored, sole claimant — nothing to consolidate.
        sweepCampaign = { id: target.id, created: false, marketCount: claimedOf(target).length, existing: true };
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
        // Declared ∪ discovered — derive from the market set so prospect
        // secondary categories (which never feed domainCategories) still
        // show up in the report.
        categories: Array.from(new Set(categoryMarkets.map((m) => m.category))),
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
