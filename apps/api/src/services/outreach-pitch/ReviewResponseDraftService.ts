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
import { buildReviewResponsePrompt } from './prompts';

// ─── Types ───────────────────────────────────────────────────────────────

export interface GenerateResponseInput {
  campaignId: string;
  reviewText: string;
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
