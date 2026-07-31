/**
 * OwnerVoiceService — Per-campaign owner voice calibration
 *
 * AI-inferred from existing owner responses (if >= 3 exist on GBP/Yelp),
 * operator-overrideable. Falls back to manual profile if no existing
 * responses. The voice profile feeds every review response draft prompt
 * so responses sound like the owner, not a bot.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_deliverable_construction_sprint_plan.md §2.4
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateOwnerVoiceProfileId } from '../../lib/id-generator';
import aiProviderFactory from '../ai-providers';
import { buildVoiceInferencePrompt } from './prompts';
import type { OwnerVoiceFields } from './prompts';

export interface OwnerVoiceProfile {
  id: string;
  campaignId: string;
  person: string | null;
  formality: string | null;
  humor: string | null;
  apologyStyle: string | null;
  signoffStyle: string | null;
  signature: string | null;
  inferredFromCount: number;
  inferredSample: string | null;
  operatorOverrides: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerVoiceInput {
  person?: string;
  formality?: string;
  humor?: string;
  apologyStyle?: string;
  signoffStyle?: string;
  signature?: string;
}

export interface VoiceInferenceResult {
  person: string;
  formality: string;
  humor: string;
  apologyStyle: string;
  signoffStyle: string;
  signature: string | null;
  inferredFromCount: number;
  inferredSample: string;
}

export class OwnerVoiceService extends BaseService {
  private static instance: OwnerVoiceService;

  private constructor() { super(); }

  static getInstance(): OwnerVoiceService {
    if (!OwnerVoiceService.instance) {
      OwnerVoiceService.instance = new OwnerVoiceService();
    }
    return OwnerVoiceService.instance;
  }

  /**
   * Get the voice profile for a campaign (or null if not yet created).
   */
  async getProfile(campaignId: string, ctx?: RequestCtx): Promise<OwnerVoiceProfile | null> {
    try {
      const row = await this.prisma.mkt_owner_voice_profile.findUnique({
        where: { campaign_id: campaignId },
      });
      if (!row) return null;
      return this.mapRow(row);
    } catch (error) {
      logger.error('Failed to get owner voice profile', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Create or update the voice profile for a campaign (manual entry or
   * operator override of AI-inferred values).
   */
  async upsertProfile(campaignId: string, input: OwnerVoiceInput, ctx?: RequestCtx): Promise<OwnerVoiceProfile> {
    try {
      const existing = await this.prisma.mkt_owner_voice_profile.findUnique({
        where: { campaign_id: campaignId },
      });

      const data: any = {};
      if (input.person !== undefined) data.person = input.person;
      if (input.formality !== undefined) data.formality = input.formality;
      if (input.humor !== undefined) data.humor = input.humor;
      if (input.apologyStyle !== undefined) data.apology_style = input.apologyStyle;
      if (input.signoffStyle !== undefined) data.signoff_style = input.signoffStyle;
      if (input.signature !== undefined) data.signature = input.signature;

      if (existing) {
        // Track which fields the operator overrode
        const overrides: any = { ...(existing.operator_overrides as any || {}) };
        for (const key of Object.keys(input)) {
          if (input[key as keyof OwnerVoiceInput] !== undefined) {
            overrides[key] = true;
          }
        }
        data.operator_overrides = overrides;

        const updated = await this.prisma.mkt_owner_voice_profile.update({
          where: { campaign_id: campaignId },
          data,
        });
        logger.info('Owner voice profile updated', ctx, { campaignId });
        return this.mapRow(updated);
      }

      // Create new
      const id = generateOwnerVoiceProfileId();
      const created = await this.prisma.mkt_owner_voice_profile.create({
        data: {
          id,
          campaign_id: campaignId,
          ...data,
          inferred_from_count: 0,
          operator_overrides: {},
        },
      });
      logger.info('Owner voice profile created (manual)', ctx, { campaignId, profileId: id });
      return this.mapRow(created);
    } catch (error) {
      logger.error('Failed to upsert owner voice profile', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * AI-infer the voice profile from existing owner responses found in the
   * audit data. Requires >= 3 existing responses to infer reliably.
   * Returns the inferred profile (not yet persisted — caller upserts).
   */
  async inferVoice(campaignId: string, ctx?: RequestCtx): Promise<VoiceInferenceResult> {
    try {
      // Fetch the latest business_analysis audit
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: { mkt_audits_list: { orderBy: { created_at: 'desc' } } },
      });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const businessAudits = (campaign.mkt_audits_list || [])
        .filter((a: any) => a.platform === 'business_analysis')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (businessAudits.length === 0) {
        throw new Error('No business_analysis audit found for this campaign');
      }

      const auditData = businessAudits[0].audit_data as any;

      // Extract existing owner responses from audit data
      const ownerResponses = this.extractExistingOwnerResponses(auditData);

      if (ownerResponses.length < 3) {
        throw new Error(
          `Only ${ownerResponses.length} existing owner response(s) found — need at least 3 to infer voice. ` +
          'Create a manual profile instead.',
        );
      }

      const sampleText = ownerResponses.slice(0, 10).map((r, i) => `Response ${i + 1}:\n${r}`).join('\n\n');
      const prompt = buildVoiceInferencePrompt(sampleText);

      logger.info('Inferring owner voice from existing responses', ctx, {
        campaignId,
        responseCount: ownerResponses.length,
      });

      const result = await aiProviderFactory.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing writing voice patterns. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        maxTokens: 300,
        temperature: 0.3, // Low temp — we want consistent analysis
      });

      const content = result.content.trim();
      // Parse JSON — handle potential markdown code fences
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      const inferred: VoiceInferenceResult = {
        person: parsed.person ?? 'first_person',
        formality: parsed.formality ?? 'casual',
        humor: parsed.humor ?? 'none',
        apologyStyle: parsed.apology_style ?? 'fix_first',
        signoffStyle: parsed.signoff_style ?? 'first_name',
        signature: parsed.signature ?? null,
        inferredFromCount: ownerResponses.length,
        inferredSample: sampleText.substring(0, 2000), // Cap stored sample
      };

      // Persist the inferred profile
      const id = generateOwnerVoiceProfileId();
      const existing = await this.prisma.mkt_owner_voice_profile.findUnique({
        where: { campaign_id: campaignId },
      });

      if (existing) {
        // Update existing — preserve operator overrides
        const overrides = existing.operator_overrides as any || {};
        const updateData: any = {
          person: overrides.person ? existing.person : inferred.person,
          formality: overrides.formality ? existing.formality : inferred.formality,
          humor: overrides.humor ? existing.humor : inferred.humor,
          apology_style: overrides.apology_style ? existing.apology_style : inferred.apologyStyle,
          signoff_style: overrides.signoff_style ? existing.signoff_style : inferred.signoffStyle,
          signature: overrides.signature ? existing.signature : inferred.signature,
          inferred_from_count: inferred.inferredFromCount,
          inferred_sample: inferred.inferredSample,
        };
        await this.prisma.mkt_owner_voice_profile.update({
          where: { campaign_id: campaignId },
          data: updateData,
        });
        logger.info('Owner voice profile updated (AI-inferred, preserving overrides)', ctx, { campaignId });
      } else {
        await this.prisma.mkt_owner_voice_profile.create({
          data: {
            id,
            campaign_id: campaignId,
            person: inferred.person,
            formality: inferred.formality,
            humor: inferred.humor,
            apology_style: inferred.apologyStyle,
            signoff_style: inferred.signoffStyle,
            signature: inferred.signature,
            inferred_from_count: inferred.inferredFromCount,
            inferred_sample: inferred.inferredSample,
            operator_overrides: {},
          },
        });
        logger.info('Owner voice profile created (AI-inferred)', ctx, { campaignId, profileId: id });
      }

      return inferred;
    } catch (error) {
      logger.error('Failed to infer owner voice', ctx, { error: (error as Error).message, campaignId });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Extract existing owner responses from audit data. Looks for
   * owner_response fields in platform review data.
   */
  private extractExistingOwnerResponses(auditData: any): string[] {
    const responses: string[] = [];
    const platforms = auditData.platforms ?? {};

    for (const [platformKey, platformData] of Object.entries(platforms)) {
      const pd = platformData as any;
      // Check for review-level owner responses
      if (pd.reviews && Array.isArray(pd.reviews)) {
        for (const review of pd.reviews) {
          if (review.owner_response && typeof review.owner_response === 'string' && review.owner_response.trim().length > 20) {
            responses.push(review.owner_response.trim());
          }
        }
      }
      // Some audits store responses at platform level
      if (pd.owner_responses && Array.isArray(pd.owner_responses)) {
        for (const resp of pd.owner_responses) {
          if (typeof resp === 'string' && resp.trim().length > 20) {
            responses.push(resp.trim());
          }
        }
      }
    }

    // Also check unanswered_negative_review_examples for any that have owner responses
    const examples = auditData.unanswered_negative_review_examples ?? [];
    for (const ex of examples) {
      if (ex.owner_response && typeof ex.owner_response === 'string' && ex.owner_response.trim().length > 20) {
        responses.push(ex.owner_response.trim());
      }
    }

    return responses;
  }

  /**
   * Convert a voice profile row to the API-friendly format.
   */
  toVoiceFields(profile: OwnerVoiceProfile): OwnerVoiceFields {
    return {
      person: profile.person,
      formality: profile.formality,
      humor: profile.humor,
      apologyStyle: profile.apologyStyle,
      signoffStyle: profile.signoffStyle,
      signature: profile.signature,
    };
  }

  private mapRow(row: any): OwnerVoiceProfile {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      person: row.person,
      formality: row.formality,
      humor: row.humor,
      apologyStyle: row.apology_style,
      signoffStyle: row.signoff_style,
      signature: row.signature,
      inferredFromCount: row.inferred_from_count ?? 0,
      inferredSample: row.inferred_sample,
      operatorOverrides: row.operator_overrides as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default OwnerVoiceService.getInstance();
