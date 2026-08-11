/**
 * OutreachIntelligenceService — Manual research worksheet for business-scope
 * campaigns.
 *
 * Captures business-published contact context (owner name, business email,
 * team signal, preferred channel) gathered by a human operator after the
 * Business Audit and before outreach begins. The server-computed
 * recommended_salutation feeds Sprint 2's hook library as the
 * {{salutation}} merge field.
 *
 * Sibling inheritance: the worksheet is gathered once per business prospect.
 * Non-primary siblings read the primary sibling's worksheet via a read-time
 * campaign-id resolution (NOT the audits-join pattern). Writes to non-primary
 * siblings are rejected with 409 — edit the primary's worksheet.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateOutreachIntelligenceId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler';

// ─── Types ──────────────────────────────────────────────────────────────

export type SourceConfidence = 'confirmed' | 'inferred_low_risk' | 'unavailable';
export type TeamSignalValue = 'sole_owner' | 'family_team' | 'small_staff' | 'unknown';

export interface SourcedField {
  value: string | null;
  source: string | null;
  source_confidence: SourceConfidence;
}

export interface TeamSignalField {
  value: TeamSignalValue;
  quoted_description: string | null;
  source: string | null;
  source_confidence: SourceConfidence;
}

export interface OutreachIntelligencePayload {
  business_name: string;
  address: string | null;
  linked_audit_reference: string | null;
  prepared_by: string;
  research_date: string; // YYYY-MM-DD
  owner_name: SourcedField;
  business_email: SourcedField;
  team_signal: TeamSignalField;
  preferred_contact_channel: SourcedField;
  recommended_salutation: string;
  researcher_notes: string;
}

export interface OutreachIntelligenceRow {
  id: string;
  campaign_id: string;
  owner_name: string | null;
  owner_name_confidence: SourceConfidence;
  business_email: string | null;
  business_email_confidence: SourceConfidence;
  team_signal: TeamSignalValue;
  preferred_contact_channel: string | null;
  recommended_salutation: string;
  research_date: string | null;
  prepared_by: string | null;
  payload: OutreachIntelligencePayload;
  created_at: string;
  updated_at: string;
}

export interface OutreachIntelligenceResult extends OutreachIntelligenceRow {
  inherited?: boolean;
  sourceCampaignId?: string;
}

export interface UpsertInput {
  payload: Omit<OutreachIntelligencePayload, 'business_name' | 'address' | 'recommended_salutation'>;
}

// ─── Salutation resolver (pure, unit-tested in isolation) ───────────────

/**
 * Resolve the recommended salutation from the worksheet payload + business
 * name. Pure function — no DB access, no side effects.
 *
 * Fallback chain (§5.2):
 * 1. owner_name.value present AND source_confidence ∈ {confirmed,
 *    inferred_low_risk} → `Hi {firstName},` (first whitespace-delimited
 *    token of the stored value).
 * 2. Else, business_name present and usable as a greeting →
 *    `Hi {business_name},`.
 * 3. Else → `Hi there,`.
 *
 * "Usable as a greeting" heuristic: non-empty after trim, ≤ 60 chars,
 * contains at least one letter, and is not all-punctuation/digits.
 * The function never fabricates a name.
 */
export function resolveSalutation(
  payload: { owner_name: SourcedField },
  businessName: string | null | undefined,
): string {
  // Tier 1: confirmed/inferred owner name
  const ownerName = payload.owner_name;
  if (
    ownerName.value &&
    ownerName.value.trim().length > 0 &&
    (ownerName.source_confidence === 'confirmed' || ownerName.source_confidence === 'inferred_low_risk')
  ) {
    const firstName = ownerName.value.trim().split(/\s+/)[0];
    return `Hi ${firstName},`;
  }

  // Tier 2: business name usable as greeting
  if (businessName && isUsableAsGreeting(businessName)) {
    return `Hi ${businessName.trim()},`;
  }

  // Tier 3: fallback
  return `Hi there,`;
}

/**
 * Check whether a business name is usable as a greeting.
 * Non-empty after trim, ≤ 60 chars, contains at least one letter,
 * and is not all-punctuation/digits.
 */
function isUsableAsGreeting(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false; // must contain at least one letter
  // Reject if all punctuation/digits (no letters already checked above,
  // but this also rejects strings that are mostly punctuation with one letter)
  // The letter check above is sufficient — anything with a letter is usable.
  return true;
}

// ─── Service ────────────────────────────────────────────────────────────

export class OutreachIntelligenceService extends BaseService {
  private static instance: OutreachIntelligenceService;

  private constructor() {
    super();
  }

  static getInstance(): OutreachIntelligenceService {
    if (!OutreachIntelligenceService.instance) {
      OutreachIntelligenceService.instance = new OutreachIntelligenceService();
    }
    return OutreachIntelligenceService.instance;
  }

  // ====================
  // READ
  // ====================

  /**
   * Get the worksheet for a campaign. Resolution order:
   * 1. Look up by campaign_id; found → return it.
   * 2. Not found + non-primary sibling → resolve primary sibling's campaign
   *    id, look up worksheet by that id, return with inherited: true.
   * 3. Still not found → return null.
   *
   * Does NOT call MarketingCampaignService.loadPrimarySiblingAudits (private,
   * and inherits audit data, not gathered contact context).
   */
  async getForCampaign(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<OutreachIntelligenceResult | null> {
    // 1. Direct lookup
    const own = await this.prisma.mkt_outreach_intelligence.findUnique({
      where: { campaign_id: campaignId },
    });
    if (own) {
      return this.mapRow(own);
    }

    // 2. Sibling inheritance
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_prospect_id: true,
        is_primary_sibling: true,
        scope: true,
      },
    });

    if (!campaign) {
      return null;
    }

    const isNonPrimarySibling =
      campaign.business_prospect_id &&
      campaign.is_primary_sibling === false &&
      campaign.scope === 'business';

    if (!isNonPrimarySibling) {
      return null;
    }

    // Resolve primary sibling campaign id (self-contained — no dependency on
    // MarketingCampaignService.loadPrimarySiblingAudits which is private).
    const primaryCampaignId = await this.resolvePrimarySiblingCampaignId(
      campaign.business_prospect_id!,
      campaignId,
      ctx,
    );

    if (!primaryCampaignId) {
      return null;
    }

    const inherited = await this.prisma.mkt_outreach_intelligence.findUnique({
      where: { campaign_id: primaryCampaignId },
    });

    if (!inherited) {
      return null;
    }

    return {
      ...this.mapRow(inherited),
      inherited: true,
      sourceCampaignId: primaryCampaignId,
    };
  }

  // ====================
  // UPSERT
  // ====================

  /**
   * Upsert the worksheet for a campaign.
   *
   * - Zod-validates the payload (validation happens in the route layer; this
   *   method receives already-parsed input).
   * - Snapshots business_name/address from the campaign row (server-side).
   * - Defaults linked_audit_reference to the campaign's latest
   *   business_analysis audit id when not supplied.
   * - Computes recommended_salutation via resolveSalutation().
   * - Rejects writes on non-primary siblings with 409.
   * - Writes audit() entry.
   */
  async upsert(
    campaignId: string,
    input: UpsertInput,
    ctx?: RequestCtx,
  ): Promise<OutreachIntelligenceResult> {
    // 1. Load campaign — verify it exists and is business-scope
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_name: true,
        address_line1: true,
        address_city: true,
        address_state: true,
        business_prospect_id: true,
        is_primary_sibling: true,
        scope: true,
        mkt_audits_list: {
          where: { platform: 'business_analysis' },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.scope !== 'business') {
      throw new ValidationError('Outreach Intelligence worksheet is only available for business-scope campaigns');
    }

    // 2. Reject writes on non-primary siblings (intelligence is gathered
    //    once per business prospect — edit the primary's worksheet)
    const isNonPrimarySibling =
      campaign.business_prospect_id &&
      campaign.is_primary_sibling === false &&
      await this.hasSiblingCampaigns(campaign.business_prospect_id!, campaignId);

    if (isNonPrimarySibling) {
      const primaryId = await this.resolvePrimarySiblingCampaignId(
        campaign.business_prospect_id!,
        campaignId,
        ctx,
      );
      throw new ConflictError(
        `Intelligence is gathered on the primary sibling campaign. Edit the worksheet on campaign ${primaryId ?? 'the primary sibling'} instead.`,
      );
    }

    // 3. Build the full payload
    const businessName = campaign.business_name ?? '';
    const address = this.formatAddress(campaign);

    // Default linked_audit_reference to the latest business_analysis audit id
    const linkedAuditReference =
      input.payload.linked_audit_reference ?? campaign.mkt_audits_list[0]?.id ?? null;

    // 4. Compute recommended_salutation (server-side — client input ignored)
    const recommendedSalutation = resolveSalutation(input.payload, businessName);

    const fullPayload: OutreachIntelligencePayload = {
      business_name: businessName,
      address,
      linked_audit_reference: linkedAuditReference,
      prepared_by: input.payload.prepared_by,
      research_date: input.payload.research_date,
      owner_name: input.payload.owner_name,
      business_email: input.payload.business_email,
      team_signal: input.payload.team_signal,
      preferred_contact_channel: input.payload.preferred_contact_channel,
      recommended_salutation: recommendedSalutation,
      researcher_notes: input.payload.researcher_notes,
    };

    // 5. Derive denormalized columns from the payload
    const ownerName = input.payload.owner_name.value ?? null;
    const ownerNameConfidence = input.payload.owner_name.source_confidence;
    const businessEmail = input.payload.business_email.value ?? null;
    const businessEmailConfidence = input.payload.business_email.source_confidence;
    const teamSignal = input.payload.team_signal.value;
    const preferredChannel = input.payload.preferred_contact_channel.value ?? null;
    // Prisma's DateTime @db.Date column requires a Date object / ISO-8601
    // DateTime — a bare "YYYY-MM-DD" string throws "premature end of input".
    // Parse at UTC midnight so the date is stable across timezones.
    const researchDate = new Date(`${input.payload.research_date}T00:00:00.000Z`);
    const preparedBy = input.payload.prepared_by;

    // 6. Upsert by campaign_id
    const existing = await this.prisma.mkt_outreach_intelligence.findUnique({
      where: { campaign_id: campaignId },
    });

    let row: any;
    if (existing) {
      row = await this.prisma.mkt_outreach_intelligence.update({
        where: { campaign_id: campaignId },
        data: {
          owner_name: ownerName,
          owner_name_confidence: ownerNameConfidence,
          business_email: businessEmail,
          business_email_confidence: businessEmailConfidence,
          team_signal: teamSignal,
          preferred_contact_channel: preferredChannel,
          recommended_salutation: recommendedSalutation,
          research_date: researchDate,
          prepared_by: preparedBy,
          payload: fullPayload as any,
          updated_at: new Date(),
        },
      });
      logger.info('Outreach Intelligence worksheet updated', ctx, { campaignId, worksheetId: existing.id });
    } else {
      const id = generateOutreachIntelligenceId();
      row = await this.prisma.mkt_outreach_intelligence.create({
        data: {
          id,
          campaign_id: campaignId,
          owner_name: ownerName,
          owner_name_confidence: ownerNameConfidence,
          business_email: businessEmail,
          business_email_confidence: businessEmailConfidence,
          team_signal: teamSignal,
          preferred_contact_channel: preferredChannel,
          recommended_salutation: recommendedSalutation,
          research_date: researchDate,
          prepared_by: preparedBy,
          payload: fullPayload as any,
        },
      });
      logger.info('Outreach Intelligence worksheet created', ctx, { campaignId, worksheetId: id });
    }

    // 7. Audit log
    try {
      const { audit } = await import('../audit');
      await audit({
        tenantId: PLATFORM_SCOPE,
        actor: ctx?.userId ?? null,
        actorType: 'user',
        action: existing ? 'update' : 'create',
        payload: {
          entity_type: 'other',
          id: row.id,
          campaign_id: campaignId,
          recommended_salutation: recommendedSalutation,
          owner_name_confidence: ownerNameConfidence,
        },
      });
    } catch (e) {
      // audit failures must not block the write
    }

    return this.mapRow(row);
  }

  // ====================
  // DELETE
  // ====================

  async delete(campaignId: string, ctx?: RequestCtx): Promise<void> {
    const existing = await this.prisma.mkt_outreach_intelligence.findUnique({
      where: { campaign_id: campaignId },
    });

    if (!existing) {
      throw new NotFoundError('Outreach Intelligence worksheet not found');
    }

    await this.prisma.mkt_outreach_intelligence.delete({
      where: { campaign_id: campaignId },
    });

    logger.info('Outreach Intelligence worksheet deleted', ctx, { campaignId, worksheetId: existing.id });

    try {
      const { audit } = await import('../audit');
      await audit({
        tenantId: PLATFORM_SCOPE,
        actor: ctx?.userId ?? null,
        actorType: 'user',
        action: 'delete',
        payload: {
          entity_type: 'other',
          id: existing.id,
          campaign_id: campaignId,
        },
      });
    } catch (e) {
      // audit failures must not block
    }
  }

  // ====================
  // HELPERS
  // ====================

  /**
   * Resolve the primary sibling's campaign id for a non-primary sibling.
   * Self-contained — does not call MarketingCampaignService.loadPrimarySiblingAudits.
   * Falls back to the earliest-created sibling if no primary is marked (legacy data).
   */
  private async resolvePrimarySiblingCampaignId(
    businessProspectId: string,
    excludeCampaignId: string,
    ctx?: RequestCtx,
  ): Promise<string | null> {
    try {
      const siblings = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          business_prospect_id: businessProspectId,
          scope: 'business',
        } as any,
        select: {
          id: true,
          is_primary_sibling: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      }) as any[];

      const primary =
        siblings.find((s) => s.is_primary_sibling === true && s.id !== excludeCampaignId) ??
        siblings.find((s) => s.id !== excludeCampaignId);

      return primary?.id ?? null;
    } catch (error) {
      logger.warn('Failed to resolve primary sibling campaign id', ctx, {
        error: (error as Error).message,
        businessProspectId,
        excludeCampaignId,
      });
      return null;
    }
  }

  /**
   * Check whether a campaign has sibling campaigns sharing the same
   * business_prospect_id (used to distinguish a true non-primary sibling
   * from a sole campaign with business_prospect_id set but no siblings).
   */
  private async hasSiblingCampaigns(
    businessProspectId: string,
    excludeCampaignId: string,
  ): Promise<boolean> {
    const count = await this.prisma.mkt_campaigns_list.count({
      where: {
        business_prospect_id: businessProspectId,
        scope: 'business',
        id: { not: excludeCampaignId },
      } as any,
    });
    return count > 0;
  }

  /**
   * Format the campaign address into a single string for the payload snapshot.
   */
  private formatAddress(campaign: any): string | null {
    const parts = [
      campaign.address_line1,
      campaign.address_city,
      campaign.address_state,
    ].filter((p: any) => p && String(p).trim().length > 0);

    if (parts.length === 0) return null;

    const line1 = campaign.address_line1?.trim();
    const city = campaign.address_city?.trim();
    const state = campaign.address_state?.trim();

    if (line1 && city && state) return `${line1}, ${city}, ${state}`;
    if (line1 && city) return `${line1}, ${city}`;
    if (city && state) return `${city}, ${state}`;
    return line1 ?? city ?? state ?? null;
  }

  /**
   * Map a Prisma row to the API response shape.
   */
  private mapRow(row: any): OutreachIntelligenceResult {
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      owner_name: row.owner_name,
      owner_name_confidence: row.owner_name_confidence,
      business_email: row.business_email,
      business_email_confidence: row.business_email_confidence,
      team_signal: row.team_signal,
      preferred_contact_channel: row.preferred_contact_channel,
      recommended_salutation: row.recommended_salutation,
      research_date: row.research_date
        ? (row.research_date instanceof Date
          ? row.research_date.toISOString().split('T')[0]
          : String(row.research_date))
        : null,
      prepared_by: row.prepared_by,
      payload: row.payload as OutreachIntelligencePayload,
      created_at: row.created_at?.toISOString?.() ?? String(row.created_at),
      updated_at: row.updated_at?.toISOString?.() ?? String(row.updated_at),
    };
  }
}

export default OutreachIntelligenceService.getInstance();
