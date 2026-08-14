/**
 * PromptComposerService — Runtime fragment composition for Intelligence scope
 *
 * Assembles the Intelligence Seek prompt from four fragment kinds (Option A —
 * GAP-P1):
 *   1. seek_category_base              — canonical Category Seek framework
 *   2. seek_intelligence_extension     — Intelligence amplification extension
 *   3. (profile block)                 — rendered dynamically from the active
 *                                        category profile (or generic fallback)
 *   4. seek_intelligence_focus_*       — focus modifier (emerging / competitive)
 *
 * The composer loads fragments from mkt_prompt_templates_list (prompt_type =
 * 'fragment'), renders the profile block via IntelligenceProfileService, and
 * returns the assembled body + resolution metadata.
 *
 * Design properties:
 *   - No category/focus-specific monolithic prompts. One base + one extension
 *     + one focus per focus type. The profile block is the only per-category
 *     variable, and it is rendered dynamically.
 *   - When no active profile exists, the generic fallback fragment is used
 *     instead of the profile block, and intelligence_mode = 'none'.
 *   - The assembled body is a single string — variable substitution happens
 *     downstream in renderTemplate() / resolvePrompt(), not here.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §5
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { MarketingPromptService } from '../MarketingPromptService';
import { IntelligenceProfileService, type IntelligenceProfile, type PromptResolution } from './IntelligenceProfileService';

export type IntelligenceFocus = 'emerging' | 'competitive';

export interface ComposedPrompt {
  body: string;
  resolution: PromptResolution;
  focus: IntelligenceFocus;
}

// Fragment kind constants — match the fragment_kind column in the seed script.
const FRAGMENT_KIND = {
  CATEGORY_BASE: 'seek_category_base',
  INTELLIGENCE_EXTENSION: 'seek_intelligence_extension',
  FOCUS_EMERGING: 'seek_intelligence_focus_emerging',
  FOCUS_COMPETITIVE: 'seek_intelligence_focus_competitive',
  GENERIC_FALLBACK: 'seek_intelligence_generic_fallback',
} as const;

export class PromptComposerService extends BaseService {
  private static instance: PromptComposerService;

  private constructor() {
    super();
  }

  static getInstance(): PromptComposerService {
    if (!PromptComposerService.instance) {
      PromptComposerService.instance = new PromptComposerService();
    }
    return PromptComposerService.instance;
  }

  /**
   * Compose an Intelligence-scope prompt from fragments + profile.
   *
   * Assembly order:
   *   1. Category Base fragment
   *   2. Intelligence Extension fragment
   *   3. Profile block (if active profile) OR Generic Fallback fragment (if none)
   *   4. Focus modifier fragment (emerging / competitive)
   *
   * Returns the assembled body + resolution metadata (profile_id, profile_version,
   * intelligence_mode) + focus.
   */
  async composeIntelligencePrompt(input: {
    category: string;
    focus: IntelligenceFocus;
  }, ctx?: RequestCtx): Promise<ComposedPrompt> {
    const promptService = MarketingPromptService.getInstance();
    const profileService = IntelligenceProfileService.getInstance();

    // 1. Load fragments
    const baseFragment = await this.loadFragment(promptService, FRAGMENT_KIND.CATEGORY_BASE, ctx);
    const extensionFragment = await this.loadFragment(promptService, FRAGMENT_KIND.INTELLIGENCE_EXTENSION, ctx);
    const focusFragment = await this.loadFragment(
      promptService,
      input.focus === 'emerging' ? FRAGMENT_KIND.FOCUS_EMERGING : FRAGMENT_KIND.FOCUS_COMPETITIVE,
      ctx,
    );

    if (!baseFragment) {
      throw new Error('Category Base fragment not found. Run: pnpm seed:intelligence-fragments');
    }
    if (!extensionFragment) {
      throw new Error('Intelligence Extension fragment not found. Run: pnpm seed:intelligence-fragments');
    }
    if (!focusFragment) {
      throw new Error(`Focus fragment not found for focus="${input.focus}". Run: pnpm seed:intelligence-fragments`);
    }

    // 2. Resolve active profile for the category
    const profile = await profileService.resolve(input.category, ctx);

    // 3. Build the profile block or generic fallback
    let profileSection: string;
    let resolution: PromptResolution;

    if (profile) {
      profileSection = profileService.renderProfileBlock(profile);
      resolution = {
        profile_id: profile.id,
        profile_version: profile.version,
        intelligence_mode: 'profile',
      };
    } else {
      const fallbackFragment = await this.loadFragment(promptService, FRAGMENT_KIND.GENERIC_FALLBACK, ctx);
      profileSection = fallbackFragment || '';
      resolution = {
        profile_id: null,
        profile_version: null,
        intelligence_mode: 'none',
      };
    }

    // 4. Assemble: base + extension + profile block + focus
    const body = [baseFragment, extensionFragment, profileSection, focusFragment]
      .filter((s) => s.length > 0)
      .join('\n\n');

    logger.info('Intelligence prompt composed', ctx, {
      category: input.category,
      focus: input.focus,
      intelligenceMode: resolution.intelligence_mode,
      profileId: resolution.profile_id,
      profileVersion: resolution.profile_version,
    });

    return { body, resolution, focus: input.focus };
  }

  /**
   * Load a fragment's body by fragment_kind. Returns empty string if not found
   * (caller decides whether missing fragment is fatal).
   */
  private async loadFragment(
    promptService: MarketingPromptService,
    fragmentKind: string,
    ctx?: RequestCtx,
  ): Promise<string> {
    const templates = await promptService.listTemplates({ fragmentKind, isActive: true }, ctx);
    if (templates.length === 0) return '';
    // Use the most recent active fragment (is_default desc, created_at desc —
    // matches listTemplates ordering).
    return templates[0].body;
  }
}

export default PromptComposerService.getInstance();
