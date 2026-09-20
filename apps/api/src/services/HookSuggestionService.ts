/**
 * HookSuggestionService — Server-side starter hook suggestions
 *
 * Ranks the hook angles from the catalog against a campaign's resolved
 * archetype + detected signals, and returns copy with merge fields resolved
 * (salutation from Sprint 1's worksheet, city, category, sender name).
 *
 * Ranking: archetype-affinity hooks first, ordered by signal-match count
 * (deterministic tie-break by catalog order). Returns the full catalog, ranked
 * — the operator can always pick off-rank.
 *
 * Merge resolution never fabricates — missing values keep the placeholder
 * visible so the operator sees what's unresolved.
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md §13
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { resolveClaimUrlForCampaign } from './outreach-openers/outreach-link-vars';
import { resolveCampaignArchetype } from './OutreachOpenerService';
import CampaignTriageService from './CampaignTriageService';
import MarketingCampaignService from './MarketingCampaignService';
import OutreachIntelligenceService, { resolveSalutation } from './OutreachIntelligenceService';
import { HOOK_LIBRARY, type HookAngle, type HookTemplate } from './outreach-openers/hook-library';
import { getEmergingAngles, extractEmergingArchetype } from './outreach-openers/emerging-angle-map';
import type { ArchetypeCode } from './outreach-openers/archetype-selection';
import type { BusinessAnalysisAuditData } from './outreach-openers/archetype-selection';
import type { DetectedSignal } from './triage/types';
import BusinessContextService from './deliverable/BusinessContextService';
import { computeSignalSeverity, severityRank, type SignalSeverity } from './outreach-openers/signal-magnitude';
import type { LeadPlatformSelection } from './intelligence/IntelligenceProfileService';

// ─── Types ──────────────────────────────────────────────────────────────

export interface RankedHook extends HookTemplate {
  rank: number;
  matchedSignals: string[];
  resolved: {
    subject: string;
    body: string;
  };
}

export interface HookSuggestionResult {
  archetype: ArchetypeCode;
  archetypeSource: 'triage' | 'fallback';
  /**
   * The merge values used to resolve the hooks (business, city, category,
   * salutation, sender_name, claim_url, lead_platform …), nulls omitted.
   * Exposed so the Pitch Construction tab can pre-populate its Construction
   * Variables from the same backend resolve that makes the hooks
   * business-name-aware.
   */
  mergeContext: Record<string, string>;
  /**
   * Platforms ranked by signal_weight × gap_severity (spec §2) — the
   * priority order the hook ranking followed. [0] is the lead platform:
   * where the category's customers are AND the business shows gaps.
   * Empty when no weights resolved.
   */
  platform_priorities: LeadPlatformSelection[];
  suggestions: RankedHook[];
}

// ─── Service ────────────────────────────────────────────────────────────

export class HookSuggestionService extends BaseService {
  private static instance: HookSuggestionService;

  private constructor() {
    super();
  }

  static getInstance(): HookSuggestionService {
    if (!HookSuggestionService.instance) {
      HookSuggestionService.instance = new HookSuggestionService();
    }
    return HookSuggestionService.instance;
  }

  /**
   * Suggest ranked hooks for a campaign with merge fields resolved.
   *
   * 1. Resolve archetype via resolveCampaignArchetype (sibling's own).
   * 2. Pull detected signals from the triage result (empty set if none).
   * 3. Rank: archetype-affinity first, signal-match tie-break, catalog order fallback.
   * 4. Resolve merge fields per hook.
   */
  async suggestForCampaign(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<HookSuggestionResult> {
    // 1. Resolve archetype
    const resolved = await resolveCampaignArchetype(campaignId, ctx);

    // 2. Pull detected signals from triage result
    let detectedSignals: DetectedSignal[] = [];
    try {
      const triage = await CampaignTriageService.getTriageResult(campaignId, ctx);
      if (triage?.detectedSignals) {
        detectedSignals = triage.detectedSignals;
      }
    } catch {
      // No triage result — rank by archetype affinity only
    }
    const signalCodes = new Set(detectedSignals.map((s) => s.code));

    // 2b. Compute severity for each detected signal — the ranking weights
    // signal matches by severity (crisis > material > cosmetic > borderline),
    // not raw count. This prevents 3 cosmetic NAP-drift signals from
    // outranking 1 crisis broken-website signal. Best-effort: if audit data
    // can't be loaded, fall back to 'borderline' for all signals.
    let auditData: BusinessAnalysisAuditData | null = null;
    try {
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (auditResult) {
        auditData = auditResult.auditData;
      }
    } catch {
      // No audit data — severity defaults to 'borderline'
    }
    const signalSeverity = new Map<string, SignalSeverity>();
    for (const sig of detectedSignals) {
      signalSeverity.set(sig.code, auditData
        ? computeSignalSeverity(sig.code, auditData)
        : 'borderline');
    }

    // 3. Load campaign for merge fields
    const campaign = await MarketingCampaignService.getCampaign(campaignId, ctx);
    const businessName = campaign.business_name ?? null;
    const city = campaign.city ?? null;
    // service_category is the operator-set field; category is the prospect-
    // discovery field. Fall back to category when service_category is null.
    const category = campaign.service_category ?? campaign.category ?? null;

    // 4. Resolve salutation — from worksheet (with sibling inheritance), or
    //    inline fallback chain against the campaign's business name.
    let salutation = 'Hi there,';
    try {
      const worksheet = await OutreachIntelligenceService.getForCampaign(campaignId, ctx);
      if (worksheet) {
        salutation = worksheet.recommended_salutation;
      } else {
        // No worksheet — run the fallback chain inline
        salutation = resolveSalutation(
          { owner_name: { value: null, source: null, source_confidence: 'unavailable' } },
          businessName,
        );
      }
    } catch {
      // Worksheet lookup failed — use the inline fallback
      salutation = resolveSalutation(
        { owner_name: { value: null, source: null, source_confidence: 'unavailable' } },
        businessName,
      );
    }

    // 5. Resolve sender name — from assigned operator (look up display name)
    //    or platform default
    const senderName = await this.resolveSenderName(campaign, ctx);

    // 6. Build merge context
    // 6a. Resolve claim URL — looks up the directory seed linked to this
    //     campaign and finds an active claim token. Best-effort: if no seed
    //     or no token exists, the placeholder stays visible so the operator
    //     sees what's unresolved (same pattern as other merge fields).
    const claimUrl = await this.resolveClaimUrl(campaignId, ctx);
    const mergeContext: MergeContext = {
      salutation,
      business: businessName,
      city,
      category: category ? category.toLowerCase() : null,
      sender_name: senderName,
      claim_url: claimUrl,
      lead_platform: null,
    };

    // 6b. Platform-aware priority (CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC §2):
    //     rank platforms by signal_weight × gap_severity — the same formula
    //     that picks the opener's lead platform, generalized to a ranking.
    //     A hook attached to a high-scoring platform outranks one on a
    //     low-scoring platform at equal signal severity, and the lead
    //     platform becomes the {{lead_platform}} merge var for pitch copy.
    //     Best-effort: unresolved → empty priorities → legacy ordering.
    let platformPriorities: LeadPlatformSelection[] = [];
    try {
      const {
        IntelligenceProfileService,
        rankPlatformPriorities,
        signalPlatformDisplayName,
      } = await import('./intelligence/IntelligenceProfileService');
      const resolvedWeights = await IntelligenceProfileService.getInstance()
        .resolveSignalWeightsForCampaign(campaign as any, auditData, ctx);
      platformPriorities = rankPlatformPriorities(auditData, resolvedWeights);
      const lead = platformPriorities[0];
      if (lead) {
        mergeContext.lead_platform = signalPlatformDisplayName(lead.platform);
      }
    } catch {
      // Weight resolution is best-effort — hooks rank by severity alone and
      // {{lead_platform}} stays a visible placeholder.
    }
    const platformScores = new Map(platformPriorities.map((p) => [p.platform, p.score]));

    // 7. Extract V3 emerging archetype for rank boost (after archetype affinity,
    //    before signal-match tie-break). Best-effort — no audit means no boost.
    let emergingAngles: HookAngle[] = [];
    try {
      const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
      if (auditResult) {
        const emergingArchetype = extractEmergingArchetype(auditResult.auditData, businessName);
        if (emergingArchetype) {
          emergingAngles = getEmergingAngles(emergingArchetype);
        }
      }
    } catch {
      // No audit data — rank without emerging boost
    }

    // 8. Rank + resolve
    const ranked = this.rankHooks(resolved.archetype, signalCodes, emergingAngles, signalSeverity, platformScores);
    const suggestions: RankedHook[] = ranked.map((entry, idx) => ({
      ...entry.template,
      rank: idx + 1,
      matchedSignals: entry.matchedSignals,
      resolved: {
        subject: this.resolveMerge(entry.template.subject, mergeContext),
        body: this.resolveMerge(entry.template.body, mergeContext),
      },
    }));

    // Nulls omitted so the frontend only pre-populates resolvable values.
    const exposedMergeContext: Record<string, string> = {};
    for (const [k, v] of Object.entries(mergeContext)) {
      if (v !== null && v !== undefined) exposedMergeContext[k] = v;
    }

    return {
      archetype: resolved.archetype,
      archetypeSource: resolved.source,
      mergeContext: exposedMergeContext,
      platform_priorities: platformPriorities,
      suggestions,
    };
  }

  // ─── Ranking ──────────────────────────────────────────────────────────

  /**
   * Rank the full hook catalog: archetype-affinity first, emerging-archetype boost
   * (ordered by list position), signal-match severity-weighted tie-break,
   * catalog order as the final deterministic fallback.
   *
   * Signal-match tie-break uses SEVERITY-WEIGHTED score, not raw count.
   * A single crisis signal (severity weight 4) outranks three cosmetic
   * signals (3 × 2 = 6... wait, 4 < 6). Actually the weights are:
   *   crisis=4, material=3, cosmetic=2, borderline=1
   * So 3 cosmetic = 6 > 1 crisis = 4. That's still wrong.
   *
   * To fix this properly, crisis signals must always outrank any number of
   * cosmetic signals. We use a two-tier tie-break:
   *   3a. Max severity among matched signals (crisis > material > cosmetic)
   *   3b. Sum of severity weights (quantity-quality hybrid)
   * This ensures a crisis-matching hook always ranks above a cosmetic-only
   * hook, regardless of how many cosmetic signals match.
   *
   * Both severity keys are scaled by (1 + platformScore), where
   * platformScore is the hook platform's signal_weight × gap_severity
   * (spec §2) — severity becomes platform-aware: the same problem on the
   * platform that carries this category's traffic outranks one on a
   * low-signal platform. A residual platformScore tie-break orders the
   * signal-less tail by platform pull. When no weights resolve, every
   * score is 0 and the ordering is byte-identical to legacy.
   */
  private rankHooks(
    archetype: ArchetypeCode,
    signalCodes: Set<string>,
    emergingAngles: HookAngle[] = [],
    signalSeverity: Map<string, SignalSeverity> = new Map(),
    platformScores: Map<string, number> = new Map(),
  ): { template: HookTemplate; matchedSignals: string[] }[] {
    // Precompute emerging boost positions (lower = stronger boost)
    const emergingBoostPos = new Map<HookAngle, number>();
    emergingAngles.forEach((angle, idx) => emergingBoostPos.set(angle, idx));

    return HOOK_LIBRARY.map((template, catalogIdx) => {
      const hasArchetypeAffinity = template.archetypes.includes(archetype);
      const matchedSignals = template.signals.filter((s) => signalCodes.has(s));
      const emergingBoost = emergingBoostPos.has(template.angle)
        ? emergingBoostPos.get(template.angle)!
        : -1;
      // Severity-weighted scoring: max severity + sum of severity weights.
      // Max severity ensures crisis-matching hooks always outrank cosmetic-only
      // hooks. Sum breaks ties within the same max severity tier.
      const matchedSeverities = matchedSignals.map((s) => signalSeverity.get(s) ?? 'borderline');
      const maxSeverityRank = matchedSeverities.length > 0
        ? Math.max(...matchedSeverities.map(severityRank))
        : 0;
      const severitySum = matchedSeverities.reduce((sum, sev) => sum + severityRank(sev), 0);
      // Platform-aware score (spec §2): the hook's platforms' best
      // signal_weight × gap_severity. 0 for untagged/unweighted hooks.
      const platformScore = Math.max(
        0,
        ...(template.platforms ?? []).map((p) => platformScores.get(p) ?? 0),
      );
      return {
        template,
        matchedSignals,
        hasArchetypeAffinity,
        hasEmergingBoost: emergingBoost >= 0,
        emergingBoost,
        signalCount: matchedSignals.length,
        maxSeverityRank,
        severitySum,
        platformScore,
        catalogIdx,
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
      // 3a. Max severity among matched signals, scaled by platform pull —
      //     the same problem on a high-weight platform outranks one on a
      //     low-weight platform.
      const aMax = a.maxSeverityRank * (1 + a.platformScore);
      const bMax = b.maxSeverityRank * (1 + b.platformScore);
      if (aMax !== bMax) {
        return bMax - aMax;
      }
      // 3b. Severity-weighted sum, same platform scaling
      const aSum = a.severitySum * (1 + a.platformScore);
      const bSum = b.severitySum * (1 + b.platformScore);
      if (aSum !== bSum) {
        return bSum - aSum;
      }
      // 3c. Residual platform pull — orders signal-less hooks toward the
      //     platform where the category's customers are.
      if (a.platformScore !== b.platformScore) {
        return b.platformScore - a.platformScore;
      }
      // 4. Catalog order (deterministic)
      return a.catalogIdx - b.catalogIdx;
    }).map((entry) => ({
      template: entry.template,
      matchedSignals: entry.matchedSignals,
    }));
  }

  // ─── Merge resolution ─────────────────────────────────────────────────

  /**
   * Resolve merge placeholders in a template string. Unresolvable
   * placeholders render as-is (visible to the operator — never fabricated).
   */
  private resolveMerge(template: string, ctx: MergeContext): string {
    return template
      .replace(/\{\{salutation\}\}/g, ctx.salutation ?? '{{salutation}}')
      .replace(/\{\{business\}\}/g, ctx.business ?? '{{business}}')
      .replace(/\{\{city\}\}/g, ctx.city ?? '{{city}}')
      .replace(/\{\{category\}\}/g, ctx.category ?? '{{category}}')
      .replace(/\{\{sender_name\}\}/g, ctx.sender_name ?? '{{sender_name}}')
      .replace(/\{\{claim_url\}\}/g, ctx.claim_url ?? '{{claim_url}}')
      .replace(/\{\{lead_platform\}\}/g, ctx.lead_platform ?? '{{lead_platform}}');
  }

  // ─── Sender name resolution ───────────────────────────────────────────

  /**
   * Resolve the sender display name. Looks up the assigned operator's
   * display name from the users table. Falls back to a platform default
   * when no operator is assigned or the lookup fails.
   */
  private async resolveSenderName(campaign: any, ctx?: RequestCtx): Promise<string> {
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
    // Platform default — matches the opener workspace's operator-name prefill
    return 'your team';
  }

  /**
   * Resolve the directory claim URL for a campaign. Delegates to the shared
   * outreach-link resolver so every surface emits the canonical
   * /place/claim/{token} path (spec §5.1/§5.2). Best-effort: any failure
   * returns null, which renders as the visible {{claim_url}} placeholder.
   */
  async resolveClaimUrl(campaignId: string, _ctx?: RequestCtx): Promise<string | null> {
    return resolveClaimUrlForCampaign(campaignId);
  }
}

// ─── Internal types ─────────────────────────────────────────────────────

interface MergeContext {
  salutation: string | null;
  business: string | null;
  city: string | null;
  category: string | null;
  sender_name: string | null;
  claim_url: string | null;
  /**
   * Display name of the lead platform (signal_weight × gap_severity argmax,
   * spec §2) — "Google", "Yelp", … for pitch copy like "your customers are
   * on {{lead_platform}}". Null when no weights resolve; the placeholder
   * stays visible.
   */
  lead_platform: string | null;
}

// ─── Export singleton ───────────────────────────────────────────────────

export default HookSuggestionService.getInstance();
