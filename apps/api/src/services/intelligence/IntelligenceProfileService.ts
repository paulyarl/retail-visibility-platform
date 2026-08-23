/**
 * IntelligenceProfileService — Category Intelligence Profile store + resolver
 *
 * Manages reusable, versioned, per-category discovery knowledge (spec §9–§13).
 * Profiles describe how a category can be discovered (Intelligence scope) AND
 * what evidence ecosystems matter when auditing a business in that category
 * (Business scope — vision §1B).
 *
 * Key design properties:
 *   - Immutable version rows (unlike prompt templates today). A new version
 *     is a new row; the old row is never mutated. Historical runs reference
 *     the exact version used (§43).
 *   - One active version per profile; one profile per category key (enforced
 *     via partial unique index on category_key WHERE status = 'active').
 *   - status: 'draft' | 'active' | 'retired' — draft-by-default with human
 *     activation (GAP-P8 normative rule 1). The resolver only returns active
 *     profiles, so both consumers (business audit resolution, intelligence
 *     discovery) pick up newly activated profiles for free.
 *
 * Category alignment rule (normative, §1B):
 *   - resolve() performs a normalized exact match (case/whitespace-insensitive)
 *     on category_key. No fuzzy/nearest-neighbor matching. No cross-category
 *     application, ever. A mismatched profile is actively harmful.
 *   - Miss → null → generic resolution, intelligence_mode: 'none'.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateIntelligenceProfileId } from '../../lib/id-generator';

// ─── Types ───────────────────────────────────────────────────────────────

export type IntelligenceProfileStatus = 'draft' | 'active' | 'retired';

/**
 * Intelligence focus type — defined here (not in PromptComposerService) to
 * avoid a circular import. PromptComposerService imports from this module,
 * so the type must originate here. PromptComposerService re-exports it for
 * backward compatibility.
 *
 * 'emerging' — discover low-visibility, hard-to-find businesses
 * 'competitive' — benchmark established, mainstream-visible market leaders
 * 'gold_standards' — establish/discover category-platform benchmark profiles
 *   (Gold Standard System — Sprint 0). Gold-standard profiles are
 *   city-agnostic and platform-focused; they sit at the top of the flow
 *   and are consumed by both intelligence establishment/discovery and the
 *   business audit as a benchmark.
 */
export type IntelligenceFocus = 'emerging' | 'competitive' | 'gold_standards';

/**
 * Role for gold-standard injection into prompts.
 *   - 'benchmark' → audit/seek prompt: compare the business against the gold standard
 *   - 'target' → fulfill prompt: produce fixes that move toward the gold standard
 *   - 'discovery' → gold-standard discovery scan: evaluate new candidates against
 *     the already-established expected fields and quality gates (do NOT re-derive)
 *   - 'discovery_benchmark' → emerging/competitive discovery scan: rate each
 *     discovered candidate against the established gold standard per-platform,
 *     aggregate gate failures, and produce platform-aware outreach
 *     recommendations. Introduces platform awareness into focus discovery scans
 *     (which were previously platform-agnostic). The gold standard is resolved
 *     via resolveGoldStandard(category, platform) so a campaign with
 *     intelligence_platform = 'google' rates candidates against google-specific
 *     expected fields.
 */
export type GoldStandardRole = 'benchmark' | 'target' | 'discovery' | 'discovery_benchmark';

export interface IntelligenceProfile {
  id: string;
  category_key: string;
  category_name: string;
  version: number;
  intelligence_focus: IntelligenceFocus;
  reference_city: string | null;
  reference_state: string | null;
  reference_platform: string | null;
  configuration_json: any;
  status: IntelligenceProfileStatus;
  created_at: Date;
  updated_at: Date;
}

export interface IntelligenceProfileConfiguration {
  terminology?: Record<string, string>;
  synonyms?: string[];
  subcategories?: string[];
  specialized_sources?: SpecializedSource[];
  discovery_patterns?: Record<string, any>;
  category_evidence_rules?: Record<string, any>;
  prohibited_inferences?: string[];
  category_signals?: string[];
  [key: string]: any;
}

export interface SpecializedSource {
  name: string;
  type: string;
  priority?: number;
  capabilities?: string[];
  limitations?: string[];
}

export interface PromptResolution {
  profile_id: string | null;
  profile_version: number | null;
  intelligence_mode: 'profile' | 'none';
  // Gold standard reference when a gold-standard block was injected into the
  // rendered prompt (discovery_benchmark role on emerging/competitive scans,
  // benchmark/target role on business audits, discovery role on gold-standard
  // discovery scans). Null when no gold standard was resolved.
  gold_standard_profile_id?: string | null;
  gold_standard_profile_version?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Normalize a category string for exact-match lookup against category_key.
 * Case/whitespace-insensitive. Also collapses underscores and hyphens to
 * spaces so that LLM-produced snake_case/kebab-case keys (e.g.
 * "beauty_supply") normalize to the same canonical form as the display
 * category (e.g. "Beauty Supply" → "beauty supply"). No fuzzy matching
 * (§1B normative rule).
 */
export function normalizeCategoryKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Normalize a city string for exact-match lookup against reference_city.
 * Case/whitespace-insensitive. Empty/whitespace input returns null so the
 * resolver treats it as "no city requested" (legacy/business-scope path).
 */
export function normalizeReferenceCity(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim().toLowerCase().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize a US state code for storage as reference_state. Uppercased,
 * whitespace-trimmed. Empty input returns null. Accepts 2-letter codes
 * (e.g. 'in' → 'IN'); does NOT validate against the state list — the
 * caller is responsible for sending a valid code.
 */
export function normalizeReferenceState(s: string | null | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class IntelligenceProfileService extends BaseService {
  private static instance: IntelligenceProfileService;

  private constructor() {
    super();
  }

  static getInstance(): IntelligenceProfileService {
    if (!IntelligenceProfileService.instance) {
      IntelligenceProfileService.instance = new IntelligenceProfileService();
    }
    return IntelligenceProfileService.instance;
  }

  // ====================
  // RESOLUTION (used by both business audit + intelligence discovery)
  // ====================

  /**
   * Resolve the active profile for a category.
   *
   * City-aware resolution (Migration 205 — Profile City Scoping):
   *   - If `city` is provided, first try an exact
   *     (category_key, reference_city, focus) match. This is the primary
   *     path for intelligence-scope discovery: a Zionsville discovery
   *     campaign resolves to the Zionsville-established profile, not the
   *     Indianapolis one.
   *   - If no city-specific profile exists, fall back to a city-agnostic
   *     profile (reference_city IS NULL) for the same (category, focus).
   *     This preserves backward compatibility for categories that only have
   *     a city-agnostic profile, and for legacy profiles we could not
   *     backfill. The fallback is logged so operators can detect when a
   *     discovery campaign is running on a city-agnostic (possibly
   *     city-contaminated) profile.
   *   - If no city-agnostic profile exists either, fall back to a
   *     category+focus match ignoring city (legacy pre-Migration-205
   *     behavior) and log a warning. This is the last-resort path that
   *     surfaces cross-city contamination — it exists only so a missing
   *     city-scoped profile does not silently produce generic fallback
   *     when a category+focus profile exists.
   *
   * Focus-aware resolution (Migration 202 — Profile Type Alignment):
   *   - If `focus` is provided, the focus filter is applied at every layer.
   *   - If `focus` is omitted (business-scope §1B path), the focus filter
   *     is dropped — business audits are category-aware, not focus-aware.
   *     City is still honored when provided so a business audit in
   *     Zionsville does not load an Indianapolis-biased profile block.
   *
   * Normalized exact match on category_key + reference_city; active version
   * only. Returns null on miss → caller uses generic fallback
   * (intelligence_mode: 'none').
   */
  async resolve(
    category: string,
    focus?: IntelligenceFocus,
    city?: string | null,
    platform?: string | null,
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    const normalizedPlatform = platform ? platform.trim().toLowerCase() || null : null;
    try {
      // Helper: build a where clause for the given (city, platform) combination.
      // focus is applied when provided.
      const buildWhere = (cityVal: string | null, platformVal: string | null) => {
        const w: any = {
          category_key: key,
          reference_city: cityVal,
          status: 'active',
        };
        if (focus) w.intelligence_focus = focus;
        if (platformVal) {
          w.reference_platform = platformVal;
        } else {
          w.reference_platform = null;
        }
        return w;
      };

      const tryFind = async (cityVal: string | null, platformVal: string | null): Promise<IntelligenceProfile | null> => {
        const found = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: buildWhere(cityVal, platformVal),
          orderBy: { version: 'desc' },
        });
        return found as IntelligenceProfile | null;
      };

      // ── Platform-aware resolution (Migration 236) ──────────────────────
      // The fallback chain narrows from most-specific to least-specific:
      //   1. (category, focus, city, platform)     — city + platform exact
      //   2. (category, focus, city, platform=null) — city exact, cross-platform
      //   3. (category, focus, city=null, platform) — city-agnostic, platform exact
      //   4. (category, focus, city=null, platform=null) — city-agnostic, cross-platform
      // After the platform-aware chain, fall through to the legacy
      // focus-only / category-only fallbacks (which ignore platform).
      if (normalizedPlatform) {
        // Step 1: city + platform exact
        if (normalizedCity) {
          const s1 = await tryFind(normalizedCity, normalizedPlatform);
          if (s1) return s1;
        }
        // Step 2: city exact, cross-platform
        if (normalizedCity) {
          const s2 = await tryFind(normalizedCity, null);
          if (s2) {
            logger.warn('Gold standard profile resolved via city+cross-platform fallback', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedPlatform: normalizedPlatform,
              resolvedPlatform: null, focus: focus ?? 'none', profileId: (s2 as any).id,
            });
            return s2;
          }
        }
        // Step 3: city-agnostic, platform exact
        const s3 = await tryFind(null, normalizedPlatform);
        if (s3) {
          if (normalizedCity) {
            logger.warn('Gold standard profile resolved via platform-only fallback — city contamination possible', ctx, {
              categoryKey: key, requestedCity: normalizedCity, requestedPlatform: normalizedPlatform,
              resolvedCity: null, focus: focus ?? 'none', profileId: (s3 as any).id,
            });
          }
          return s3;
        }
        // Step 4: city-agnostic, cross-platform
        const s4 = await tryFind(null, null);
        if (s4) {
          logger.warn('Gold standard profile resolved via cross-platform fallback — platform contamination possible', ctx, {
            categoryKey: key, requestedPlatform: normalizedPlatform,
            resolvedPlatform: null, focus: focus ?? 'none', profileId: (s4 as any).id,
          });
          return s4;
        }
        // Fall through to legacy fallbacks below (which ignore platform).
      }

      // ── Legacy resolution (pre-Migration-236, still used when platform is
      //    not requested or when the platform-aware chain found nothing) ───

      // 1. City-specific exact match (primary intelligence-scope path)
      if (normalizedCity) {
        const cityWhere: any = {
          category_key: key,
          reference_city: normalizedCity,
          status: 'active',
        };
        if (focus) cityWhere.intelligence_focus = focus;
        const exact = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: cityWhere,
          orderBy: { version: 'desc' },
        });
        if (exact) return exact as IntelligenceProfile;

        // 2. City-agnostic fallback for the same (category, focus)
        const agnosticWhere: any = {
          category_key: key,
          reference_city: null,
          status: 'active',
        };
        if (focus) agnosticWhere.intelligence_focus = focus;
        const agnostic = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: agnosticWhere,
          orderBy: { version: 'desc' },
        });
        if (agnostic) {
          logger.warn(
            'Intelligence profile resolved via city-agnostic fallback — city contamination possible',
            ctx,
            {
              categoryKey: key,
              requestedCity: normalizedCity,
              resolvedCity: null,
              focus: focus ?? 'none',
              profileId: (agnostic as any).id,
            },
          );
          return agnostic as IntelligenceProfile;
        }
      }

      // 3. Focus-specific match ignoring city (legacy / pre-Migration-205
      //    behavior). Reached when city is omitted, or when no city-specific
      //    AND no city-agnostic profile exists for the requested (city, focus).
      if (focus) {
        const exact = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: {
            category_key: key,
            intelligence_focus: focus,
            status: 'active',
          },
          orderBy: { version: 'desc' },
        });
        if (exact) {
          // If a city was requested but we landed here, the resolved profile
          // may be scoped to a different city — surface the mismatch.
          if (normalizedCity && (exact as any).reference_city && (exact as any).reference_city !== normalizedCity) {
            logger.warn(
              'Intelligence profile resolved via category+focus fallback — cross-city contamination likely',
              ctx,
              {
                categoryKey: key,
                requestedCity: normalizedCity,
                resolvedCity: (exact as any).reference_city,
                focus,
                profileId: (exact as any).id,
              },
            );
          } else if (normalizedCity) {
            logger.warn(
              'Intelligence profile resolved via focus fallback — type mismatch possible',
              ctx,
              {
                categoryKey: key,
                requestedCity: normalizedCity,
                requestedFocus: focus,
                resolvedFocus: (exact as any).intelligence_focus,
                profileId: (exact as any).id,
              },
            );
          }
          return exact as IntelligenceProfile;
        }

        // 4. Fallback: category-only match (legacy / pre-Migration-202 behavior)
        const fallback = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: { category_key: key, status: 'active' },
          orderBy: { version: 'desc' },
        });
        if (fallback) {
          logger.warn(
            'Intelligence profile resolved via focus fallback — type mismatch possible',
            ctx,
            {
              categoryKey: key,
              requestedFocus: focus,
              resolvedFocus: (fallback as any).intelligence_focus,
              profileId: (fallback as any).id,
            },
          );
        }
        return fallback as IntelligenceProfile | null;
      }

      // 5. No focus requested (business-scope §1B path) — category-only match.
      //    If a city was requested, prefer a city-specific profile; otherwise
      //    any active profile for the category.
      if (normalizedCity) {
        const cityProfile = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: { category_key: key, reference_city: normalizedCity, status: 'active' },
          orderBy: { version: 'desc' },
        });
        if (cityProfile) return cityProfile as IntelligenceProfile;
      }
      const profile = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { category_key: key, status: 'active' },
        orderBy: { version: 'desc' },
      });
      if (!profile) return null;
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.resolve failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
        focus: focus ?? 'none',
        city: normalizedCity ?? 'none',
        platform: normalizedPlatform ?? 'none',
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get a specific version of a profile (for historical fidelity, §43).
   * Immutable version rows — the exact version used by a historical run
   * is always retrievable.
   */
  async getVersion(profileId: string, version: number, ctx?: RequestCtx): Promise<IntelligenceProfile | null> {
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.findUnique({
        where: {
          id_version: { id: profileId, version },
        },
      });
      return profile as IntelligenceProfile | null;
    } catch (error) {
      logger.error('IntelligenceProfileService.getVersion failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // LISTING
  // ====================

  /**
   * List all active profiles (for admin UI).
   * Optional focus filter — e.g. 'gold_standards' to list only gold-standard profiles.
   */
  async listActive(focus?: IntelligenceFocus, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'active', ...(focus ? { intelligence_focus: focus } : {}) },
        orderBy: [{ category_key: 'asc' }, { version: 'desc' }],
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.listActive failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List all draft profiles awaiting activation (GAP-P8 — for admin UI).
   * Optional focus filter — e.g. 'gold_standards' to list only gold-standard drafts.
   */
  async listDrafts(focus?: IntelligenceFocus, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'draft', ...(focus ? { intelligence_focus: focus } : {}) },
        orderBy: [{ category_key: 'asc' }, { version: 'desc' }],
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.listDrafts failed', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get a profile with all its versions (for admin detail view).
   */
  async getProfileWithVersions(profileId: string, ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { id: profileId },
        orderBy: { version: 'desc' },
      });
      return profiles as IntelligenceProfile[];
    } catch (error) {
      logger.error('IntelligenceProfileService.getProfileWithVersions failed', ctx, {
        error: (error as Error).message,
        profileId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // CREATION + LIFECYCLE
  // ====================

  /**
   * Create a new profile (manual authoring path — version 1, status 'draft').
   * Used by the hand-seed script and the admin create route.
   */
  async createProfile(input: {
    id?: string;
    categoryKey: string;
    categoryName: string;
    configurationJson: IntelligenceProfileConfiguration;
    status?: IntelligenceProfileStatus;
    intelligenceFocus?: IntelligenceFocus;
    referenceCity?: string | null;
    referenceState?: string | null;
    referencePlatform?: string | null;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const id = input.id || generateIntelligenceProfileId();
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const status = input.status ?? 'draft';
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
    const referencePlatform = input.referencePlatform ? input.referencePlatform.trim().toLowerCase() || null : null;
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id,
          category_key: categoryKey,
          category_name: input.categoryName,
          version: 1,
          intelligence_focus: intelligenceFocus,
          reference_city: referenceCity,
          reference_state: referenceState,
          reference_platform: referencePlatform,
          configuration_json: input.configurationJson as any,
          status,
        },
      });
      logger.info('Intelligence profile created', ctx, {
        profileId: id,
        categoryKey,
        status,
        intelligenceFocus,
        referenceCity,
        referenceState,
        referencePlatform,
      });
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.createProfile failed', ctx, {
        error: (error as Error).message,
        categoryKey,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Import a profile as DRAFT from an external AI result (GAP-P8).
   * Called by the post-import hook when an intelligence_profile schema result
   * is imported via importExternalResult. Persists as status = 'draft'.
   * Does NOT activate — operator must explicitly call activateDraft().
   *
   * If a profile with the same id already exists, creates a new version number.
   * If no profile with the category_key exists, creates a new profile (version 1).
   *
   * The intelligenceFocus is read from the establishment campaign at import
   * time (Migration 202 — Profile Type Alignment) so the draft is born with
   * the correct type lineage. All versions of a profile id share the same focus.
   */
  async importAsDraft(input: {
    categoryKey: string;
    categoryName: string;
    configurationJson: IntelligenceProfileConfiguration;
    existingProfileId?: string;
    intelligenceFocus?: IntelligenceFocus;
    referenceCity?: string | null;
    referenceState?: string | null;
    referencePlatform?: string | null;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
    const referencePlatform = input.referencePlatform ? input.referencePlatform.trim().toLowerCase() || null : null;
    try {
      // Determine the profile id + next version number
      let profileId = input.existingProfileId;
      let nextVersion = 1;

      if (profileId) {
        // Existing profile — find the max version
        const existing = await this.prisma.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length > 0) {
          nextVersion = existing[0].version + 1;
        }
      } else {
        // Check if a profile with this (category_key, reference_city, focus,
        // reference_platform) already exists. City AND platform are part of
        // the identity tuple so a cross-platform establishment and a
        // google-specific establishment for the same (category, focus) get
        // distinct profile ids.
        const findWhere: any = {
          category_key: categoryKey,
          intelligence_focus: intelligenceFocus,
        };
        if (referenceCity) {
          findWhere.reference_city = referenceCity;
        } else {
          findWhere.reference_city = null;
        }
        if (referencePlatform) {
          findWhere.reference_platform = referencePlatform;
        } else {
          findWhere.reference_platform = null;
        }
        const existingByKey = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: findWhere,
          orderBy: { version: 'desc' },
        });
        if (existingByKey) {
          profileId = existingByKey.id;
          nextVersion = existingByKey.version + 1;
        } else {
          profileId = generateIntelligenceProfileId();
        }
      }

      const profile = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id: profileId,
          category_key: categoryKey,
          category_name: input.categoryName,
          version: nextVersion,
          intelligence_focus: intelligenceFocus,
          reference_city: referenceCity,
          reference_state: referenceState,
          reference_platform: referencePlatform,
          configuration_json: input.configurationJson as any,
          status: 'draft',
        },
      });
      logger.info('Intelligence profile imported as draft', ctx, {
        profileId,
        categoryKey,
        version: nextVersion,
        intelligenceFocus,
        referenceCity,
        referenceState,
        referencePlatform,
      });
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.importAsDraft failed', ctx, {
        error: (error as Error).message,
        categoryKey,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Activate a draft profile (GAP-P8 — operator-driven).
   * Flips draft → active; flips any previous active version to 'retired'.
   * Atomic transaction. After activation, the resolver picks up the profile
   * for free (no resolver code change).
   */
  async activateDraft(profileId: string, version: number, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Verify the draft exists
        const draft = await tx.mkt_intelligence_profiles.findUnique({
          where: {
            id_version: { id: profileId, version },
          },
        });
        if (!draft) {
          throw new Error(`Profile ${profileId} v${version} not found`);
        }
        if (draft.status !== 'draft') {
          throw new Error(`Profile ${profileId} v${version} is not a draft (status: ${draft.status})`);
        }

        // 2. Retire any existing active version for this
        //    (category_key, reference_city, focus) triple.
        //    Type-scoped (Migration 202): activating a competitive draft retires
        //    only the prior active competitive profile — the active emerging
        //    profile for the same category is untouched.
        //    City-scoped (Migration 205): activating a Zionsville draft retires
        //    only the prior active Zionsville profile — the active Indianapolis
        //    profile for the same (category, focus) is untouched. NULL
        //    reference_city is treated as a distinct scope (city-agnostic).
        //    State-scoped (Migration 229): reference_state is also matched so
        //    two profiles in the same city name across different states do
        //    not retire each other.
        const retireWhere: any = {
          category_key: draft.category_key,
          intelligence_focus: draft.intelligence_focus,
          status: 'active',
        };
        if (draft.reference_city) {
          retireWhere.reference_city = draft.reference_city;
        } else {
          retireWhere.reference_city = null;
        }
        if (draft.reference_state) {
          retireWhere.reference_state = draft.reference_state;
        } else {
          retireWhere.reference_state = null;
        }
        await tx.mkt_intelligence_profiles.updateMany({
          where: retireWhere,
          data: { status: 'retired', updated_at: new Date() },
        });

        // 3. Activate the draft
        const activated = await tx.mkt_intelligence_profiles.update({
          where: {
            id_version: { id: profileId, version },
          },
          data: { status: 'active', updated_at: new Date() },
        });

        return activated;
      });
      logger.info('Intelligence profile activated', ctx, {
        profileId,
        version,
        categoryKey: result.category_key,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.activateDraft failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Delete a draft profile version (GAP-P8 — operator-driven cleanup).
   *
   * Only drafts may be deleted. Active and retired versions are immutable
   * historical records (§43 — historical fidelity) and cannot be removed;
   * attempting to delete a non-draft version throws. Deleting the last
   * remaining version of a profile id effectively removes the profile from
   * the admin UI (no row left to list).
   *
   * Drafts are inert — they have never been referenced by a run, so there
   * are no downstream referential-integrity concerns.
   */
  async deleteDraft(profileId: string, version: number, ctx?: RequestCtx): Promise<{ id: string; version: number }> {
    try {
      const draft = await this.prisma.mkt_intelligence_profiles.findUnique({
        where: {
          id_version: { id: profileId, version },
        },
      });
      if (!draft) {
        throw new Error(`Profile ${profileId} v${version} not found`);
      }
      if (draft.status !== 'draft') {
        throw new Error(
          `Profile ${profileId} v${version} is not a draft (status: ${draft.status}) — only drafts can be deleted`,
        );
      }

      await this.prisma.mkt_intelligence_profiles.delete({
        where: {
          id_version: { id: profileId, version },
        },
      });

      logger.info('Intelligence profile draft deleted', ctx, {
        profileId,
        version,
        categoryKey: draft.category_key,
      });
      return { id: profileId, version };
    } catch (error) {
      logger.error('IntelligenceProfileService.deleteDraft failed', ctx, {
        error: (error as Error).message,
        profileId,
        version,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Publish a new version from operator-supplied JSON (manual authoring path).
   * Creates a new immutable version row, flips the previous active version to
   * 'retired', marks the new one 'active'. Atomic transaction.
   */
  async publishVersion(profileId: string, input: {
    categoryName?: string;
    configurationJson: IntelligenceProfileConfiguration;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Find the max version for this profile id
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${profileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        // 2. Retire any existing active version
        await tx.mkt_intelligence_profiles.updateMany({
          where: {
            id: profileId,
            status: 'active',
          },
          data: { status: 'retired', updated_at: new Date() },
        });

        // 3. Create the new active version — carry the focus + reference_city +
        //    reference_state from the latest version so all versions of a
        //    profile id share the same focus and city/state scope.
        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: input.categoryName ?? latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            configuration_json: input.configurationJson as any,
            status: 'active',
          },
        });

        return created;
      });
      logger.info('Intelligence profile version published', ctx, {
        profileId,
        version: result.version,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.publishVersion failed', ctx, {
        error: (error as Error).message,
        profileId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // GOLD STANDARD SLOT PROMOTION (per-platform candidate injection)
  // ====================

  /**
   * Promote a discovered candidate into a specific platform's gold-standard
   * slot on the active gold-standard profile. This is the operator-facing
   * "Add to {platform} slot" action — it replaces the manual JSON-surgery
   * workflow via publishVersion.
   *
   * Per-platform independence (architecture doc §"The discovery →
   * establishment relationship"): a candidate can be added to Google's slot
   * without being added to Yelp's. The candidate row in configuration_json
   * is shared, but each platform_evaluation has its own is_gold_standard
   * flag. This method flips only the target platform's flag.
   *
   * Rules:
   *   - Only gold-standard profiles (focus = 'gold_standards') have slots.
   *   - Only candidates flagged is_gold_standard = true by the analyst on
   *     the target platform can be promoted (operator curates, does not
   *     override the analyst's assessment).
   *   - Up to 4 gold-standard candidates per platform (cap enforced).
   *   - Idempotent: if the candidate is already in the profile with the
   *     target platform flagged gold-standard, returns the current active
   *     version without creating a new one.
   *   - If the candidate exists in the profile but the target platform's
   *     flag is false/null, flips it to true (the per-platform promotion
   *     case — adds to Google's slot without affecting Yelp's).
   *   - If the candidate is new, appends the full candidate object
   *     (preserving all platform_evaluations from the scan) with only the
   *     target platform's is_gold_standard set to true.
   *   - Creates a new active version (immutable version pattern — old
   *     active retires, new active with modified config takes over).
   *
   * Candidate matching: by business_name (case-insensitive, trimmed).
   * Addresses can be formatted differently across scans; business name is
   * the most stable key.
   */
  async addGoldStandardCandidate(profileId: string, input: {
    candidate: Record<string, any>;
    platform: string;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const platform = input.platform.trim().toLowerCase();
    const candidateName = (input.candidate.business_name || '').trim();

    if (!platform) {
      throw new Error('Platform is required');
    }
    if (!candidateName) {
      throw new Error('Candidate business_name is required');
    }

    try {
      // 1. Load the active version of this profile
      const active = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId, status: 'active' },
      });
      if (!active) {
        throw new Error(`Active profile ${profileId} not found`);
      }

      // 2. Validate this is a gold-standard profile
      if (active.intelligence_focus !== 'gold_standards') {
        throw new Error(
          `Profile ${profileId} is not a gold-standard profile (focus: ${active.intelligence_focus}). Only gold-standard profiles have platform slots.`,
        );
      }

      // 3. Validate the candidate has an is_gold_standard evaluation on the target platform
      const inputEvaluations: any[] = Array.isArray(input.candidate.platform_evaluations) ? input.candidate.platform_evaluations : [];
      const targetEval = inputEvaluations.find(
        (pe) => (pe.platform || '').trim().toLowerCase() === platform && pe.is_gold_standard === true,
      );
      if (!targetEval) {
        throw new Error(
          `Candidate "${candidateName}" was not flagged gold-standard on ${platform} by the analyst. Only analyst-flagged candidates can be promoted.`,
        );
      }

      // 4. Deep-clone the config and upsert the candidate
      const config = JSON.parse(JSON.stringify(active.configuration_json ?? {})) as Record<string, any>;
      const candidates: any[] = Array.isArray(config.candidates) ? config.candidates : [];

      // Find existing candidate by business_name (case-insensitive)
      const existingIdx = candidates.findIndex(
        (c) => (c.business_name || '').trim().toLowerCase() === candidateName.toLowerCase(),
      );

      if (existingIdx >= 0) {
        // Candidate already in profile — check if the target platform is already flagged
        const existing = candidates[existingIdx];
        const existingEvals: any[] = Array.isArray(existing.platform_evaluations) ? existing.platform_evaluations : [];
        const existingTargetEval = existingEvals.find(
          (pe) => (pe.platform || '').trim().toLowerCase() === platform,
        );

        if (existingTargetEval && existingTargetEval.is_gold_standard === true) {
          // Idempotent — already in slot. Return current active without new version.
          logger.info('Gold standard candidate already in slot (idempotent)', ctx, {
            profileId,
            candidateName,
            platform,
          });
          return active as IntelligenceProfile;
        }

        // Flip the target platform's flag to true (per-platform promotion).
        // If the platform_evaluation doesn't exist on the existing candidate,
        // append it from the input scan data.
        if (existingTargetEval) {
          existingTargetEval.is_gold_standard = true;
        } else {
          existingEvals.push({ ...targetEval });
          existing.platform_evaluations = existingEvals;
        }
      } else {
        // New candidate — append the full object from the scan, but ensure
        // only the target platform's is_gold_standard is true. Other
        // platform evaluations retain their scan-assigned flags (may be
        // false/null) so the operator can later promote to those platforms.
        const newCandidate = JSON.parse(JSON.stringify(input.candidate));
        const newEvals: any[] = Array.isArray(newCandidate.platform_evaluations) ? newCandidate.platform_evaluations : [];
        for (const pe of newEvals) {
          const pePlatform = (pe.platform || '').trim().toLowerCase();
          pe.is_gold_standard = pePlatform === platform ? true : (pe.is_gold_standard ?? false);
        }
        candidates.push(newCandidate);
      }

      config.candidates = candidates;

      // 5. Enforce the 4-per-platform cap (count after the upsert)
      const goldCountForPlatform = candidates.reduce((count, c) => {
        const evals: any[] = Array.isArray(c.platform_evaluations) ? c.platform_evaluations : [];
        return count + (evals.some((pe) =>
          (pe.platform || '').trim().toLowerCase() === platform && pe.is_gold_standard === true,
        ) ? 1 : 0);
      }, 0);

      if (goldCountForPlatform > 4) {
        throw new Error(
          `Platform ${platform} already has 4 gold-standard candidates. Remove one before adding another.`,
        );
      }

      // 6. Create a new active version with the modified config (immutable
      //    version pattern — same transaction as publishVersion).
      const result = await this.prisma.$transaction(async (tx) => {
        // Find the max version for this profile id
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${profileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        // Retire any existing active version
        await tx.mkt_intelligence_profiles.updateMany({
          where: { id: profileId, status: 'active' },
          data: { status: 'retired', updated_at: new Date() },
        });

        // Create the new active version — carry metadata from the latest
        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            reference_platform: latest.reference_platform,
            configuration_json: config as any,
            status: 'active',
          },
        });

        return created;
      });

      logger.info('Gold standard candidate promoted to platform slot', ctx, {
        profileId,
        version: result.version,
        candidateName,
        platform,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.addGoldStandardCandidate failed', ctx, {
        error: (error as Error).message,
        profileId,
        candidateName,
        platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Remove a candidate from a specific platform's gold-standard slot on the
   * active gold-standard profile. Flips is_gold_standard to false on the
   * target platform's evaluation for the matching candidate (by business_name,
   * case-insensitive). Creates a new active version.
   *
   * This is the inverse of addGoldStandardCandidate — it frees up a slot so
   * a new discovery can be promoted. The candidate row itself is NOT removed
   * from configuration_json.candidates (it may still be gold-standard on
   * other platforms); only the target platform's flag is flipped to false.
   *
   * Idempotent: if the candidate is not in the target platform's slot (flag
   * is already false/null or candidate not found), returns the current active
   * version without creating a new one.
   */
  async removeGoldStandardCandidate(profileId: string, input: {
    businessName: string;
    platform: string;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const platform = input.platform.trim().toLowerCase();
    const businessName = (input.businessName || '').trim();

    if (!platform) {
      throw new Error('Platform is required');
    }
    if (!businessName) {
      throw new Error('businessName is required');
    }

    try {
      // 1. Load the active version
      const active = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: { id: profileId, status: 'active' },
      });
      if (!active) {
        throw new Error(`Active profile ${profileId} not found`);
      }

      // 2. Validate gold-standard profile
      if (active.intelligence_focus !== 'gold_standards') {
        throw new Error(
          `Profile ${profileId} is not a gold-standard profile (focus: ${active.intelligence_focus}).`,
        );
      }

      // 3. Deep-clone config and find the candidate
      const config = JSON.parse(JSON.stringify(active.configuration_json ?? {})) as Record<string, any>;
      const candidates: any[] = Array.isArray(config.candidates) ? config.candidates : [];

      const existingIdx = candidates.findIndex(
        (c) => (c.business_name || '').trim().toLowerCase() === businessName.toLowerCase(),
      );

      if (existingIdx < 0) {
        // Candidate not in profile at all — idempotent
        logger.info('Gold standard candidate not in profile (idempotent remove)', ctx, {
          profileId, businessName, platform,
        });
        return active as IntelligenceProfile;
      }

      const existing = candidates[existingIdx];
      const existingEvals: any[] = Array.isArray(existing.platform_evaluations) ? existing.platform_evaluations : [];
      const existingTargetEval = existingEvals.find(
        (pe) => (pe.platform || '').trim().toLowerCase() === platform,
      );

      if (!existingTargetEval || existingTargetEval.is_gold_standard !== true) {
        // Not in this platform's slot — idempotent
        logger.info('Gold standard candidate not in platform slot (idempotent remove)', ctx, {
          profileId, businessName, platform,
        });
        return active as IntelligenceProfile;
      }

      // 4. Flip the flag to false
      existingTargetEval.is_gold_standard = false;
      config.candidates = candidates;

      // 5. Create a new active version
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.mkt_intelligence_profiles.findMany({
          where: { id: profileId },
          orderBy: { version: 'desc' },
          take: 1,
        });
        if (existing.length === 0) {
          throw new Error(`Profile ${profileId} not found`);
        }
        const latest = existing[0];
        const nextVersion = latest.version + 1;

        await tx.mkt_intelligence_profiles.updateMany({
          where: { id: profileId, status: 'active' },
          data: { status: 'retired', updated_at: new Date() },
        });

        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: latest.category_name,
            version: nextVersion,
            intelligence_focus: latest.intelligence_focus,
            reference_city: latest.reference_city,
            reference_state: latest.reference_state,
            reference_platform: latest.reference_platform,
            configuration_json: config as any,
            status: 'active',
          },
        });

        return created;
      });

      logger.info('Gold standard candidate removed from platform slot', ctx, {
        profileId,
        version: result.version,
        businessName,
        platform,
      });
      return result as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.removeGoldStandardCandidate failed', ctx, {
        error: (error as Error).message,
        profileId,
        businessName,
        platform,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PROMPT BLOCK RENDERING
  // ====================

  /**
   * Render the discovery-relevant slice of the profile into prompt text
   * for the Intelligence scope. Includes terminology, specialized sources
   * with capabilities/limitations, discovery patterns, category evidence
   * rules, prohibited inferences, and category signals.
   */
  renderProfileBlock(profile: IntelligenceProfile, targetCity?: string | null): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];
    const normalizedTarget = normalizeReferenceCity(targetCity);
    const profileCity = normalizeReferenceCity(profile.reference_city);

    lines.push('');
    lines.push('=== CATEGORY INTELLIGENCE PROFILE ===');
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (profileCity) {
      lines.push(`Reference city (profile established for): ${profileCity}`);
    } else {
      lines.push('Reference city: city-agnostic (no reference market recorded)');
    }
    if (normalizedTarget) {
      lines.push(`Target city (this discovery campaign): ${normalizedTarget}`);
      if (profileCity && profileCity !== normalizedTarget) {
        // Render-time city mismatch guard (Migration 205). The profile was
        // established for a different city than the one this discovery
        // campaign is targeting. The configuration_json may contain
        // reference-city-specific supplier names, business examples, and
        // discovery patterns that, if followed literally, would surface
        // businesses in the reference city rather than the target city.
        // Emit an explicit directive so the AI re-targets the profile's
        // concrete examples to the target city instead of copying them.
        lines.push('');
        lines.push('--- CITY RETARGETING DIRECTIVE ---');
        lines.push(`This profile was established for ${profileCity}, but this discovery`);
        lines.push(`campaign targets ${normalizedTarget}. The specialized sources,`);
        lines.push('discovery patterns, supplier names, business examples, and community');
        lines.push(`references below were drawn from the ${profileCity} market. Apply the`);
        lines.push(`profile's CATEGORY-LEVEL knowledge (terminology, evidence rules,`);
        lines.push('prohibited inferences, signal definitions, source TYPES and their');
        lines.push('capability/limitation contracts) to the target city, but do NOT');
        lines.push(`import ${profileCity}-specific business names, supplier retailer lists,`);
        lines.push(`or ${profileCity}-specific search strings as-is. Re-derive concrete`);
        lines.push(`discovery queries, supplier retailer lists, and community sources for`);
        lines.push(`${normalizedTarget}. Exclude businesses located in ${profileCity} from`);
        lines.push(`the qualifying set unless they also serve the ${normalizedTarget} market.`);
        lines.push('Classify every discovered business by location relative to the TARGET');
        lines.push(`city (${normalizedTarget}), not the profile's reference city.`);
      } else if (!profileCity) {
        // City-agnostic profile applied to a city-specific campaign. The
        // configuration_json may still contain incidental city references
        // from whatever market the establishment campaign happened to use.
        lines.push('');
        lines.push('--- CITY APPLICATION DIRECTIVE ---');
        lines.push('This profile is city-agnostic (no reference market recorded). Apply');
        lines.push(`its category-level knowledge to ${normalizedTarget}. If the profile`);
        lines.push('body contains any concrete city names, supplier retailer lists, or');
        lines.push('business examples, treat them as illustrative of the category, not as');
        lines.push(`discovery targets. Re-derive concrete discovery queries for ${normalizedTarget}.`);
      }
    }
    lines.push('');

    if (config.terminology && Object.keys(config.terminology).length > 0) {
      lines.push('--- Terminology ---');
      for (const [term, definition] of Object.entries(config.terminology)) {
        lines.push(`  ${term}: ${definition}`);
      }
      lines.push('');
    }

    if (config.synonyms && config.synonyms.length > 0) {
      lines.push(`--- Synonyms ---`);
      lines.push(`  ${config.synonyms.join(', ')}`);
      lines.push('');
    }

    if (config.specialized_sources && config.specialized_sources.length > 0) {
      lines.push('--- Specialized Sources ---');
      for (const src of config.specialized_sources) {
        lines.push(`  [${src.priority ?? '-'}] ${src.name} (${src.type})`);
        if (src.capabilities && src.capabilities.length > 0) {
          lines.push(`    Capabilities: ${src.capabilities.join('; ')}`);
        }
        if (src.limitations && src.limitations.length > 0) {
          lines.push(`    Limitations: ${src.limitations.join('; ')}`);
        }
      }
      lines.push('');
    }

    if (config.discovery_patterns && Object.keys(config.discovery_patterns).length > 0) {
      lines.push('--- Discovery Patterns ---');
      lines.push(JSON.stringify(config.discovery_patterns, null, 2));
      lines.push('');
    }

    if (config.category_evidence_rules && Object.keys(config.category_evidence_rules).length > 0) {
      lines.push('--- Category Evidence Rules ---');
      lines.push(JSON.stringify(config.category_evidence_rules, null, 2));
      lines.push('');
    }

    if (config.prohibited_inferences && config.prohibited_inferences.length > 0) {
      lines.push('--- PROHIBITED INFERENCES (do NOT make these) ---');
      for (const inf of config.prohibited_inferences) {
        lines.push(`  - ${inf}`);
      }
      lines.push('');
    }

    if (config.category_signals && config.category_signals.length > 0) {
      lines.push('--- Category Signals ---');
      lines.push(`  ${config.category_signals.join(', ')}`);
      lines.push('');
    }

    lines.push('=== END CATEGORY INTELLIGENCE PROFILE ===');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Render the audit-relevant slice of the profile into prompt text for
   * business-scope resolution (§1B). Shares section renderers with
   * renderProfileBlock but with different sections enabled — includes
   * terminology, specialized sources + capability/limitation contracts,
   * category evidence rules, prohibited inferences, and category signals.
   * Excludes discovery patterns (not relevant for business audits).
   */
  renderBusinessProfileBlock(
    profile: IntelligenceProfile,
    targetCity?: string | null,
    headerTitle?: string,
    headerDirective?: string | null,
  ): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];
    const normalizedTarget = normalizeReferenceCity(targetCity);
    const profileCity = normalizeReferenceCity(profile.reference_city);

    lines.push('');
    lines.push(`=== ${headerTitle ?? 'CATEGORY INTELLIGENCE (BUSINESS AUDIT AMPLIFICATION)'} ===`);
    if (headerDirective) {
      lines.push(headerDirective);
      lines.push('');
    }
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (profileCity) {
      lines.push(`Reference city (profile established for): ${profileCity}`);
    }
    if (normalizedTarget && profileCity && profileCity !== normalizedTarget) {
      lines.push(`Target city (this business audit): ${normalizedTarget}`);
      lines.push('');
      lines.push('--- CITY RETARGETING DIRECTIVE ---');
      lines.push(`This profile was established for ${profileCity}, but this business audit`);
      lines.push(`targets a business in ${normalizedTarget}. Apply the category-level`);
      lines.push('evidence rules, terminology, and signal definitions, but do NOT import');
      lines.push(`${profileCity}-specific supplier names or business examples as evidence`);
      lines.push(`about the ${normalizedTarget} business under audit.`);
    }
    lines.push('');

    if (config.terminology && Object.keys(config.terminology).length > 0) {
      lines.push('--- Terminology ---');
      for (const [term, definition] of Object.entries(config.terminology)) {
        lines.push(`  ${term}: ${definition}`);
      }
      lines.push('');
    }

    if (config.specialized_sources && config.specialized_sources.length > 0) {
      lines.push('--- Specialized Sources (use these for evidence corroboration) ---');
      for (const src of config.specialized_sources) {
        lines.push(`  [${src.priority ?? '-'}] ${src.name} (${src.type})`);
        if (src.capabilities && src.capabilities.length > 0) {
          lines.push(`    Capabilities: ${src.capabilities.join('; ')}`);
        }
        if (src.limitations && src.limitations.length > 0) {
          lines.push(`    Limitations: ${src.limitations.join('; ')}`);
        }
      }
      lines.push('');
    }

    if (config.category_evidence_rules && Object.keys(config.category_evidence_rules).length > 0) {
      lines.push('--- Category Evidence Rules ---');
      lines.push(JSON.stringify(config.category_evidence_rules, null, 2));
      lines.push('');
    }

    if (config.prohibited_inferences && config.prohibited_inferences.length > 0) {
      lines.push('--- PROHIBITED INFERENCES (do NOT make these inferences for this category) ---');
      for (const inf of config.prohibited_inferences) {
        lines.push(`  - ${inf}`);
      }
      lines.push('');
    }

    if (config.category_signals && config.category_signals.length > 0) {
      lines.push('--- Category Signals (discovery signals relevant to this category) ---');
      lines.push(`  ${config.category_signals.join(', ')}`);
      lines.push('');
    }

    lines.push('=== END CATEGORY INTELLIGENCE ===');
    lines.push('');

    return lines.join('\n');
  }

  // ====================
  // GOLD STANDARD SYSTEM (Sprint 0)
  // ====================

  /**
   * Resolve the active gold-standard profile for a category.
   *
   * Gold-standard profiles are city-agnostic (reference_city = NULL) and
   * focus = 'gold_standards'. When `platform` is provided, the resolver
   * first looks for a platform-specific profile (reference_platform = platform),
   * then falls back to a cross-platform profile (reference_platform = NULL).
   *
   * Returns null on miss → caller uses degraded fallback (no benchmark).
   */
  async resolveGoldStandard(category: string, platform?: string | null, ctx?: RequestCtx): Promise<IntelligenceProfile | null> {
    return this.resolve(category, 'gold_standards', null, platform, ctx);
  }

  /**
   * Build the scan variables for a gold-standard scan prompt.
   *
   * The gold-standard scan template references {category} and {platform}.
   * This method ensures the platform variable is populated from the
   * campaign's intelligence_platform field, falling back to 'all'.
   */
  buildGoldStandardScanVariables(campaign: {
    category?: string | null;
    intelligence_platform?: string | null;
  }): Record<string, string> {
    return {
      category: campaign.category || '',
      platform: campaign.intelligence_platform || 'all',
    };
  }

  /**
   * Serialize a gold-standard profile into a prompt text block for
   * injection into audit (benchmark) and fulfill (target) prompts.
   *
   * The block includes:
   *   - A role-specific directive (benchmark vs target)
   *   - Expected fields (universal + per-platform)
   *   - Quality gates (non_negotiable + recommended)
   *   - Pattern exemplars (business name, quality score, destination URL,
   *     platform config)
   *
   * Returns an empty string if the profile has no gold-standard data
   * (no expected_fields and no candidates) so the caller can skip
   * injection without producing an empty section.
   */
  serializeGoldStandard(
    profile: IntelligenceProfile,
    role: GoldStandardRole,
  ): string {
    const config = profile.configuration_json as any;
    if (!config) return '';

    const expectedFields = config.expected_fields;
    const candidates = config.candidates;
    if (!expectedFields && !candidates) return '';

    const lines: string[] = [];
    const roleLabel = role === 'benchmark'
      ? 'BENCHMARK'
      : role === 'target'
      ? 'TARGET'
      : role === 'discovery_benchmark'
      ? 'DISCOVERY BENCHMARK'
      : 'DISCOVERY CRITERIA';
    const roleAction = role === 'benchmark'
      ? 'Compare the business\'s actual profile against these expected fields and quality gates. Flag any field where the business\'s actual value differs from the expected value as a gap.'
      : role === 'target'
      ? 'Generate fix instructions that move the business\'s profile toward these expected field values. Use the pattern exemplar as the concrete adaptation source.'
      : role === 'discovery_benchmark'
      ? 'Rate each discovered candidate against these established expected fields and quality gates. For each candidate, evaluate per-platform: a candidate may meet the gold standard on one platform but fail on another. Flag gold_standard_match = true for the TOP candidates per platform relative to the pool and the existing benchmark exemplars — a candidate that is at least as strong as the existing benchmark on a platform qualifies, even if they do not pass every non_negotiable gate. Populate gold_standard_gate_results per candidate with per-gate pass/fail (informational — does NOT filter gold_standard_match). Do NOT re-derive expected_fields — the ones below are the rating benchmark. Aggregate per-platform gate failures into platform_analysis.platform_breakdown, and recommend a primary_platform for outreach based on where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform, not just the most-present platform). Populate platform_analysis.outreach_recommendation with platform-specific opportunities and a recommended_platform_focus that downstream business audits should target.'
      : 'Evaluate each discovered candidate against these established expected fields and quality gates. Flag is_gold_standard = true for the TOP candidates per platform (up to 4), relative to the candidate pool and the existing benchmark exemplars. A candidate that is at least as strong as the existing benchmark on a platform qualifies — they do NOT need to pass every non_negotiable gate. The quality_score and quality_gates_passed/failed capture the absolute quality signal. Do NOT re-derive expected_fields — the ones below are already established. Return the same expected_fields in your output (echoed from this profile) so downstream audits stay consistent.';

    lines.push('');
    lines.push(`=== GOLD STANDARD ${roleLabel} ===`);
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
    if (role === 'discovery_benchmark') {
      const platformLabel = profile.reference_platform
        ? profile.reference_platform
        : 'cross-platform (all platforms)';
      lines.push(`Platform scope: ${platformLabel}`);
    }
    lines.push('');
    lines.push(`DIRECTIVE: This is your ${roleLabel} for this category. ${roleAction}`);
    lines.push('');

    // Universal expected fields
    if (expectedFields?.universal) {
      const u = expectedFields.universal;
      lines.push('--- Universal Expected Fields ---');
      if (u.canonical_name) lines.push(`  Canonical name: ${u.canonical_name}`);
      if (u.canonical_address) lines.push(`  Canonical address: ${u.canonical_address}`);
      if (u.canonical_phone) lines.push(`  Canonical phone: ${u.canonical_phone}`);
      if (u.hours_present !== undefined) lines.push(`  Hours present: ${u.hours_present}`);
      if (u.website_present !== undefined) lines.push(`  Website present: ${u.website_present}`);
      if (u.fields && Array.isArray(u.fields)) {
        for (const f of u.fields) {
          lines.push(`  ${f.field}: ${f.description}${f.severity ? ` (${f.severity})` : ''}`);
        }
      }
      if (u.quality_gates && Array.isArray(u.quality_gates)) {
        lines.push('  Quality Gates:');
        for (const g of u.quality_gates) {
          lines.push(`    [${g.severity}] ${g.field}: ${g.description}`);
        }
      }
      lines.push('');
    }

    // Platform-specific expected fields
    if (expectedFields?.platforms) {
      for (const [platformKey, platformFields] of Object.entries(expectedFields.platforms)) {
        const pf = platformFields as any;
        lines.push(`--- Platform: ${platformKey} ---`);
        if (pf.primary_category) lines.push(`  Primary category: ${pf.primary_category}`);
        if (pf.additional_categories) lines.push(`  Additional categories: ${pf.additional_categories.join(', ')}`);
        if (pf.required_attributes) lines.push(`  Required attributes: ${pf.required_attributes.join(', ')}`);
        if (pf.recommended_attributes) lines.push(`  Recommended attributes: ${pf.recommended_attributes.join(', ')}`);
        if (pf.description_requirements) lines.push(`  Description requirements: ${pf.description_requirements}`);
        if (pf.page_type) lines.push(`  Page type: ${pf.page_type}`);
        if (pf.expected_photo_count !== undefined) lines.push(`  Expected photo count: ${pf.expected_photo_count}`);
        if (pf.branding_expectations) {
          const be = pf.branding_expectations;
          lines.push('  Branding expectations:');
          if (be.has_logo !== undefined) lines.push(`    Has logo: ${be.has_logo}`);
          if (be.has_cover_photo !== undefined) lines.push(`    Has cover photo: ${be.has_cover_photo}`);
          if (be.has_profile_photo !== undefined) lines.push(`    Has profile photo: ${be.has_profile_photo}`);
          if (be.photo_count !== undefined) lines.push(`    Photo count: ${be.photo_count}`);
          if (be.photo_types) lines.push(`    Photo types: ${be.photo_types.join(', ')}`);
        }
        if (pf.fields && Array.isArray(pf.fields)) {
          lines.push('  Fields:');
          for (const f of pf.fields) {
            lines.push(`    ${f.field}: ${f.description}${f.severity ? ` (${f.severity})` : ''}`);
          }
        }
        if (pf.quality_gates && Array.isArray(pf.quality_gates)) {
          lines.push('  Quality Gates:');
          for (const g of pf.quality_gates) {
            lines.push(`    [${g.severity}] ${g.field}: ${g.description}`);
          }
        }
        lines.push('');
      }
    }

    // Pattern exemplars (candidates flagged as gold standard)
    if (candidates && Array.isArray(candidates)) {
      const exemplars = candidates.filter((c: any) => {
        if (!c.platform_evaluations) return false;
        return c.platform_evaluations.some((pe: any) => pe.is_gold_standard === true);
      });
      if (exemplars.length > 0) {
        lines.push('--- Pattern Exemplars ---');
        for (const ex of exemplars) {
          lines.push(`  Business: ${ex.business_name}`);
          if (ex.city) lines.push(`    City: ${ex.city}`);
          if (ex.category_notes) lines.push(`    Notes: ${ex.category_notes}`);
          if (ex.platform_evaluations) {
            for (const pe of ex.platform_evaluations) {
              if (pe.is_gold_standard !== true) continue;
              lines.push(`    Platform: ${pe.platform}`);
              if (pe.profile_url) lines.push(`      Destination URL: ${pe.profile_url}`);
              if (pe.quality_score !== undefined && pe.quality_score !== null) {
                lines.push(`      Quality score: ${pe.quality_score}/10`);
              }
              if (pe.quality_rationale) lines.push(`      Rationale: ${pe.quality_rationale}`);
              if (pe.branding_artifacts) {
                const ba = pe.branding_artifacts;
                if (ba.has_logo) lines.push(`      Has logo: yes`);
                if (ba.has_cover_photo) lines.push(`      Has cover photo: yes`);
                if (ba.photo_count !== undefined && ba.photo_count !== null) {
                  lines.push(`      Photo count: ${ba.photo_count}`);
                }
              }
            }
          }
        }
        lines.push('');
      }
    }

    lines.push('=== END GOLD STANDARD ===');
    lines.push('');

    return lines.join('\n');
  }
}

export default IntelligenceProfileService.getInstance();
