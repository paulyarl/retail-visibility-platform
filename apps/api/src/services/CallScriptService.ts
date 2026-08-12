/**
 * CallScriptService — Cold-call script assembly + worksheet write-back
 *
 * Two responsibilities:
 * 1. assembleForCampaign — deterministic assembly of the five-stage
 *    cold-call script (Verify → Hook → Bridge → Ask → Close) with merge
 *    fields resolved server-side. Only Stage 2 (the Hook) varies per
 *    angle; stages 1/3/4/5 are code-defined constants.
 * 2. applyCallConfirmations — fill-and-confirm write-back of call-confirmed
 *    fields into the Outreach Intelligence worksheet. Never clobbers a
 *    conflicting non-null value; conflicts surface to the operator.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_cold_call_channel_sprint_plan.md §5.2–§5.4
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { audit } from '../audit';
import type { RequestCtx } from '../context';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import MarketingCampaignService from './MarketingCampaignService';
import { resolveCampaignArchetype } from './OutreachOpenerService';
import CampaignTriageService from './CampaignTriageService';
import OutreachIntelligenceService, {
  resolveSalutation,
  type SourceConfidence,
  type TeamSignalValue,
  type SourcedField,
  type OutreachIntelligenceResult,
} from './OutreachIntelligenceService';
import MarketingDeliverableService from './MarketingDeliverableService';
import {
  HOOK_LIBRARY,
  HOOK_ANGLE_KEYS,
  getHook,
  isValidHookAngle,
  CALL_SCRIPT_VERIFY,
  CALL_SCRIPT_BRIDGE,
  CALL_SCRIPT_ASK,
  CALL_SCRIPT_ASK_DECLINE_FALLBACK,
  CALL_SCRIPT_CLOSE,
  CALL_SCRIPT_OBJECTIONS,
  type HookAngle,
  type HookTemplate,
  type ObjectionRow,
} from './outreach-openers/hook-library';
import {
  getEmergingAngles,
  extractEmergingArchetype,
  extractGrowthReadiness,
  deriveChannelHint,
  type ChannelHint,
} from './outreach-openers/emerging-angle-map';
import type { ArchetypeCode } from './outreach-openers/archetype-selection';
import type { DetectedSignal } from './triage/types';
import BusinessContextService from './deliverable/BusinessContextService';

// ─── Types ──────────────────────────────────────────────────────────────

export interface RankedPhoneHook {
  angle: HookAngle;
  label: string;
  archetypes: ArchetypeCode[];
  signals: string[];
  phone_hook: string;
  resolved_phone_hook: string;
  rank: number;
  matchedSignals: string[];
}

export interface CallContext {
  phone: string;
  owner_name: string | null;
  owner_name_confidence: SourceConfidence;
  team_signal: TeamSignalValue;
  gallery_short_url: string | null;
  channel_hint: ChannelHint;
}

export interface AssembledCallScript {
  stages: {
    verify: string;
    hook: { angle: HookAngle; label: string; line: string };
    bridge: string;
    ask: string;
    ask_decline_fallback: string;
    close: string;
  };
  hookOptions: RankedPhoneHook[];
  objections: ObjectionRow[];
  callContext: CallContext;
}

export interface CallConfirmationInput {
  campaignId: string;
  callLogId: string;
  callDate: string; // YYYY-MM-DD
  contactedBy: string | null;
  ownerNameConfirmed: string | null;
  teamSignalConfirmed: TeamSignalValue | null;
  preferredChannelConfirmed: string | null;
  emailObtained: boolean | null;
  emailValue: string | null;
}

export interface CallConfirmationResult {
  writeTargetCampaignId: string;
  worksheetId: string | null;
  written: string[];
  conflicts: Array<{ field: string; existingValue: string; newValue: string }>;
  campaignEmailFilled: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────

export class CallScriptService extends BaseService {
  private static instance: CallScriptService;

  private constructor() {
    super();
  }

  static getInstance(): CallScriptService {
    if (!CallScriptService.instance) {
      CallScriptService.instance = new CallScriptService();
    }
    return CallScriptService.instance;
  }

  // ─── Assembly ─────────────────────────────────────────────────────────

  /**
   * Assemble the five-stage cold-call script for a campaign.
   *
   * 1. Load campaign (404 if missing). Require campaign.phone (400
   *    phone_required otherwise).
   * 2. Resolve ranked hooks (archetype + signals — channel-agnostic ranking).
   * 3. Resolve phone merge fields.
   * 4. Read the worksheet for call context (who to ask for, team signal).
   * 5. Resolve the active gallery short URL for the SMS handoff.
   * 6. Return the assembled script with all 13 ranked hook options.
   */
  async assembleForCampaign(
    campaignId: string,
    angle?: string,
    ctx?: RequestCtx,
  ): Promise<AssembledCallScript> {
    // 1. Load campaign
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    if (!campaign) {
      throw new NotFoundError(`Campaign ${campaignId} not found`);
    }
    if (!campaign.phone) {
      throw new ValidationError('phone_required');
    }

    // 2. Resolve ranked hooks
    const resolved = await resolveCampaignArchetype(campaignId, ctx);

    let detectedSignals: DetectedSignal[] = [];
    try {
      const triage = await CampaignTriageService.getTriageResult(campaignId, ctx);
      if (triage?.detectedSignals) {
        detectedSignals = triage.detectedSignals;
      }
    } catch {
      // No triage — rank by archetype affinity only
    }
    const signalCodes = new Set(detectedSignals.map((s) => s.code));

    // 3. Resolve phone merge fields
    const businessName = campaign.business_name ?? null;
    const city = campaign.city ?? null;
    // service_category is the operator-set field; category is the prospect-
    // discovery field. Fall back to category when service_category is null.
    const rawCategory = campaign.service_category ?? campaign.category ?? null;
    const category = rawCategory ? rawCategory.toLowerCase() : null;
    const address = this.formatAddress(campaign);
    const operatorName = await this.resolveOperatorName(campaign, ctx);

    const mergeContext: PhoneMergeContext = {
      business: businessName,
      address,
      category,
      city,
      operator_name: operatorName,
    };

    // 4. Read worksheet for call context
    let ownerName: string | null = null;
    let ownerNameConfidence: SourceConfidence = 'unavailable';
    let teamSignal: TeamSignalValue = 'unknown';
    try {
      const worksheet = await OutreachIntelligenceService.getForCampaign(campaignId, ctx);
      if (worksheet) {
        ownerName = worksheet.owner_name ?? null;
        ownerNameConfidence = worksheet.owner_name_confidence ?? 'unavailable';
        teamSignal = worksheet.team_signal ?? 'unknown';
      }
    } catch {
      // Worksheet lookup failed — use defaults
    }

    // 5. Resolve gallery short URL
    const galleryShortUrl = await this.resolveGalleryShortUrl(campaignId, ctx);

    // 5b. Extract V3 emerging archetype + channel hint (best-effort)
    let emergingAngles: HookAngle[] = [];
    let channelHint: ChannelHint = null;
    try {
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (auditResult) {
        const emergingArchetype = extractEmergingArchetype(auditResult.auditData, businessName);
        if (emergingArchetype) {
          emergingAngles = getEmergingAngles(emergingArchetype);
        }
        const growthReadiness = extractGrowthReadiness(auditResult.auditData, businessName);
        channelHint = deriveChannelHint(
          growthReadiness,
          !!campaign.phone,
          !!campaign.email,
          !!campaign.website,
        );
      }
    } catch {
      // No audit data — rank without emerging boost
    }

    // 6. Rank + resolve all 13 hooks (with emerging-archetype boost)
    const ranked = this.rankPhoneHooks(resolved.archetype, signalCodes, mergeContext, emergingAngles);

    // 7. Select the hook for Stage 2
    const selectedAngle: HookAngle = (angle && isValidHookAngle(angle))
      ? (angle as HookAngle)
      : ranked[0]?.angle ?? 'gbp_verification';
    const selectedHook = getHook(selectedAngle);
    const selectedRanked = ranked.find((h) => h.angle === selectedAngle);

    const hookLine = selectedRanked?.resolved_phone_hook
      ?? this.resolveMerge(selectedHook?.phone_hook ?? '', mergeContext);

    // 8. Assemble the fixed stages
    const verifyStage = this.resolveMerge(CALL_SCRIPT_VERIFY, mergeContext);
    const bridgeStage = this.resolveMerge(CALL_SCRIPT_BRIDGE, mergeContext);
    const askStage = this.resolveMerge(CALL_SCRIPT_ASK, mergeContext);
    const closeStage = this.resolveMerge(CALL_SCRIPT_CLOSE, mergeContext);

    return {
      stages: {
        verify: verifyStage,
        hook: {
          angle: selectedAngle,
          label: selectedHook?.label ?? selectedAngle,
          line: hookLine,
        },
        bridge: bridgeStage,
        ask: askStage,
        ask_decline_fallback: CALL_SCRIPT_ASK_DECLINE_FALLBACK,
        close: closeStage,
      },
      hookOptions: ranked,
      objections: CALL_SCRIPT_OBJECTIONS,
      callContext: {
        phone: campaign.phone,
        owner_name: ownerName,
        owner_name_confidence: ownerNameConfidence,
        team_signal: teamSignal,
        gallery_short_url: galleryShortUrl,
        channel_hint: channelHint,
      },
    };
  }

  // ─── Worksheet write-back ─────────────────────────────────────────────

  /**
   * Apply call-confirmed fields to the Outreach Intelligence worksheet.
   *
   * Fill-and-confirm semantics:
   * - Field empty/unavailable + call confirmed a value → write value,
   *   source: "Phone call YYYY-MM-DD", source_confidence: 'confirmed'.
   * - Field already confirmed with the same value → no-op (idempotent).
   * - Field holds a different non-null value → conflict (returned, not
   *   overwritten).
   * - No worksheet row → create one with the confirmed fields.
   * - email_obtained + email_value also fills campaigns.email null-only.
   *
   * Write target: the campaign itself, unless it's a non-primary sibling
   * — then the primary sibling's campaign id (never hits the 409 path).
   */
  async applyCallConfirmations(
    input: CallConfirmationInput,
    ctx?: RequestCtx,
  ): Promise<CallConfirmationResult> {
    // 1. Resolve write target (primary sibling if non-primary)
    const writeTargetCampaignId = await this.resolveWriteTarget(input.campaignId, ctx);

    // 2. Load the target worksheet
    const existing = await this.prisma.mkt_outreach_intelligence.findUnique({
      where: { campaign_id: writeTargetCampaignId },
    });

    const sourceString = `Phone call ${input.callDate}`;
    const written: string[] = [];
    const conflicts: Array<{ field: string; existingValue: string; newValue: string }> = [];

    // 3. Build the update payload (fill-and-confirm)
    const updateData: any = {};
    const createData: any = {
      id: await this.generateId(),
      campaign_id: writeTargetCampaignId,
      prepared_by: input.contactedBy ?? 'phone_call',
      research_date: input.callDate,
      payload: {
        business_name: '',
        address: null,
        linked_audit_reference: null,
        prepared_by: input.contactedBy ?? 'phone_call',
        research_date: input.callDate,
        researcher_notes: `Created from ${sourceString}`,
      },
    };

    // Owner name
    if (input.ownerNameConfirmed && input.ownerNameConfirmed.trim()) {
      const existingValue = existing?.owner_name ?? null;
      const existingConfidence = existing?.owner_name_confidence ?? 'unavailable';
      if (!existingValue || existingConfidence === 'unavailable') {
        updateData.owner_name = input.ownerNameConfirmed.trim();
        updateData.owner_name_source = sourceString;
        updateData.owner_name_confidence = 'confirmed';
        createData.owner_name = input.ownerNameConfirmed.trim();
        createData.owner_name_source = sourceString;
        createData.owner_name_confidence = 'confirmed';
        written.push('owner_name');
      } else if (existingValue === input.ownerNameConfirmed.trim()) {
        // Idempotent — same value, no-op
      } else {
        conflicts.push({
          field: 'owner_name',
          existingValue,
          newValue: input.ownerNameConfirmed.trim(),
        });
      }
    }

    // Team signal
    if (input.teamSignalConfirmed && input.teamSignalConfirmed !== 'unknown') {
      const existingValue = existing?.team_signal ?? 'unknown';
      if (existingValue === 'unknown') {
        updateData.team_signal = input.teamSignalConfirmed;
        updateData.team_signal_source = sourceString;
        updateData.team_signal_confidence = 'confirmed';
        createData.team_signal = input.teamSignalConfirmed;
        createData.team_signal_source = sourceString;
        createData.team_signal_confidence = 'confirmed';
        written.push('team_signal');
      } else if (existingValue === input.teamSignalConfirmed) {
        // Idempotent
      } else {
        conflicts.push({
          field: 'team_signal',
          existingValue,
          newValue: input.teamSignalConfirmed,
        });
      }
    }

    // Preferred channel
    if (input.preferredChannelConfirmed && input.preferredChannelConfirmed.trim()) {
      const existingValue = existing?.preferred_contact_channel ?? null;
      if (!existingValue) {
        updateData.preferred_contact_channel = input.preferredChannelConfirmed.trim();
        updateData.preferred_contact_channel_source = sourceString;
        updateData.preferred_contact_channel_confidence = 'confirmed';
        createData.preferred_contact_channel = input.preferredChannelConfirmed.trim();
        createData.preferred_contact_channel_source = sourceString;
        createData.preferred_contact_channel_confidence = 'confirmed';
        written.push('preferred_contact_channel');
      } else if (existingValue === input.preferredChannelConfirmed.trim()) {
        // Idempotent
      } else {
        conflicts.push({
          field: 'preferred_contact_channel',
          existingValue,
          newValue: input.preferredChannelConfirmed.trim(),
        });
      }
    }

    // Email — fills worksheet + campaign.email (null-only)
    let campaignEmailFilled = false;
    if (input.emailObtained === true && input.emailValue && input.emailValue.trim()) {
      const existingEmail = existing?.business_email ?? null;
      if (!existingEmail) {
        updateData.business_email = input.emailValue.trim();
        updateData.business_email_source = sourceString;
        updateData.business_email_confidence = 'confirmed';
        createData.business_email = input.emailValue.trim();
        createData.business_email_source = sourceString;
        createData.business_email_confidence = 'confirmed';
        written.push('business_email');
      } else if (existingEmail === input.emailValue.trim()) {
        // Idempotent
      } else {
        conflicts.push({
          field: 'business_email',
          existingValue: existingEmail,
          newValue: input.emailValue.trim(),
        });
      }

      // Null-only campaign.email fill (mirrors HotProspectService rule)
      const campaignRow = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: writeTargetCampaignId },
        select: { email: true },
      });
      if (campaignRow && !campaignRow.email) {
        await this.prisma.mkt_campaigns_list.update({
          where: { id: writeTargetCampaignId },
          data: { email: input.emailValue.trim() },
        });
        campaignEmailFilled = true;
      }
    }

    // 4. Persist — update existing or create new
    let worksheetId: string | null = null;
    if (existing) {
      if (written.length > 0) {
        // Recompute salutation if owner_name changed
        if (written.includes('owner_name')) {
          const campaign = await this.prisma.mkt_campaigns_list.findUnique({
            where: { id: writeTargetCampaignId },
            select: { business_name: true },
          });
          updateData.recommended_salutation = resolveSalutation(
            { owner_name: { value: updateData.owner_name, source: sourceString, source_confidence: 'confirmed' } },
            campaign?.business_name ?? null,
          );
        }
        const updated = await this.prisma.mkt_outreach_intelligence.update({
          where: { campaign_id: writeTargetCampaignId },
          data: updateData,
        });
        worksheetId = updated.id;
      } else {
        worksheetId = existing.id;
      }
    } else {
      // Create new worksheet with confirmed fields
      // Recompute salutation
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: writeTargetCampaignId },
        select: { business_name: true },
      });
      createData.recommended_salutation = resolveSalutation(
        { owner_name: { value: createData.owner_name ?? null, source: sourceString, source_confidence: 'confirmed' } },
        campaign?.business_name ?? null,
      );
      // Fill defaults for fields not confirmed
      if (!createData.owner_name) createData.owner_name = null;
      if (!createData.business_email) createData.business_email = null;
      if (!createData.team_signal) createData.team_signal = 'unknown';
      if (!createData.preferred_contact_channel) createData.preferred_contact_channel = null;

      const created = await this.prisma.mkt_outreach_intelligence.create({
        data: createData,
      });
      worksheetId = created.id;
    }

    // 5. Audit
    try {
      await audit({
        actor: ctx?.userId ?? null,
        actorType: 'user',
        action: 'update',
        payload: {
          entity_type: 'other',
          id: writeTargetCampaignId,
          campaign_id: writeTargetCampaignId,
          call_log_id: input.callLogId,
          call_date: input.callDate,
          written,
          conflicts: conflicts.map((c) => c.field),
          campaign_email_filled: campaignEmailFilled,
          worksheet_id: worksheetId,
        },
      });
    } catch (e) {
      // audit failures must not block
    }

    logger.info('Call confirmations applied', ctx, {
      campaignId: writeTargetCampaignId,
      callLogId: input.callLogId,
      written,
      conflicts: conflicts.length,
    });

    return {
      writeTargetCampaignId,
      worksheetId,
      written,
      conflicts,
      campaignEmailFilled,
    };
  }

  // ─── Ranking (phone hooks) ────────────────────────────────────────────

  /**
   * Rank all 13 hooks for the phone channel. Same ranking logic as
   * HookSuggestionService but resolves phone_hook instead of email body.
   * Emerging-archetype boost applied after archetype affinity, before
   * signal-match tie-break.
   */
  private rankPhoneHooks(
    archetype: ArchetypeCode,
    signalCodes: Set<string>,
    mergeContext: PhoneMergeContext,
    emergingAngles: HookAngle[] = [],
  ): RankedPhoneHook[] {
    const emergingBoostPos = new Map<HookAngle, number>();
    emergingAngles.forEach((a, idx) => emergingBoostPos.set(a, idx));

    return HOOK_LIBRARY.map((template, catalogIdx) => {
      const hasArchetypeAffinity = template.archetypes.includes(archetype);
      const matchedSignals = template.signals.filter((s) => signalCodes.has(s));
      const emergingBoost = emergingBoostPos.has(template.angle)
        ? emergingBoostPos.get(template.angle)!
        : -1;
      return {
        template,
        hasArchetypeAffinity,
        hasEmergingBoost: emergingBoost >= 0,
        emergingBoost,
        signalCount: matchedSignals.length,
        catalogIdx,
        matchedSignals,
      };
    }).sort((a, b) => {
      // 1. Archetype-affinity hooks first
      if (a.hasArchetypeAffinity !== b.hasArchetypeAffinity) {
        return a.hasArchetypeAffinity ? -1 : 1;
      }
      // 2. Emerging-archetype boost (after affinity, before signal tie-break)
      if (a.hasEmergingBoost !== b.hasEmergingBoost) {
        return a.hasEmergingBoost ? -1 : 1;
      }
      if (a.hasEmergingBoost && b.hasEmergingBoost) {
        return a.emergingBoost - b.emergingBoost;
      }
      // 3. Signal-match tie-break
      if (a.signalCount !== b.signalCount) {
        return b.signalCount - a.signalCount;
      }
      // 4. Catalog order (deterministic)
      return a.catalogIdx - b.catalogIdx;
    }).map((entry, idx) => ({
      angle: entry.template.angle,
      label: entry.template.label,
      archetypes: entry.template.archetypes,
      signals: entry.template.signals,
      phone_hook: entry.template.phone_hook,
      resolved_phone_hook: this.resolveMerge(entry.template.phone_hook, mergeContext),
      rank: idx + 1,
      matchedSignals: entry.matchedSignals,
    }));
  }

  // ─── Merge resolution ─────────────────────────────────────────────────

  /**
   * Resolve phone merge placeholders. Unresolvable placeholders render
   * as-is (visible to the operator — never fabricated).
   */
  private resolveMerge(template: string, ctx: PhoneMergeContext): string {
    return template
      .replace(/\{\{business\}\}/g, ctx.business ?? '{{business}}')
      .replace(/\{\{address\}\}/g, ctx.address ?? '{{address}}')
      .replace(/\{\{category\}\}/g, ctx.category ?? '{{category}}')
      .replace(/\{\{city\}\}/g, ctx.city ?? '{{city}}')
      .replace(/\{\{operator_name\}\}/g, ctx.operator_name ?? '{{operator_name}}');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Format the campaign address into a single spoken string.
   * Mirrors OutreachIntelligenceService.formatAddress.
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

    if (line1 && city && state) {
      return `${line1}, ${city}, ${state}`;
    }
    if (line1 && city) {
      return `${line1}, ${city}`;
    }
    if (city && state) {
      return `${city}, ${state}`;
    }
    return parts.map((p: any) => String(p).trim()).join(', ');
  }

  /**
   * Resolve the operator display name — looks up the assigned operator's
   * display name from the users table. Falls back to a platform default
   * when no operator is assigned or the lookup fails.
   */
  private async resolveOperatorName(campaign: any, ctx?: RequestCtx): Promise<string> {
    const assigned = campaign?.assigned_to;
    if (assigned && typeof assigned === 'string' && assigned.trim().length > 0) {
      // If it's already a display name (not a uid-), use it directly
      if (!assigned.startsWith('uid-')) {
        return assigned.trim();
      }
      // Look up the user's display name from the users table
      try {
        const user = await this.prisma.users.findUnique({
          where: { id: assigned },
          select: { first_name: true, last_name: true, email: true },
        });
        if (user) {
          const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
            || null;
          if (displayName && displayName.length > 0) {
            return displayName;
          }
          // Fall back to email local-part if no name fields
          if (user.email) {
            return user.email.split('@')[0];
          }
        }
      } catch {
        // User lookup failed — fall through to default
      }
    }
    return 'your team';
  }

  /**
   * Resolve the campaign's most recent active gallery short URL for the
   * SMS handoff. Mirrors LogContactModal.handleInsertGalleryLink.
   */
  private async resolveGalleryShortUrl(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<string | null> {
    try {
      const tokens = await this.prisma.mkt_deliverable_preview_tokens.findMany({
        where: {
          campaign_id: campaignId,
          token_type: { in: ['diagnostic_gallery', 'multi_diagnostic_gallery'] },
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          token: true,
          token_type: true,
          short_code: true,
          expires_at: true,
          converted_at: true,
        },
      });

      const now = new Date();
      const activeToken = tokens
        .filter((t: any) => !t.converted_at && (!t.expires_at || new Date(t.expires_at) > now))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (!activeToken) return null;

      // Lazy backfill for legacy tokens without a short code
      let shortCode = activeToken.short_code;
      if (!shortCode) {
        shortCode = await MarketingDeliverableService.ensureShortCode(activeToken.id, activeToken.token_type, ctx);
      }

      if (shortCode) {
        return `/g/${shortCode}`;
      }
      // Fall back to long URL if short code backfill failed
      return `/preview/${activeToken.token}`;
    } catch (e) {
      logger.warn('Failed to resolve gallery short URL for call script', ctx, { campaignId });
      return null;
    }
  }

  /**
   * Resolve the write target for worksheet write-back. If the campaign
   * is a non-primary sibling, returns the primary sibling's campaign id.
   * Otherwise returns the campaign itself.
   */
  private async resolveWriteTarget(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<string> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_prospect_id: true,
        is_primary_sibling: true,
        scope: true,
      },
    });

    if (!campaign) return campaignId;

    const isNonPrimarySibling =
      campaign.business_prospect_id &&
      campaign.is_primary_sibling === false &&
      campaign.scope === 'business';

    if (!isNonPrimarySibling) return campaignId;

    // Resolve primary sibling
    const siblings = await this.prisma.mkt_campaigns_list.findMany({
      where: {
        business_prospect_id: campaign.business_prospect_id,
        scope: 'business',
      } as any,
      select: { id: true, is_primary_sibling: true, created_at: true },
      orderBy: { created_at: 'asc' },
    }) as any[];

    const primary =
      siblings.find((s) => s.is_primary_sibling === true && s.id !== campaignId) ??
      siblings.find((s) => s.id !== campaignId);

    return primary?.id ?? campaignId;
  }

  /**
   * Generate an ID for a new worksheet row. Uses the same generator as
   * OutreachIntelligenceService.
   */
  private async generateId(): Promise<string> {
    try {
      const { generateOutreachIntelligenceId } = await import('../lib/id-generator');
      return generateOutreachIntelligenceId();
    } catch {
      return `moi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }
}

// ─── Internal types ─────────────────────────────────────────────────────

interface PhoneMergeContext {
  business: string | null;
  address: string | null;
  category: string | null;
  city: string | null;
  operator_name: string | null;
}

// ─── Re-exports for route layer ─────────────────────────────────────────

export { CALL_SCRIPT_OBJECTIONS };

// ─── Export singleton ───────────────────────────────────────────────────

export default CallScriptService.getInstance();
