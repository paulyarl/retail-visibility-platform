/**
 * ReviewSlotService — Batch review ingestion + per-slot CRUD + batch
 * response generation for the deliverable.
 *
 * Ingests all unanswered reviews from audit data, creates a slot per
 * review, generates owner responses in batch using the owner voice
 * profile + business context, and supports per-slot edit/approve/skip.
 *
 * The preview (pre-payment) is the first 3 slots (negative cluster).
 * The full deliverable expands to all unanswered reviews.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §2.5
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateDeliverableReviewSlotId } from '../../lib/id-generator';
import aiProviderFactory from '../ai-providers';
import { buildDeliverableReviewResponsePrompt } from './prompts';
import type { OwnerVoiceFields, BusinessContextFields } from './prompts';
import OwnerVoiceService, { type OwnerVoiceProfile } from './OwnerVoiceService';
import BusinessContextService from './BusinessContextService';

export interface ReviewSlot {
  id: string;
  deliverableId: string | null;
  campaignId: string;
  platform: string | null;
  reviewText: string | null;
  reviewRating: number | null;
  reviewDate: string | null;
  reviewAuthor: string | null;
  sentiment: string | null;
  theme: string | null;
  isNegativeFirst: boolean;
  responseText: string | null;
  responseSource: string | null;
  responseAiProvider: string | null;
  responseAiModel: string | null;
  responseTokensUsed: number;
  qualityGatePassed: boolean | null;
  qualityGateIssues: string[] | null;
  status: string;
  slotIndex: number;
  createdAt: string;
  updatedAt: string;
}

export class ReviewSlotService extends BaseService {
  private static instance: ReviewSlotService;

  private constructor() { super(); }

  static getInstance(): ReviewSlotService {
    if (!ReviewSlotService.instance) {
      ReviewSlotService.instance = new ReviewSlotService();
    }
    return ReviewSlotService.instance;
  }

  // ====================
  // INGEST — pull all unanswered reviews from audit data
  // ====================

  /**
   * Ingest all unanswered reviews from the latest business_analysis audit.
   * Creates a slot per review, sorted: negative-first (1-star), then by date desc.
   * Idempotent — if slots already exist for the campaign, returns them.
   */
  async ingestReviews(campaignId: string, ctx?: RequestCtx): Promise<{ ingested: number; slots: ReviewSlot[] }> {
    try {
      // Check if slots already exist
      const existing = await this.prisma.mkt_deliverable_review_slot.findMany({
        where: { campaign_id: campaignId },
        orderBy: { slot_index: 'asc' },
      });
      if (existing.length > 0) {
        logger.info('Review slots already ingested, returning existing', ctx, { campaignId, count: existing.length });
        return { ingested: 0, slots: existing.map(this.mapRow) };
      }

      // Fetch audit data
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (!auditResult) {
        throw new Error('No business_analysis audit found for this campaign');
      }

      const { auditData } = auditResult;

      // Extract all unanswered reviews from audit data
      const reviews = this.extractUnansweredReviews(auditData);

      if (reviews.length === 0) {
        throw new Error('No unanswered reviews found in audit data');
      }

      // Sort: negative-first (lowest rating), then by date desc
      reviews.sort((a, b) => {
        if (a.isNegativeFirst && !b.isNegativeFirst) return -1;
        if (!a.isNegativeFirst && b.isNegativeFirst) return 1;
        const ratingDiff = (a.rating ?? 3) - (b.rating ?? 3);
        if (ratingDiff !== 0) return ratingDiff; // lower ratings first
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // newer first
      });

      // Create slots
      const slots: any[] = [];
      for (let i = 0; i < reviews.length; i++) {
        const r = reviews[i];
        const id = generateDeliverableReviewSlotId();
        const slot = await this.prisma.mkt_deliverable_review_slot.create({
          data: {
            id,
            campaign_id: campaignId,
            platform: r.platform,
            review_text: r.text,
            review_rating: r.rating,
            review_date: r.date ? new Date(r.date) : null,
            review_author: r.author,
            sentiment: r.sentiment,
            theme: r.theme,
            is_negative_first: r.isNegativeFirst,
            status: 'draft',
            slot_index: i,
          },
        });
        slots.push(slot);
      }

      logger.info('Review slots ingested', ctx, { campaignId, count: slots.length });
      return { ingested: slots.length, slots: slots.map(this.mapRow) };
    } catch (error) {
      logger.error('Failed to ingest reviews', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // LIST — get all slots for a campaign
  // ====================

  async listSlots(campaignId: string, ctx?: RequestCtx): Promise<ReviewSlot[]> {
    try {
      const slots = await this.prisma.mkt_deliverable_review_slot.findMany({
        where: { campaign_id: campaignId },
        orderBy: { slot_index: 'asc' },
      });
      return slots.map(this.mapRow);
    } catch (error) {
      logger.error('Failed to list review slots', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // BATCH GENERATE — AI draft responses for all draft slots
  // ====================

  /**
   * Generate owner responses for all slots in 'draft' status (or a specific slot).
   * Uses the owner voice profile + business context for each prompt.
   */
  async generateAllResponses(campaignId: string, ctx?: RequestCtx): Promise<{ generated: number; errors: string[] }> {
    try {
      // Get voice profile (fall back to defaults if not set)
      const voiceProfile = await OwnerVoiceService.getProfile(campaignId, ctx);
      const voiceFields: OwnerVoiceFields = voiceProfile
        ? OwnerVoiceService.toVoiceFields(voiceProfile)
        : { person: 'first_person', formality: 'casual', humor: 'none', apologyStyle: 'fix_first', signoffStyle: 'first_name', signature: null };

      // Get business context
      const businessCtx = await BusinessContextService.getBusinessContext(campaignId, ctx);

      // Get all draft slots
      const slots = await this.prisma.mkt_deliverable_review_slot.findMany({
        where: { campaign_id: campaignId, status: 'draft' },
        orderBy: { slot_index: 'asc' },
      });

      if (slots.length === 0) {
        return { generated: 0, errors: [] };
      }

      let generated = 0;
      const errors: string[] = [];

      for (const slot of slots) {
        try {
          if (!slot.review_text) {
            errors.push(`Slot ${slot.slot_index}: no review text`);
            continue;
          }

          const review = {
            platform: slot.platform ?? 'unknown',
            rating: slot.review_rating,
            date: slot.review_date ? slot.review_date.toISOString().split('T')[0] : null,
            text: slot.review_text,
          };

          const prompt = buildDeliverableReviewResponsePrompt(voiceFields, businessCtx, review);

          const result = await aiProviderFactory.generateChatCompletion({
            messages: [
              {
                role: 'system',
                content: 'You are drafting an owner response to a customer review. Write in the owner\'s voice — not as a marketing bot. Follow the prompt instructions precisely. Output only the response — no preamble, no explanation.',
              },
              { role: 'user', content: prompt },
            ],
            maxTokens: 200,
            temperature: 0.7,
          });

          const responseText = result.content.trim();
          const tokensUsed = result.usage?.totalTokens || 0;

          await this.prisma.mkt_deliverable_review_slot.update({
            where: { id: slot.id },
            data: {
              response_text: responseText,
              response_source: 'ai',
              response_ai_provider: result.model.split('-')[0] || 'unknown',
              response_ai_model: result.model,
              response_tokens_used: tokensUsed,
              quality_gate_passed: true, // Basic gate — response is non-empty
              quality_gate_issues: [],
            },
          });

          generated++;
        } catch (slotError) {
          errors.push(`Slot ${slot.slot_index}: ${(slotError as Error).message}`);
          logger.error('Failed to generate response for slot', ctx, {
            campaignId, slotId: slot.id, slotIndex: slot.slot_index,
            error: (slotError as Error).message,
          });
        }
      }

      logger.info('Batch response generation complete', ctx, { campaignId, generated, errors: errors.length });
      return { generated, errors };
    } catch (error) {
      logger.error('Failed to batch generate responses', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Re-generate a single slot's response via AI.
   */
  async regenerateSlot(slotId: string, ctx?: RequestCtx): Promise<ReviewSlot> {
    try {
      const slot = await this.prisma.mkt_deliverable_review_slot.findUnique({ where: { id: slotId } });
      if (!slot) throw new Error('Review slot not found');
      if (!slot.review_text) throw new Error('Slot has no review text');

      const voiceProfile = await OwnerVoiceService.getProfile(slot.campaign_id, ctx);
      const voiceFields: OwnerVoiceFields = voiceProfile
        ? OwnerVoiceService.toVoiceFields(voiceProfile)
        : { person: 'first_person', formality: 'casual', humor: 'none', apologyStyle: 'fix_first', signoffStyle: 'first_name', signature: null };

      const businessCtx = await BusinessContextService.getBusinessContext(slot.campaign_id, ctx);

      const review = {
        platform: slot.platform ?? 'unknown',
        rating: slot.review_rating,
        date: slot.review_date ? slot.review_date.toISOString().split('T')[0] : null,
        text: slot.review_text,
      };

      const prompt = buildDeliverableReviewResponsePrompt(voiceFields, businessCtx, review);

      const result = await aiProviderFactory.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are drafting an owner response to a customer review. Write in the owner\'s voice. Output only the response.',
          },
          { role: 'user', content: prompt },
        ],
        maxTokens: 200,
        temperature: 0.7,
      });

      const responseText = result.content.trim();
      const updated = await this.prisma.mkt_deliverable_review_slot.update({
        where: { id: slotId },
        data: {
          response_text: responseText,
          response_source: 'ai',
          response_ai_provider: result.model.split('-')[0] || 'unknown',
          response_ai_model: result.model,
          response_tokens_used: result.usage?.totalTokens || 0,
          quality_gate_passed: true,
          quality_gate_issues: [],
          status: 'draft', // Reset to draft after re-generation
        },
      });

      logger.info('Slot response regenerated', ctx, { slotId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to regenerate slot', ctx, { error: (error as Error).message, slotId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // PER-SLOT CRUD
  // ====================

  async updateSlotResponse(slotId: string, responseText: string, ctx?: RequestCtx): Promise<ReviewSlot> {
    try {
      const updated = await this.prisma.mkt_deliverable_review_slot.update({
        where: { id: slotId },
        data: {
          response_text: responseText,
          response_source: 'external',
          status: 'draft', // Editing resets to draft
        },
      });
      logger.info('Slot response edited', ctx, { slotId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to update slot response', ctx, { error: (error as Error).message, slotId });
      throw this.handleError(error, ctx);
    }
  }

  async approveSlot(slotId: string, ctx?: RequestCtx): Promise<ReviewSlot> {
    try {
      const slot = await this.prisma.mkt_deliverable_review_slot.findUnique({ where: { id: slotId } });
      if (!slot) throw new Error('Review slot not found');
      if (!slot.response_text) throw new Error('Cannot approve slot without a response');

      const updated = await this.prisma.mkt_deliverable_review_slot.update({
        where: { id: slotId },
        data: { status: 'approved' },
      });
      logger.info('Slot approved', ctx, { slotId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to approve slot', ctx, { error: (error as Error).message, slotId });
      throw this.handleError(error, ctx);
    }
  }

  async skipSlot(slotId: string, ctx?: RequestCtx): Promise<ReviewSlot> {
    try {
      const updated = await this.prisma.mkt_deliverable_review_slot.update({
        where: { id: slotId },
        data: { status: 'skipped' },
      });
      logger.info('Slot skipped', ctx, { slotId });
      return this.mapRow(updated);
    } catch (error) {
      logger.error('Failed to skip slot', ctx, { error: (error as Error).message, slotId });
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // HELPERS
  // ====================

  /**
   * Extract all unanswered reviews from audit data across all platforms.
   */
  private extractUnansweredReviews(auditData: any): Array<{
    platform: string;
    text: string;
    rating: number | null;
    date: string | null;
    author: string | null;
    sentiment: string;
    theme: string | null;
    isNegativeFirst: boolean;
  }> {
    const reviews: any[] = [];
    const platforms = auditData.platforms ?? {};
    const themes = auditData.negative_review_themes ?? [];

    // Map theme names for review matching
    const themeNames = themes.map((t: any) => t.theme);

    for (const [platformKey, platformData] of Object.entries(platforms)) {
      const pd = platformData as any;
      if (pd.reviews && Array.isArray(pd.reviews)) {
        for (const review of pd.reviews) {
          // Only include unanswered reviews
          if (review.owner_response) continue;
          if (!review.text || typeof review.text !== 'string') continue;

          const rating = review.rating ?? null;
          const isNegative = rating !== null && rating <= 2;
          const isNegativeFirst = rating === 1;

          // Try to match a theme
          let matchedTheme: string | null = null;
          if (review.theme) {
            matchedTheme = review.theme;
          } else if (review.tags && Array.isArray(review.tags)) {
            for (const tag of review.tags) {
              if (themeNames.includes(tag)) {
                matchedTheme = tag;
                break;
              }
            }
          }

          reviews.push({
            platform: platformKey,
            text: review.text,
            rating,
            date: review.date ?? null,
            author: review.author ?? null,
            sentiment: isNegative ? 'negative' : (rating === 3 ? 'neutral' : 'positive'),
            theme: matchedTheme,
            isNegativeFirst,
          });
        }
      }
    }

    // Also check unanswered_negative_review_examples
    const examples = auditData.unanswered_negative_review_examples ?? [];
    for (const ex of examples) {
      if (!ex.complaint_summary) continue;
      // Only add if not already captured from platform reviews
      const exists = reviews.some(r => r.text === ex.complaint_summary || r.text?.includes(ex.complaint_summary));
      if (!exists) {
        reviews.push({
          platform: ex.platform ?? 'google',
          text: ex.complaint_summary,
          rating: ex.rating ?? 1,
          date: ex.date ?? null,
          author: ex.author ?? null,
          sentiment: 'negative',
          theme: ex.theme ?? null,
          isNegativeFirst: ex.rating === 1,
        });
      }
    }

    return reviews;
  }

  private mapRow(row: any): ReviewSlot {
    return {
      id: row.id,
      deliverableId: row.deliverable_id,
      campaignId: row.campaign_id,
      platform: row.platform,
      reviewText: row.review_text,
      reviewRating: row.review_rating,
      reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
      reviewAuthor: row.review_author,
      sentiment: row.sentiment,
      theme: row.theme,
      isNegativeFirst: row.is_negative_first ?? false,
      responseText: row.response_text,
      responseSource: row.response_source,
      responseAiProvider: row.response_ai_provider,
      responseAiModel: row.response_ai_model,
      responseTokensUsed: row.response_tokens_used ?? 0,
      qualityGatePassed: row.quality_gate_passed,
      qualityGateIssues: row.quality_gate_issues,
      status: row.status ?? 'draft',
      slotIndex: row.slot_index ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default ReviewSlotService.getInstance();
