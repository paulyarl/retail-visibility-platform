/**
 * IntelligenceRunService — Intelligence Seek run tracking
 *
 * Creates and retrieves mkt_intelligence_runs records (spec §41). A run
 * captures the full resolution context: which profile was active, which
 * focus was used, which prompt version produced the discovery, and links
 * to the execution that holds the raw output.
 *
 * Run records are immutable historical artifacts — they reference the exact
 * profile version used (not the profile id alone), so reproducibility is
 * guaranteed even after the profile is updated or retired.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §5
 */

import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { generateIntelligenceRunId } from '../../lib/id-generator';
import type { IntelligenceFocus } from './PromptComposerService';
import type { PromptResolution } from './IntelligenceProfileService';

export interface IntelligenceRun {
  id: string;
  campaign_id: string;
  execution_id: string | null;
  profile_id: string | null;
  profile_version: number | null;
  intelligence_mode: string;
  focus: string;
  prompt_version: number | null;
  prompt_body_hash: string | null;
  candidate_count: number;
  qualifying_count: number;
  hold_count: number;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export class IntelligenceRunService extends BaseService {
  private static instance: IntelligenceRunService;

  private constructor() {
    super();
  }

  static getInstance(): IntelligenceRunService {
    if (!IntelligenceRunService.instance) {
      IntelligenceRunService.instance = new IntelligenceRunService();
    }
    return IntelligenceRunService.instance;
  }

  /**
   * Create a new intelligence run record (§41).
   * Stamps all resolution context: profile id+version, intelligence_mode,
   * focus, prompt version + body hash, and candidate/qualifying/hold counts.
   */
  async createRun(input: {
    campaignId: string;
    executionId?: string;
    resolution: PromptResolution;
    focus: IntelligenceFocus;
    promptVersion?: number;
    promptBodyHash?: string;
    candidateCount?: number;
    qualifyingCount?: number;
    holdCount?: number;
    metadata?: Record<string, any>;
  }, ctx?: RequestCtx): Promise<IntelligenceRun> {
    const id = generateIntelligenceRunId();
    try {
      const run = await this.prisma.mkt_intelligence_runs.create({
        data: {
          id,
          campaign_id: input.campaignId,
          execution_id: input.executionId || null,
          profile_id: input.resolution.profile_id,
          profile_version: input.resolution.profile_version,
          intelligence_mode: input.resolution.intelligence_mode,
          focus: input.focus,
          prompt_version: input.promptVersion || null,
          prompt_body_hash: input.promptBodyHash || null,
          candidate_count: input.candidateCount || 0,
          qualifying_count: input.qualifyingCount || 0,
          hold_count: input.holdCount || 0,
          metadata: input.metadata || null,
        },
      });
      logger.info('Intelligence run created', ctx, {
        runId: id,
        campaignId: input.campaignId,
        intelligenceMode: input.resolution.intelligence_mode,
        focus: input.focus,
        profileId: input.resolution.profile_id,
        profileVersion: input.resolution.profile_version,
      });
      return run as IntelligenceRun;
    } catch (error) {
      logger.error('IntelligenceRunService.createRun failed', ctx, {
        error: (error as Error).message,
        campaignId: input.campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * List runs for a campaign, ordered by created_at desc.
   */
  async listRunsForCampaign(campaignId: string, ctx?: RequestCtx): Promise<IntelligenceRun[]> {
    try {
      const runs = await this.prisma.mkt_intelligence_runs.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
      });
      return runs as IntelligenceRun[];
    } catch (error) {
      logger.error('IntelligenceRunService.listRunsForCampaign failed', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get a single run by id.
   */
  async getRun(runId: string, ctx?: RequestCtx): Promise<IntelligenceRun | null> {
    try {
      const run = await this.prisma.mkt_intelligence_runs.findUnique({
        where: { id: runId },
      });
      return run as IntelligenceRun | null;
    } catch (error) {
      logger.error('IntelligenceRunService.getRun failed', ctx, {
        error: (error as Error).message,
        runId,
      });
      throw this.handleError(error, ctx);
    }
  }
}

export default IntelligenceRunService.getInstance();
