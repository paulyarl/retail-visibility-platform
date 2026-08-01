/**
 * RecoveryOpsService — Web client for recovery management admin endpoints
 *
 * Mirrors the admin recovery endpoints in apps/api/src/routes/marketing-ops.ts.
 * Extends AdminApiSingleton for admin privilege validation + caching.
 *
 * Sprint 4 — Recovery Management Engine.
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

const BASE_URL = '/api/admin/marketing-ops/recovery';

// ====================
// TYPES
// ====================

export interface RecoveryCampaign {
  id: string;
  display_id: string | null;
  business_name: string | null;
  category: string;
  city: string;
  stage: string;
  stage_entered_at: string;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
}

export interface RecoveryCampaignListResult {
  campaigns: RecoveryCampaign[];
  byStage: Record<string, RecoveryCampaign[]>;
  total: number;
}

export interface DisputeIntake {
  id: string;
  campaign_id: string;
  owner_statement: string;
  owner_email: string | null;
  owner_phone: string | null;
  proposed_resolution: string;
  service_date: string | null;
  status_flag: string | null;
  submitted_at: string | null;
  expires_at: string;
  mkt_dispute_attachments: DisputeAttachment[];
}

export interface DisputeAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
}

export interface DeliverableSection {
  id: string;
  section_type: string | null;
  title: string | null;
  content: string | null;
  source: string | null;
  status: string | null;
  section_index: number | null;
}

export interface RecoveryDraft {
  id: string;
  campaign_id: string;
  deliverable_type: string;
  status: string;
  generated_at: string;
  mkt_deliverable_sections: DeliverableSection[];
}

export interface ApproveResult {
  campaignId: string;
  stage: string;
  deliverableId: string;
}

export interface RegenerateResult {
  executionId: string;
  campaignId: string;
}

// ====================
// SERVICE
// ====================

class RecoveryOpsService extends AdminApiSingleton {
  private static instance: RecoveryOpsService;

  private constructor() {
    super('RecoveryOpsService');
  }

  static getInstance(): RecoveryOpsService {
    if (!RecoveryOpsService.instance) {
      RecoveryOpsService.instance = new RecoveryOpsService();
    }
    return RecoveryOpsService.instance;
  }

  // ─── List recovery campaigns grouped by stage ──────────────────

  async listCampaigns(): Promise<RecoveryCampaignListResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `${BASE_URL}/campaigns`,
        {},
        'recovery-campaigns-list',
        this.cacheTTL,
      );
      if (!result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch recovery campaigns');
      }
      return result.data?.data ?? result.data;
    } catch (error) {
      clientLogger.error('[RecoveryOpsService] Failed to list campaigns:', { detail: error });
      return { campaigns: [], byStage: {}, total: 0 };
    }
  }

  // ─── Get intake + attachments ──────────────────────────────────

  async getIntake(campaignId: string): Promise<DisputeIntake | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `${BASE_URL}/${campaignId}/intake`,
        {},
        `recovery-intake-${campaignId}`,
        this.cacheTTL,
      );
      if (!result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch intake');
      }
      return result.data?.data ?? result.data;
    } catch (error) {
      clientLogger.error('[RecoveryOpsService] Failed to get intake:', { detail: error, campaignId });
      return null;
    }
  }

  // ─── Get current resolution draft + sections ───────────────────

  async getDraft(campaignId: string): Promise<RecoveryDraft | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `${BASE_URL}/${campaignId}/draft`,
        {},
        `recovery-draft-${campaignId}`,
        this.cacheTTL,
      );
      if (!result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch draft');
      }
      return result.data?.data ?? result.data;
    } catch (error) {
      clientLogger.error('[RecoveryOpsService] Failed to get draft:', { detail: error, campaignId });
      return null;
    }
  }

  // ─── Edit draft sections ───────────────────────────────────────

  async editDraft(campaignId: string, input: {
    responseDraft?: string;
    submissionGuide?: string;
  }): Promise<{ deliverableId: string; updated: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/draft`,
      { method: 'PATCH', body: JSON.stringify(input) },
      `recovery-draft-edit-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to edit draft');
    }
    await this.invalidateCachePattern(`recovery-draft-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  // ─── Approve draft → resolved_and_closed ───────────────────────

  async approveDraft(campaignId: string): Promise<ApproveResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/approve`,
      { method: 'POST', body: JSON.stringify({}) },
      `recovery-approve-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to approve draft');
    }
    await this.invalidateCachePattern('recovery-campaigns');
    await this.invalidateCachePattern(`recovery-draft-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  // ─── Regenerate draft (re-run the agent) ───────────────────────

  async regenerate(campaignId: string): Promise<RegenerateResult> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/regenerate`,
      { method: 'POST', body: JSON.stringify({}) },
      `recovery-regenerate-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to regenerate draft');
    }
    await this.invalidateCachePattern(`recovery-draft-${campaignId}`);
    return result.data?.data ?? result.data;
  }

  // ─── Dual-Mode: Render prompt text for copy-paste bridge ───────

  async getPromptText(campaignId: string): Promise<{
    renderedPrompt: string;
    templateId: string;
    variablesUsed: Record<string, any>;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/prompt-text`,
      {},
      `recovery-prompt-text-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to render prompt text');
    }
    return result.data?.data ?? result.data;
  }

  // ─── Dual-Mode: Import external AI result ──────────────────────

  async importExternalResult(campaignId: string, rawOutput: string): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    passed: boolean;
    errors?: string[];
  }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/import-result`,
      { method: 'POST', body: JSON.stringify({ raw_output: rawOutput }) },
      `recovery-import-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to import external result');
    }
    await this.invalidateCachePattern(`recovery-draft-${campaignId}`);
    await this.invalidateCachePattern('recovery-campaigns');
    return result.data?.data ?? result.data;
  }

  // ─── Dual-Mode: Direct execute via API ─────────────────────────

  async executeDirect(campaignId: string): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    passed: boolean;
    errors?: string[];
  }> {
    const result = await this.makeDefaultRequest<any>(
      `${BASE_URL}/${campaignId}/execute`,
      { method: 'POST', body: JSON.stringify({}) },
      `recovery-execute-${campaignId}`,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to execute directly');
    }
    await this.invalidateCachePattern(`recovery-draft-${campaignId}`);
    await this.invalidateCachePattern('recovery-campaigns');
    return result.data?.data ?? result.data;
  }
}

export default RecoveryOpsService.getInstance();
