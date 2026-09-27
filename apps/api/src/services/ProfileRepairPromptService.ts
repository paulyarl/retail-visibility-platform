/**
 * Profile Repair Prompt Service
 *
 * Dedicated variable-builder, execution, and import service for Profile Repair
 * prompt templates (triage seek, per-issue seek, citation-package fulfill,
 * and Track B reinstatement appeal resolution).
 *
 * Sibling of RecoveryResolutionService.
 * Spec: docs/LocalBiz/marketing_ops_prompt_variable_injection_sprint_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { MarketingPromptService } from './MarketingPromptService';
import { MarketingExecutionService } from './MarketingExecutionService';
import MarketingCampaignService from './MarketingCampaignService';
import { extractSignals } from './triage/signal-extractor';
import { type SignalCode } from './triage/signal-taxonomy';
import aiProviderFactory from './ai-providers';
import { generateDeliverableId, generateDeliverableSectionId } from '../lib/id-generator';
import { isStubBusinessAnalysisAudit, STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES } from '../lib/marketing-audits';
import {
  resolveOutputSchema,
  profileRepairTriageSchema,
  type ProfileRepairTriageOutput,
} from '../validators/market-analysis.schema';

// Template ID constants
export const PROFILE_REPAIR_TRIAGE_TEMPLATE_ID = 'mpt-profile-repair-triage-default';
export const PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID = 'mpt-profile-repair-nap-drift-seek';
export const PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID = 'mpt-profile-repair-unclaimed-seek';
export const PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID = 'mpt-profile-repair-platform-gap-seek';
export const PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID = 'mpt-profile-repair-citation-package-fulfill';
export const PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID = 'mpt-profile-repair-resolution-default';

// Signal Code -> Triage Vocabulary mapping table
const SIGNAL_TO_TRIAGE_VOCAB: Record<string, string> = {
  DS_PROFILE_SUSPENDED: 'suspension',
  DS_DUPLICATE_LISTING: 'duplicate_listing',
  DS_HIJACKED_LISTING: 'hijacked_listing',
  DS_OWNERSHIP_DISPUTE: 'ownership_dispute',
  DS_ADDRESS_VERIFICATION_BLOCK: 'address_verification_block',
  CP_NAP_NAME_DRIFT: 'nap_drift',
  CP_NAP_ADDRESS_DRIFT: 'nap_drift',
  CP_NAP_PHONE_DRIFT: 'nap_drift',
  CP_MISSING_CONTACT_INFO: 'nap_drift',
  CP_NAP_INCONSISTENCY: 'nap_drift',
  CP_NAP_INCONSISTENT: 'nap_drift',
  DS_CLAIMED_STATUS: 'unclaimed_profile',
  DS_UNCLAIMED_PROFILE: 'unclaimed_profile',
  DS_MISSING_SERVICE_MENU: 'missing_category',
  DS_MISSING_PRODUCT_CATALOG: 'missing_category',
  DS_MISSING_CATEGORY: 'missing_category',
  DS_OUTDATED_HOURS: 'missing_hours',
  DS_OUTDATED_HOLIDAY_HOURS: 'missing_hours',
  DS_MISSING_HOURS: 'missing_hours',
  DS_MISSING_PROFILE: 'platform_gap',
  DS_PLATFORM_GAP: 'platform_gap',
  DS_BROKEN_PROFILE_LINK: 'platform_gap',
  WC_URL_MISMATCH: 'platform_gap',
  WC_BROKEN_WEBSITE: 'platform_gap',
  WC_MISSING_WEBSITE: 'platform_gap',
  VP_MISSING_STOREFRONT_PHOTOS: 'platform_gap',
};

export class ProfileRepairPromptService extends BaseService {
  private static instance: ProfileRepairPromptService;

  private constructor() {
    super();
  }

  static getInstance(): ProfileRepairPromptService {
    if (!ProfileRepairPromptService.instance) {
      ProfileRepairPromptService.instance = new ProfileRepairPromptService();
    }
    return ProfileRepairPromptService.instance;
  }

  // ==========================================================================
  // Template Resolution Helper
  // ==========================================================================

  /**
   * Code-side track resolution — the deterministic floor for the AI's
   * recommended_track. The AI may escalate above this (e.g., flag a
   * nap_drift case as escalated due to context), but never de-escalate
   * below it (e.g., a suspension signal always forces escalated).
   *
   * Used in executeSeekSync to validate the AI's track output.
   */
  resolveTrackFromSignals(signals: SignalCode[] | string[]): 'standard' | 'escalated' {
    const ESCALATION_VOCAB = new Set([
      'suspension',
      'hijacked_listing',
      'duplicate_listing',
      'ownership_dispute',
      'address_verification_block',
    ]);
    for (const sig of signals) {
      const vocab = SIGNAL_TO_TRIAGE_VOCAB[sig];
      if (vocab && ESCALATION_VOCAB.has(vocab)) return 'escalated';
    }
    return 'standard';
  }

  resolveSeekTemplateId(issueType: string | null | undefined): string {
    if (!issueType) return PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    const normalized = issueType.toLowerCase().trim();
    switch (normalized) {
      case 'nap_drift':
        return PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID;
      case 'unclaimed_profile':
        return PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID;
      case 'platform_gap':
        return PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID;
      default:
        return PROFILE_REPAIR_TRIAGE_TEMPLATE_ID;
    }
  }

  // ==========================================================================
  // Variable Serializers & Builders
  // ==========================================================================

  serializeSignals(signals: SignalCode[] | string[]): string {
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return '';
    }

    const triageTerms = new Set<string>();
    for (const sig of signals) {
      const vocab = SIGNAL_TO_TRIAGE_VOCAB[sig];
      if (vocab) {
        triageTerms.add(vocab);
      }
    }

    return Array.from(triageTerms).join('\n');
  }

  serializeAuditResults(auditData: any): string {
    if (!auditData || typeof auditData !== 'object') {
      return '';
    }

    // Shape dispatch — the two upstream triage lanes feed this variable:
    //   - business_analysis, real (FULL): verified platform findings, gap
    //     analysis, quality gates, scores, audit-derived outreach problems.
    //   - business_analysis, stub (PARTIAL): the partial lane's carrier —
    //     a placeholder row stamped with a stub audit_metadata.source
    //     (discovery_scan / queue promotion / derive) carrying translated
    //     detected_signals, never verified platform findings. Checked by
    //     source BEFORE the BA shape test: stubs carry audit_metadata +
    //     detected_signals, so they would otherwise be mislabeled FULL.
    //   - category_identification (PARTIAL): a cross-platform presence
    //     snapshot gathered while identifying the category — presence
    //     observations, not verified platform findings.
    // Anything else (empty object, unknown shape) is treated as no usable
    // audit and gets an explicit coverage banner rather than a blank section.
    if (Array.isArray((auditData as any).candidate_categories)) {
      return this.serializeCategoryIdentificationAudit(auditData);
    }

    const auditSource = (auditData as any)?.audit_metadata?.source;
    if (
      typeof auditSource === 'string' &&
      (STUB_BUSINESS_ANALYSIS_AUDIT_SOURCES as readonly string[]).includes(auditSource)
    ) {
      return this.serializeSignalStubAudit(auditData, auditSource);
    }

    const looksLikeBusinessAnalysis =
      'audit_metadata' in auditData ||
      'summary' in auditData ||
      'platforms' in auditData ||
      'nap_consistency' in auditData ||
      'website' in auditData ||
      'detected_signals' in auditData;
    if (!looksLikeBusinessAnalysis) {
      return [
        '## Audit Coverage',
        'NONE — no audit on file for this campaign. Ground the briefing in the collapsed signals and business fields; do not assert platform findings.',
      ].join('\n');
    }

    return this.serializeBusinessAnalysisAudit(auditData);
  }

  /**
   * FULL lane — serialize the blocks of a business_analysis audit the
   * repair briefing consumes: identity, canonical NAP, platform status
   * (enriched with render-control determinations so a control-confirmed
   * absence is distinguishable from an unverifiable render), website,
   * operational status, review metrics, scoreline, gap analysis, quality
   * gates, market opportunities, audit-derived outreach problems, detected
   * signals, recommended attributes, and data quality.
   */
  private serializeBusinessAnalysisAudit(auditData: any): string {
    const lines: string[] = [
      '## Audit Coverage',
      'FULL — business analysis audit on file. The platform findings, gap analysis, quality gates, and audit-derived outreach problems below are verified audit output — consume them directly rather than re-deriving.',
      '',
    ];

    // 1. Audit summary + identity
    const meta = auditData.audit_metadata;
    if (typeof auditData.summary === 'string' && auditData.summary.trim()) {
      lines.push('## Audit Summary', auditData.summary.trim(), '');
    }
    if (meta && typeof meta === 'object') {
      const parts: string[] = [];
      if (meta.identity_status) parts.push(`identity: ${meta.identity_status}`);
      if (meta.identity_confidence) parts.push(`confidence: ${meta.identity_confidence}`);
      if (meta.matched_business?.business_name) {
        parts.push(`matched as: ${meta.matched_business.business_name}`);
      }
      if (parts.length > 0) {
        lines.push('## Identity', `- ${parts.join(' · ')}`, '');
      }
    }

    // 2. Canonical NAP
    const nap = auditData.nap_consistency;
    if (nap) {
      lines.push('## Canonical NAP');
      lines.push(`- Name: ${nap.canonical_name ?? 'Not verified'}`);
      lines.push(`- Address: ${nap.canonical_address ?? 'Not verified'}`);
      lines.push(`- Phone: ${nap.canonical_phone ?? 'Not verified'}`);
      if (Array.isArray(nap.material_issues) && nap.material_issues.length > 0) {
        lines.push(`- Material issues: ${nap.material_issues.join(', ')}`);
      }
      lines.push('');
    }

    // 3. Platform Status — enriched with render-control determinations so a
    // control-confirmed absence (business_specific_failure) reads as
    // "verified absent", not just another unable_to_verify.
    const platforms = auditData.platforms;
    const renderControls = Array.isArray(auditData.render_controls) ? auditData.render_controls : [];
    const rcByPlatform = new Map<string, any>(
      renderControls
        .filter((rc: any) => rc && typeof rc === 'object' && rc.platform)
        .map((rc: any) => [String(rc.platform).toLowerCase(), rc]),
    );
    if (platforms && typeof platforms === 'object') {
      lines.push('## Platform Status');
      for (const [name, p] of Object.entries(platforms) as [string, any][]) {
        if (p && typeof p === 'object') {
          const status = p.profile_status ?? 'unavailable';
          const nameSuffix = p.displayed_name ? ` (${p.displayed_name})` : '';
          const rc = rcByPlatform.get(name.toLowerCase());
          let renderSuffix = '';
          if (rc?.determination === 'business_specific_failure') {
            renderSuffix = ' · verified absent (render control confirmed)';
          } else if (rc?.determination === 'platform_available') {
            renderSuffix = ' · rendered';
          }
          lines.push(`- ${name}: ${status}${nameSuffix}${renderSuffix}`);
        }
      }
      lines.push('');
    }

    // 4. Website
    const web = auditData.website;
    if (web && typeof web === 'object') {
      lines.push('## Website');
      lines.push(`- Status: ${web.status ?? 'unavailable'}`);
      if (Array.isArray(web.issues) && web.issues.length > 0) {
        lines.push(`- Issues: ${web.issues.join(', ')}`);
      }
      if (Array.isArray(web.conversion_opportunities) && web.conversion_opportunities.length > 0) {
        lines.push(`- Conversion opportunities: ${web.conversion_opportunities.slice(0, 4).join('; ')}`);
      }
      lines.push('');
    }

    // 5. Operational status
    const ops = auditData.operational_status;
    if (ops && typeof ops === 'object') {
      lines.push('## Operational Status');
      lines.push(`- ${ops.status ?? 'unknown'}${ops.last_activity_evidence ? ` — ${ops.last_activity_evidence}` : ''}`);
      lines.push('');
    }

    // 6. Review metrics
    const metrics = auditData.combined_review_metrics;
    if (metrics && typeof metrics === 'object') {
      lines.push('## Review Metrics');
      const parts = [
        `${metrics.observable_total_reviews ?? 0} observable reviews`,
        metrics.observable_unanswered_reviews != null ? `${metrics.observable_unanswered_reviews} unanswered` : null,
        metrics.observable_response_rate_percent != null ? `${metrics.observable_response_rate_percent}% response rate` : null,
        metrics.counts_complete === false ? 'counts incomplete' : null,
      ].filter(Boolean);
      lines.push(`- ${parts.join(' · ')}`);
      if (Array.isArray(auditData.negative_review_themes) && auditData.negative_review_themes.length > 0) {
        lines.push(`- Negative themes: ${auditData.negative_review_themes.join(', ')}`);
      }
      lines.push('');
    }

    // 7. Scoreline — the audit's own assessment, consumed for viability
    const score = auditData.digital_opportunity_score;
    const align = auditData.alignment_scoring;
    const hasScoreline =
      (score && typeof score === 'object') ||
      auditData.recommended_tier != null ||
      (align && typeof align === 'object' && (align.action_classification != null || align.lead_disposition != null)) ||
      auditData.high_attention != null;
    if (hasScoreline) {
      lines.push('## Scoreline');
      if (score && typeof score === 'object' && score.score != null) {
        lines.push(`- Digital opportunity score: ${score.score}${score.classification ? ` (${score.classification})` : ''}`);
      }
      if (auditData.recommended_tier != null) {
        lines.push(`- Recommended tier: ${auditData.recommended_tier}${auditData.tier_rationale ? ` — ${auditData.tier_rationale}` : ''}`);
      }
      if (align && typeof align === 'object') {
        const parts = [
          align.action_classification != null ? `alignment: ${align.action_classification}` : null,
          align.lead_disposition != null ? `lead disposition: ${align.lead_disposition}` : null,
        ].filter(Boolean);
        if (parts.length > 0) lines.push(`- ${parts.join(' · ')}`);
        if (align.primary_outreach_hook) {
          lines.push(`- Audit outreach hook: ${align.primary_outreach_hook}`);
        }
      }
      if (auditData.high_attention === true) {
        const reasons = Array.isArray(auditData.high_attention_reasons) && auditData.high_attention_reasons.length > 0
          ? ` — ${auditData.high_attention_reasons.join('; ')}`
          : '';
        lines.push(`- High attention: true${reasons}`);
      }
      lines.push('');
    }

    // 8. Gap analysis — the audit's pre-computed gap list
    const gapAnalysis = auditData.gap_analysis;
    if (gapAnalysis && typeof gapAnalysis === 'object') {
      if (Array.isArray(gapAnalysis.gaps) && gapAnalysis.gaps.length > 0) {
        lines.push('## Gap Analysis');
        for (const g of gapAnalysis.gaps) {
          if (!g || typeof g !== 'object') continue;
          const where = [g.platform, g.field].filter(Boolean).join('.');
          lines.push(`- [${g.severity ?? 'unranked'}] ${where || 'gap'} — ${g.gap_description ?? g.actual ?? ''}`);
        }
        if (gapAnalysis.summary) lines.push(`- Summary: ${gapAnalysis.summary}`);
        lines.push('');
      }
    }

    // 9. Quality gates
    const gates = auditData.quality_gate_results;
    if (gates && typeof gates === 'object' && Array.isArray(gates.results) && gates.results.length > 0) {
      lines.push('## Quality Gates');
      for (const r of gates.results) {
        if (!r || typeof r !== 'object') continue;
        const verdict = r.passed === true ? 'pass' : r.passed === false ? 'FAIL' : 'not verified';
        const where = [r.platform, r.gate].filter(Boolean).join(' / ');
        lines.push(`- [${r.severity ?? 'unranked'}] ${where}: ${verdict}${r.notes ? ` — ${r.notes}` : ''}`);
      }
      if (gates.summary) lines.push(`- Summary: ${gates.summary}`);
      lines.push('');
    }

    // 10. Market opportunities
    const marketOpps = auditData.market_opportunities;
    if (Array.isArray(marketOpps) && marketOpps.length > 0) {
      lines.push('## Market Opportunities');
      for (const m of marketOpps) {
        if (!m || typeof m !== 'object') continue;
        lines.push(`- [${m.impact ?? 'unranked'}] ${m.title ?? 'opportunity'}${m.description ? ` — ${m.description}` : ''}`);
      }
      lines.push('');
    }

    // 11. Audit-derived outreach problems — pre-computed pairs the §6 rules
    // align and rank rather than reinvent.
    const auditProblems = auditData.outreach_problems;
    if (Array.isArray(auditProblems) && auditProblems.length > 0) {
      lines.push('## Audit Outreach Problems (pre-computed by the audit)');
      for (const p of auditProblems) {
        if (!p || typeof p !== 'object') continue;
        const parts = [p.problem, p.evidence ? `evidence: ${p.evidence}` : null, p.solution ? `fix: ${p.solution}` : null].filter(Boolean);
        lines.push(`- ${parts.join(' — ')}`);
      }
      lines.push('');
    }

    // 12. Competitive benchmarks (compact — positioning input)
    const benchmarks = auditData.competitive_benchmarks;
    if (Array.isArray(benchmarks) && benchmarks.length > 0) {
      lines.push('## Competitive Benchmarks');
      for (const b of benchmarks.slice(0, 4)) {
        if (!b || typeof b !== 'object') continue;
        const ratings = [
          b.google_rating != null ? `google ${b.google_rating}${b.google_review_count != null ? ` (${b.google_review_count})` : ''}` : null,
          b.yelp_rating != null ? `yelp ${b.yelp_rating}${b.yelp_review_count != null ? ` (${b.yelp_review_count})` : ''}` : null,
        ].filter(Boolean).join(', ');
        lines.push(`- ${b.business_name ?? 'benchmark'}${b.store_format ? ` (${b.store_format})` : ''}${ratings ? `: ${ratings}` : ''}${b.format_context_note ? ` — ${b.format_context_note}` : ''}`);
      }
      lines.push('');
    }

    // 13. Detected signals
    const signals = auditData.detected_signals;
    if (Array.isArray(signals) && signals.length > 0) {
      lines.push('## Detected Signals');
      for (const s of signals) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    // 14. Recommended attributes — advisory chips the business may want to
    // enable or verify on the named platform. Not observed facts; the
    // fulfill package should frame these as enableable opportunities.
    const recAttrs = auditData.recommended_attributes;
    if (Array.isArray(recAttrs) && recAttrs.length > 0) {
      lines.push('## Recommended Attributes (advisory — not observed on the profile)');
      for (const r of recAttrs) {
        if (!r || typeof r !== 'object') continue;
        const parts = [r.label ?? r.key];
        if (r.platform) parts.push(`platform: ${r.platform}`);
        if (r.current_state) parts.push(`state: ${r.current_state}`);
        if (r.rationale) parts.push(`— ${r.rationale}`);
        lines.push(`- ${parts.join(' · ')}`);
      }
      lines.push('');
    }

    // 15. Data quality — confidence, conflicts, limitations (risk input)
    const dq = auditData.data_quality;
    if (dq && typeof dq === 'object') {
      lines.push('## Data Quality');
      if (dq.confidence) lines.push(`- Confidence: ${dq.confidence}`);
      if (Array.isArray(dq.conflicts) && dq.conflicts.length > 0) {
        lines.push(`- Conflicts: ${dq.conflicts.slice(0, 6).join('; ')}`);
      }
      if (Array.isArray(dq.limitations) && dq.limitations.length > 0) {
        lines.push(`- Limitations: ${dq.limitations.slice(0, 8).join('; ')}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * PARTIAL lane — serialize a category_identification audit. Its
   * digital_footprint block is a presence snapshot gathered during category
   * research: `claimed`, ratings, and review counts are observations, not
   * verified platform findings. The coverage banner tells the downstream
   * prompt not to assert platform defects the snapshot does not show.
   */
  private serializeCategoryIdentificationAudit(auditData: any): string {
    const lines: string[] = [
      '## Audit Coverage',
      'PARTIAL — category identification only; no platform-level business audit is on file. The Platform Presence Snapshot below records what was FOUND during category research — it is not a verified platform audit. Do not assert a platform defect (stale data, unclaimed listing, missing profile) that the snapshot does not show; absence from the snapshot is not absence from the platform.',
      '',
    ];

    // 1. Business identity + category call
    lines.push('## Business');
    const nameParts = [auditData.business_name ?? 'unknown'];
    if (auditData.business_type) nameParts.push(`type: ${auditData.business_type}`);
    lines.push(`- Name: ${nameParts.join(' · ')}`);
    if (auditData.primary_category) {
      lines.push(`- Primary category: ${auditData.primary_category}${auditData.primary_category_confidence ? ` (confidence: ${auditData.primary_category_confidence})` : ''}`);
    }
    if (typeof auditData.business_summary === 'string' && auditData.business_summary.trim()) {
      lines.push(`- ${auditData.business_summary.trim()}`);
    }
    lines.push('');

    // 2. Canonical NAP (cat-id shape — flat fields + directory URLs)
    const nap = auditData.nap;
    if (nap && typeof nap === 'object') {
      lines.push('## Canonical NAP');
      const address = [nap.address_line1, nap.address_line2, nap.city, nap.state, nap.postal_code]
        .filter(Boolean)
        .join(', ');
      if (nap.canonical_name) lines.push(`- Name: ${nap.canonical_name}`);
      if (address) lines.push(`- Address: ${address}`);
      if (nap.phone) lines.push(`- Phone: ${nap.phone}`);
      if (nap.website) lines.push(`- Website: ${nap.website}`);
      if (Array.isArray(nap.directory_profile_urls) && nap.directory_profile_urls.length > 0) {
        const urls = nap.directory_profile_urls
          .filter((d: any) => d && d.platform && d.url)
          .map((d: any) => `${d.platform}: ${d.url}`);
        if (urls.length > 0) lines.push(`- Directory profiles: ${urls.join(' · ')}`);
      }
      if (nap.provenance) lines.push(`- Provenance: ${nap.provenance}`);
      lines.push('');
    }

    // 3. Platform presence snapshot
    const footprint = auditData.digital_footprint;
    if (footprint && typeof footprint === 'object') {
      lines.push('## Platform Presence Snapshot (observed during category research — presence-level, not verified findings)');
      if (Array.isArray(footprint.platforms_found)) {
        for (const p of footprint.platforms_found) {
          if (!p || typeof p !== 'object') continue;
          const parts = [
            p.claimed === true ? 'claimed' : p.claimed === false ? 'unclaimed' : null,
            p.rating != null ? `${p.rating}${p.review_count != null ? ` (${p.review_count} reviews)` : ' rating'}` : null,
            p.url ?? null,
            p.notes ?? null,
          ].filter(Boolean);
          lines.push(`- ${p.platform ?? 'platform'}${parts.length > 0 ? `: ${parts.join(' · ')}` : ''}`);
        }
      }
      if (footprint.website_url || footprint.website_status) {
        lines.push(`- Website: ${footprint.website_url ?? 'none located'}${footprint.website_status ? ` (${footprint.website_status})` : ''}`);
      }
      if (footprint.gbp_primary_category) {
        lines.push(`- GBP primary category: ${footprint.gbp_primary_category}`);
      }
      if (Array.isArray(footprint.signature_products_services) && footprint.signature_products_services.length > 0) {
        lines.push(`- Signature products/services: ${footprint.signature_products_services.join(', ')}`);
      }
      lines.push('');
    }

    // 4. Candidate categories
    if (Array.isArray(auditData.candidate_categories) && auditData.candidate_categories.length > 0) {
      lines.push('## Candidate Categories');
      for (const c of auditData.candidate_categories.slice(0, 6)) {
        if (!c || typeof c !== 'object') continue;
        lines.push(`- ${c.category}${c.confidence ? ` (${c.confidence})` : ''}${c.is_known_category === false ? ' · not a known platform category' : ''}`);
      }
      lines.push('');
    }

    // 5. Detected signals (rare on this lane, but honor them when present)
    if (Array.isArray(auditData.detected_signals) && auditData.detected_signals.length > 0) {
      lines.push('## Detected Signals');
      for (const s of auditData.detected_signals) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }

    // 6. Evidence sources + data quality
    if (Array.isArray(auditData.evidence_sources) && auditData.evidence_sources.length > 0) {
      lines.push('## Evidence Sources');
      for (const e of auditData.evidence_sources.slice(0, 8)) {
        if (!e || typeof e !== 'object') continue;
        lines.push(`- ${e.source ?? 'source'}${e.finding ? ` — ${e.finding}` : ''}`);
      }
      lines.push('');
    }
    const dq = auditData.data_quality;
    if (dq && typeof dq === 'object') {
      lines.push('## Data Quality');
      const parts = [
        dq.overall_confidence ? `confidence: ${dq.overall_confidence}` : null,
        dq.sources_consulted != null ? `sources consulted: ${dq.sources_consulted}` : null,
      ].filter(Boolean);
      if (parts.length > 0) lines.push(`- ${parts.join(' · ')}`);
      if (Array.isArray(dq.limitations) && dq.limitations.length > 0) {
        lines.push(`- Limitations: ${dq.limitations.slice(0, 8).join('; ')}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * PARTIAL lane — serialize a signal-stub audit. Stubs are placeholder
   * business_analysis rows created by queue promotion / campaign derivation /
   * discovery scan so upstream triage has detected_signals to work with
   * before a real audit runs. They carry translated upstream evidence —
   * candidate defects to confirm — and must never be presented as verified
   * audit output.
   */
  private serializeSignalStubAudit(auditData: any, source: string): string {
    const meta = auditData?.audit_metadata;
    const origin = source === 'discovery_scan' ? 'discovery-scan' : 'queue/derivation';
    const lines: string[] = [
      '## Audit Coverage',
      `PARTIAL — signal stub only (provenance: ${source}); no platform-level business audit is on file. The signals below were translated from upstream ${origin} evidence — treat them as candidate defects to confirm, not verified platform findings.`,
      '',
    ];

    if (meta && typeof meta === 'object') {
      const parts = [
        meta.business_name ? `business: ${meta.business_name}` : null,
        meta.verdict ? `verdict: ${meta.verdict}` : null,
      ].filter(Boolean);
      if (parts.length > 0) {
        lines.push('## Audit Provenance', `- ${parts.join(' · ')}`, '');
      }
    }

    if (typeof auditData.summary === 'string' && auditData.summary.trim()) {
      lines.push('## Summary', auditData.summary.trim(), '');
    }

    if (Array.isArray(auditData.detected_signals) && auditData.detected_signals.length > 0) {
      lines.push('## Detected Signals (translated upstream — unverified)');
      for (const s of auditData.detected_signals) {
        if (s != null) lines.push(`- ${s}`);
      }
      lines.push('');
    }

    const sigMap = auditData.discovery_signal_map;
    if (Array.isArray(sigMap) && sigMap.length > 0) {
      lines.push('## Signal Provenance (what produced each signal)');
      for (const c of sigMap.slice(0, 16)) {
        if (!c || typeof c !== 'object') continue;
        lines.push(`- ${c.code ?? 'signal'}${c.ref ? ` ← ${c.via ?? 'source'}:${c.ref}` : ''}${c.basis ? ` — ${c.basis}` : ''}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * Lane-aware audit selection for repair consumers:
   *   1. Real business_analysis audit (FULL) — the fuller artifact. Stub
   *      rows are skipped so a placeholder can neither mislabel itself
   *      FULL nor shadow a real audit.
   *   2. category_identification audit (PARTIAL) — the richer partial
   *      artifact: presence snapshot, NAP, candidate categories.
   *   3. Stub business_analysis audit (PARTIAL) — the partial lane's
   *      signal carrier when no descriptive audit exists yet.
   * Anything else does not feed the repair briefing.
   */
  pickRepairSourceAudit(audits: any[] | null | undefined): any | null {
    const list = Array.isArray(audits) ? audits : [];
    return (
      list.find((a) => a?.platform === 'business_analysis' && !isStubBusinessAnalysisAudit(a)) ??
      list.find((a) => a?.platform === 'category_identification') ??
      list.find((a) => isStubBusinessAnalysisAudit(a)) ??
      null
    );
  }

  buildSeekVariables(
    campaign: any,
    latestAudit?: any,
    platformSignalWeights?: Record<string, number>,
  ): Record<string, string> {
    const audit =
      latestAudit ||
      this.pickRepairSourceAudit(campaign?.audits) ||
      this.pickRepairSourceAudit(campaign?.mkt_audits_list) ||
      null;
    const signalCodes = extractSignals({
      campaign,
      auditData: audit?.audit_data,
      platformSignalWeights,
    });

    // Also include any pre-extracted detected_signals from campaign or triage results
    const storedSignals = campaign?.mkt_campaign_triage_results?.detected_signals || campaign?.detected_signals;
    if (Array.isArray(storedSignals)) {
      for (const s of storedSignals) {
        const code = typeof s === 'string' ? s : (s as any)?.code;
        if (code && !signalCodes.includes(code)) {
          signalCodes.push(code);
        }
      }
    }

    const serialized = this.serializeSignals(signalCodes);

    // Triage template now uses audit_results as a primary input for scope
    // assessment (which platforms are broken, what's drifted, what's missing).
    // Previously only injected for fulfill; triage needs it too so the AI can
    // produce an evidence-grounded operator briefing instead of rubber-stamping
    // the signal→track mapping.
    const auditResults = this.serializeAuditResults(audit?.audit_data ?? {});

    return {
      audit_signals: serialized,
      issue_type: campaign?.repair_issue_type || '(not yet diagnosed — infer from audit signals above)',
      audit_results: auditResults,
    };
  }

  /**
   * W5a — serialize the latest per-issue seek execution (output_schema
   * 'profile_repair_audit') into a compact markdown briefing for the fulfill
   * prompt: { issueType, scope.specifics, scope.affected_platforms, impact,
   * pitch.value_preview }. Returns null when no completed seek execution
   * exists — the fulfill prompt degrades to audit_results-only context.
   */
  async serializeSeekBriefing(
    campaignId: string,
  ): Promise<{ markdown: string; affectedPlatforms: string[] } | null> {
    try {
      const executions = await this.prisma.mkt_prompt_executions_list.findMany({
        where: { campaign_id: campaignId, status: 'completed' },
        include: {
          mkt_prompt_templates_list: { select: { output_schema: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 15,
      });

      const execution = executions.find((e: any) => {
        const schema = e.mkt_prompt_templates_list?.output_schema;
        const name = schema?.name ?? schema?.outputSchema?.name;
        return name === 'profile_repair_audit';
      });
      if (!execution?.filtered_output && !execution?.raw_output) return null;

      let parsed: any;
      try {
        parsed = JSON.parse(
          this.stripJsonArtifacts(execution.filtered_output || execution.raw_output || ''),
        );
      } catch {
        return null;
      }
      const briefing = parsed?.profile_repair_audit;
      if (!briefing || typeof briefing !== 'object') return null;

      const affectedPlatforms: string[] = Array.isArray(briefing.scope?.affected_platforms)
        ? briefing.scope.affected_platforms.map((p: any) => String(p))
        : [];

      const lines: string[] = ['## Repair Briefing (seek-stage diagnosis)'];
      if (briefing.issueType) lines.push(`- Issue type: ${briefing.issueType}`);
      if (affectedPlatforms.length > 0) {
        lines.push(`- Affected platforms: ${affectedPlatforms.join(', ')}`);
      }
      if (briefing.scope?.summary) lines.push(`- Scope: ${briefing.scope.summary}`);
      if (briefing.scope?.specifics) lines.push(`- Specifics: ${briefing.scope.specifics}`);
      const impact = briefing.impact;
      if (impact && typeof impact === 'object') {
        const parts = [
          impact.primary_consequence,
          impact.estimated_reach_loss,
          impact.competitive_gap,
        ].filter(Boolean);
        if (parts.length > 0) lines.push(`- Impact: ${parts.join(' | ')}`);
      }
      if (briefing.pitch?.value_preview) {
        lines.push(`- Value preview: ${briefing.pitch.value_preview}`);
      }

      return { markdown: lines.join('\n'), affectedPlatforms };
    } catch {
      return null;
    }
  }

  /**
   * W5a — fulfill prompt variables. Extends the audit-only baseline with the
   * seek briefing, purchased tier, delivery mode, and the derived repair
   * platform scope:
   *
   *   repair_platforms = repair_fulfillment.platforms     (purchased scope, W2)
   *                    ∩ briefing.scope.affected_platforms (diagnosed scope)
   *                    ?? affected_platforms               (fallback when unset)
   *
   * All returned keys are defaults — a caller-supplied `repair_platforms` in
   * the Prompt Workspace variables still wins (same fill-if-empty pattern as
   * `interactive_verification`), enabling ad-hoc rescope.
   */
  async buildFulfillVariables(campaign: any, latestAudit: any): Promise<Record<string, string>> {
    const { REPAIR_TIER_CATALOG, REPAIR_PLATFORM_LABELS, isRepairTier } = await import(
      '../lib/repair-tiers.js'
    );

    const rf = (campaign?.repair_fulfillment as Record<string, any> | null) ?? {};
    const briefing = campaign?.id ? await this.serializeSeekBriefing(campaign.id) : null;

    // Purchased scope → normalized platform keys.
    const toPlatformKey = (p: string): string => {
      const norm = p.trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (norm in REPAIR_PLATFORM_LABELS) return norm;
      const byLabel = Object.entries(REPAIR_PLATFORM_LABELS).find(
        ([, label]) => label.toLowerCase() === p.trim().toLowerCase(),
      );
      return byLabel?.[0] ?? norm;
    };

    const purchased: string[] = Array.isArray(rf.platforms)
      ? rf.platforms.map((p: any) => toPlatformKey(String(p)))
      : [];
    const diagnosed = (briefing?.affectedPlatforms ?? []).map(toPlatformKey);

    let repairPlatforms: string[];
    if (purchased.length > 0 && diagnosed.length > 0) {
      const diagnosedSet = new Set(diagnosed);
      const intersection = purchased.filter((p) => diagnosedSet.has(p));
      repairPlatforms = intersection.length > 0 ? intersection : purchased;
    } else {
      repairPlatforms = purchased.length > 0 ? purchased : diagnosed;
    }

    const tierKey = typeof rf.tier === 'string' && isRepairTier(rf.tier) ? rf.tier : null;
    const tierSpec = tierKey ? REPAIR_TIER_CATALOG[tierKey] : null;
    const repairTier = tierSpec
      ? `${tierSpec.label} tier — up to ${tierSpec.platforms.length} platforms (${tierSpec.platforms
          .map((p) => REPAIR_PLATFORM_LABELS[p])
          .join(', ')}), ${tierSpec.slaHours}h SLA`
      : '';

    const mode = rf.mode === 'dfy' ? 'dfy' : rf.mode === 'diy' ? 'diy' : '';
    const deliveryMode =
      mode === 'dfy'
        ? 'dfy — done-for-you: the operator executes every fix on delegated access; the package is the internal fix-sheet, framed for handoff'
        : mode === 'diy'
          ? 'diy — do-it-yourself: the customer executes the fixes; write the package for the owner to follow step by step'
          : '';

    return {
      audit_results: this.serializeAuditResults(latestAudit?.audit_data ?? {}),
      seek_briefing: briefing?.markdown ?? '',
      repair_tier: repairTier,
      delivery_mode: deliveryMode,
      repair_platforms: repairPlatforms
        .map((p) => REPAIR_PLATFORM_LABELS[p as keyof typeof REPAIR_PLATFORM_LABELS] ?? p)
        .join(', '),
    };
  }

  buildResolutionVariables(campaign: any, intake: any): Record<string, any> {
    const intakePayload = JSON.stringify({
      ownerStatement: intake?.owner_statement ?? '',
      proposedResolution: intake?.proposed_resolution ?? '',
    });

    const evidencePayload = JSON.stringify(intake?.evidence_payload ?? {});

    const attachmentMeta = JSON.stringify(
      (intake?.mkt_dispute_attachments ?? []).map((a: any) => ({
        fileName: a.file_name,
        fileType: a.file_type,
      })),
    );

    return {
      issueType: campaign?.repair_issue_type || '',
      intakePayload,
      evidencePayload,
      attachmentMeta,
      intakeId: intake?.id,
    };
  }

  // ==========================================================================
  // Seek Execution (Synchronous Triage Flow)
  // ==========================================================================

  async executeSeekSync(
    campaignId: string,
    templateId?: string,
    ctx?: RequestCtx,
  ): Promise<{
    executionId: string;
    recommendation: ProfileRepairTriageOutput['profile_repair_triage'] | null;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          // Both audit lanes feed repair triage — business_analysis is the
          // full path, category_identification is the partial (fast) path.
          mkt_audits_list: {
            where: { platform: { in: ['business_analysis', 'category_identification'] } },
            take: 6,
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const latestAudit = this.pickRepairSourceAudit(campaign.mkt_audits_list);
      // Phase 6 — signal-aligned gap gate (undefined → legacy primary set).
      const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
      const platformSignalWeights = await IntelligenceProfileService.getInstance()
        .resolveSignalWeightMapForCampaign(campaign, latestAudit?.audit_data, ctx);
      const targetTemplateId = templateId || this.resolveSeekTemplateId(campaign.repair_issue_type);
      const seekVars = this.buildSeekVariables(campaign, latestAudit, platformSignalWeights);

      const execution = await MarketingExecutionService.getInstance().executeSingle(
        {
          campaignId,
          templateId: targetTemplateId,
          variables: seekVars,
          executedBy: ctx?.userId || 'operator',
        },
        ctx,
      );

      let recommendation: ProfileRepairTriageOutput['profile_repair_triage'] | null = null;
      let validatedSuccess = false;

      if (targetTemplateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID && execution.raw_output) {
        try {
          const cleaned = this.stripJsonArtifacts(execution.raw_output);
          const parsed = JSON.parse(cleaned);
          const validated = profileRepairTriageSchema.safeParse(parsed);
          validatedSuccess = validated.success;
          if (validated.success) {
            recommendation = validated.data.profile_repair_triage;
          } else {
            logger.warn('Triage AI output did not strictly match schema', ctx, {
              errors: validated.error.format(),
              executionId: execution.id,
            });
            // Best-effort extraction if top-level structure is present
            if (parsed?.profile_repair_triage) {
              recommendation = parsed.profile_repair_triage;
            }
          }

          // Code-side track floor: the AI may escalate above the signal-derived
          // track, but never de-escalate below it. If the AI recommends
          // 'standard' when signals say 'escalated', force 'escalated'.
          if (recommendation) {
            const signalCodes = extractSignals({
              campaign,
              auditData: latestAudit?.audit_data as any,
              platformSignalWeights,
            });
            const floorTrack = this.resolveTrackFromSignals(signalCodes);
            if (floorTrack === 'escalated' && recommendation.recommended_track === 'standard') {
              logger.warn('Triage AI de-escalated below signal floor; forcing escalated', ctx, {
                campaignId,
                aiTrack: recommendation.recommended_track,
                floorTrack,
              });
              recommendation.recommended_track = 'escalated';
            }

            // Persist the briefing on the campaign row with provenance metadata.
            // No write on AI failure (recommendation is null → skip). Flag
            // best-effort output with _validated: false so the UI can badge it.
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaignId },
              data: {
                repair_triage_briefing: {
                  ...recommendation,
                  _execution_id: execution.id,
                  _validated: validatedSuccess,
                } as any,
              },
            });
          }
        } catch (parseErr) {
          logger.error('Failed to parse triage JSON output', ctx, {
            error: (parseErr as Error).message,
            executionId: execution.id,
          });
        }
      }

      logger.info('Profile repair seek execution completed synchronously', ctx, {
        campaignId,
        templateId: targetTemplateId,
        executionId: execution.id,
        hasRecommendation: Boolean(recommendation),
      });

      return {
        executionId: execution.id,
        recommendation,
      };
    } catch (error) {
      logger.error('Failed to execute profile repair seek', ctx, {
        error: (error as Error).message,
        campaignId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Track B Resolution (Async Enqueue & Scheduler Runner)
  // ==========================================================================

  async enqueueResolution(campaignId: string, intakeId: string, ctx?: RequestCtx): Promise<{ executionId: string; campaignId: string }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_dispute_intake: {
            where: { id: intakeId },
            include: { mkt_dispute_attachments: true },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const intake = campaign.mkt_dispute_intake?.[0];
      if (!intake) throw new Error(`Dispute intake ${intakeId} not found for campaign ${campaignId}`);

      const variablesUsed = this.buildResolutionVariables(campaign, intake);

      const execution = await MarketingPromptService.getInstance().createExecution(
        {
          campaignId,
          templateId: PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID,
          variablesUsed,
          executedBy: ctx?.userId || 'repair-agent',
        },
        ctx,
      );

      logger.info('Profile repair resolution execution enqueued', ctx, {
        executionId: execution.id,
        campaignId,
        intakeId,
      });

      return { executionId: execution.id, campaignId };
    } catch (error) {
      logger.error('Failed to enqueue profile repair resolution', ctx, {
        error: (error as Error).message,
        campaignId,
        intakeId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async runResolution(executionId: string, ctx?: RequestCtx): Promise<{
    executionId: string;
    campaignId: string;
    deliverableId: string;
    stage: string;
    passed: boolean;
  }> {
    try {
      const promptService = MarketingPromptService.getInstance();
      const execution = await promptService.getExecution(executionId, ctx);
      if (!execution) throw new Error(`Execution ${executionId} not found`);

      if (execution.status !== 'pending') {
        logger.info('Profile repair execution already processed, skipping', ctx, {
          executionId,
          status: execution.status,
        });
        return {
          executionId,
          campaignId: execution.campaign_id,
          deliverableId: '',
          stage: '',
          passed: false,
        };
      }

      const campaignId = execution.campaign_id;
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
      const intake = campaign.mkt_dispute_intake?.[0];
      if (!intake) throw new Error(`Profile repair intake not found for campaign ${campaignId}`);

      const template = execution.mkt_prompt_templates_list;
      if (!template) throw new Error(`Template not found for execution ${executionId}`);

      const variables = this.buildResolutionVariables(campaign, intake);
      const executionService = MarketingExecutionService.getInstance();
      const { renderedPrompt } = await executionService.resolvePrompt(
        { template, campaign, variables },
        ctx,
      );

      const aiResult = await aiProviderFactory.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are the Profile Repair Resolution Agent. Produce valid JSON matching the schema.' },
          { role: 'user', content: renderedPrompt },
        ],
        maxTokens: 2500,
        temperature: 0.3,
      });

      const tokensUsed = aiResult.usage?.totalTokens || 0;
      const costCents = Math.round((tokensUsed / 1000) * 0.2);

      await promptService.updateExecution(
        executionId,
        {
          rawOutput: aiResult.content,
          aiProvider: aiResult.model.split('-')[0] || 'unknown',
          aiModel: aiResult.model,
          tokensUsed,
          costCents,
          status: 'completed',
        },
        ctx,
      );

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(aiResult.content));
      } catch (e) {
        await promptService.updateExecution(executionId, {
          status: 'failed',
          flaggedCount: 1,
          errorMessage: `AI output was not valid JSON: ${(e as Error).message}`,
        }, ctx);
        throw new Error(`AI output was not valid JSON: ${(e as Error).message}`);
      }

      // Create deliverable of type reinstatement_appeal + sections
      const deliverableId = generateDeliverableId();

      await this.prisma.mkt_deliverables_list.create({
        data: {
          id: deliverableId,
          campaign_id: campaignId,
          execution_id: executionId,
          template_id: null,
          deliverable_type: 'reinstatement_appeal',
          status: 'drafted',
          file_name: `reinstatement-appeal-${campaignId}.json`,
          storage_path: `recovery/${campaignId}/${deliverableId}.json`,
          mime_type: 'application/json',
          generated_by: 'profile-repair-agent',
        },
      });

      await this.prisma.mkt_deliverable_section.createMany({
        data: [
          {
            id: generateDeliverableSectionId(),
            deliverable_id: deliverableId,
            campaign_id: campaignId,
            section_type: 'response_draft',
            title: 'Reinstatement Appeal Letter',
            content: parsedJson.deliverableText,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 0,
          },
          {
            id: generateDeliverableSectionId(),
            deliverable_id: deliverableId,
            campaign_id: campaignId,
            section_type: 'submission_guide',
            title: 'Submission Guide',
            content: parsedJson.submissionGuide,
            source: 'ai',
            quality_gate_passed: true,
            quality_gate_issues: [],
            status: 'draft',
            section_index: 1,
          },
        ],
      });

      // Transition campaign stage to final_resolution_drafted
      await MarketingCampaignService.transitionStage(
        {
          campaignId,
          toStage: 'final_resolution_drafted',
          triggerType: 'system',
          notes: 'Profile Repair AI Agent drafted reinstatement appeal package',
        },
        ctx,
      );

      logger.info('Profile repair resolution run completed', ctx, {
        executionId,
        campaignId,
        deliverableId,
      });

      return {
        executionId,
        campaignId,
        deliverableId,
        stage: 'final_resolution_drafted',
        passed: true,
      };
    } catch (error) {
      logger.error('Failed to run profile repair resolution', ctx, {
        error: (error as Error).message,
        executionId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Copy-Paste Bridge & External Import
  // ==========================================================================

  async renderPromptText(
    campaignId: string,
    templateId: string,
    ctx?: RequestCtx,
  ): Promise<{
    renderedPrompt: string;
    templateId: string;
    variablesUsed: Record<string, any>;
  }> {
    try {
      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: {
            where: { platform: { in: ['business_analysis', 'category_identification'] } },
            take: 6,
            orderBy: { created_at: 'desc' },
          },
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const promptService = MarketingPromptService.getInstance();
      const template = await promptService.getTemplate(templateId, ctx);
      if (!template) throw new Error(`Template ${templateId} not found`);

      const latestAudit = this.pickRepairSourceAudit(campaign.mkt_audits_list);
      const intake = campaign.mkt_dispute_intake?.[0] ?? null;
      // Phase 6 — signal-aligned gap gate (undefined → legacy primary set).
      const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
      const platformSignalWeights = await IntelligenceProfileService.getInstance()
        .resolveSignalWeightMapForCampaign(campaign, latestAudit?.audit_data, ctx);

      let variablesUsed: Record<string, any> = {};
      if (template.prompt_type === 'recovery_resolution' || templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID) {
        variablesUsed = this.buildResolutionVariables(campaign, intake);
      } else if (template.prompt_type === 'fulfill' || templateId === PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID) {
        variablesUsed = await this.buildFulfillVariables(campaign, latestAudit);
      } else {
        variablesUsed = this.buildSeekVariables(campaign, latestAudit, platformSignalWeights);
      }

      const executionService = MarketingExecutionService.getInstance();
      const { renderedPrompt } = await executionService.resolvePrompt(
        { template, campaign, variables: variablesUsed },
        ctx,
      );

      return {
        renderedPrompt,
        templateId,
        variablesUsed,
      };
    } catch (error) {
      logger.error('Failed to render profile repair prompt text', ctx, {
        error: (error as Error).message,
        campaignId,
        templateId,
      });
      throw this.handleError(error, ctx);
    }
  }

  async importExternalResult(
    campaignId: string,
    templateId: string,
    rawOutput: string,
    ctx?: RequestCtx,
  ): Promise<{
    executionId: string;
    passed: boolean;
    deliverableId?: string;
    errors?: string[];
  }> {
    try {
      const promptService = MarketingPromptService.getInstance();
      const template = await promptService.getTemplate(templateId, ctx);
      if (!template) throw new Error(`Template ${templateId} not found`);

      const campaign = await this.prisma.mkt_campaigns_list.findUnique({
        where: { id: campaignId },
        include: {
          mkt_audits_list: {
            where: { platform: { in: ['business_analysis', 'category_identification'] } },
            take: 6,
            orderBy: { created_at: 'desc' },
          },
          mkt_dispute_intake: {
            where: { intake_kind: 'profile_repair' },
            include: { mkt_dispute_attachments: true },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      const latestAudit = this.pickRepairSourceAudit(campaign.mkt_audits_list);
      const intake = campaign.mkt_dispute_intake?.[0] ?? null;
      // Phase 6 — signal-aligned gap gate (undefined → legacy primary set).
      const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
      const platformSignalWeights = await IntelligenceProfileService.getInstance()
        .resolveSignalWeightMapForCampaign(campaign, latestAudit?.audit_data, ctx);

      let variablesUsed: Record<string, any> = {};
      if (template.prompt_type === 'recovery_resolution' || templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID) {
        variablesUsed = this.buildResolutionVariables(campaign, intake);
      } else if (template.prompt_type === 'fulfill' || templateId === PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID) {
        variablesUsed = await this.buildFulfillVariables(campaign, latestAudit);
      } else {
        variablesUsed = this.buildSeekVariables(campaign, latestAudit, platformSignalWeights);
      }

      const execution = await promptService.createExecution(
        {
          campaignId,
          templateId,
          variablesUsed,
          executedBy: ctx?.userId || 'operator-external',
        },
        ctx,
      );

      // Parse & validate JSON
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(this.stripJsonArtifacts(rawOutput));
      } catch (e) {
        await promptService.updateExecution(
          execution.id,
          { rawOutput, status: 'failed', flaggedCount: 1, errorMessage: `Output is not valid JSON: ${(e as Error).message}` },
          ctx,
        );
        return {
          executionId: execution.id,
          passed: false,
          errors: [`Output is not valid JSON: ${(e as Error).message}`],
        };
      }

      const schemaName = template.output_schema?.name || template.outputSchema?.name;
      const schemaEntry = resolveOutputSchema(schemaName);

      if (schemaEntry) {
        const validation = schemaEntry.validator.safeParse(parsedJson);
        if (!validation.success) {
          const errors = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
          await promptService.updateExecution(
            execution.id,
            { rawOutput, status: 'failed', flaggedCount: 1, errorMessage: `Schema validation failed: ${errors.join('; ')}` },
            ctx,
          );
          return { executionId: execution.id, passed: false, errors };
        }
      }

      let deliverableId: string | undefined;

      // Persist triage briefing on the campaign row when the import targets the
      // triage template. Per-issue imports stay execution-row-only (Non-Goals).
      // Mirrors executeSeekSync: provenance metadata + _validated flag.
      if (templateId === PROFILE_REPAIR_TRIAGE_TEMPLATE_ID && parsedJson?.profile_repair_triage) {
        try {
          const triageValidated = profileRepairTriageSchema.safeParse(parsedJson);
          const recommendation = triageValidated.success
            ? triageValidated.data.profile_repair_triage
            : parsedJson.profile_repair_triage;

          // Apply the same code-side track floor as executeSeekSync.
          const signalCodes = extractSignals({
            campaign,
            auditData: latestAudit?.audit_data as any,
            platformSignalWeights,
          });
          const floorTrack = this.resolveTrackFromSignals(signalCodes);
          if (floorTrack === 'escalated' && recommendation?.recommended_track === 'standard') {
            logger.warn('Imported triage de-escalated below signal floor; forcing escalated', ctx, {
              campaignId,
              aiTrack: recommendation.recommended_track,
              floorTrack,
            });
            recommendation.recommended_track = 'escalated';
          }

          if (recommendation) {
            await this.prisma.mkt_campaigns_list.update({
              where: { id: campaignId },
              data: {
                repair_triage_briefing: {
                  ...recommendation,
                  _execution_id: execution.id,
                  _validated: triageValidated.success,
                } as any,
              },
            });
          }
        } catch (persistErr) {
          logger.warn('Failed to persist triage briefing from import', ctx, {
            error: (persistErr as Error).message,
            campaignId,
            executionId: execution.id,
          });
        }
      }

      // Handle resolution import -> deliverable + stage transition
      if (templateId === PROFILE_REPAIR_RESOLUTION_TEMPLATE_ID || template.prompt_type === 'recovery_resolution') {
        deliverableId = generateDeliverableId();

        await this.prisma.mkt_deliverables_list.create({
          data: {
            id: deliverableId,
            campaign_id: campaignId,
            execution_id: execution.id,
            template_id: templateId,
            deliverable_type: 'reinstatement_appeal',
            status: 'drafted',
            file_name: `reinstatement-appeal-${campaignId}.json`,
            storage_path: `recovery/${campaignId}/${deliverableId}.json`,
            mime_type: 'application/json',
            generated_by: ctx?.userId || 'operator-external',
          },
        });

        await this.prisma.mkt_deliverable_section.createMany({
          data: [
            {
              id: generateDeliverableSectionId(),
              deliverable_id: deliverableId,
              campaign_id: campaignId,
              section_type: 'response_draft',
              title: 'Reinstatement Appeal Letter',
              content: parsedJson.deliverableText,
              source: 'external',
              quality_gate_passed: true,
              quality_gate_issues: [],
              status: 'draft',
              section_index: 0,
            },
            {
              id: generateDeliverableSectionId(),
              deliverable_id: deliverableId,
              campaign_id: campaignId,
              section_type: 'submission_guide',
              title: 'Submission Guide',
              content: parsedJson.submissionGuide,
              source: 'external',
              quality_gate_passed: true,
              quality_gate_issues: [],
              status: 'draft',
              section_index: 1,
            },
          ],
        });

        await MarketingCampaignService.transitionStage(
          {
            campaignId,
            toStage: 'final_resolution_drafted',
            triggerType: 'manual',
            notes: 'External reinstatement appeal imported',
          },
          ctx,
        );
      }

      // W6a — fulfill import → citation_repair_package deliverable.
      // Mirrors the reinstatement_appeal block above: deliverable row + the
      // deliverable_text / submission_guide sections. No stage transition on
      // import — the operator reviews, then generates + sends the PDF.
      // Idempotent: a non-preview citation_repair_package already on the
      // campaign means a prior import landed — return its id, never double up.
      if (template.prompt_type === 'fulfill' || templateId === PROFILE_REPAIR_CITATION_PACKAGE_TEMPLATE_ID) {
        const existing = await this.prisma.mkt_deliverables_list.findFirst({
          where: {
            campaign_id: campaignId,
            deliverable_type: 'citation_repair_package',
            status: { not: 'preview' },
          },
          orderBy: { created_at: 'desc' },
        });

        if (existing) {
          deliverableId = existing.id;
        } else {
          deliverableId = generateDeliverableId();

          await this.prisma.mkt_deliverables_list.create({
            data: {
              id: deliverableId,
              campaign_id: campaignId,
              execution_id: execution.id,
              template_id: templateId,
              deliverable_type: 'citation_repair_package',
              status: 'drafted',
              file_name: `citation-repair-package-${campaignId}.json`,
              storage_path: `recovery/${campaignId}/${deliverableId}.json`,
              mime_type: 'application/json',
              generated_by: ctx?.userId || 'operator-external',
            },
          });

          await this.prisma.mkt_deliverable_section.createMany({
            data: [
              {
                id: generateDeliverableSectionId(),
                deliverable_id: deliverableId,
                campaign_id: campaignId,
                section_type: 'deliverable_text',
                title: 'Citation & Profile Repair Package',
                content: parsedJson.deliverableText,
                source: 'external',
                quality_gate_passed: true,
                quality_gate_issues: [],
                status: 'draft',
                section_index: 0,
              },
              {
                id: generateDeliverableSectionId(),
                deliverable_id: deliverableId,
                campaign_id: campaignId,
                section_type: 'submission_guide',
                title: 'Submission Guide',
                content: parsedJson.submissionGuide,
                source: 'external',
                quality_gate_passed: true,
                quality_gate_issues: [],
                status: 'draft',
                section_index: 1,
              },
            ],
          });
        }
      }

      await promptService.updateExecution(
        execution.id,
        {
          rawOutput,
          filteredOutput: rawOutput,
          status: 'completed',
        },
        ctx,
      );

      return {
        executionId: execution.id,
        passed: true,
        deliverableId,
      };
    } catch (error) {
      logger.error('Failed to import external profile repair result', ctx, {
        error: (error as Error).message,
        campaignId,
        templateId,
      });
      throw this.handleError(error, ctx);
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private stripJsonArtifacts(content: string): string {
    return content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
}

export default ProfileRepairPromptService.getInstance();
