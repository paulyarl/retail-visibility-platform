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
 */
export type IntelligenceFocus = 'emerging' | 'competitive';

export interface IntelligenceProfile {
  id: string;
  category_key: string;
  category_name: string;
  version: number;
  intelligence_focus: IntelligenceFocus;
  reference_city: string | null;
  reference_state: string | null;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Normalize a category string for exact-match lookup against category_key.
 * Case/whitespace-insensitive. No fuzzy matching (§1B normative rule).
 */
export function normalizeCategoryKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
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
    ctx?: RequestCtx,
  ): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    const normalizedCity = normalizeReferenceCity(city);
    try {
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
   */
  async listActive(ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'active' },
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
   */
  async listDrafts(ctx?: RequestCtx): Promise<IntelligenceProfile[]> {
    try {
      const profiles = await this.prisma.mkt_intelligence_profiles.findMany({
        where: { status: 'draft' },
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
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const id = input.id || generateIntelligenceProfileId();
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const status = input.status ?? 'draft';
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
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
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const intelligenceFocus = input.intelligenceFocus ?? 'emerging';
    const referenceCity = normalizeReferenceCity(input.referenceCity ?? null);
    const referenceState = normalizeReferenceState(input.referenceState ?? null);
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
        // Check if a profile with this (category_key, reference_city, focus)
        // already exists. City is part of the identity tuple so an
        // Indianapolis-established profile and a Zionsville-established
        // profile for the same (category, focus) get distinct profile ids.
        const findWhere: any = {
          category_key: categoryKey,
          intelligence_focus: intelligenceFocus,
        };
        if (referenceCity) {
          findWhere.reference_city = referenceCity;
        } else {
          findWhere.reference_city = null;
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
}

export default IntelligenceProfileService.getInstance();
