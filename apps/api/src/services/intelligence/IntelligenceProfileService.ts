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

export interface IntelligenceProfile {
  id: string;
  category_key: string;
  category_name: string;
  version: number;
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
   * Normalized exact match on category_key; active version only.
   * Returns null on miss → caller uses generic fallback (intelligence_mode: 'none').
   *
   * Unchanged by GAP-P8 — the resolver only returns active profiles, so both
   * consumers pick up newly activated profiles for free.
   */
  async resolve(category: string, ctx?: RequestCtx): Promise<IntelligenceProfile | null> {
    const key = normalizeCategoryKey(category);
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.findFirst({
        where: {
          category_key: key,
          status: 'active',
        },
        orderBy: { version: 'desc' },
      });
      if (!profile) return null;
      return profile as IntelligenceProfile;
    } catch (error) {
      logger.error('IntelligenceProfileService.resolve failed', ctx, {
        error: (error as Error).message,
        categoryKey: key,
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
          pk_mkt_intelligence_profiles: { id: profileId, version },
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
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const id = input.id || generateIntelligenceProfileId();
    const categoryKey = normalizeCategoryKey(input.categoryKey);
    const status = input.status ?? 'draft';
    try {
      const profile = await this.prisma.mkt_intelligence_profiles.create({
        data: {
          id,
          category_key: categoryKey,
          category_name: input.categoryName,
          version: 1,
          configuration_json: input.configurationJson as any,
          status,
        },
      });
      logger.info('Intelligence profile created', ctx, {
        profileId: id,
        categoryKey,
        status,
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
   */
  async importAsDraft(input: {
    categoryKey: string;
    categoryName: string;
    configurationJson: IntelligenceProfileConfiguration;
    existingProfileId?: string;
  }, ctx?: RequestCtx): Promise<IntelligenceProfile> {
    const categoryKey = normalizeCategoryKey(input.categoryKey);
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
        // Check if a profile with this category_key already exists
        const existingByKey = await this.prisma.mkt_intelligence_profiles.findFirst({
          where: { category_key: categoryKey },
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
          configuration_json: input.configurationJson as any,
          status: 'draft',
        },
      });
      logger.info('Intelligence profile imported as draft', ctx, {
        profileId,
        categoryKey,
        version: nextVersion,
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
            pk_mkt_intelligence_profiles: { id: profileId, version },
          },
        });
        if (!draft) {
          throw new Error(`Profile ${profileId} v${version} not found`);
        }
        if (draft.status !== 'draft') {
          throw new Error(`Profile ${profileId} v${version} is not a draft (status: ${draft.status})`);
        }

        // 2. Retire any existing active version for this category_key
        await tx.mkt_intelligence_profiles.updateMany({
          where: {
            category_key: draft.category_key,
            status: 'active',
          },
          data: { status: 'retired', updated_at: new Date() },
        });

        // 3. Activate the draft
        const activated = await tx.mkt_intelligence_profiles.update({
          where: {
            pk_mkt_intelligence_profiles: { id: profileId, version },
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

        // 3. Create the new active version
        const created = await tx.mkt_intelligence_profiles.create({
          data: {
            id: profileId,
            category_key: latest.category_key,
            category_name: input.categoryName ?? latest.category_name,
            version: nextVersion,
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
  renderProfileBlock(profile: IntelligenceProfile): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];

    lines.push('');
    lines.push('=== CATEGORY INTELLIGENCE PROFILE ===');
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
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
  renderBusinessProfileBlock(profile: IntelligenceProfile): string {
    const config = profile.configuration_json as IntelligenceProfileConfiguration;
    const lines: string[] = [];

    lines.push('');
    lines.push('=== CATEGORY INTELLIGENCE (BUSINESS AUDIT AMPLIFICATION) ===');
    lines.push(`Category: ${profile.category_name}`);
    lines.push(`Profile: ${profile.id} v${profile.version}`);
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
