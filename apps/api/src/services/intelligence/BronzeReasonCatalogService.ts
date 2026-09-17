/**
 * BronzeReasonCatalogService — DB-authoritative bronze reason catalog
 *
 * Spec: docs/LocalBiz/BRONZE_STANDARD_SPEC.md §3 (catalog), §3.5 (store +
 * operator authoring), §3.6 (scope model), sprint plan Phase 2.
 *
 * The catalog defines which bronze slots exist: each reason names a
 * discovery blind spot (why a category-qualified, operating business is
 * invisible). It is curated, not scan-produced — new reasons enter only
 * through operator authoring (live immediately, no review gate), and the
 * national bronze profile carries a revision-stamped snapshot of the
 * scope-applicable rows.
 *
 * Invariants enforced here (no CHECK constraints — code-validated per the
 * mkt_manual_play_templates precedent):
 *   - reason_key is immutable once assigned (op_<slug> precedent).
 *   - The catalog is additive: never delete, only deprecate (§3.4/§3.5.6).
 *   - Every write bumps mkt_bronze_catalog_meta.catalog_revision inside the
 *     same transaction and stamps the appropriate *_in_revision column.
 *   - Scope values are normalized on write (§3.5.1) via the same normalizers
 *     importAsDraft uses — a scope value that fails to normalize is rejected,
 *     never silently stored.
 *   - scope_city and scope_state are set together or not at all (§3.6.1:
 *     location scope is city + state).
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { audit } from '../../audit';
import { ConflictError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import {
  normalizeCategoryKey,
  normalizeReferenceCity,
  normalizeReferenceState,
  normalizePlatformScope,
} from './IntelligenceProfileService';

// ─── Types ───────────────────────────────────────────────────────────────

export interface BronzeReason {
  reason_key: string;
  label: string;
  definition: string;
  signals: string[];
  expected_vectors: string[];
  priority: number;
  scope_category_key: string | null;
  scope_city: string | null;
  scope_state: string | null;
  scope_platform: string | null;
  provenance: 'derived' | 'operator_authored';
  introduced_in_revision: number;
  revised_in_revision: number | null;
  deprecated_in_revision: number | null;
  deprecated_reason: string | null;
  superseded_by: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BronzeReasonInput {
  label: string;
  definition: string;
  signals?: string[];
  expected_vectors?: string[];
  priority?: number;
  scope_category_key?: string | null;
  scope_city?: string | null;
  scope_state?: string | null;
  scope_platform?: string | null;
}

export interface BronzeScopeFilter {
  categoryKey?: string | null;
  city?: string | null;
  state?: string | null;
  platform?: string | null;
}

export interface UncoveredReason {
  reason_key: string;
  label: string;
  gap_kind: 'never_covered' | 'revised_since_authored';
}

/**
 * Gold platform vocabulary for scope_platform (§3.6.5). Matches the
 * platform_focus enum in gold-standard-scan.schema.ts minus 'all' (which
 * normalizes to NULL = platform-agnostic). NOTE: the spec §3.5.1 lists
 * 'website' — the code vocabulary uses 'bbb' instead; the gold schema is
 * authoritative.
 */
export const BRONZE_SCOPE_PLATFORMS = [
  'google',
  'yelp',
  'facebook',
  'bbb',
  'apple_maps',
  'bing',
] as const;

const REASON_KEY_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;

// ─── Service ─────────────────────────────────────────────────────────────

export class BronzeReasonCatalogService extends BaseService {
  private static instance: BronzeReasonCatalogService;

  private constructor() {
    super();
  }

  static getInstance(): BronzeReasonCatalogService {
    if (!BronzeReasonCatalogService.instance) {
      BronzeReasonCatalogService.instance = new BronzeReasonCatalogService();
    }
    return BronzeReasonCatalogService.instance;
  }

  // ====================
  // READS
  // ====================

  /**
   * Admin list — rows in catalog order (priority, then key). Filters are
   * exact matches on the stored (normalized) scope values; pass
   * includeDeprecated to see retired rows.
   */
  async listReasons(opts: {
    categoryKey?: string | null;
    city?: string | null;
    state?: string | null;
    platform?: string | null;
    includeDeprecated?: boolean;
  } = {}, ctx?: RequestCtx): Promise<BronzeReason[]> {
    try {
      const where: any = {};
      if (opts.categoryKey) where.scope_category_key = normalizeCategoryKey(opts.categoryKey);
      if (opts.city) where.scope_city = normalizeReferenceCity(opts.city);
      if (opts.state) where.scope_state = normalizeReferenceState(opts.state);
      if (opts.platform) where.scope_platform = normalizePlatformScope(opts.platform);
      if (!opts.includeDeprecated) where.deprecated_in_revision = null;

      const rows = await this.prisma.mkt_bronze_reason_catalog.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { reason_key: 'asc' }],
      });
      return rows as unknown as BronzeReason[];
    } catch (error) {
      logger.error('BronzeReasonCatalogService.listReasons failed', ctx, {
        error: (error as Error).message,
      });
      throw this.handleError(error, ctx);
    }
  }

  /** Single-row read by immutable key. Returns null when absent. */
  async getReason(reasonKey: string, ctx?: RequestCtx): Promise<BronzeReason | null> {
    try {
      const row = await this.prisma.mkt_bronze_reason_catalog.findUnique({
        where: { reason_key: (reasonKey || '').trim().toLowerCase() },
      });
      return (row as unknown as BronzeReason) ?? null;
    } catch (error) {
      logger.error('BronzeReasonCatalogService.getReason failed', ctx, {
        error: (error as Error).message,
        reasonKey,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Scope-applicable read — the §3.6.1 predicate. NULL scope columns are
   * wildcards. A platform-bound reason applies when the scan's platform
   * matches, OR when the scan is cross-platform (:platform IS NULL covers
   * every platform). Deprecated rows are excluded. Ordered by priority.
   *
   * Stage 1 (national) calls this without city/state — location-scoped rows
   * never match nationally by construction (they require a city). Stage 2
   * passes the market's city/state so location rows join the set.
   */
  async applicableReasons(scope: BronzeScopeFilter, ctx?: RequestCtx): Promise<BronzeReason[]> {
    const categoryKey = scope.categoryKey ? normalizeCategoryKey(scope.categoryKey) : null;
    const city = normalizeReferenceCity(scope.city);
    const state = normalizeReferenceState(scope.state);
    const platform = normalizePlatformScope(scope.platform);
    try {
      // §3.6.1 platform clause: (scope_platform IS NULL OR :platform IS NULL
      // OR scope_platform = :platform). A cross-platform scan (:platform IS
      // NULL) covers every platform, so it evaluates ALL platform-bound
      // reasons — the clause is omitted entirely rather than narrowed to
      // scope_platform IS NULL.
      const and: any[] = [
        { OR: [{ scope_category_key: null }, { scope_category_key: categoryKey ?? '' }] },
        { OR: [{ scope_city: null }, { scope_city: city ?? '' }] },
        { OR: [{ scope_state: null }, { scope_state: state ?? '' }] },
      ];
      if (platform) {
        and.push({ OR: [{ scope_platform: null }, { scope_platform: platform }] });
      }
      const rows = await this.prisma.mkt_bronze_reason_catalog.findMany({
        where: {
          deprecated_in_revision: null,
          AND: and,
        },
        orderBy: [{ priority: 'asc' }, { reason_key: 'asc' }],
      });
      return rows as unknown as BronzeReason[];
    } catch (error) {
      logger.error('BronzeReasonCatalogService.applicableReasons failed', ctx, {
        error: (error as Error).message,
        categoryKey, city, state, platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Current catalog revision — a plain SELECT on the single-row counter.
   * Never derived from reason rows (§3.5.2).
   */
  async currentRevision(): Promise<number> {
    const row = await this.prisma.mkt_bronze_catalog_meta.findUnique({
      where: { id: 'catalog' },
      select: { catalog_revision: true },
    });
    return row?.catalog_revision ?? 0;
  }

  /**
   * §3.5.3 staleness query — reasons a profile stamped at
   * profileCatalogRevision has never been asked to cover, or covers against
   * a stale definition. Scope-filtered so a profile for one market is not
   * flagged for another market's reasons.
   */
  async uncoveredReasons(input: {
    categoryKey: string;
    city?: string | null;
    state?: string | null;
    platform?: string | null;
    profileCatalogRevision: number;
  }, ctx?: RequestCtx): Promise<UncoveredReason[]> {
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const city = normalizeReferenceCity(input.city);
    const state = normalizeReferenceState(input.state);
    const platform = normalizePlatformScope(input.platform);
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        reason_key: string;
        label: string;
        gap_kind: 'never_covered' | 'revised_since_authored';
      }>>(`
        SELECT reason_key, label,
               CASE WHEN introduced_in_revision > $1
                    THEN 'never_covered'
                    ELSE 'revised_since_authored' END AS gap_kind
        FROM mkt_bronze_reason_catalog
        WHERE GREATEST(introduced_in_revision,
                       COALESCE(revised_in_revision, 0)) > $1
          AND deprecated_in_revision IS NULL
          AND (scope_category_key IS NULL OR scope_category_key = $2)
          AND (scope_city         IS NULL OR scope_city         = $3)
          AND (scope_state        IS NULL OR scope_state        = $4)
          AND (scope_platform     IS NULL OR $5::text IS NULL OR scope_platform = $5)
        ORDER BY priority, reason_key`,
        input.profileCatalogRevision,
        categoryKey,
        city,
        state,
        platform,
      );
      return rows;
    } catch (error) {
      logger.error('BronzeReasonCatalogService.uncoveredReasons failed', ctx, {
        error: (error as Error).message,
        categoryKey, city, state, platform,
        profileCatalogRevision: input.profileCatalogRevision,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // WRITES (each bumps catalog_revision in the same transaction)
  // ====================

  /**
   * Author a new reason. Live immediately on save (§3.5 governance — no
   * review gate). Stamps introduced_in_revision with the bumped revision.
   */
  async createReason(reasonKey: string, input: BronzeReasonInput, ctx?: RequestCtx): Promise<BronzeReason> {
    const key = (reasonKey || '').trim().toLowerCase();
    if (!REASON_KEY_PATTERN.test(key)) {
      throw new ValidationError(
        `reason_key must be snake_case (lowercase letters, digits, underscores; 2-80 chars, starting with a letter). Got: "${reasonKey}"`,
      );
    }
    const scope = this.normalizeScope(input);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mkt_bronze_reason_catalog.findUnique({
          where: { reason_key: key },
          select: { reason_key: true },
        });
        if (existing) {
          throw new ConflictError(`reason_key "${key}" already exists — keys are immutable and never reused`);
        }
        const revision = await this.bumpRevision(tx);
        const row = await tx.mkt_bronze_reason_catalog.create({
          data: {
            reason_key: key,
            label: input.label.trim(),
            definition: input.definition.trim(),
            signals: (input.signals ?? []) as any,
            expected_vectors: (input.expected_vectors ?? []) as any,
            priority: input.priority ?? 3,
            ...scope,
            provenance: 'operator_authored',
            introduced_in_revision: revision,
            created_by: ctx?.userId ?? null,
            updated_at: new Date(),
          },
        });
        return { row, revision };
      });

      await audit({
        actor: ctx?.userId ?? 'unknown',
        actorType: 'user',
        action: 'create',
        payload: {
          id: created.row.reason_key,
          entity_type: 'other',
          table: 'mkt_bronze_reason_catalog',
          revision: created.revision,
        },
      });
      logger.info('Bronze reason authored', ctx, {
        reasonKey: key,
        revision: created.revision,
      });
      return created.row as unknown as BronzeReason;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) throw error;
      logger.error('BronzeReasonCatalogService.createReason failed', ctx, {
        error: (error as Error).message,
        reasonKey: key,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Edit a reason's content/scope. reason_key is immutable — the key comes
   * from the route param and cannot be changed. Stamps revised_in_revision
   * on every write (§3.4: content, priority, and scope changes all bump).
   */
  async updateReason(reasonKey: string, input: Partial<BronzeReasonInput>, ctx?: RequestCtx): Promise<BronzeReason> {
    const key = (reasonKey || '').trim().toLowerCase();
    if ((input as any).reason_key && (input as any).reason_key !== key) {
      throw new ValidationError('reason_key is immutable — it cannot be changed after creation');
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mkt_bronze_reason_catalog.findUnique({
          where: { reason_key: key },
        });
        if (!existing) throw new NotFoundError(`bronze reason "${key}" not found`);

        const data: any = { updated_at: new Date() };
        if (input.label !== undefined) data.label = input.label.trim();
        if (input.definition !== undefined) data.definition = input.definition.trim();
        if (input.signals !== undefined) data.signals = input.signals as any;
        if (input.expected_vectors !== undefined) data.expected_vectors = input.expected_vectors as any;
        if (input.priority !== undefined) data.priority = input.priority;
        if (
          input.scope_category_key !== undefined ||
          input.scope_city !== undefined ||
          input.scope_state !== undefined ||
          input.scope_platform !== undefined
        ) {
          const scope = this.normalizeScope({
            scope_category_key: input.scope_category_key !== undefined ? input.scope_category_key : existing.scope_category_key,
            scope_city: input.scope_city !== undefined ? input.scope_city : existing.scope_city,
            scope_state: input.scope_state !== undefined ? input.scope_state : existing.scope_state,
            scope_platform: input.scope_platform !== undefined ? input.scope_platform : existing.scope_platform,
          });
          Object.assign(data, scope);
        }

        const revision = await this.bumpRevision(tx);
        data.revised_in_revision = revision;
        const row = await tx.mkt_bronze_reason_catalog.update({
          where: { reason_key: key },
          data,
        });
        return { row, revision };
      });

      await audit({
        actor: ctx?.userId ?? 'unknown',
        actorType: 'user',
        action: 'update',
        payload: {
          id: key,
          entity_type: 'other',
          table: 'mkt_bronze_reason_catalog',
          revision: updated.revision,
          changed: Object.keys(input).filter((k) => k !== 'reason_key'),
        },
      });
      return updated.row as unknown as BronzeReason;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      logger.error('BronzeReasonCatalogService.updateReason failed', ctx, {
        error: (error as Error).message,
        reasonKey: key,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Deprecate a reason — the only escape hatch in an additive catalog
   * (§3.4/§3.5.6). Optionally point superseded_by at the canonical reason a
   * duplicate retires into.
   */
  async deprecateReason(
    reasonKey: string,
    opts: { deprecatedReason?: string | null; supersededBy?: string | null },
    ctx?: RequestCtx,
  ): Promise<BronzeReason> {
    const key = (reasonKey || '').trim().toLowerCase();
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mkt_bronze_reason_catalog.findUnique({
          where: { reason_key: key },
        });
        if (!existing) throw new NotFoundError(`bronze reason "${key}" not found`);
        if (existing.deprecated_in_revision !== null) {
          throw new ConflictError(`bronze reason "${key}" is already deprecated (revision ${existing.deprecated_in_revision})`);
        }

        const supersededBy = opts.supersededBy?.trim().toLowerCase() || null;
        if (supersededBy) {
          if (supersededBy === key) {
            throw new ValidationError('superseded_by cannot point at the reason being deprecated');
          }
          const target = await tx.mkt_bronze_reason_catalog.findUnique({
            where: { reason_key: supersededBy },
            select: { deprecated_in_revision: true },
          });
          if (!target) {
            throw new ValidationError(`superseded_by target "${supersededBy}" does not exist`);
          }
          if (target.deprecated_in_revision !== null) {
            throw new ValidationError(`superseded_by target "${supersededBy}" is itself deprecated — point at the canonical reason`);
          }
        }

        const revision = await this.bumpRevision(tx);
        const row = await tx.mkt_bronze_reason_catalog.update({
          where: { reason_key: key },
          data: {
            deprecated_in_revision: revision,
            deprecated_reason: opts.deprecatedReason?.trim() || null,
            superseded_by: supersededBy,
            updated_at: new Date(),
          },
        });
        return { row, revision };
      });

      await audit({
        actor: ctx?.userId ?? 'unknown',
        actorType: 'user',
        action: 'update',
        payload: {
          id: key,
          entity_type: 'other',
          table: 'mkt_bronze_reason_catalog',
          deprecated_in_revision: updated.revision,
          superseded_by: updated.row.superseded_by,
        },
      });
      return updated.row as unknown as BronzeReason;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof ConflictError
      ) throw error;
      logger.error('BronzeReasonCatalogService.deprecateReason failed', ctx, {
        error: (error as Error).message,
        reasonKey: key,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // SERIALIZATION (D6 — stage-1 catalog injection)
  // ====================

  /**
   * Serialize scope-applicable catalog rows as the stage-1 hunt list. The
   * national bronze establishment prompt cannot snapshot a catalog it never
   * saw — this block IS the catalog it snapshots. Emits each reason's key,
   * label, definition, signals, expected vectors, and priority, plus the
   * catalog revision the snapshot is stamped at.
   */
  serializeCatalogBlock(rows: BronzeReason[], catalogRevision: number): string {
    if (!rows.length) return '';
    const lines: string[] = [
      '',
      '=== BRONZE REASON CATALOG ===',
      `Catalog revision: ${catalogRevision}`,
      'These are the discovery-blind-spot reasons your scan must cover. Each reason is a slot axis: hunt for the lowest-quality OPERATING category qualifier that matches the reason\'s signal vocabulary. Record the catalog_revision in your output.',
      '',
    ];
    for (const r of rows) {
      lines.push(`--- [${r.reason_key}] (priority ${r.priority}) ---`);
      lines.push(`Label: ${r.label}`);
      lines.push(`Definition: ${r.definition}`);
      if (r.signals?.length) {
        lines.push('Signals:');
        for (const s of r.signals) lines.push(`  - ${s}`);
      }
      if (r.expected_vectors?.length) {
        lines.push(`Expected vectors: ${r.expected_vectors.join('; ')}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // ====================
  // INTERNALS
  // ====================

  /**
   * Bump the single-row catalog counter inside a transaction and return the
   * new revision. Throws if the meta row is missing (migration not applied).
   */
  private async bumpRevision(tx: any): Promise<number> {
    const updated = await tx.mkt_bronze_catalog_meta.update({
      where: { id: 'catalog' },
      data: {
        catalog_revision: { increment: 1 },
        updated_at: new Date(),
      },
      select: { catalog_revision: true },
    });
    return updated.catalog_revision;
  }

  /**
   * Normalize + validate scope fields on write (§3.5.1). A scope value that
   * fails to normalize is rejected, never silently stored. City and state
   * must be set together (§3.6.1: location scope is city + state).
   */
  private normalizeScope(input: Partial<BronzeReasonInput>): {
    scope_category_key: string | null;
    scope_city: string | null;
    scope_state: string | null;
    scope_platform: string | null;
  } {
    const categoryKey = input.scope_category_key
      ? normalizeCategoryKey(input.scope_category_key)
      : null;
    if (input.scope_category_key && !categoryKey) {
      throw new ValidationError(`scope_category_key "${input.scope_category_key}" does not normalize to a valid category key`);
    }

    const city = input.scope_city ? normalizeReferenceCity(input.scope_city) : null;
    const state = input.scope_state ? normalizeReferenceState(input.scope_state) : null;
    if (input.scope_city && !city) {
      throw new ValidationError(`scope_city "${input.scope_city}" does not normalize to a valid city`);
    }
    if (input.scope_state && !state) {
      throw new ValidationError(`scope_state "${input.scope_state}" does not normalize to a valid state`);
    }
    if ((city === null) !== (state === null)) {
      throw new ValidationError('scope_city and scope_state must be set together — location scope is city + state (§3.6.1)');
    }

    let platform: string | null = null;
    if (input.scope_platform) {
      const p = input.scope_platform.trim().toLowerCase();
      if (!p || p === 'all') {
        platform = null;
      } else if (!(BRONZE_SCOPE_PLATFORMS as readonly string[]).includes(p)) {
        throw new ValidationError(
          `scope_platform "${input.scope_platform}" is not in the gold platform vocabulary (${BRONZE_SCOPE_PLATFORMS.join(', ')})`,
        );
      } else {
        platform = p;
      }
    }

    return {
      scope_category_key: categoryKey,
      scope_city: city,
      scope_state: state,
      scope_platform: platform,
    };
  }
}
