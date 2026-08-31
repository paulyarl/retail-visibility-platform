/**
 * HookSuggestionService — Server-side starter hook suggestions
 *
 * Ranks the 12 hook angles from the catalog against a campaign's resolved
 * archetype + detected signals, and returns copy with merge fields resolved
 * (salutation from Sprint 1's worksheet, city, category, sender name).
 *
 * Ranking: archetype-affinity hooks first, ordered by signal-match count
 * (deterministic tie-break by catalog order). Returns all 12, ranked — the
 * operator can always pick off-rank.
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
import { unifiedConfig } from '../config/unifiedConfig';
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
    };

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
    const ranked = this.rankHooks(resolved.archetype, signalCodes, emergingAngles, signalSeverity);
    const suggestions: RankedHook[] = ranked.map((entry, idx) => ({
      ...entry.template,
      rank: idx + 1,
      matchedSignals: entry.matchedSignals,
      resolved: {
        subject: this.resolveMerge(entry.template.subject, mergeContext),
        body: this.resolveMerge(entry.template.body, mergeContext),
      },
    }));

    return {
      archetype: resolved.archetype,
      archetypeSource: resolved.source,
      suggestions,
    };
  }

  // ─── Ranking ──────────────────────────────────────────────────────────

  /**
   * Rank all 13 hooks: archetype-affinity first, emerging-archetype boost
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
   */
  private rankHooks(
    archetype: ArchetypeCode,
    signalCodes: Set<string>,
    emergingAngles: HookAngle[] = [],
    signalSeverity: Map<string, SignalSeverity> = new Map(),
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
      return {
        template,
        matchedSignals,
        hasArchetypeAffinity,
        hasEmergingBoost: emergingBoost >= 0,
        emergingBoost,
        signalCount: matchedSignals.length,
        maxSeverityRank,
        severitySum,
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
      // 3a. Max severity among matched signals — crisis > material > cosmetic
      if (a.maxSeverityRank !== b.maxSeverityRank) {
        return b.maxSeverityRank - a.maxSeverityRank;
      }
      // 3b. Severity-weighted sum (quantity-quality hybrid within same max tier)
      if (a.severitySum !== b.severitySum) {
        return b.severitySum - a.severitySum;
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
      .replace(/\{\{claim_url\}\}/g, ctx.claim_url ?? '{{claim_url}}');
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
   * Resolve the directory claim URL for a campaign. Looks up the directory
   * seed linked to this campaign via directory_seed_campaign_links, then
   * finds an active (unconsumed) claim token for that seed. Returns the
   * public claim URL or null if no seed/token exists.
   *
   * Best-effort: any failure returns null, which renders as the visible
   * {{claim_url}} placeholder so the operator sees what's unresolved.
   */
  private async resolveClaimUrl(campaignId: string, ctx?: RequestCtx): Promise<string | null> {
    try {
      // 1. Find the seed linked to this campaign
      const links = await this.prisma.$queryRaw<any[]>`
        SELECT seed_id FROM directory_seed_campaign_links
        WHERE campaign_id = ${campaignId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!links[0]?.seed_id) return null;
      const seedId = links[0].seed_id;

      // 2. Find an active claim token for that seed
      const tokens = await this.prisma.$queryRaw<any[]>`
        SELECT token FROM directory_claim_tokens
        WHERE seed_id = ${seedId}
          AND consumed_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!tokens[0]?.token) return null;

      // 3. Build the public claim URL
      const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl || '';
      return `${baseUrl}/directory/claim/${tokens[0].token}`;
    } catch {
      // Any failure — return null, placeholder stays visible
      return null;
    }
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
}

// ─── Export singleton ───────────────────────────────────────────────────

export default HookSuggestionService.getInstance();
