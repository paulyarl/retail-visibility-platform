/**
 * ReviewResponseDraftService — Owner response drafts for preview slots
 *
 * No persistence — returns a draft for the slot. The caller (PitchService)
 * is responsible for storing the pair in the pitch's review_pairs JSON.
 *
 * Dual path mirroring the opener/header/closer pattern:
 *   - generateResponse (Path 1): AI draft using campaign tone
 *   - importResponse  (Path 2): validate non-empty paste, return as-is
 *
 * The review text itself is never AI-generated — the operator pastes the
 * real public customer review from the platform browser page. Only the
 * owner response is drafted.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §5.4, §3.4
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import MarketingCampaignService from '../MarketingCampaignService';
import aiProviderFactory from '../ai-providers';
import { buildReviewResponsePrompt, buildPreviewSlotPrompt } from './prompts';

// ─── Types ───────────────────────────────────────────────────────────────

export interface GenerateResponseInput {
  campaignId: string;
  reviewText: string;
}

export interface GenerateSlotFixInput {
  campaignId: string;
  // The "evidence" half of the slot — the operator pastes the real public
  // state (a wrong listing, a missing CTA, a missing product presence). For
  // A1/A2/A5 this is the customer review text and the fix is the owner
  // response (legacy behavior).
  evidenceText: string;
  archetype: string;
  slotLabel?: string;
}

export interface ImportResponseInput {
  campaignId: string;
  reviewText: string;
  responseText: string;
}

export interface ReviewResponseDraft {
  review_text: string;
  response_text: string;
  response_source: 'ai' | 'external';
  response_ai_provider: string | null;
  response_ai_model: string | null;
  response_tokens_used: number;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class ReviewResponseDraftService extends BaseService {
  private static instance: ReviewResponseDraftService;

  private constructor() {
    super();
  }

  static getInstance(): ReviewResponseDraftService {
    if (!ReviewResponseDraftService.instance) {
      ReviewResponseDraftService.instance = new ReviewResponseDraftService();
    }
    return ReviewResponseDraftService.instance;
  }

  // ====================
  // GENERATE (Path 1 — AI draft using campaign tone)
  // ====================

  async generateResponse(
    input: GenerateResponseInput,
    ctx?: RequestCtx,
  ): Promise<ReviewResponseDraft> {
    const reviewText = input.reviewText.trim();
    if (!reviewText) {
      throw new Error('Review text cannot be empty');
    }

    const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
    if (!campaign) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }

    const businessName = campaign.business_name ?? 'your business';
    const tone = campaign.tone || 'short informal';
    const resolvedPrompt = buildReviewResponsePrompt(reviewText, businessName, tone);

    logger.info('Generating review response draft', ctx, {
      campaignId: input.campaignId,
      reviewLength: reviewText.length,
      tone,
    });

    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are drafting an owner response to a customer review for a small business. The response turns the review around — acknowledges the issue, names the specific fix, and invites the customer back. Follow the prompt instructions precisely. Output only the response — no preamble, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 200, // Responses are short (≤80 words); 200 tokens is generous
      temperature: 0.7,
    });

    const responseText = result.content.trim();
    const tokensUsed = result.usage?.totalTokens || 0;

    logger.info('Review response draft generated', ctx, {
      campaignId: input.campaignId,
      responseLength: responseText.length,
      tokensUsed,
      model: result.model,
    });

    return {
      review_text: reviewText,
      response_text: responseText,
      response_source: 'ai',
      response_ai_provider: result.model.split('-')[0] || 'unknown',
      response_ai_model: result.model,
      response_tokens_used: tokensUsed,
    };
  }

  // ====================
  // GENERATE SLOT FIX (archetype-aware preview-slot draft)
  // ====================
  //
  // Generalizes generateResponse beyond review responses. The 3-slot preview
  // is archetype-aware: A1/A2 draft owner responses, A3 drafts corrected
  // listing entries, A4 drafts CTA fixes, A6 drafts product-visibility fixes.
  // The wire format (ReviewResponseDraft) is reused — review_text holds the
  // evidence, response_text holds the fix — so PitchService.assemblePitch and
  // the renderer don't need to change shape.

  async generateSlotFix(
    input: GenerateSlotFixInput,
    ctx?: RequestCtx,
  ): Promise<ReviewResponseDraft> {
    const evidenceText = input.evidenceText.trim();
    if (!evidenceText) {
      throw new Error('Evidence text cannot be empty');
    }

    const campaign = await MarketingCampaignService.getCampaign(input.campaignId, ctx);
    if (!campaign) {
      throw new Error(`Campaign ${input.campaignId} not found`);
    }

    const businessName = campaign.business_name ?? 'your business';
    const tone = campaign.tone || 'short informal';
    const resolvedPrompt = buildPreviewSlotPrompt(
      input.archetype,
      evidenceText,
      businessName,
      tone,
      input.slotLabel,
    );

    logger.info('Generating preview-slot fix draft', ctx, {
      campaignId: input.campaignId,
      archetype: input.archetype,
      slotLabel: input.slotLabel ?? null,
      evidenceLength: evidenceText.length,
      tone,
    });

    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are drafting a concrete fix for a small business visibility gap. Follow the prompt instructions precisely. Output only the fix — no preamble, no explanation.',
        },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 200,
      temperature: 0.7,
    });

    const fixText = result.content.trim();
    const tokensUsed = result.usage?.totalTokens || 0;

    logger.info('Preview-slot fix draft generated', ctx, {
      campaignId: input.campaignId,
      archetype: input.archetype,
      fixLength: fixText.length,
      tokensUsed,
      model: result.model,
    });

    return {
      review_text: evidenceText,
      response_text: fixText,
      response_source: 'ai',
      response_ai_provider: result.model.split('-')[0] || 'unknown',
      response_ai_model: result.model,
      response_tokens_used: tokensUsed,
    };
  }

  // ====================
  // IMPORT (Path 2 — external paste)
  // ====================

  async importResponse(
    input: ImportResponseInput,
    ctx?: RequestCtx,
  ): Promise<ReviewResponseDraft> {
    const reviewText = input.reviewText.trim();
    const responseText = input.responseText.trim();
    if (!reviewText) {
      throw new Error('Review text cannot be empty');
    }
    if (!responseText) {
      throw new Error('Response text cannot be empty');
    }

    logger.info('Review response imported', ctx, {
      campaignId: input.campaignId,
      reviewLength: reviewText.length,
      responseLength: responseText.length,
    });

    return {
      review_text: reviewText,
      response_text: responseText,
      response_source: 'external',
      response_ai_provider: null,
      response_ai_model: null,
      response_tokens_used: 0,
    };
  }
}

export default ReviewResponseDraftService.getInstance();
