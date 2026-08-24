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

  // ── Tier B: runAutopilot (IMPLEMENTED but NOT INVOKED in Phase 2) ──────

  /**
   * Tier B: Autopilot — automatically generates drafts AND publishes the
   * best-scoring draft as a reply without human review.
   *
   * IMPLEMENTED but NOT WIRED to any job in Phase 2. Phase 2.5 gates Tier B
   * activation after a quality review. Calling this method before Phase 2.5
   * activation is a no-op that logs a warning.
   */
  async runAutopilot(tenantId: string, ctx?: RequestCtx): Promise<void> {
    logger.warn('[GBPReviewReply] runAutopilot invoked but Tier B is not activated (Phase 2.5 gate)', ctx, {
      tenantId,
    });
    // Phase 2.5 will implement the actual autopilot logic here:
    // 1. Fetch all reviews with reply_status = 'NONE' for this tenant
    // 2. For each, generate drafts (Tier A)
    // 3. Score drafts (sentiment match, length, tone alignment)
    // 4. Publish the best-scoring draft via GBPAdvancedSync.replyToReview
    // 5. Set reply_status = 'PUBLISHED'
    // Until then, this is a no-op.
  }
}

export default GBPReviewReplyService.getInstance();
