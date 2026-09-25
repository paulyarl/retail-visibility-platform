/**
 * CategoryVocabularyService — the operator-selectable category union
 *
 * Loads the two lists the DirectoryCategorySelectorAdapter merges for the
 * operator dropdown, server-side:
 *   1. platform_categories (is_active) — the ~414 directory shelf labels
 *   2. mkt_service_categories_list (is_active) — registered labels, including
 *      analyst-registered categories AND marketing service packages (the
 *      table has no kind discriminator — see spec §2.3)
 * plus a third enrichment-ecosystem supplement:
 *   3. supplementLabels — distinct category names carried by the marketing
 *      module itself: mkt_campaigns_list.category + secondary_categories,
 *      directory_category_enrichment.category_name, and
 *      mkt_intelligence_profiles.category_name. These are labels operators
 *      created off-list at campaign creation ("Middle Eastern Grocery
 *      Store") — they already have live enriched pages, so the enrichment
 *      analyst should be able to align to them verbatim.
 *
 * Two consumers:
 *   - MarketingExecutionService injects the union into the category-
 *     identification seek prompt so is_known_category is judged against the
 *     real vocabulary instead of general knowledge.
 *   - The category-identification act endpoint calls isKnownLabel() before
 *     upsertCategory so a wrong/stale is_known flag cannot mint a duplicate
 *     vocab row (spec §4.6).
 *
 * Reads are cached for 5 minutes (mirroring MarketContextLoader). Each source
 * is loaded independently — a failure of one degrades that source to [] and
 * never throws, so the prompt render and the act flow are never blocked.
 *
 * Spec: docs/LocalBiz/CATEGORY_IDENTIFICATION_VOCAB_INJECTION_SPEC.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import MarketingServiceCategoryService from './MarketingServiceCategoryService';

export interface CategoryVocabulary {
  directoryLabels: string[];
  registeredLabels: string[];
  supplementLabels: string[];
}

interface RegisteredRow {
  value: string;
  label: string;
}

interface VocabularyCache {
  directory: string[];
  registered: RegisteredRow[];
  supplement: string[];
  expiresAt: number;
}

// Sentinel values that ride the required `category` column on non-category
// scopes — never a shelf label.
const SENTINEL_CATEGORIES = new Set(['__location__', '__all__']);

export class CategoryVocabularyService extends BaseService {
  private static instance: CategoryVocabularyService;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  private cache: VocabularyCache | null = null;

  private constructor() {
    super();
  }

  static getInstance(): CategoryVocabularyService {
    if (!CategoryVocabularyService.instance) {
      CategoryVocabularyService.instance = new CategoryVocabularyService();
    }
    return CategoryVocabularyService.instance;
  }

  /** Clear the in-memory cache (used by tests). */
  resetCache(): void {
    this.cache = null;
  }

  /**
   * Load both vocabulary lists. Per-source failure degrades that source to
   * an empty list — this method never throws.
   */
  async loadVocabulary(ctx?: RequestCtx): Promise<CategoryVocabulary> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return {
        directoryLabels: this.cache.directory,
        registeredLabels: this.cache.registered.map((r) => r.label),
        supplementLabels: this.cache.supplement,
      };
    }

    const [directory, registered, supplement] = await Promise.all([
      this.loadDirectoryLabels(ctx),
      this.loadRegisteredRows(ctx),
      this.loadSupplementLabels(ctx),
    ]);

    this.cache = {
      directory,
      registered,
      supplement,
      expiresAt: Date.now() + CategoryVocabularyService.CACHE_TTL_MS,
    };
    return {
      directoryLabels: directory,
      registeredLabels: registered.map((r) => r.label),
      supplementLabels: supplement,
    };
  }

  /**
   * Whether `label` is already in the operator-selectable union —
   * case-insensitive on the trimmed label. Returns false when the vocabulary
   * cannot be loaded (fail-open: callers fall back to flag-driven behaviour).
   */
  async isKnownLabel(label: string, ctx?: RequestCtx): Promise<boolean> {
    const needle = label.trim().toLowerCase();
    if (!needle) return false;
    const vocab = await this.loadVocabulary(ctx);
    return (
      vocab.directoryLabels.some((l) => l.trim().toLowerCase() === needle) ||
      vocab.registeredLabels.some((l) => l.trim().toLowerCase() === needle) ||
      vocab.supplementLabels.some((l) => l.trim().toLowerCase() === needle)
    );
  }

  /**
   * Look up a registered-vocab row by `value` (the slugified key). Used to
   * detect a slug collision where a proposed label would overwrite an
   * existing row's label via upsertCategory.
   */
  async findRegisteredValue(value: string, ctx?: RequestCtx): Promise<RegisteredRow | null> {
    const needle = value.trim();
    if (!needle) return null;
    await this.loadVocabulary(ctx);
    return this.cache?.registered.find((r) => r.value === needle) ?? null;
  }

  private async loadDirectoryLabels(ctx?: RequestCtx): Promise<string[]> {
    try {
      const rows = await this.prisma.platform_categories.findMany({
        where: { is_active: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((r) => r.name).filter((n): n is string => Boolean(n?.trim()));
    } catch (err) {
      logger.warn('Failed to load platform_categories vocabulary', ctx, {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async loadRegisteredRows(ctx?: RequestCtx): Promise<RegisteredRow[]> {
    try {
      // listCategories() rethrows on error — caught here so a sink failure
      // never takes down the directory list.
      const rows = await MarketingServiceCategoryService.listCategories(ctx);
      return rows
        .filter((r) => Boolean(r?.value?.trim()) && Boolean(r?.label?.trim()))
        .map((r) => ({ value: r.value, label: r.label }));
    } catch (err) {
      logger.warn('Failed to load registered category vocabulary', ctx, {
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Enrichment-ecosystem supplement — distinct category names that exist in
   * the marketing module regardless of platform_categories membership:
   *   - mkt_campaigns_list.category (operator-typed primary, e.g. a label
   *     created via the selector's allowCreateNew at campaign creation)
   *   - mkt_campaigns_list.secondary_categories (operator-added supplements)
   *   - directory_category_enrichment.category_name (an applied packet →
   *     a live category page exists for that label)
   *   - mkt_intelligence_profiles.category_name (an ACTIVE established
   *     category profile — retired/draft versions don't make a live page)
   * Sentinel placeholders (__location__, __all__) are excluded by key and
   * by name — location packets reuse these tables with a sentinel
   * category_key and the location label in category_name. Returned
   * unsorted/unpartitioned — the formatter partitions against the directory
   * and registered lists.
   */
  private async loadSupplementLabels(ctx?: RequestCtx): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRaw<{ name: string }[]>`
        SELECT DISTINCT name FROM (
          SELECT category AS name FROM mkt_campaigns_list
          UNION
          SELECT TRIM(sec) AS name
            FROM mkt_campaigns_list,
                 LATERAL unnest(secondary_categories) sec
          UNION
          SELECT category_name AS name FROM directory_category_enrichment
            WHERE category_key !~ '^__'
          UNION
          SELECT category_name AS name FROM mkt_intelligence_profiles
            WHERE category_key !~ '^__' AND status = 'active'
        ) names
        WHERE name IS NOT NULL
          AND BTRIM(name) <> ''
          AND name !~ '^__'
        ORDER BY name
      `;
      return rows
        .map((r) => r.name.trim())
        .filter((n) => n.length > 0 && !SENTINEL_CATEGORIES.has(n.toLowerCase()));
    } catch (err) {
      logger.warn('Failed to load enrichment supplement category vocabulary', ctx, {
        error: (err as Error).message,
      });
      return [];
    }
  }
}

export default CategoryVocabularyService.getInstance();
