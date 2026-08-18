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

    await prisma.$executeRaw`
      INSERT INTO mkt_seek_batches (
        id, batch_slug, profile_id, profile_version, niche_category, intelligence_focus,
        cities, campaign_ids, status, created_by, created_at
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
      SELECT id, profile_id, profile_version, niche_category, intelligence_focus, cities, status
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

    if (entryRows.length > 0) {
      // Queue-based launch: one campaign per entry, each using its own profile/category/focus
      for (const entry of entryRows) {
        const campaignId = `mkt-${entry.niche_category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${entry.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
        const focus = entry.intelligence_focus || 'emerging';

        try {
          await prisma.$executeRaw`
            INSERT INTO mkt_campaigns_list (
              id, category, city, state, scope, intelligence_focus,
              intelligence_campaign_kind, seek_batch_id, stage,
              created_at, updated_at
            ) VALUES (
              ${campaignId},
              ${entry.niche_category},
              ${entry.city},
              ${entry.state || 'IN'},
              'intelligence',
              ${focus},
              'discovery',
              ${batchId},
              'seek',
              now(), now()
            )
          `;
          campaignIds.push(campaignId);
        } catch (err) {
          logger.error('BatchSeekService.launchBatch — campaign creation failed (entry)', undefined, {
            batchId, city: entry.city, category: entry.niche_category, error: (err as Error).message,
          });
          // Continue with other entries — partial failure is OK
        }
      }
    } else {
      // Legacy launch: one campaign per city using batch-level profile/category/focus
      const cities: string[] = batch.cities;
      for (const city of cities) {
        const campaignId = `mkt-${batch.niche_category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
        const focus = batch.intelligence_focus || 'emerging';

        try {
          await prisma.$executeRaw`
            INSERT INTO mkt_campaigns_list (
              id, category, city, state, scope, intelligence_focus,
              intelligence_campaign_kind, seek_batch_id, stage,
              created_at, updated_at
            ) VALUES (
              ${campaignId},
              ${batch.niche_category},
              ${city},
              ${'IN'},
              'intelligence',
              ${focus},
              'discovery',
              ${batchId},
              'seek',
              now(), now()
            )
          `;
          campaignIds.push(campaignId);
        } catch (err) {
          logger.error('BatchSeekService.launchBatch — campaign creation failed', undefined, {
            batchId, city, error: (err as Error).message,
          });
          // Continue with other cities — partial failure is OK
        }
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
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.status = 'published') AS published_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.status = 'claimed') AS claimed_seeds
      FROM mkt_seek_batches b
      WHERE b.id = ${batchId}
      LIMIT 1
    `;
    if (!rows[0]) return null;

    const r = rows[0];
    const cities: string[] = r.cities;

    // Per-city breakdown
    const perCityRows = await prisma.$queryRaw<any[]>`
      SELECT
        pq.city,
        COUNT(DISTINCT pq.id) AS prospects,
        COUNT(DISTINCT dps.id) AS seeds,
        COUNT(DISTINCT CASE WHEN dps.status = 'published' THEN dps.id END) AS published,
        COUNT(DISTINCT CASE WHEN dps.status = 'claimed' THEN dps.id END) AS claimed
      FROM mkt_prospect_queue pq
      LEFT JOIN directory_presence_seeds dps ON dps.tenant_id IS NOT NULL
        AND dps.city = pq.city AND dps.seek_batch_id = pq.seek_batch_id
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
        claimedSeeds: parseInt(r.claimed_seeds) || 0,
      },
      perCity: perCityRows.map((c) => ({
        city: c.city,
        prospects: parseInt(c.prospects) || 0,
        seeds: parseInt(c.seeds) || 0,
        published: parseInt(c.published) || 0,
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
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.status = 'published') AS published_seeds,
        (SELECT COUNT(*) FROM directory_presence_seeds dps WHERE dps.seek_batch_id = b.id AND dps.status = 'claimed') AS claimed_seeds
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
        claimedSeeds: parseInt(r.claimed_seeds) || 0,
      },
    }));
  }

  /**
   * List seed batches (grouped by seed_batch column) with metrics.
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
  }>> {
    const limit = Math.min(filters?.limit || 50, 200);
    const seedBatchFilter = filters?.seedBatch;

    let query = `
      SELECT
        seed_batch,
        COUNT(*) AS total_seeds,
        COUNT(*) FILTER (WHERE status = 'published') AS published_seeds,
        COUNT(*) FILTER (WHERE status = 'claimed') AS claimed_seeds,
        COUNT(*) FILTER (WHERE status = 'invited') AS invited_seeds,
        ARRAY_AGG(DISTINCT city) AS cities,
        ARRAY_AGG(DISTINCT category) AS categories
      FROM directory_presence_seeds
    `;
    const params: any[] = [];
    if (seedBatchFilter) {
      query += ` WHERE seed_batch = $1`;
      params.push(seedBatchFilter);
    }
    query += ` GROUP BY seed_batch ORDER BY MIN(created_at) DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    return rows.map((r) => ({
      seedBatch: r.seed_batch,
      totalSeeds: parseInt(r.total_seeds) || 0,
      publishedSeeds: parseInt(r.published_seeds) || 0,
      claimedSeeds: parseInt(r.claimed_seeds) || 0,
      invitedSeeds: parseInt(r.invited_seeds) || 0,
      cities: r.cities || [],
      categories: r.categories || [],
    }));
  }
}

export default new BatchSeekService();
