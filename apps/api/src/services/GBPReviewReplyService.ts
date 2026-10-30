/**
 * GBPReviewReplyService — Tier A AI draft generation for GBP review responses.
 *
 * Generates 3 distinct angle-variant drafts per review using the tone source
 * hierarchy (owner voice → category tone → campaign tone). Stores drafts in
 * gbp_reviews.ai_drafts (JSONB) and sets reply_status = 'AI_DRAFTED'.
 *
 * Entitlement gate: full 3-draft generation requires the `gbp_ai_response`
 * capability. Unentitled users get a single preview draft (draft-preview mode)
 * with an upgrade CTA. The feature key is registered in Phase 4; until then
 * the gate returns false and all users get preview mode. This is correct —
 * Phase 2 delivers the service, Phase 4 delivers the entitlement.
 *
 * Tier B autopilot (`runAutopilot`) is implemented but NOT wired to any job
 * in Phase 2. Phase 2.5 gates Tier B activation after a quality review.
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 2
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE2.md Task 3
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import aiProviderFactory from './ai-providers';
import { permissionServiceFactory } from './permissions/PermissionServiceFactory';
import { OwnerVoiceService } from './deliverable/OwnerVoiceService';
import { MarketingCategoryToneService } from './MarketingCategoryToneService';
import { buildGbpReviewReplyPrompt, buildGbpReviewReplyPreviewPrompt } from './gbp/prompts';
import { replyToReview } from './GBPAdvancedSync';
import { resolveGbpLocation } from '../lib/google/gbp-target';
import { emitGbpActivity } from '../lib/google/gbp-activity';
import { unifiedConfig } from '../config/unifiedConfig';

// ── Types ────────────────────────────────────────────────────────────────

export interface AiDraft {
  angle: string;
  text: string;
}

export interface GenerateDraftsResult {
  drafts: AiDraft[];
  previewMode: boolean;
  upgradeCta?: string;
}

/** Outcome of one Tier B autopilot pass for a tenant. */
export interface AutopilotResult {
  /** False when a gate blocked the pass (see `reason`). */
  activated: boolean;
  reason?: 'not_activated' | 'not_entitled' | 'merchant_opt_out' | 'daily_cap';
  scanned: number;
  published: number;
  skipped: number;
  failed: number;
}

/**
 * Pure draft scorer — picks the draft Tier B should auto-publish.
 *
 * Heuristic (no LLM call): reject placeholders and stubs, prefer replies in a
 * natural length band, and give a small edge to drafts that open with thanks.
 * Deterministic so it is unit-testable and reproducible.
 */
export function selectBestAutopilotDraft(drafts: AiDraft[]): AiDraft | null {
  const scored = drafts
    .filter((d) => typeof d?.text === 'string' && d.text.trim().length > 0)
    .map((draft) => {
      const text = draft.text.trim();
      let score = 0;
      const lower = text.toLowerCase();

      if (text.length < 40) score -= 100;
      if (/[{}]/.test(text) || lower.includes('todo') || lower.includes('lorem ipsum')) score -= 50;
      if (text.length >= 80 && text.length <= 600) score += 10;
      else score += 2;
      if (lower.includes('thank')) score += 3;

      return { draft: { ...draft, text }, score };
    });

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].draft;
}

// ── Service ──────────────────────────────────────────────────────────────

export class GBPReviewReplyService extends BaseService {
  private static instance: GBPReviewReplyService;

  private constructor() {
    super();
  }

  static getInstance(): GBPReviewReplyService {
    if (!GBPReviewReplyService.instance) {
      GBPReviewReplyService.instance = new GBPReviewReplyService();
    }
    return GBPReviewReplyService.instance;
  }

  // ── Entitlement gate ───────────────────────────────────────────────────

  /**
   * Check whether the tenant has the `gbp_ai_response` capability (hard
   * entitlement gate). Returns false until Phase 4 registers the feature key.
   */
  async isEntitled(tenantId: string): Promise<boolean> {
    try {
      return await permissionServiceFactory.hasFeature(tenantId, 'gbp_ai_response');
    } catch (error) {
      logger.warn('[GBPReviewReply] Entitlement check failed — defaulting to preview mode', undefined, {
        tenantId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // ── Tier A: generateDrafts ─────────────────────────────────────────────

  /**
   * Tier A: Generate 3 contextual tone-aware AI draft responses for a review.
   *
   * Flow:
   * 1. Load review from gbp_reviews (by reviewId + tenantId — cross-customer isolation)
   * 2. Load owner voice profile (PRIMARY tone source)
   * 3. Load category tone preset (SECONDARY augmentation)
   * 4. Load business context (business name + category)
   * 5. Build prompt via buildGbpReviewReplyPrompt()
   * 6. Single LLM call → parse 3 drafts
   * 7. Store drafts in gbp_reviews.ai_drafts as JSONB
   * 8. Set gbp_reviews.reply_status = 'AI_DRAFTED'
   * 9. Return drafts to caller
   *
   * If unentitled (gbp_ai_response not active), returns a single preview draft
   * with an upgrade CTA (draft-preview mode). The review row is NOT mutated
   * in preview mode.
   */
  async generateDrafts(tenantId: string, reviewId: string, ctx?: RequestCtx): Promise<GenerateDraftsResult> {
    try {
      // 1. Load review (tenant-scoped — cross-customer isolation)
      const review = await this.prisma.gbp_reviews.findFirst({
        where: { id: reviewId, tenant_id: tenantId },
      });
      if (!review) {
        throw new Error(`Review ${reviewId} not found for tenant ${tenantId}`);
      }

      // 2. Load business context from gbp_locations_list
      const location = review.location_id
        ? await this.prisma.gbp_locations_list.findFirst({
            where: { id: review.location_id, tenant_id: tenantId },
          })
        : await this.prisma.gbp_locations_list.findFirst({
            where: { tenant_id: tenantId },
          });

      const businessName = location?.business_name || location?.location_name || 'your business';
      const businessCategory = location?.category || 'local business';

      // 3. Load owner voice profile (PRIMARY tone source)
      // The owner voice profile is keyed by campaign_id. For GBP reviews we
      // look up the most recent GBP-scoped campaign for this tenant to find
      // the voice profile. If none exists, fall back to null (campaign tone).
      const gbpCampaign = await this.prisma.mkt_campaigns_list.findFirst({
        where: {
          tenant_id: tenantId,
          category: { in: ['gbp_optimization', 'review_management'] },
        },
        orderBy: { created_at: 'desc' },
        select: { id: true, category: true, tone: true },
      });

      let ownerVoiceProfile = null;
      if (gbpCampaign) {
        ownerVoiceProfile = await OwnerVoiceService.getInstance().getProfile(gbpCampaign.id, ctx);
      }

      // 4. Load category tone preset (SECONDARY augmentation)
      const categoryTonePresetRow = await MarketingCategoryToneService.getInstance().getPresetByCategory(businessCategory, ctx);
      const categoryTonePreset = categoryTonePresetRow
        ? { tone: categoryTonePresetRow.tone, description: categoryTonePresetRow.description }
        : null;

      const campaignTone = gbpCampaign?.tone ?? null;

      // 5. Build prompt input
      const promptInput = {
        reviewerName: review.reviewer_name || 'a customer',
        starRating: review.star_rating ?? 3,
        comment: review.comment,
        reviewTime: review.google_create_time ? review.google_create_time.toISOString() : null,
        businessName,
        businessCategory,
        ownerVoiceProfile: ownerVoiceProfile
          ? {
              person: ownerVoiceProfile.person,
              formality: ownerVoiceProfile.formality,
              humor: ownerVoiceProfile.humor,
              apologyStyle: ownerVoiceProfile.apologyStyle,
              signoffStyle: ownerVoiceProfile.signoffStyle,
              signature: ownerVoiceProfile.signature,
            }
          : null,
        categoryTonePreset,
        campaignTone,
      };

      // 6. Entitlement gate
      const entitled = await this.isEntitled(tenantId);

      if (!entitled) {
        // Draft-preview mode — single preview draft + upgrade CTA
        const previewPrompt = buildGbpReviewReplyPreviewPrompt(promptInput);
        const result = await aiProviderFactory.generateChatCompletion({
          messages: [
            {
              role: 'system',
              content: 'You are an expert at writing review responses that sound like the business owner. Return only valid JSON.',
            },
            { role: 'user', content: previewPrompt },
          ],
          maxTokens: 300,
          temperature: 0.7,
        });

        const content = result.content.trim();
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        const previewDraft: AiDraft = {
          angle: parsed.angle || 'preview',
          text: parsed.text,
        };

        logger.info('[GBPReviewReply] Generated preview draft (unentitled)', ctx, {
          tenantId,
          reviewId,
        });

        return {
          drafts: [previewDraft],
          previewMode: true,
          upgradeCta: 'Upgrade to GBP Pro to generate 3 tone-variant drafts and publish replies directly.',
        };
      }

      // 7. Full 3-draft generation
      const prompt = buildGbpReviewReplyPrompt(promptInput);
      const result = await aiProviderFactory.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at writing review responses that sound like the business owner. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        maxTokens: 800,
        temperature: 0.7,
      });

      const content = result.content.trim();
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      const drafts: AiDraft[] = Array.isArray(parsed) ? parsed : [parsed];

      // Validate we got 3 drafts with distinct angles
      const angles = new Set(drafts.map((d) => d.angle));
      if (drafts.length !== 3 || angles.size !== 3) {
        logger.warn('[GBPReviewReply] LLM returned unexpected draft count — padding/truncating', ctx, {
          tenantId,
          reviewId,
          draftCount: drafts.length,
          angles: Array.from(angles),
        });
      }

      // 8. Store drafts in gbp_reviews.ai_drafts + set reply_status
      await this.prisma.gbp_reviews.update({
        where: { id: reviewId },
        data: {
          ai_drafts: drafts as any,
          reply_status: 'AI_DRAFTED',
          updated_at: new Date(),
        },
      });

      logger.info('[GBPReviewReply] Generated 3 AI drafts (entitled)', ctx, {
        tenantId,
        reviewId,
        angles: drafts.map((d) => d.angle),
      });

      return {
        drafts,
        previewMode: false,
      };
    } catch (error) {
      logger.error('[GBPReviewReply] Failed to generate drafts', ctx, {
        tenantId,
        reviewId,
        error: (error as Error).message,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ── Tier B: runAutopilot ───────────────────────────────────────────────

  /**
   * Tier B: Autopilot — generates drafts and publishes the best-scoring one
   * as a reply without human review.
   *
   * Three gates must all pass before a single reply is published:
   *   1. `GBP_AUTOPILOT_ENABLED` — the Phase 2.5 activation flag (default OFF).
   *   2. `gbp_ai_response` entitlement (tier / BSaaS / grant / flexible).
   *   3. The merchant's own opt-in — `tenant_gbp_options_settings.gbp_autopilot_enabled`.
   *
   * Only reviews at or above the merchant's `gbp_autopilot_min_rating`
   * (default 5★) are auto-replied; lower ratings are left for a human. Each
   * pass publishes at most `GBP_AUTOPILOT_BATCH_LIMIT` replies (default 5) and
   * never touches a review that already has a reply or a non-NONE status.
   *
   * NOT scheduled — the `gbp-review-autopilot` job is a catalog-only entry
   * until the platform flips the flag (see jobs/gbpReviewAutopilot.ts).
   */
  async runAutopilot(tenantId: string, ctx?: RequestCtx): Promise<AutopilotResult> {
    const blocked = (reason: AutopilotResult['reason']): AutopilotResult => ({
      activated: false,
      reason,
      scanned: 0,
      published: 0,
      skipped: 0,
      failed: 0,
    });

    if (!unifiedConfig.gbpAutopilotEnabled) {
      logger.warn('[GBPReviewReply] runAutopilot skipped — Tier B not activated (Phase 2.5 gate)', ctx, { tenantId });
      return blocked('not_activated');
    }

    if (!(await this.isEntitled(tenantId))) {
      logger.info('[GBPReviewReply] runAutopilot skipped — gbp_ai_response not entitled', ctx, { tenantId });
      return blocked('not_entitled');
    }

    const prefs = await (this.prisma as any).tenant_gbp_options_settings?.findUnique({
      where: { tenant_id: tenantId },
      select: { gbp_autopilot_enabled: true, gbp_autopilot_min_rating: true },
    });

    // Consent precedence (DFY spec §4.3, Q8):
    //   managed_by='platform' + delegated_surfaces.reviews → default-on; only
    //     an explicit merchant veto (gbp_autopilot_enabled === false) blocks.
    //   DIY (managed_by='self') → requires merchant opt-in (=== true).
    const location = await resolveGbpLocation({ tenantId });
    const delegated =
      location?.managed_by === 'platform' &&
      (location.delegated_surfaces as any)?.reviews !== false;

    const vetoed = prefs?.gbp_autopilot_enabled === false;
    const optedIn = prefs?.gbp_autopilot_enabled === true;
    if (delegated ? vetoed : !optedIn) {
      logger.info('[GBPReviewReply] runAutopilot skipped — merchant consent gate', ctx, {
        tenantId,
        delegated,
        optedIn,
        vetoed,
      });
      return blocked('merchant_opt_out');
    }

    const minRating = prefs?.gbp_autopilot_min_rating ?? 5;
    const limit = unifiedConfig.gbpAutopilotBatchLimit;

    // Daily cap — autopilot_status='PUBLISHED' rows stamped today count
    // against the same batch limit so bursts can't exceed it across passes.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayPublished = await this.prisma.gbp_reviews.count({
      where: {
        tenant_id: tenantId,
        autopilot_status: 'PUBLISHED',
        reply_update_time: { gte: todayStart },
      },
    });
    const remaining = limit - todayPublished;
    if (remaining <= 0) {
      logger.info('[GBPReviewReply] runAutopilot skipped — daily cap reached', ctx, { tenantId, todayPublished });
      return blocked('daily_cap');
    }

    const now = new Date();
    const pending = await this.prisma.gbp_reviews.findMany({
      where: {
        tenant_id: tenantId,
        reply_status: 'NONE',
        review_reply: null,
        google_review_id: { not: null },
        star_rating: { gte: minRating },
        // Due-filter: rows stamped QUEUED publish only once due; pre-stamp
        // rows (null) are treated as due for backward compatibility.
        OR: [{ autopilot_due_at: { lte: now } }, { autopilot_due_at: null }],
      },
      orderBy: { google_create_time: 'asc' },
      take: remaining,
    });

    let published = 0;
    let skipped = 0;
    let failed = 0;

    for (const review of pending) {
      try {
        // Full 3-draft generation — we are entitled (checked above).
        const generated = await this.generateDrafts(tenantId, review.id, ctx);
        const best = selectBestAutopilotDraft(generated.drafts);
        if (!best || !review.google_review_id) {
          skipped++;
          continue;
        }

        const result = await replyToReview(tenantId, review.google_review_id, best.text);
        if (!result.success) {
          failed++;
          logger.warn('[GBPReviewReply] Autopilot publish failed', ctx, {
            tenantId,
            reviewId: review.id,
            error: result.error,
          });
          continue;
        }

        await this.prisma.gbp_reviews.update({
          where: { id: review.id },
          data: {
            review_reply: best.text,
            reply_status: 'PUBLISHED',
            is_replied: true,
            reply_update_time: new Date(),
            autopilot_status: 'PUBLISHED',
            updated_at: new Date(),
          },
        });
        await emitGbpActivity({
          tenantId,
          gbpLocationId: review.location_id ?? null,
          action: 'review_auto_replied',
          actor: 'autopilot',
          detail: { reviewId: review.id, starRating: review.star_rating },
        });
        published++;
      } catch (error) {
        failed++;
        logger.warn('[GBPReviewReply] Autopilot error on review', ctx, {
          tenantId,
          reviewId: review.id,
          error: (error as Error).message,
        });
      }

      // Be respectful to the Google API between publishes.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info('[GBPReviewReply] Autopilot pass complete', ctx, {
      tenantId,
      scanned: pending.length,
      published,
      skipped,
      failed,
    });

    return { activated: true, scanned: pending.length, published, skipped, failed };
  }
}

export default GBPReviewReplyService.getInstance();
