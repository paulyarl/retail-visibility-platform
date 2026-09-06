/**
 * ProvingGroundDedupService — the identity ledger (Migration 262, spec §4.9).
 *
 * Persists operator verdicts on funnel-surfaced duplicate seed groups so the
 * signal clears permanently instead of re-surfacing every week:
 *
 *   - recordVerdict({seed_ids, match_key, verdict, merge_into?, rationale})
 *     upserts one row per surfaced group (seed_ids is the sorted canonical
 *     set, matching getCohortFunnel's ARRAY_AGG output).
 *   - 'same_entity' also merges the other seeds' business names into the
 *     merge_into seed's name_variants — verdicts accumulate canonical
 *     identity knowledge.
 *   - getCohortFunnel excludes verdict-covered groups (see the exclusion join
 *     in SeedFunnelAnalyticsService); duplicateSeedCount reports unannotated
 *     groups only.
 *
 * Pattern: singleton extends BaseService.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { ValidationError } from '../middleware/errorHandler';
import { generateDedupVerdictId } from '../lib/id-generator';

export type DedupMatchKey = 'phone' | 'address_city';
export type DedupVerdict = 'same_entity' | 'distinct';

export interface RecordVerdictInput {
  seedIds: string[];          // the surfaced group (sorted canonical set)
  matchKey: DedupMatchKey;
  verdict: DedupVerdict;
  mergeInto?: string;         // required when verdict = 'same_entity'
  rationale?: string;
}

class ProvingGroundDedupServiceClass extends BaseService {
  private static instance: ProvingGroundDedupServiceClass;
  private constructor() { super(); }
  static getInstance(): ProvingGroundDedupServiceClass {
    if (!ProvingGroundDedupServiceClass.instance) {
      ProvingGroundDedupServiceClass.instance = new ProvingGroundDedupServiceClass();
    }
    return ProvingGroundDedupServiceClass.instance;
  }

  /**
   * Record (or update) a verdict for a surfaced duplicate group.
   */
  async recordVerdict(input: RecordVerdictInput, ctx?: RequestCtx): Promise<any> {
    try {
      const seedIds = [...new Set(input.seedIds)].sort();
      if (seedIds.length < 2) {
        throw new ValidationError('verdict requires at least 2 seeds');
      }
      if (input.verdict === 'same_entity') {
        if (!input.mergeInto || !seedIds.includes(input.mergeInto)) {
          throw new ValidationError('same_entity verdict requires merge_into to be one of the group seeds');
        }
      }

      const id = generateDedupVerdictId();
      const row = await this.prisma.mkt_prospect_dedup_verdicts.upsert({
        where: { seed_ids_match_key: { seed_ids: seedIds, match_key: input.matchKey } },
        create: {
          id,
          seed_ids: seedIds,
          match_key: input.matchKey,
          verdict: input.verdict,
          merge_into: input.verdict === 'same_entity' ? input.mergeInto! : null,
          rationale: input.rationale ?? null,
          resolved_by: ctx?.userId ?? null,
          resolved_at: new Date(),
        },
        update: {
          verdict: input.verdict,
          merge_into: input.verdict === 'same_entity' ? input.mergeInto! : null,
          rationale: input.rationale ?? null,
          resolved_by: ctx?.userId ?? null,
          resolved_at: new Date(),
          updated_at: new Date(),
        },
      });

      // same_entity → merge the other seeds' identity into the survivor's
      // name_variants (identity ledger accumulation, spec §4.9).
      if (input.verdict === 'same_entity' && input.mergeInto) {
        await this.mergeNameVariants(input.mergeInto, seedIds);
      }

      logger.info('recordVerdict: recorded', ctx, {
        seedIds, matchKey: input.matchKey, verdict: input.verdict,
      });
      return row;
    } catch (error) {
      logger.error('recordVerdict failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List recorded verdicts (audit view).
   */
  async listVerdicts(ctx?: RequestCtx): Promise<any[]> {
    try {
      return await this.prisma.mkt_prospect_dedup_verdicts.findMany({
        orderBy: { resolved_at: 'desc' },
      });
    } catch (error) {
      logger.error('listVerdicts failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Merge the non-surviving seeds' business names (+ their existing
   * name_variants) into the survivor seed's name_variants.
   */
  private async mergeNameVariants(mergeInto: string, seedIds: string[]): Promise<void> {
    const others = seedIds.filter((s) => s !== mergeInto);
    // Collect names + existing variants from all seeds in the group.
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT dps.id, dps.name_variants, dl.business_name
      FROM directory_presence_seeds dps
      LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ANY(${others}::varchar[])
    `;
    const survivor = await this.prisma.directory_presence_seeds.findUnique({
      where: { id: mergeInto },
      select: { name_variants: true },
    });

    const merged = new Set<string>((survivor?.name_variants as string[] | null) ?? []);
    for (const r of rows) {
      if (r.business_name) merged.add(r.business_name);
      for (const v of (r.name_variants as string[] | null) ?? []) merged.add(v);
    }

    await this.prisma.directory_presence_seeds.update({
      where: { id: mergeInto },
      data: { name_variants: [...merged], updated_at: new Date() },
    });
  }
}

export default ProvingGroundDedupServiceClass.getInstance();
