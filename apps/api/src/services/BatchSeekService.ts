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

    const summaryProfileId = hasEntries ? entries[0].profileId : input.profileId;
    const summaryProfileVersion = hasEntries
      ? (entries[0].profileVersion || null)
      : (input.profileVersion || null);
    const summaryCategory = hasEntries ? entries[0].nicheCategory : input.nicheCategory;
    const summaryFocus = hasEntries
      ? (entries[0].intelligenceFocus || 'emerging')
      : (input.intelligenceFocus || 'emerging');
    const summaryCities = hasEntries
      ? Array.from(new Set(entries.map((e) => e.city)))
      : input.cities;

    const batchSlug = generateSeekBatchSlug(summaryCategory, summaryCities.length);

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
        const entryFocus = e.intelligenceFocus || 'emerging';
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

    // Reuse a campaign this batch already created for the same (category, city)
    // — makes relaunch idempotent instead of minting duplicates.
    const reuseExisting = async (category: string, city: string): Promise<string | null> => {
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM mkt_campaigns_list
        WHERE seek_batch_id = ${batchId}
          AND LOWER(category) = LOWER(${category})
          AND LOWER(city) = LOWER(${city})
        LIMIT 1
      `;
      return existing[0]?.id || null;
    };

    const launchEntry = async (category: string, city: string, state: string | null, focus: string) => {
      const reused = await reuseExisting(category, city);
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

    return {
      id: r.id,
      batchSlug: r.batch_slug,
      profileId: r.profile_id,
      profileVersion: r.profile_version,
      nicheCategory: r.niche_category,
      intelligenceFocus: r.intelligence_focus || 'emerging',
      cities,
      campaignIds: r.campaign_ids || [],
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
   */
  async listBatches(filters?: {
    status?: string;
    limit?: number;
  }): Promise<Array<BatchSummary & { metrics: BatchMetrics }>> {
    const limit = Math.min(filters?.limit || 50, 200);
    const statusFilter = filters?.status;

    let query = `
      SELECT
        b.id, b.batch_slug, b.profile_id, b.profile_version, b.niche_category, b.intelligence_focus,
        b.cities, b.campaign_ids, b.status, b.created_at, b.completed_at,
        (SELECT COUNT(*) FROM mkt_prospect_queue pq WHERE pq.seek_batch_id = b.id) AS total_prospects,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id) AS total_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.published_at IS NOT NULL) AS published_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.invited_at IS NOT NULL) AS invited_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.claimed_at IS NOT NULL) AS claimed_seeds
      FROM mkt_seek_batches b
    `;
    const params: any[] = [];
    if (statusFilter) {
      query += ` WHERE b.status = $1`;
      params.push(statusFilter);
    }
    query += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

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
   * List seed batches (grouped by seed_batch column) with metrics.
   *
   * PG awareness: each batch is attributed to proving-ground campaigns via
   * the seeds' campaign links (proving-ground-seed stamps pg-{id}-{date}
   * slugs, but attribution comes from the link — not the slug — so renamed
   * or hand-stamped batches still resolve). A batch can surface multiple
   * PGs if its seeds were linked to more than one.
   */
  async listSeedBatches(filters?: {
    seedBatch?: string;
    limit?: number;
  }): Promise<Array<{
    seedBatch: string;
    totalSeeds: number;
    publishedSeeds: number;
    claimedSeeds: number;
    invitedSeeds: number;
    cities: string[];
    categories: string[];
    provingGrounds: Array<{ id: string; displayId: string | null }>;
  }>> {
    const limit = Math.min(filters?.limit || 50, 200);
    const seedBatchFilter = filters?.seedBatch;

    let query = `
      SELECT
        seed_batch,
        COUNT(*) AS total_seeds,
        COUNT(*) FILTER (WHERE published_at IS NOT NULL) AS published_seeds,
        COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) AS claimed_seeds,
        COUNT(*) FILTER (WHERE invited_at IS NOT NULL) AS invited_seeds,
        ARRAY_AGG(DISTINCT city) AS cities,
        ARRAY_AGG(DISTINCT category) AS categories
      FROM directory_presence_seeds
    `;
    const params: any[] = [];
    const conditions = ['seed_batch IS NOT NULL'];
    if (seedBatchFilter) {
      conditions.push(`seed_batch = $1`);
      params.push(seedBatchFilter);
    }
    query += ` WHERE ${conditions.join(' AND ')} GROUP BY seed_batch ORDER BY MIN(created_at) DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);

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

    return rows.map((r) => ({
      seedBatch: r.seed_batch,
      totalSeeds: parseInt(r.total_seeds) || 0,
      publishedSeeds: parseInt(r.published_seeds) || 0,
      claimedSeeds: parseInt(r.claimed_seeds) || 0,
      invitedSeeds: parseInt(r.invited_seeds) || 0,
      cities: r.cities || [],
      categories: r.categories || [],
      provingGrounds: pgByBatch.get(r.seed_batch) || [],
    }));
  }
}

export default new BatchSeekService();
