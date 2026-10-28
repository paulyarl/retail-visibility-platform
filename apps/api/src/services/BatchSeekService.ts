/**
 * BatchSeekService — coordinates multi-city seek operations.
 *
 * A seek batch creates N campaigns (one per city) with a shared batch_id.
 * Each campaign gets its own intelligence run. Prospect queue entries are
 * tagged with the batch_id for filtering.
 *
 * The batch is a coordination layer — it doesn't change how individual
 * seeks work. It creates N campaigns, N runs, and queues results with a
 * shared batch identifier.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { ValidationError } from '../middleware/errorHandler';
import { generateSeekBatchId, generateSeekBatchSlug, generateSeekBatchEntryId } from '../lib/id-generator';

interface BatchAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export interface BatchEntryInput {
  profileId: string;
  profileVersion?: number;
  nicheCategory: string;
  city: string;
  state?: string;
  intelligenceFocus?: string;
}

export interface BatchEntry {
  id: string;
  batchId: string;
  profileId: string;
  profileVersion: number | null;
  nicheCategory: string;
  city: string;
  state: string | null;
  intelligenceFocus: string;
  sortOrder: number;
}

export interface CreateBatchInput {
  profileId: string;
  profileVersion?: number;
  nicheCategory: string;
  intelligenceFocus?: string;
  cities: string[];
  state?: string;
  /** Queue-based entries: one tightly-coupled (profile, city, category, focus) tuple per entry.
   *  When provided, entries are the source of truth at launch time — one campaign per entry,
   *  each using its own profile/category/focus. Eliminates profile spillover. */
  entries?: BatchEntryInput[];
}

export interface BatchSummary {
  id: string;
  batchSlug: string;
  profileId: string;
  profileVersion: number | null;
  nicheCategory: string;
  intelligenceFocus: string;
  cities: string[];
  campaignIds: string[];
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  /** Distinct entry categories — the honest set for mixed-category batches
   *  (summary nicheCategory may read "X +N more"). Fallback: [nicheCategory]. */
  categories?: string[];
  /** Distinct entry focuses — a batch may sweep both lenses. Fallback:
   *  [intelligenceFocus]. */
  focuses?: string[];
  /** Campaign descriptors (detail reads) — attributes plus seek_batch_id so
   *  an adopted campaign still shows which batch actually owns its yield. */
  campaigns?: Array<{
    id: string;
    displayId: string | null;
    category: string | null;
    city: string | null;
    state: string | null;
    intelligenceFocus: string | null;
    campaignKind: string | null;
    stage: string | null;
    campaignCategory: string | null;
    seekBatchId: string | null;
  }>;
  entries?: BatchEntry[];
}

export interface BatchMetrics {
  totalProspects: number;
  totalSeeds: number;
  publishedSeeds: number;
  invitedSeeds: number;
  claimedSeeds: number;
}

class BatchSeekService {
  /**
   * Create a seek batch record (does not launch yet).
   *
   * When `input.entries` is provided (queue-based flow), each entry tightly
   * couples a (profile, city, category, focus) tuple. The parent batch row
   * stores a summary (first entry's profile/category/focus, all entry cities)
   * for backward-compatible list views, but the entries table is the source
   * of truth at launch time.
   */
  async createBatch(
    input: CreateBatchInput,
    ctx?: BatchAuditCtx,
  ): Promise<BatchSummary> {
    const id = generateSeekBatchId();

    // Derive summary fields from entries when available, otherwise use legacy fields
    const hasEntries = input.entries && input.entries.length > 0;
    const entries = hasEntries ? input.entries! : [];

    // Validate every referenced profile before writing anything. A seek batch
    // launches prospect-emitting discovery scans, so each profile must be an
    // active driver ('emerging' | 'competitive') tightly coupled to the entry's
    // category and scope — the same coupling the launcher UI enforces.
    // gold_standards / bronze_standards profiles are calibration artifacts
    // injected into scans at render time; letting one occupy the driver slot
    // would mint campaigns whose scans emit benchmark evaluations instead of
    // prospects — a quiet zero-yield failure.
    const refs: Array<BatchEntryInput & { resolvedFocus?: string }> = hasEntries
      ? entries.map((e) => ({ ...e }))
      : (input.cities || []).map((city) => ({
          profileId: input.profileId,
          profileVersion: input.profileVersion,
          nicheCategory: input.nicheCategory,
          city,
          state: input.state,
          intelligenceFocus: input.intelligenceFocus,
        }));

    // Entries dedup on (category, city, state, declared focus) — the market
    // is swept once per lens; the same market may legitimately queue both an
    // emerging and a competitive scan (different candidate classes, each
    // with its own campaign per the structural-duplicate signature).
    // Declared focus is validated against the profile below, so a missing
    // focus falls back to 'emerging' consistently for the key.
    const seenMarkets = new Set<string>();
    for (const ref of refs) {
      const marketKey = [
        ref.nicheCategory, ref.city, ref.state, ref.intelligenceFocus || 'emerging',
      ].map((p) => (p || '').trim().toLowerCase()).join('|');
      if (seenMarkets.has(marketKey)) {
        throw new ValidationError(`duplicate batch entry for '${ref.nicheCategory}' in '${ref.city || ref.state || 'nationwide'}' (${ref.intelligenceFocus || 'emerging'}) — same market + same lens already queued`);
      }
      seenMarkets.add(marketKey);
    }

    const profileIds = Array.from(new Set(refs.map((r) => r.profileId).filter(Boolean)));
    const profileRows = profileIds.length
      ? await prisma.mkt_intelligence_profiles.findMany({
          where: { id: { in: profileIds }, status: 'active' },
        })
      : [];
    const versionsById = new Map<string, typeof profileRows>();
    for (const row of profileRows) {
      const list = versionsById.get(row.id) || [];
      list.push(row);
      versionsById.set(row.id, list);
    }

    for (const ref of refs) {
      const versions = (versionsById.get(ref.profileId) || []).sort((a, b) => b.version - a.version);
      const profile = ref.profileVersion
        ? versions.find((v) => v.version === ref.profileVersion)
        : versions[0];
      if (!profile) {
        throw new ValidationError(`seek batch entry references unknown or inactive profile '${ref.profileId}'`);
      }
      const focus = profile.intelligence_focus;
      if (focus !== 'emerging' && focus !== 'competitive') {
        throw new ValidationError(`profile '${ref.profileId}' has intelligence_focus '${focus}' — only 'emerging'/'competitive' profiles can drive a seek batch (gold/bronze standards are scan calibration, not drivers)`);
      }
      if (ref.intelligenceFocus && ref.intelligenceFocus !== focus) {
        throw new ValidationError(`entry declares intelligenceFocus '${ref.intelligenceFocus}' but profile '${ref.profileId}' is '${focus}'`);
      }
      if (profile.category_name !== ref.nicheCategory && profile.category_key !== ref.nicheCategory) {
        throw new ValidationError(`profile '${ref.profileId}' is for category '${profile.category_name}' — entry declares '${ref.nicheCategory}'`);
      }
      // Scope coupling — mirrors the launcher rules: a city-scoped profile only
      // drives its own city; a state-scoped profile can't drive another state's
      // scope; a nationwide entry requires a nationwide profile.
      const entryCity = (ref.city || '').toLowerCase();
      const profileCity = (profile.reference_city || '').toLowerCase();
      if (profileCity) {
        if (entryCity !== profileCity) {
          throw new ValidationError(`city-scoped profile '${ref.profileId}' (${profile.reference_city}) cannot drive entry '${ref.city || ref.state || 'nationwide'}'`);
        }
      } else if (!entryCity) {
        if (profile.reference_state && profile.reference_state !== ref.state) {
          throw new ValidationError(`state-scoped profile '${ref.profileId}' (${profile.reference_state}) cannot drive entry '${ref.state || 'nationwide'}'`);
        }
      } else if (ref.state && profile.reference_state && profile.reference_state !== ref.state) {
        throw new ValidationError(`state-scoped profile '${ref.profileId}' (${profile.reference_state}) cannot drive city entry '${ref.city}' in ${ref.state}`);
      }
      ref.resolvedFocus = focus;
    }

    const summaryProfileId = hasEntries ? entries[0].profileId : input.profileId;
    const summaryProfileVersion = hasEntries
      ? (entries[0].profileVersion || null)
      : (input.profileVersion || null);
    // Mixed-category batches: the summary niche reads "First Category +N more"
    // and the slug drops the niche name entirely — a batch that sweeps two
    // niches shouldn't label itself with only one of them.
    const distinctCategories = hasEntries
      ? Array.from(new Set(entries.map((e) => e.nicheCategory)))
      : [input.nicheCategory];
    const summaryCategory = distinctCategories.length > 1
      ? `${distinctCategories[0]} +${distinctCategories.length - 1} more`
      : distinctCategories[0];
    const summaryFocus = refs[0]?.resolvedFocus || input.intelligenceFocus || 'emerging';
    const summaryCities = hasEntries
      ? Array.from(new Set(entries.map((e) => e.city)))
      : input.cities;

    const batchSlug = generateSeekBatchSlug(distinctCategories[0], summaryCities.length, distinctCategories.length);

    // Summary state: prefer the first entry's state, else the batch-level state.
    const summaryState = hasEntries ? (entries[0].state || null) : (input.state || null);

    await prisma.$executeRaw`
      INSERT INTO mkt_seek_batches (
        id, batch_slug, profile_id, profile_version, niche_category, intelligence_focus,
        cities, campaign_ids, status, state, created_by, created_at
      ) VALUES (
        ${id},
        ${batchSlug},
        ${summaryProfileId},
        ${summaryProfileVersion},
        ${summaryCategory},
        ${summaryFocus},
        ${summaryCities}::text[],
        ${'{}'}::text[],
        'draft',
        ${summaryState},
        ${ctx?.actorId || null},
        now()
      )
    `;

    // Insert per-entry rows when entries are provided (queue-based flow)
    const entryRows: BatchEntry[] = [];
    if (hasEntries) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const entryId = generateSeekBatchEntryId();
        const entryFocus = refs[i].resolvedFocus || 'emerging';
        await prisma.$executeRaw`
          INSERT INTO mkt_seek_batch_entries (
            id, batch_id, profile_id, profile_version, niche_category,
            city, state, intelligence_focus, sort_order, created_at
          ) VALUES (
            ${entryId},
            ${id},
            ${e.profileId},
            ${e.profileVersion || null},
            ${e.nicheCategory},
            ${e.city},
            ${e.state || null},
            ${entryFocus},
            ${i},
            now()
          )
        `;
        entryRows.push({
          id: entryId,
          batchId: id,
          profileId: e.profileId,
          profileVersion: e.profileVersion || null,
          nicheCategory: e.nicheCategory,
          city: e.city,
          state: e.state || null,
          intelligenceFocus: entryFocus,
          sortOrder: i,
        });
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'seek_batch.create',
      payload: { batchId: id, batchSlug, nicheCategory: summaryCategory, intelligenceFocus: summaryFocus, cities: summaryCities, entryCount: entries.length },
    });

    logger.info('BatchSeekService.createBatch', undefined, { id, batchSlug, cities: summaryCities, entryCount: entries.length });

    return {
      id,
      batchSlug,
      profileId: summaryProfileId,
      profileVersion: summaryProfileVersion,
      nicheCategory: summaryCategory,
      intelligenceFocus: summaryFocus,
      cities: summaryCities,
      campaignIds: [],
      status: 'draft',
      createdAt: new Date(),
      completedAt: null,
      entries: entryRows.length > 0 ? entryRows : undefined,
    };
  }

  /**
   * Launch a seek batch: creates one campaign per entry (or per city for
   * legacy batches without entries) and tags them with the batch_id.
   *
   * When the batch has `mkt_seek_batch_entries`, each entry drives its own
   * campaign using the entry's tightly-coupled profile/category/focus/city —
   * no spillover. Legacy batches fall back to one campaign per city using
   * the batch-level profile/category/focus.
   */
  async launchBatch(
    batchId: string,
    ctx?: BatchAuditCtx,
  ): Promise<{ success: boolean; error?: string; campaignIds?: string[] }> {
    const batchRows = await prisma.$queryRaw<any[]>`
      SELECT id, profile_id, profile_version, niche_category, intelligence_focus, cities, state, status
      FROM mkt_seek_batches WHERE id = ${batchId} LIMIT 1
    `;
    if (!batchRows[0]) {
      return { success: false, error: 'batch_not_found' };
    }

    const batch = batchRows[0];
    if (batch.status === 'running' || batch.status === 'completed') {
      return { success: false, error: 'batch_already_launched' };
    }

    // Load entries if they exist (queue-based flow)
    const entryRows = await prisma.$queryRaw<any[]>`
      SELECT id, profile_id, profile_version, niche_category, city, state, intelligence_focus, sort_order
      FROM mkt_seek_batch_entries
      WHERE batch_id = ${batchId}
      ORDER BY sort_order ASC
    `;

    const campaignIds: string[] = [];

    // Route through MarketingCampaignService.createCampaign so batch-launched
    // campaigns get the structural-duplicate guardrail, stage-transition log,
    // and the discovery-profile prerequisite — same as every other campaign.
    const { default: campaignService } = await import('./MarketingCampaignService.js');
    const requestCtx = {
      region: 'us-east-1',
      userId: ctx?.actorId,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    };

    // Reuse a campaign this batch already created for the same
    // (category, city, focus) — makes relaunch idempotent instead of
    // minting duplicates. Focus is part of the key: the same market may
    // carry both an emerging and a competitive scan as separate campaigns.
    const reuseExisting = async (category: string, city: string, focus: string): Promise<string | null> => {
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM mkt_campaigns_list
        WHERE seek_batch_id = ${batchId}
          AND LOWER(category) = LOWER(${category})
          AND LOWER(city) = LOWER(${city})
          AND LOWER(COALESCE(intelligence_focus, 'emerging')) = LOWER(${focus})
        LIMIT 1
      `;
      return existing[0]?.id || null;
    };

    const launchEntry = async (category: string, city: string, state: string | null, focus: string) => {
      const reused = await reuseExisting(category, city, focus);
      if (reused) {
        campaignIds.push(reused);
        return;
      }
      try {
        const campaign = await campaignService.createCampaign({
          scope: 'intelligence',
          category,
          city,
          state: state || undefined,
          intelligenceFocus: focus as 'emerging' | 'competitive',
          intelligenceCampaignKind: 'discovery',
          seekBatchId: batchId,
        }, requestCtx);
        campaignIds.push(campaign.id);
      } catch (err) {
        // Structural-duplicate conflict: adopt the existing campaign rather
        // than failing the entry (carries existingCampaignId — Migration 271).
        const existingId = (err as any)?.existingCampaignId;
        if (existingId) {
          // Backfill the batch tag so the adopted campaign's scan output
          // propagates seek_batch_id onto its prospects — otherwise the batch
          // counts campaign_ids (completion works) but never sees the yield
          // (prospect/seed metrics key on seek_batch_id). IS NULL guard: a
          // campaign already claimed by another batch keeps its attribution —
          // queue rows can only carry one batch id, first claim wins.
          await prisma.$executeRaw`
            UPDATE mkt_campaigns_list
            SET seek_batch_id = ${batchId}
            WHERE id = ${existingId} AND seek_batch_id IS NULL
          `;
          campaignIds.push(existingId);
          return;
        }
        logger.error('BatchSeekService.launchBatch — campaign creation failed', undefined, {
          batchId, city, category, error: (err as Error).message,
        });
        // Continue with other entries — partial failure is OK
      }
    };

    if (entryRows.length > 0) {
      // Queue-based launch: one campaign per entry, each using its own profile/category/focus
      for (const entry of entryRows) {
        await launchEntry(entry.niche_category, entry.city, entry.state, entry.intelligence_focus || 'emerging');
      }
    } else {
      // Legacy launch: one campaign per city using batch-level profile/category/focus
      const cities: string[] = batch.cities;
      for (const city of cities) {
        await launchEntry(batch.niche_category, city, batch.state, batch.intelligence_focus || 'emerging');
      }
    }

    // Update batch with campaign IDs and set status to running
    await prisma.$executeRaw`
      UPDATE mkt_seek_batches
      SET campaign_ids = ${campaignIds}::text[], status = 'running', updated_at = now()
      WHERE id = ${batchId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'seek_batch.launch',
      payload: { batchId, campaignIds, campaignCount: campaignIds.length },
    });

    logger.info('BatchSeekService.launchBatch', undefined, { batchId, campaignIds });

    return { success: true, campaignIds };
  }

  /**
   * Mark a batch as completed (called when all campaigns have finished
   * their intelligence runs).
   */
  async completeBatch(batchId: string, ctx?: BatchAuditCtx): Promise<{ success: boolean; error?: string }> {
    const batchRows = await prisma.$queryRaw<any[]>`
      SELECT id FROM mkt_seek_batches WHERE id = ${batchId} LIMIT 1
    `;
    if (!batchRows[0]) {
      return { success: false, error: 'batch_not_found' };
    }

    await prisma.$executeRaw`
      UPDATE mkt_seek_batches
      SET status = 'completed', completed_at = now()
      WHERE id = ${batchId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'seek_batch.complete',
      payload: { batchId },
    });

    return { success: true };
  }

  /**
   * Get batch status with per-city metrics.
   */
  async getBatchStatus(batchId: string): Promise<BatchSummary & { metrics: BatchMetrics; perCity: any[] } | null> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        b.id, b.batch_slug, b.profile_id, b.profile_version, b.niche_category, b.intelligence_focus,
        b.cities, b.campaign_ids, b.status, b.created_at, b.completed_at,
        (SELECT COUNT(*) FROM mkt_prospect_queue pq WHERE pq.seek_batch_id = b.id) AS total_prospects,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id) AS total_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.published_at IS NOT NULL) AS published_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.invited_at IS NOT NULL) AS invited_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.claimed_at IS NOT NULL) AS claimed_seeds
      FROM mkt_seek_batches b
      WHERE b.id = ${batchId}
      LIMIT 1
    `;
    if (!rows[0]) return null;

    const r = rows[0];
    const cities: string[] = r.cities;

    // Lazy completion: a running batch is complete once every launched
    // campaign has ≥1 execution recorded. completeBatch has no other caller —
    // runs never signal back to the batch otherwise.
    if (r.status === 'running' && Array.isArray(r.campaign_ids) && r.campaign_ids.length > 0) {
      const done = await this.campaignsAllExecuted(r.campaign_ids);
      if (done) {
        await this.completeBatch(batchId);
        r.status = 'completed';
        r.completed_at = new Date();
      }
    }

    // Per-city breakdown — cumulative timestamps (published/invited/claimed
    // are lifecycle events, not the current status), NULL-safe + case-insensitive
    // city join consistent with the rest of the pipeline.
    const perCityRows = await prisma.$queryRaw<any[]>`
      SELECT
        pq.city,
        COUNT(DISTINCT pq.id) AS prospects,
        COUNT(DISTINCT dps.id) AS seeds,
        COUNT(DISTINCT CASE WHEN dps.published_at IS NOT NULL THEN dps.id END) AS published,
        COUNT(DISTINCT CASE WHEN dps.invited_at IS NOT NULL THEN dps.id END) AS invited,
        COUNT(DISTINCT CASE WHEN dps.claimed_at IS NOT NULL THEN dps.id END) AS claimed
      FROM mkt_prospect_queue pq
      LEFT JOIN directory_presence_seeds dps ON dps.tenant_id IS NOT NULL
        AND LOWER(dps.city) = LOWER(pq.city) AND dps.seek_batch_id = pq.seek_batch_id
      WHERE pq.seek_batch_id = ${batchId}
      GROUP BY pq.city
    `;

    // Load entries if they exist (queue-based flow)
    const entryRows = await prisma.$queryRaw<any[]>`
      SELECT id, profile_id, profile_version, niche_category, city, state, intelligence_focus, sort_order
      FROM mkt_seek_batch_entries
      WHERE batch_id = ${batchId}
      ORDER BY sort_order ASC
    `;
    const entries: BatchEntry[] | undefined = entryRows.length > 0
      ? entryRows.map((e) => ({
          id: e.id,
          batchId: batchId,
          profileId: e.profile_id,
          profileVersion: e.profile_version,
          nicheCategory: e.niche_category,
          city: e.city,
          state: e.state,
          intelligenceFocus: e.intelligence_focus || 'emerging',
          sortOrder: e.sort_order,
        }))
      : undefined;

    // Campaign descriptors — the raw ids alone don't say what was minted or
    // adopted. seek_batch_id exposes ownership: an adopted campaign still
    // belongs to its origin batch (first-claim-wins), so surface it.
    const campaignIds: string[] = r.campaign_ids || [];
    const campaigns = campaignIds.length > 0
      ? await prisma.$queryRaw<any[]>`
          SELECT id, display_id, category, city, state, intelligence_focus,
                 intelligence_campaign_kind, stage, campaign_category, seek_batch_id
          FROM mkt_campaigns_list
          WHERE id = ANY(${campaignIds}::text[])
        `
      : [];

    return {
      id: r.id,
      batchSlug: r.batch_slug,
      profileId: r.profile_id,
      profileVersion: r.profile_version,
      nicheCategory: r.niche_category,
      intelligenceFocus: r.intelligence_focus || 'emerging',
      cities,
      campaignIds,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        displayId: c.display_id,
        category: c.category,
        city: c.city,
        state: c.state,
        intelligenceFocus: c.intelligence_focus,
        campaignKind: c.intelligence_campaign_kind,
        stage: c.stage,
        campaignCategory: c.campaign_category,
        seekBatchId: c.seek_batch_id,
      })),
      categories: entryRows.length
        ? Array.from(new Set(entryRows.map((e) => e.niche_category).filter(Boolean)))
        : (r.niche_category ? [r.niche_category] : []),
      focuses: entryRows.length
        ? Array.from(new Set(entryRows.map((e) => e.intelligence_focus || 'emerging')))
        : [r.intelligence_focus || 'emerging'],
      status: r.status,
      createdAt: new Date(r.created_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
      entries,
      metrics: {
        totalProspects: parseInt(r.total_prospects) || 0,
        totalSeeds: parseInt(r.total_seeds) || 0,
        publishedSeeds: parseInt(r.published_seeds) || 0,
        invitedSeeds: parseInt(r.invited_seeds) || 0,
        claimedSeeds: parseInt(r.claimed_seeds) || 0,
      },
      perCity: perCityRows.map((c) => ({
        city: c.city,
        prospects: parseInt(c.prospects) || 0,
        seeds: parseInt(c.seeds) || 0,
        published: parseInt(c.published) || 0,
        invited: parseInt(c.invited) || 0,
        claimed: parseInt(c.claimed) || 0,
      })),
    };
  }

  /**
   * List seek batches with summary metrics.
   *
   * Filter semantics mirror listSeedBatches: `batch` is a slug substring
   * search; `city` is exact case-insensitive against the batch's city set;
   * `category`/`focus` match the summary column OR any entry row — a
   * mixed-lens or mixed-category batch surfaces under each of its parts,
   * not just its first entry.
   */
  async listBatches(filters?: {
    status?: string;
    batch?: string;
    city?: string;
    category?: string;
    focus?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<Array<BatchSummary & { metrics: BatchMetrics }>> {
    const limit = Math.min(filters?.limit || 50, 200);

    const conditions: string[] = [];
    const params: any[] = [];
    const addParam = (v: any) => `$${params.push(v)}`;

    if (filters?.status) {
      conditions.push(`b.status = ${addParam(filters.status)}`);
    }
    if (filters?.batch) {
      conditions.push(`b.batch_slug ILIKE ${addParam(`%${filters.batch}%`)}`);
    }
    if (filters?.city) {
      conditions.push(`EXISTS (
        SELECT 1 FROM unnest(COALESCE(b.cities, '{}'::text[])) c
        WHERE lower(c) = lower(${addParam(filters.city)})
      )`);
    }
    if (filters?.category) {
      const p = addParam(filters.category);
      conditions.push(`(
        lower(b.niche_category) = lower(${p})
        OR EXISTS (
          SELECT 1 FROM mkt_seek_batch_entries e
          WHERE e.batch_id = b.id AND lower(e.niche_category) = lower(${p})
        )
      )`);
    }
    if (filters?.focus) {
      const p = addParam(filters.focus);
      conditions.push(`(
        b.intelligence_focus = ${p}
        OR EXISTS (
          SELECT 1 FROM mkt_seek_batch_entries e
          WHERE e.batch_id = b.id AND e.intelligence_focus = ${p}
        )
      )`);
    }
    if (filters?.dateFrom) {
      conditions.push(`b.created_at >= ${addParam(filters.dateFrom)}::timestamptz`);
    }
    if (filters?.dateTo) {
      conditions.push(`b.created_at < (${addParam(filters.dateTo)}::date + 1)`);
    }

    const query = `
      SELECT
        b.id, b.batch_slug, b.profile_id, b.profile_version, b.niche_category, b.intelligence_focus,
        b.cities, b.campaign_ids, b.status, b.created_at, b.completed_at,
        (SELECT array_agg(DISTINCT e.niche_category)
         FROM mkt_seek_batch_entries e WHERE e.batch_id = b.id) AS entry_categories,
        (SELECT array_agg(DISTINCT e.intelligence_focus)
         FROM mkt_seek_batch_entries e WHERE e.batch_id = b.id) AS entry_focuses,
        (SELECT COUNT(*) FROM mkt_prospect_queue pq WHERE pq.seek_batch_id = b.id) AS total_prospects,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id) AS total_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.published_at IS NOT NULL) AS published_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.invited_at IS NOT NULL) AS invited_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.claimed_at IS NOT NULL) AS claimed_seeds
      FROM mkt_seek_batches b
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY b.created_at DESC LIMIT ${addParam(limit)}
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // Lazy completion — see getBatchStatus. One aggregate query across all
    // running batches instead of a per-row check.
    const running = rows.filter(
      (r) => r.status === 'running' && Array.isArray(r.campaign_ids) && r.campaign_ids.length > 0,
    );
    if (running.length > 0) {
      const allCampaignIds = running.flatMap((r) => r.campaign_ids);
      const executed = new Set(await this.executedCampaignIds(allCampaignIds));
      for (const r of running) {
        if (r.campaign_ids.every((id: string) => executed.has(id))) {
          await this.completeBatch(r.id);
          r.status = 'completed';
          r.completed_at = new Date();
        }
      }
    }

    return rows.map((r) => ({
      id: r.id,
      batchSlug: r.batch_slug,
      profileId: r.profile_id,
      profileVersion: r.profile_version,
      nicheCategory: r.niche_category,
      intelligenceFocus: r.intelligence_focus || 'emerging',
      cities: r.cities || [],
      // Distinct categories across entries — the honest option universe for
      // mixed-category batches (summary niche reads "X +N more"). Legacy
      // batches have no entry rows, so fall back to the summary category.
      categories: r.entry_categories?.length ? r.entry_categories : (r.niche_category ? [r.niche_category] : []),
      focuses: r.entry_focuses?.length ? r.entry_focuses : [r.intelligence_focus || 'emerging'],
      campaignIds: r.campaign_ids || [],
      status: r.status,
      createdAt: new Date(r.created_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
      metrics: {
        totalProspects: parseInt(r.total_prospects) || 0,
        totalSeeds: parseInt(r.total_seeds) || 0,
        publishedSeeds: parseInt(r.published_seeds) || 0,
        invitedSeeds: parseInt(r.invited_seeds) || 0,
        claimedSeeds: parseInt(r.claimed_seeds) || 0,
      },
    }));
  }

  /** Campaign ids that have at least one recorded prompt execution. */
  private async executedCampaignIds(campaignIds: string[]): Promise<string[]> {
    if (campaignIds.length === 0) return [];
    const rows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT campaign_id FROM mkt_prompt_executions_list
      WHERE campaign_id = ANY(${campaignIds}::text[])
    `;
    return rows.map((r) => r.campaign_id);
  }

  private async campaignsAllExecuted(campaignIds: string[]): Promise<boolean> {
    const executed = new Set(await this.executedCampaignIds(campaignIds));
    return campaignIds.every((id) => executed.has(id));
  }

  /**
   * Delete a seek batch: removes the coordination record and its entries, and
   * unlinks downstream attribution — campaigns, queue prospects, and seeds
   * keep living (the batch was bookkeeping, not an owner). The honest verb for
   * discarding smoke-test or abandoned batches without touching the work they
   * minted. Irreversible.
   */
  async deleteSeekBatch(
    batchId: string,
    ctx?: BatchAuditCtx,
  ): Promise<{ deleted: boolean; unlinked: { campaigns: number; queueEntries: number; seeds: number } }> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id FROM mkt_seek_batches WHERE id = ${batchId} LIMIT 1
    `;
    if (!rows[0]) {
      return { deleted: false, unlinked: { campaigns: 0, queueEntries: 0, seeds: 0 } };
    }

    const unlinkedCampaigns = await prisma.$executeRaw`
      UPDATE mkt_campaigns_list SET seek_batch_id = NULL WHERE seek_batch_id = ${batchId}
    `;
    const unlinkedQueue = await prisma.$executeRaw`
      UPDATE mkt_prospect_queue SET seek_batch_id = NULL WHERE seek_batch_id = ${batchId}
    `;
    const unlinkedSeeds = await prisma.$executeRaw`
      UPDATE directory_presence_seeds SET seek_batch_id = NULL, updated_at = now()
      WHERE seek_batch_id = ${batchId}
    `;
    await prisma.$executeRaw`DELETE FROM mkt_seek_batch_entries WHERE batch_id = ${batchId}`;
    await prisma.$executeRaw`DELETE FROM mkt_seek_batches WHERE id = ${batchId}`;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'seek_batch.delete',
      payload: { batchId, unlinkedCampaigns, unlinkedQueue, unlinkedSeeds },
    });
    logger.info('BatchSeekService.deleteSeekBatch', undefined, { batchId, unlinkedCampaigns, unlinkedQueue, unlinkedSeeds });

    return { deleted: true, unlinked: { campaigns: unlinkedCampaigns, queueEntries: unlinkedQueue, seeds: unlinkedSeeds } };
  }

  /**
   * Dissolve a seed-batch cohort: clears the seed_batch label on every seed in
   * the group. Seed batches are labels, not entities — "delete" here means the
   * cohort view goes away; the seeds themselves are untouched (per-seed delete
   * lives on the seeds list page where the cascade is explicit).
   */
  async unbatchSeeds(
    seedBatch: string,
    ctx?: BatchAuditCtx,
  ): Promise<{ unbatched: number }> {
    const unbatched = await prisma.$executeRaw`
      UPDATE directory_presence_seeds
      SET seed_batch = NULL, updated_at = now()
      WHERE seed_batch = ${seedBatch}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'seed_batch.unbatch',
      payload: { seedBatch, unbatched },
    });
    logger.info('BatchSeekService.unbatchSeeds', undefined, { seedBatch, unbatched });

    return { unbatched };
  }

  /**
   * List seed batches (grouped by seed_batch column) with metrics.
   *
   * PG awareness: each batch is attributed to proving-ground campaigns via
   * the seeds' campaign links (proving-ground-seed stamps pg-{id}-{date}
   * slugs, but attribution comes from the link — not the slug — so renamed
   * or hand-stamped batches still resolve). A batch can surface multiple
   * PGs if its seeds were linked to more than one.
   *
   * Slug fallback: seeds minted before link-stamping (or hand-labeled) carry
   * no link rows — pg-{campaignId}-{yyyymmdd} and from-campaign-{id} labels
   * embed the source campaign id, so unresolved batches parse the slug and
   * attribute directly. Linked attribution wins; the slug only fills the gap.
   *
   * Seek-batch lineage: dps.seek_batch_id connects each seed cohort back to
   * the seek batch that produced its prospects (queue → seed propagation).
   */
  async listSeedBatches(filters?: {
    seedBatch?: string;
    city?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    focus?: string;
    seekBatch?: string;
    limit?: number;
  }): Promise<Array<{
    seedBatch: string;
    totalSeeds: number;
    publishedSeeds: number;
    claimedSeeds: number;
    invitedSeeds: number;
    cities: string[];
    categories: string[];
    /** Modal city ("City, ST") — what the cohort mostly is, not what sorts
     *  first. Labels lead with this; `cities` drives the "+N" remainder. */
    topCity: string | null;
    /** Modal shelf — same rationale as topCity. */
    topCategory: string | null;
    createdAt: string | null;
    provingGrounds: Array<{ id: string; displayId: string | null }>;
    sourceCampaigns: Array<{ id: string; displayId: string | null }>;
    seekBatches: Array<{ id: string; batchSlug: string | null; intelligenceFocus: string | null }>;
    focuses: string[];
  }>> {
    const limit = Math.min(filters?.limit || 50, 200);

    const conditions = ['dps.seed_batch IS NOT NULL'];
    const params: any[] = [];
    const addParam = (v: any) => `$${params.push(v)}`;
    if (filters?.seedBatch) {
      conditions.push(`dps.seed_batch ILIKE ${addParam(`%${filters.seedBatch}%`)}`);
    }
    if (filters?.city) {
      // Exact (case-insensitive) — the UI supplies real city values from the
      // batch rollup; substring here would leak (city 'St' matching 'Austin').
      conditions.push(`dps.city ILIKE ${addParam(filters.city)}`);
    }
    if (filters?.category) {
      conditions.push(`dps.category ILIKE ${addParam(filters.category)}`);
    }
    if (filters?.dateFrom) {
      conditions.push(`dps.created_at >= ${addParam(filters.dateFrom)}::timestamptz`);
    }
    if (filters?.dateTo) {
      conditions.push(`dps.created_at < (${addParam(filters.dateTo)}::date + 1)`);
    }
    if (filters?.seekBatch) {
      conditions.push(`dps.seek_batch_id = ${addParam(filters.seekBatch)}`);
    }
    if (filters?.focus) {
      // Lens lineage, three paths — a seed can trace its lens through its
      // seek batch (summary OR any entry, same semantics as listBatches),
      // through a linked campaign, or through the campaign id encoded in a
      // convention label (from-campaign-*, pg-*). Legacy seeds almost always
      // carry only the third.
      const p = addParam(filters.focus);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM mkt_seek_batches sb
          WHERE sb.id = dps.seek_batch_id
            AND (
              sb.intelligence_focus = ${p}
              OR EXISTS (
                SELECT 1 FROM mkt_seek_batch_entries e
                WHERE e.batch_id = sb.id AND e.intelligence_focus = ${p}
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM directory_seed_campaign_links dscl
          JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
          WHERE dscl.seed_id = dps.id AND mc.intelligence_focus = ${p}
        )
        OR EXISTS (
          SELECT 1 FROM mkt_campaigns_list mc2
          WHERE mc2.id = substring(dps.seed_batch from '(mcamp-[a-z0-9]+)')
            AND mc2.intelligence_focus = ${p}
        )
      )`);
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        dps.seed_batch,
        COUNT(*) AS total_seeds,
        COUNT(*) FILTER (WHERE dps.published_at IS NOT NULL) AS published_seeds,
        COUNT(*) FILTER (WHERE dps.claimed_at IS NOT NULL) AS claimed_seeds,
        COUNT(*) FILTER (WHERE dps.invited_at IS NOT NULL) AS invited_seeds,
        ARRAY_AGG(DISTINCT dps.city) AS cities,
        ARRAY_AGG(DISTINCT dps.category) AS categories,
        MODE() WITHIN GROUP (ORDER BY CONCAT_WS(', ', NULLIF(dps.city, ''), NULLIF(dps.state, '')))
          FILTER (WHERE COALESCE(NULLIF(dps.city, ''), NULLIF(dps.state, '')) IS NOT NULL) AS top_city,
        MODE() WITHIN GROUP (ORDER BY dps.category)
          FILTER (WHERE NULLIF(dps.category, '') IS NOT NULL) AS top_category,
        MIN(dps.created_at) AS created_at
      FROM directory_presence_seeds dps
      WHERE ${conditions.join(' AND ')}
      GROUP BY dps.seed_batch
      ORDER BY MIN(dps.created_at) DESC
      LIMIT ${addParam(limit)}
    `, ...params);

    // Attribute each seed_batch to its proving-ground campaign(s) via the
    // seed ↔ campaign links.
    const pgRows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT dps.seed_batch, mc.id AS pg_id, mc.display_id AS pg_display_id
      FROM directory_presence_seeds dps
      JOIN directory_seed_campaign_links dscl ON dscl.seed_id = dps.id
      JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
      WHERE dps.seed_batch IS NOT NULL
        AND mc.campaign_category = 'proving_ground'
    `;
    const pgByBatch = new Map<string, Array<{ id: string; displayId: string | null }>>();
    for (const r of pgRows) {
      const list = pgByBatch.get(r.seed_batch) || [];
      list.push({ id: r.pg_id, displayId: r.pg_display_id });
      pgByBatch.set(r.seed_batch, list);
    }

    // Slug-parse fallback for unlinked batches + source-campaign attribution
    // for convention labels (pg-{campaignId}-{yyyymmdd}, from-campaign-{id}).
    const slugCampaignIds = new Set<string>();
    for (const r of rows) {
      const m = String(r.seed_batch).match(/^(?:pg-(mcamp-[a-z0-9]+)-\d{8}|from-campaign-(mcamp-[a-z0-9]+))$/i);
      const cid = m?.[1] || m?.[2];
      if (cid) slugCampaignIds.add(cid);
    }
    const campaignById = new Map<string, { id: string; displayId: string | null; category: string | null }>();
    if (slugCampaignIds.size) {
      const camps = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, display_id, campaign_category FROM mkt_campaigns_list WHERE id = ANY($1::text[])`,
        Array.from(slugCampaignIds),
      );
      for (const c of camps) {
        campaignById.set(c.id, { id: c.id, displayId: c.display_id, category: c.campaign_category });
      }
    }

    // Seek-batch lineage per seed batch.
    const sbRows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT dps.seed_batch, sb.id AS sb_id, sb.batch_slug, sb.intelligence_focus
      FROM directory_presence_seeds dps
      JOIN mkt_seek_batches sb ON sb.id = dps.seek_batch_id
      WHERE dps.seed_batch IS NOT NULL
    `;
    const sbByBatch = new Map<string, Array<{ id: string; batchSlug: string | null; intelligenceFocus: string | null }>>();
    for (const r of sbRows) {
      const list = sbByBatch.get(r.seed_batch) || [];
      list.push({ id: r.sb_id, batchSlug: r.batch_slug, intelligenceFocus: r.intelligence_focus });
      sbByBatch.set(r.seed_batch, list);
    }

    // Lens resolution per seed batch — the same three lineage paths the focus
    // filter uses, surfaced so the row can show which lens(es) it descends
    // from. Legacy cohorts resolve through their source campaign's focus.
    const focusRows = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT dps.seed_batch, f.intelligence_focus
      FROM directory_presence_seeds dps
      JOIN LATERAL (
        SELECT sb.intelligence_focus FROM mkt_seek_batches sb
        WHERE sb.id = dps.seek_batch_id AND sb.intelligence_focus IS NOT NULL
        UNION
        SELECT e.intelligence_focus FROM mkt_seek_batch_entries e
        WHERE e.batch_id = dps.seek_batch_id AND e.intelligence_focus IS NOT NULL
        UNION
        SELECT mc.intelligence_focus FROM directory_seed_campaign_links dscl
        JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
        WHERE dscl.seed_id = dps.id AND mc.intelligence_focus IS NOT NULL
        UNION
        SELECT mc2.intelligence_focus FROM mkt_campaigns_list mc2
        WHERE mc2.id = substring(dps.seed_batch from '(mcamp-[a-z0-9]+)')
          AND mc2.intelligence_focus IS NOT NULL
      ) f ON true
      WHERE dps.seed_batch IS NOT NULL
    `;
    const focusByBatch = new Map<string, string[]>();
    for (const r of focusRows) {
      const list = focusByBatch.get(r.seed_batch) || [];
      list.push(r.intelligence_focus);
      focusByBatch.set(r.seed_batch, list);
    }

    return rows.map((r) => {
      const label = String(r.seed_batch);
      const m = label.match(/^(?:pg-(mcamp-[a-z0-9]+)-\d{8}|from-campaign-(mcamp-[a-z0-9]+))$/i);
      const slugCampaign = m ? campaignById.get(m[1] || m[2] || '') : undefined;
      const linkedPgs = pgByBatch.get(label) || [];
      // Slug-attributed PG fills the gap only when links found none.
      const slugPg = slugCampaign?.category === 'proving_ground'
        ? [{ id: slugCampaign.id, displayId: slugCampaign.displayId }]
        : [];
      const provingGrounds = linkedPgs.length
        ? linkedPgs
        : slugPg;
      const sourceCampaigns = slugCampaign && slugCampaign.category !== 'proving_ground'
        ? [{ id: slugCampaign.id, displayId: slugCampaign.displayId }]
        : [];
      return {
        seedBatch: label,
        totalSeeds: parseInt(r.total_seeds) || 0,
        publishedSeeds: parseInt(r.published_seeds) || 0,
        claimedSeeds: parseInt(r.claimed_seeds) || 0,
        invitedSeeds: parseInt(r.invited_seeds) || 0,
        cities: r.cities || [],
        categories: r.categories || [],
        topCity: r.top_city ?? null,
        topCategory: r.top_category ?? null,
        createdAt: r.created_at ?? null,
        provingGrounds,
        sourceCampaigns,
        seekBatches: sbByBatch.get(label) || [],
        focuses: focusByBatch.get(label) || [],
      };
    });
  }
}

export default new BatchSeekService();
