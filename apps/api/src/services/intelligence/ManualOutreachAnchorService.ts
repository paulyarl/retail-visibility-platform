/**
 * ManualOutreachAnchorService — manual outreach anchor CRUD + lifecycle (spec §11, §12.4).
 *
 * A manual anchor is an operator-selected outreach thesis — a focused question
 * to verify during contact. It does NOT change the detected archetype; it only
 * affects outreach copy.
 *
 * Lifecycle:
 *   draft → active → used → retired
 *
 * Scopes:
 *   - seed-scoped   — claim/verification work on a specific seed
 *   - campaign-scoped — a specific outreach pipeline (may reference a seed)
 *   - prospect-scoped — a business prospect
 *
 * When a contact event uses an anchor, the anchor is snapshotted into
 * `mkt_outreach_log.anchor_snapshot` so historical records remain accurate
 * even if the anchor is later edited or retired (§11.4 rule 4).
 */
import { randomUUID } from 'crypto';
import { BaseService } from '../BaseService';
import { prisma } from '../../prisma';
import { generateManualOutreachAnchorId } from '../../lib/id-generator';
import { audit } from '../../audit';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { NotFoundError, ConflictError, ValidationError } from '../../middleware/errorHandler';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────

export const MANUAL_ANCHOR_TYPES = [
  'identity_verification',
  'address_verification',
  'hours_verification',
  'operating_status_verification',
  'website_or_profile_claim',
  'category_verification',
  'service_verification',
  'customer_discovery_problem',
  'listing_accuracy',
  'seed_claim_invitation',
  'owner_reported_pain',
  'custom',
] as const;

export type ManualAnchorType = (typeof MANUAL_ANCHOR_TYPES)[number];

export const ANCHOR_STATUSES = ['draft', 'active', 'used', 'retired'] as const;
export type AnchorStatus = (typeof ANCHOR_STATUSES)[number];

export const EXPECTED_VERIFICATIONS = [
  'confirm',
  'correct',
  'dispute',
  'discover',
  'claim',
  'not_applicable',
] as const;

export type ExpectedVerification = (typeof EXPECTED_VERIFICATIONS)[number];

export interface ManualOutreachAnchor {
  id: string;
  seed_id: string | null;
  campaign_id: string | null;
  business_prospect_id: string | null;
  anchor_type: ManualAnchorType;
  status: AnchorStatus;
  title: string;
  operator_thesis: string;
  observed_issue: string | null;
  evidence_summary: string | null;
  evidence_refs: any[];
  verification_question: string;
  pain_question: string | null;
  recommended_transition: string | null;
  expected_verification: ExpectedVerification;
  created_by: string;
  activated_by: string | null;
  created_at: string;
  activated_at: string | null;
  retired_at: string | null;
}

export interface CreateAnchorInput {
  seedId?: string;
  campaignId?: string;
  businessProspectId?: string;
  anchorType: ManualAnchorType;
  title: string;
  operatorThesis: string;
  observedIssue?: string;
  evidenceSummary?: string;
  evidenceRefs?: any[];
  verificationQuestion: string;
  painQuestion?: string;
  recommendedTransition?: string;
  expectedVerification?: ExpectedVerification;
}

export interface UpdateAnchorInput {
  title?: string;
  operatorThesis?: string;
  observedIssue?: string;
  evidenceSummary?: string;
  evidenceRefs?: any[];
  verificationQuestion?: string;
  painQuestion?: string;
  recommendedTransition?: string;
  expectedVerification?: ExpectedVerification;
}

export type AnchorVerificationResultType =
  | 'not_attempted'
  | 'unreachable'
  | 'identity_confirmed'
  | 'identity_not_confirmed'
  | 'fact_confirmed'
  | 'fact_corrected'
  | 'fact_disputed'
  | 'pain_confirmed'
  | 'pain_not_present'
  | 'pain_discovered'
  | 'claim_accepted'
  | 'claim_declined'
  | 'follow_up_requested'
  | 'other';

export interface AnchorVerificationResult {
  type: AnchorVerificationResultType;
  field?: string;
  value?: unknown;
  previous_value?: unknown;
  new_value?: unknown;
  confidence?: string;
  owner_response?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────

const createAnchorSchema = z.object({
  seedId: z.string().optional(),
  campaignId: z.string().optional(),
  businessProspectId: z.string().optional(),
  anchorType: z.enum(MANUAL_ANCHOR_TYPES),
  title: z.string().min(1).max(255),
  operatorThesis: z.string().min(1),
  observedIssue: z.string().optional(),
  evidenceSummary: z.string().optional(),
  evidenceRefs: z.array(z.any()).optional(),
  verificationQuestion: z.string().min(1),
  painQuestion: z.string().optional(),
  recommendedTransition: z.string().optional(),
  expectedVerification: z.enum(EXPECTED_VERIFICATIONS).optional(),
});

const updateAnchorSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  operatorThesis: z.string().min(1).optional(),
  observedIssue: z.string().optional(),
  evidenceSummary: z.string().optional(),
  evidenceRefs: z.array(z.any()).optional(),
  verificationQuestion: z.string().min(1).optional(),
  painQuestion: z.string().optional(),
  recommendedTransition: z.string().optional(),
  expectedVerification: z.enum(EXPECTED_VERIFICATIONS).optional(),
});

// ─── Service ──────────────────────────────────────────────────────────────

export class ManualOutreachAnchorService extends BaseService {
  private static instance: ManualOutreachAnchorService;

  private constructor() {
    super();
  }

  public static getInstance(): ManualOutreachAnchorService {
    if (!ManualOutreachAnchorService.instance) {
      ManualOutreachAnchorService.instance = new ManualOutreachAnchorService();
    }
    return ManualOutreachAnchorService.instance;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Create a new anchor (draft status). At least one scope is required.
   */
  async createAnchor(input: CreateAnchorInput, ctx: RequestCtx): Promise<ManualOutreachAnchor> {
    const validated = createAnchorSchema.parse(input);

    if (!validated.seedId && !validated.campaignId && !validated.businessProspectId) {
      throw new ValidationError('At least one scope (seedId, campaignId, or businessProspectId) is required');
    }

    const id = generateManualOutreachAnchorId();
    const userId = ctx.userId ?? 'system';

    const rows = await this.prisma.$queryRaw<any[]>`
      INSERT INTO mkt_outreach_anchors (
        id, seed_id, campaign_id, business_prospect_id,
        anchor_type, status, title, operator_thesis,
        observed_issue, evidence_summary, evidence_refs,
        verification_question, pain_question, recommended_transition,
        expected_verification, created_by, created_at
      ) VALUES (
        ${id},
        ${validated.seedId ?? null},
        ${validated.campaignId ?? null},
        ${validated.businessProspectId ?? null},
        ${validated.anchorType},
        'draft',
        ${validated.title},
        ${validated.operatorThesis},
        ${validated.observedIssue ?? null},
        ${validated.evidenceSummary ?? null},
        ${JSON.stringify(validated.evidenceRefs ?? [])}::jsonb,
        ${validated.verificationQuestion},
        ${validated.painQuestion ?? null},
        ${validated.recommendedTransition ?? null},
        ${validated.expectedVerification ?? 'confirm'},
        ${userId},
        now()
      )
      RETURNING *
    `;

    await audit({
      actorType: 'user',
      actor: userId,
      action: 'outreach_anchor.create',
      payload: { anchorId: id, anchorType: validated.anchorType, seedId: validated.seedId, campaignId: validated.campaignId },
    });

    return rows[0] as ManualOutreachAnchor;
  }

  /**
   * Get an anchor by ID.
   */
  async getAnchor(anchorId: string, ctx?: RequestCtx): Promise<ManualOutreachAnchor> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_outreach_anchors WHERE id = ${anchorId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundError('Anchor not found');
    return rows[0] as ManualOutreachAnchor;
  }

  /**
   * List anchors for a seed.
   */
  async listAnchorsForSeed(seedId: string, ctx?: RequestCtx): Promise<ManualOutreachAnchor[]> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_outreach_anchors
      WHERE seed_id = ${seedId}
      ORDER BY created_at DESC
    `;
    return rows as ManualOutreachAnchor[];
  }

  /**
   * List anchors for a campaign.
   */
  async listAnchorsForCampaign(campaignId: string, ctx?: RequestCtx): Promise<ManualOutreachAnchor[]> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM mkt_outreach_anchors
      WHERE campaign_id = ${campaignId}
      ORDER BY created_at DESC
    `;
    return rows as ManualOutreachAnchor[];
  }

  /**
   * Update an anchor (only in draft status).
   */
  async updateAnchor(anchorId: string, input: UpdateAnchorInput, ctx: RequestCtx): Promise<ManualOutreachAnchor> {
    const validated = updateAnchorSchema.parse(input);

    const existing = await this.getAnchor(anchorId, ctx);
    if (existing.status !== 'draft') {
      throw new ConflictError(`Cannot update anchor in "${existing.status}" status — only draft anchors are editable`);
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fields: Record<string, any> = {
      title: validated.title,
      operator_thesis: validated.operatorThesis,
      observed_issue: validated.observedIssue,
      evidence_summary: validated.evidenceSummary,
      evidence_refs: validated.evidenceRefs ? JSON.stringify(validated.evidenceRefs) : undefined,
      verification_question: validated.verificationQuestion,
      pain_question: validated.painQuestion,
      recommended_transition: validated.recommendedTransition,
      expected_verification: validated.expectedVerification,
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        setClauses.push(`${key} = $${paramIdx}`);
        values.push(key === 'evidence_refs' ? val : val);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    const query = `
      UPDATE mkt_outreach_anchors
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING *
    `;
    values.push(anchorId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(query, ...values);
    return rows[0] as ManualOutreachAnchor;
  }

  /**
   * Activate an anchor (draft → active).
   */
  async activateAnchor(anchorId: string, ctx: RequestCtx): Promise<ManualOutreachAnchor> {
    const existing = await this.getAnchor(anchorId, ctx);
    if (existing.status !== 'draft') {
      throw new ConflictError(`Cannot activate anchor in "${existing.status}" status`);
    }

    const userId = ctx.userId ?? 'system';
    const rows = await this.prisma.$queryRaw<any[]>`
      UPDATE mkt_outreach_anchors
      SET status = 'active', activated_by = ${userId}, activated_at = now()
      WHERE id = ${anchorId}
      RETURNING *
    `;

    await audit({
      actorType: 'user',
      actor: userId,
      action: 'outreach_anchor.activate',
      payload: { anchorId, anchorType: existing.anchor_type },
    });

    return rows[0] as ManualOutreachAnchor;
  }

  /**
   * Retire an anchor (draft|active|used → retired).
   */
  async retireAnchor(anchorId: string, ctx: RequestCtx): Promise<ManualOutreachAnchor> {
    const existing = await this.getAnchor(anchorId, ctx);
    if (existing.status === 'retired') {
      throw new ConflictError('Anchor is already retired');
    }

    const userId = ctx.userId ?? 'system';
    const rows = await this.prisma.$queryRaw<any[]>`
      UPDATE mkt_outreach_anchors
      SET status = 'retired', retired_at = now()
      WHERE id = ${anchorId}
      RETURNING *
    `;

    await audit({
      actorType: 'user',
      actor: userId,
      action: 'outreach_anchor.retire',
      payload: { anchorId, previousStatus: existing.status },
    });

    return rows[0] as ManualOutreachAnchor;
  }

  // ── Contact integration ────────────────────────────────────────────────

  /**
   * Snapshot an anchor for use in a contact event (§11.4 rule 4).
   * Returns the anchor snapshot to embed in `mkt_outreach_log.anchor_snapshot`.
   */
  async snapshotAnchor(anchorId: string, ctx?: RequestCtx): Promise<Record<string, any>> {
    const anchor = await this.getAnchor(anchorId, ctx);
    return {
      id: anchor.id,
      anchor_type: anchor.anchor_type,
      title: anchor.title,
      operator_thesis: anchor.operator_thesis,
      verification_question: anchor.verification_question,
      pain_question: anchor.pain_question,
      recommended_transition: anchor.recommended_transition,
      expected_verification: anchor.expected_verification,
      evidence_refs: anchor.evidence_refs,
      snapshotted_at: new Date().toISOString(),
    };
  }

  /**
   * Record a contact event that used an anchor. Writes the anchor snapshot
   * and verification results to `mkt_outreach_log` and, when linked to a
   * seed, to `directory_seed_outreach_touches` (§12.5).
   *
   * Verification results are processed per §11.6:
   *   - fact_confirmed / fact_corrected / fact_disputed → NAP verification
   *   - pain_confirmed / pain_discovered → owner-reported pain (separate
   *     from platform-observed evidence)
   *   - claim_accepted → claim status update
   */
  async recordContactWithAnchor(params: {
    anchorId: string;
    campaignId?: string;
    seedId?: string;
    channel?: string;
    callResult: string;
    verificationResults: AnchorVerificationResult[];
    contactEventId?: string;
    notes?: string;
  }, ctx: RequestCtx): Promise<{ touchId: string | null; eventId: string | null }> {
    const { anchorId, campaignId, seedId, channel, callResult, verificationResults, contactEventId, notes } = params;

    // Snapshot the anchor
    const anchorSnapshot = await this.snapshotAnchor(anchorId, ctx);
    const userId = ctx.userId ?? 'system';
    let touchId: string | null = null;
    let eventId: string | null = null;

    // Write to mkt_outreach_log if campaign-scoped
    if (campaignId) {
      eventId = contactEventId ?? `evt-${Date.now()}`;
      await this.prisma.$executeRaw`
        INSERT INTO mkt_outreach_log (
          id, campaign_id, anchor_id, anchor_snapshot,
          call_result, verification_results, notes, created_by, created_at
        ) VALUES (
          ${eventId},
          ${campaignId},
          ${anchorId},
          ${JSON.stringify(anchorSnapshot)}::jsonb,
          ${callResult},
          ${JSON.stringify(verificationResults)}::jsonb,
          ${notes ?? null},
          ${userId},
          now()
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // Write to directory_seed_outreach_touches if seed-scoped
    if (seedId) {
      // Resolve tenant_id from the seed
      const seedRows = await this.prisma.$queryRaw<any[]>`
        SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
      `;
      const tenantId = seedRows[0]?.tenant_id ?? null;

      touchId = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO directory_seed_outreach_touches (
          id, seed_id, tenant_id, channel, outcome, notes, operator_id, occurred_at, created_at
        ) VALUES (
          ${touchId}::uuid,
          ${seedId},
          ${tenantId},
          ${channel ?? 'phone'},
          ${callResult},
          ${notes ?? `Anchor: ${anchorSnapshot.title} (${anchorSnapshot.anchor_type})`},
          ${userId},
          now(),
          now()
        )
      `;
    }

    // Process verification results — write NAP corrections and owner-reported findings
    if (seedId && verificationResults.length > 0) {
      await this.processVerificationResults(seedId, verificationResults, callResult, ctx);

      // §5.1: an owner verification event that changes a report fact triggers
      // a new report version. Best-effort — a refresh failure must not lose
      // the contact record, and the last successful version is preserved (§20.4.11).
      const hasReportVisibleResult = verificationResults.some((r) =>
        ['identity_confirmed', 'identity_not_confirmed', 'fact_confirmed', 'fact_corrected', 'fact_disputed', 'pain_confirmed', 'pain_not_present', 'pain_discovered', 'claim_accepted'].includes(r.type),
      );
      if (hasReportVisibleResult) {
        try {
          const { SeedIntelligenceReportService } = await import('./SeedIntelligenceReportService.js');
          await SeedIntelligenceReportService.getInstance().refreshReport(seedId, ctx);
        } catch (err: any) {
          logger.warn('ManualOutreachAnchorService: report refresh after verification failed', ctx, {
            seedId,
            error: err?.message,
          });
        }
      }
    }

    // Mark anchor as used
    await this.prisma.$executeRaw`
      UPDATE mkt_outreach_anchors
      SET status = 'used'
      WHERE id = ${anchorId} AND status = 'active'
    `;

    return { touchId, eventId };
  }

  /**
   * Attach an anchor to an existing `mkt_outreach_log` row (§13.4 — the
   * standard outreach-log request carries `anchor_id` + `verification_results`,
   * and this back-fills the snapshot onto the already-created log row).
   *
   * Also writes the canonical seed touch + processes verification results
   * when the anchor is seed-scoped, and marks the anchor as used.
   */
  async attachAnchorToOutreachLog(params: {
    logId: string;
    anchorId: string;
    verificationResults?: AnchorVerificationResult[];
    callResult?: string;
    channel?: string;
  }, ctx: RequestCtx): Promise<void> {
    const { logId, anchorId } = params;
    const verificationResults = params.verificationResults ?? [];
    const anchor = await this.getAnchor(anchorId, ctx);
    const anchorSnapshot = await this.snapshotAnchor(anchorId, ctx);
    const userId = ctx.userId ?? 'system';

    await this.prisma.$executeRaw`
      UPDATE mkt_outreach_log
      SET anchor_id = ${anchorId},
          anchor_snapshot = ${JSON.stringify(anchorSnapshot)}::jsonb,
          verification_results = ${JSON.stringify(verificationResults)}::jsonb
      WHERE id = ${logId}
    `;

    // Seed-scoped anchors also produce a canonical seed touch so the
    // report's verification_activity reflects the contact (§12.5).
    if (anchor.seed_id) {
      const seedId = anchor.seed_id;
      const callResult = params.callResult ?? 'unknown';
      const seedRows = await this.prisma.$queryRaw<any[]>`
        SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
      `;
      const tenantId = seedRows[0]?.tenant_id ?? null;

      await this.prisma.$executeRaw`
        INSERT INTO directory_seed_outreach_touches (
          id, seed_id, tenant_id, channel, outcome, notes, operator_id, occurred_at, created_at
        ) VALUES (
          ${randomUUID()}::uuid,
          ${seedId},
          ${tenantId},
          ${params.channel ?? 'phone'},
          ${callResult},
          ${`Anchor: ${anchorSnapshot.title} (${anchorSnapshot.anchor_type})`},
          ${userId},
          now(),
          now()
        )
      `;

      if (verificationResults.length > 0) {
        await this.processVerificationResults(seedId, verificationResults, callResult, ctx);

        const hasReportVisibleResult = verificationResults.some((r) =>
          ['identity_confirmed', 'identity_not_confirmed', 'fact_confirmed', 'fact_corrected', 'fact_disputed', 'pain_confirmed', 'pain_not_present', 'pain_discovered', 'claim_accepted'].includes(r.type),
        );
        if (hasReportVisibleResult) {
          try {
            const { SeedIntelligenceReportService } = await import('./SeedIntelligenceReportService.js');
            await SeedIntelligenceReportService.getInstance().refreshReport(seedId, ctx);
          } catch (err: any) {
            logger.warn('ManualOutreachAnchorService: report refresh after verification failed', ctx, {
              seedId,
              error: err?.message,
            });
          }
        }
      }
    }

    // Mark anchor as used (§11.4 — active anchors transition on use)
    await this.prisma.$executeRaw`
      UPDATE mkt_outreach_anchors
      SET status = 'used'
      WHERE id = ${anchorId} AND status = 'active'
    `;
  }

  /**
   * Process verification results from a contact event (§11.6).
   * Separates platform-observed corrections from owner-reported findings.
   */
  private async processVerificationResults(
    seedId: string,
    results: AnchorVerificationResult[],
    callResult: string,
    ctx: RequestCtx,
  ): Promise<void> {
    const userId = ctx.userId ?? 'system';

    // §20.4 invariants 2-3: owner confirmation/correction requires a
    // connected owner or business-representative contact — a no-answer,
    // voicemail, or wrong-number call cannot produce a verified fact.
    const NOT_CONNECTED = new Set([
      'not_attempted', 'unreachable', 'no_answer', 'voicemail',
      'left_message', 'wrong_number', 'disconnected_number', 'refused',
    ]);
    const isConnected = !NOT_CONNECTED.has(callResult);

    // Resolve tenant_id
    const seedRows = await this.prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    const tenantId = seedRows[0]?.tenant_id ?? null;
    const writebacks: Array<{ type: string; field: string }> = [];

    for (const result of results) {
      // Fact confirmations → NAP verification with owner_corrected=FALSE.
      // The report builder counts these as owner confirmations (distinct
      // from corrections) in claim_summary / verification_activity.
      if (result.type === 'fact_confirmed' && result.field && isConnected) {
        const confirmedFields = { [result.field]: { confirmed: result.value ?? result.new_value ?? null } };
        await this.prisma.$executeRaw`
          INSERT INTO directory_seed_nap_verifications (
            id, seed_id, tenant_id, source, changed_fields, owner_corrected, created_at
          ) VALUES (
            ${randomUUID()},
            ${seedId},
            ${tenantId},
            'anchor_verification',
            ${JSON.stringify(confirmedFields)}::jsonb,
            FALSE,
            now()
          )
        `;
        await this.prisma.$executeRaw`
          UPDATE directory_presence_seeds
          SET nap_verified_at = COALESCE(nap_verified_at, now()), updated_at = now()
          WHERE id = ${seedId}
        `;
        writebacks.push({ type: result.type, field: result.field });
      }

      // Fact corrections → NAP verification (same connected-contact gate —
      // an owner correction also requires a connected contact event).
      if (result.type === 'fact_corrected' && result.field && result.new_value !== undefined && isConnected) {
        const changedFields = { [result.field]: { previous: result.previous_value, corrected: result.new_value } };
        await this.prisma.$executeRaw`
          INSERT INTO directory_seed_nap_verifications (
            id, seed_id, tenant_id, source, changed_fields, owner_corrected, created_at
          ) VALUES (
            ${randomUUID()},
            ${seedId},
            ${tenantId},
            'anchor_verification',
            ${JSON.stringify(changedFields)}::jsonb,
            TRUE,
            now()
          )
        `;

        // Update the seed's corrected flag
        await this.prisma.$executeRaw`
          UPDATE directory_presence_seeds
          SET nap_owner_corrected = TRUE, updated_at = now()
          WHERE id = ${seedId}
        `;
        writebacks.push({ type: result.type, field: result.field });
      }

      // Owner-reported pain → stored separately from platform-observed evidence.
      // Written to mkt_outreach_log as a verification result (already done above)
      // and surfaced in the report's verification_activity section.
      // The report builder reads it from outreach touches, NOT from
      // directory_field_provenance (§11.7).
      if (result.type === 'pain_confirmed' || result.type === 'pain_discovered') {
        // Owner-reported pain is already recorded in the outreach touch/log.
        // The report builder reads it from the verification_activity section.
        // No additional write needed — it's separated from platform evidence
        // by the report DTO's evidence_state field.
      }

      // Claim accepted → mark the claim token consumed
      if (result.type === 'claim_accepted') {
        // The claim token consumption is handled by the existing claim flow.
        // This result is recorded for reporting purposes.
      }
    }

    // §23.4 auditability — contact verification write-back
    if (writebacks.length > 0) {
      await audit({
        actorType: 'user',
        actor: userId,
        action: 'contact_verification.writeback',
        payload: { seedId, tenantId, callResult, writebacks },
      });
    }
  }
}

export default ManualOutreachAnchorService.getInstance();
