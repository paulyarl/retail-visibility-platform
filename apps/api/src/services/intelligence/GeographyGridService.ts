/**
 * GeographyGridService — city-level geography grid cache.
 *
 * The discovery substrate's sweep units (ZIPs + corridors + adjacent
 * municipalities) are CATEGORY-INDEPENDENT: they describe the retail catchment
 * of a market, not a category. This service derives the grid ONCE per
 * (city, state) market and reuses it across every category's establishment and
 * discovery runs, so the same market does not get a slightly different ZIP set
 * per category.
 *
 * Write path: the establishment import hook upserts the profile's
 * `geography_grid` after a profile is persisted (derivation 'profile_import').
 * Read path: MarketingExecutionService reads the cached grid at prompt-render
 * time and injects it as the authoritative sweep units when the campaign itself
 * carries no ZIPs.
 *
 * Best-effort by design: a cache miss or a persistence failure must never block
 * a prompt render or an import.
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { normalizeCityKey, parseZipCodes, type GeographyGrid } from './geography-grid';

export type GeographyGridDerivation = 'campaign_zip_codes' | 'profile_import' | 'ai_derived';

const VALID_DERIVATIONS: ReadonlySet<string> = new Set([
  'campaign_zip_codes',
  'profile_import',
  'ai_derived',
]);

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Deterministic, readable id for a market (idempotent upserts). */
function gridId(cityKey: string): string {
  return `geo-${cityKey.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')}`;
}

/** Coerce an unknown jsonb blob into a normalized GeographyGrid. */
function normalizeGrid(raw: any, city: string, state: string): GeographyGrid {
  return {
    city: (raw?.city ?? city ?? null) || null,
    state: (raw?.state ?? state ?? null) || null,
    zips: Array.isArray(raw?.zips) ? asStringArray(raw.zips).map((z) => z.slice(0, 5)) : parseZipCodes(raw?.zips),
    corridors: asStringArray(raw?.corridors),
    adjacent_municipalities: asStringArray(raw?.adjacent_municipalities),
    radius_miles: typeof raw?.radius_miles === 'number' && Number.isFinite(raw.radius_miles)
      ? raw.radius_miles
      : null,
  };
}

export class GeographyGridService extends BaseService {
  private static instance: GeographyGridService;

  private constructor() {
    super();
  }

  static getInstance(): GeographyGridService {
    if (!GeographyGridService.instance) {
      GeographyGridService.instance = new GeographyGridService();
    }
    return GeographyGridService.instance;
  }

  /** Read the cached grid for a market. Returns null on miss (never throws). */
  async getGrid(
    city: string | null | undefined,
    state: string | null | undefined,
    zips?: string[] | null,
    ctx?: RequestCtx,
  ): Promise<GeographyGrid | null> {
    const cityKey = normalizeCityKey(city, state, zips);
    if (!cityKey) return null;
    try {
      const row = await this.prisma.mkt_geography_grids.findUnique({
        where: { city_key: cityKey },
      });
      if (!row) return null;
      return normalizeGrid(row.grid, row.city, row.state);
    } catch (err) {
      logger.warn('Geography grid cache read failed — falling back to derivation', ctx, {
        cityKey,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Upsert the grid for a market. Best-effort: failures are logged, never thrown,
   * so a cache write can never fail an establishment import.
   *
   * EXACT-STRING SEMANTICS: the row is keyed by `city+state` (no campaign ZIPs)
   * or `city+state+zips` (campaign ZIPs present). A ZIP-scoped grid and a
   * city-wide grid are distinct keys and never overwrite each other.
   */
  async upsertGrid(input: {
    city: string | null | undefined;
    state: string | null | undefined;
    zips?: string[] | null;
    grid: Partial<GeographyGrid> | null | undefined;
    derivation: GeographyGridDerivation;
    sourceProfileId?: string | null;
  }, ctx?: RequestCtx): Promise<void> {
    const cityKey = normalizeCityKey(input.city, input.state, input.zips);
    if (!cityKey) return;
    const city = (input.city ?? '').toString().trim();
    const state = (input.state ?? '').toString().trim();
    const grid = normalizeGrid(input.grid, city, state);
    // Only cache a grid that actually carries sweep units — an empty grid is
    // worse than a miss (it would suppress derivation on the next run).
    if (grid.zips.length === 0 && grid.corridors.length === 0 && grid.adjacent_municipalities.length === 0) {
      return;
    }
    const derivation = VALID_DERIVATIONS.has(input.derivation) ? input.derivation : 'ai_derived';
    try {
      await this.prisma.mkt_geography_grids.upsert({
        where: { city_key: cityKey },
        create: {
          id: gridId(cityKey),
          city_key: cityKey,
          city,
          state,
          grid: grid as any,
          derivation,
          source_profile_id: input.sourceProfileId ?? null,
        },
        update: {
          city,
          state,
          grid: grid as any,
          derivation,
          source_profile_id: input.sourceProfileId ?? null,
          updated_at: new Date(),
        },
      });
      logger.info('Geography grid cache upserted', ctx, {
        cityKey,
        derivation,
        zipCount: grid.zips.length,
      });
    } catch (err) {
      logger.warn('Geography grid cache write failed (non-fatal)', ctx, {
        cityKey,
        error: (err as Error).message,
      });
    }
  }
}

export default GeographyGridService;
