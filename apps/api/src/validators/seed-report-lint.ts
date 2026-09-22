/**
 * Seed Intelligence Report — Lint Rules (Phase 1)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §4.3  Absence is not a negative finding
 *   §4.7  Tone and narrative quality
 *   §17.1 Evidence safety acceptance criteria
 *   §17.3 Prompt contract — tone and claim-safety lint
 *
 * The normalizer (Phase 3, SeedReportEvidenceService) runs these checks
 * before a report version is published. A failing lint check blocks
 * publication and surfaces the failure as incomplete evidence (§17.3).
 *
 * These are NOT prompt-side rules. They validate the assembled report DTO
 * and the normalized evidence, not the raw prompt output.
 */

import type { SeedIntelligenceReport } from './seed-report-dto.schema';
import type { ReportEvidenceOutput } from './seed-report-evidence.schema';

// ─── Lint result ─────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warning';

export interface LintFinding {
  rule: string;
  severity: LintSeverity;
  message: string;
  path?: string;
}

export interface LintResult {
  passed: boolean;
  findings: LintFinding[];
}

// ─── Banned phrases (§4.7, §17.1) ───────────────────────────────────────
//
// Phrases that convert an unavailable field into a negative finding or use
// alarmist/shaming language. The report narrative must never contain these.

export const BANNED_NEGATIVE_FINDING_PHRASES: readonly string[] = [
  'no website',
  "doesn't have a website",
  'does not have a website',
  'has no website',
  'no google profile',
  'has no google profile',
  'no google listing',
  'no facebook page',
  'has no facebook',
  'no yelp page',
  'has no yelp',
  'no online presence',
  'has no online presence',
  'not on google',
  'not on facebook',
  'not on yelp',
];

export const BANNED_ALARMIST_PHRASES: readonly string[] = [
  'losing customers',
  'lost customers',
  'losing revenue',
  'lost revenue',
  'losing sales',
  'lost sales',
  'competitors are stealing',
  'competitors stealing',
  'falling behind',
  'being left behind',
  'will lose',
  'are losing out',
  'missing out on customers',
  'driving customers away',
  'scaring customers away',
  'damaging your reputation',
  'destroying your reputation',
  'hurting your business',
  'killing your business',
  'bleeding customers',
];

export const BANNED_FILLER_PHRASES: readonly string[] = [
  'digital presence is important',
  'having an online presence is important',
  'online presence is crucial',
  'online presence is essential',
  'in today\'s digital world',
  'in the digital age',
];

// ─── Lint rule definitions ───────────────────────────────────────────────

export interface LintRule {
  id: string;
  description: string;
  severity: LintSeverity;
  check: (report: SeedIntelligenceReport, evidence?: ReportEvidenceOutput) => LintFinding[];
}

// ─── §17.1: Claim CTA gating ────────────────────────────────────────────

export const claimCtaGatingRule: LintRule = {
  id: 'claim_cta_gating',
  description: 'insufficient_evidence and requires_identity_review reports must not expose a claim CTA (§17.1, §5.2)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];
    const operatorInternalStatuses = ['insufficient_evidence', 'requires_identity_review'];

    if (operatorInternalStatuses.includes(report.status)) {
      if (report.next_actions.cta_eligible) {
        findings.push({
          rule: 'claim_cta_gating',
          severity: 'error',
          message: `Report status "${report.status}" is operator-internal but cta_eligible is true — claim CTA must be disabled`,
          path: 'next_actions.cta_eligible',
        });
      }
      if (report.next_actions.primary_cta !== null) {
        findings.push({
          rule: 'claim_cta_gating',
          severity: 'error',
          message: `Report status "${report.status}" is operator-internal but primary_cta is set — must be null`,
          path: 'next_actions.primary_cta',
        });
      }
    }

    return findings;
  },
};

// ─── §17.1: Every report fact has provenance ────────────────────────────

export const factProvenanceRule: LintRule = {
  id: 'fact_provenance',
  description: 'No report fact exists without provenance (source_observation_ids) or an explicit derived-value explanation (§17.1, §4.4)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];
    const identityFields = Object.entries(report.business_identity) as Array<[string, any]>;

    for (const [fieldName, fact] of identityFields) {
      if (!fact || typeof fact !== 'object') continue;
      const hasProvenance = Array.isArray(fact.source_observation_ids) && fact.source_observation_ids.length > 0;
      const hasDerivedNote = typeof fact.display_note === 'string' && fact.display_note.length > 0;

      if (!hasProvenance && !hasDerivedNote) {
        findings.push({
          rule: 'fact_provenance',
          severity: 'error',
          message: `Business identity field "${fieldName}" has no source_observation_ids and no display_note explaining the derived value`,
          path: `business_identity.${fieldName}`,
        });
      }
    }

    return findings;
  },
};

// ─── §17.1: Every INT_* signal has an evidence basis ───────────────────

export const signalEvidenceBasisRule: LintRule = {
  id: 'signal_evidence_basis',
  description: 'Every INT_* signal must have an evidence basis and source observation IDs (§17.1, §6.7)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];

    for (let i = 0; i < report.intelligence_signals.signals.length; i++) {
      const signal = report.intelligence_signals.signals[i];
      if (!signal.basis || signal.basis.trim().length === 0) {
        findings.push({
          rule: 'signal_evidence_basis',
          severity: 'error',
          message: `Signal "${signal.code}" has no evidence basis`,
          path: `intelligence_signals.signals[${i}].basis`,
        });
      }
      if (!Array.isArray(signal.source_observation_ids) || signal.source_observation_ids.length === 0) {
        findings.push({
          rule: 'signal_evidence_basis',
          severity: 'error',
          message: `Signal "${signal.code}" has no source_observation_ids`,
          path: `intelligence_signals.signals[${i}].source_observation_ids`,
        });
      }
    }

    return findings;
  },
};

// ─── §4.3: Absence is not a negative finding ───────────────────────────

export const absenceNotNegativeRule: LintRule = {
  id: 'absence_not_negative',
  description: 'not_found_during_discovery / not_checked / unknown / conflicting must not be rendered as false or a negative finding (§4.3)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];
    const absenceStates = ['not_found_during_discovery', 'not_checked', 'conflicting'];
    const identityFields = Object.entries(report.business_identity) as Array<[string, any]>;

    for (const [fieldName, fact] of identityFields) {
      if (!fact || typeof fact !== 'object') continue;
      if (absenceStates.includes(fact.state)) {
        // If the value is explicitly false, that's a violation — absence
        // states must not be converted to boolean false (§4.3).
        if (fact.value === false) {
          findings.push({
            rule: 'absence_not_negative',
            severity: 'error',
            message: `Field "${fieldName}" has state "${fact.state}" but value is false — absence must not be converted to a negative finding`,
            path: `business_identity.${fieldName}.value`,
          });
        }
      }
    }

    return findings;
  },
};

// ─── §17.1: Owner-reported pain is separate from platform-observed evidence ──

export const painSeparationRule: LintRule = {
  id: 'pain_separation',
  description: 'Owner-reported pain must be separate from platform-observed evidence (§17.1, §11.4 rule 7)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];

    for (let i = 0; i < report.verification_activity.events.length; i++) {
      const event = report.verification_activity.events[i];
      // Owner-reported pain must be in the verification event, not in
      // business_identity or intelligence_signals.
      if (event.owner_reported_pain) {
        // Check that no identity field has state 'observed' with a value
        // matching the pain text (would indicate pain was mixed into evidence).
        const identityFields = Object.values(report.business_identity) as any[];
        for (const fact of identityFields) {
          if (fact && typeof fact === 'object' && typeof fact.value === 'string') {
            if (fact.value === event.owner_reported_pain) {
              findings.push({
                rule: 'pain_separation',
                severity: 'error',
                message: `Owner-reported pain appears in business_identity field — must be separate from platform-observed evidence`,
                path: `verification_activity.events[${i}].owner_reported_pain`,
              });
            }
          }
        }
      }
    }

    return findings;
  },
};

// ─── §17.1: No-answer/declined does not create negative signals ────────

export const noAnswerNotNegativeRule: LintRule = {
  id: 'no_answer_not_negative',
  description: 'No-answer and declined contact outcomes must not create negative business signals (§17.1, §11.4 rule 8)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];
    const negativeOutcomes = ['no_answer', 'declined', 'unreachable', 'wrong_number', 'disconnected_number'];

    for (let i = 0; i < report.verification_activity.events.length; i++) {
      const event = report.verification_activity.events[i];
      if (event.contact_outcome && negativeOutcomes.includes(event.contact_outcome)) {
        // A no-answer/declined event must not produce any facts_confirmed,
        // facts_corrected, or facts_disputed — those require a connected
        // conversation.
        if (event.facts_confirmed.length > 0 || event.facts_corrected.length > 0 || event.facts_disputed.length > 0) {
          findings.push({
            rule: 'no_answer_not_negative',
            severity: 'error',
            message: `Contact outcome "${event.contact_outcome}" cannot produce confirmed/corrected/disputed facts — no conversation was connected`,
            path: `verification_activity.events[${i}]`,
          });
        }
      }
    }

    return findings;
  },
};

// ─── §4.7: Banned phrase detection ──────────────────────────────────────

/**
 * Check a block of narrative text for banned phrases. Used by the
 * normalizer on any LLM-generated prose before it enters the report DTO.
 * Returns findings for each banned phrase found.
 */
export function lintNarrativeText(text: string, path?: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const lower = text.toLowerCase();

  for (const phrase of BANNED_NEGATIVE_FINDING_PHRASES) {
    if (lower.includes(phrase)) {
      findings.push({
        rule: 'banned_negative_finding',
        severity: 'error',
        message: `Narrative contains banned negative-finding phrase: "${phrase}" — use not_found_during_discovery state instead (§4.3)`,
        path,
      });
    }
  }

  for (const phrase of BANNED_ALARMIST_PHRASES) {
    if (lower.includes(phrase)) {
      findings.push({
        rule: 'banned_alarmist',
        severity: 'error',
        message: `Narrative contains banned alarmist phrase: "${phrase}" — use opportunity language, not fear-based language (§4.7)`,
        path,
      });
    }
  }

  for (const phrase of BANNED_FILLER_PHRASES) {
    if (lower.includes(phrase)) {
      findings.push({
        rule: 'banned_filler',
        severity: 'warning',
        message: `Narrative contains generic filler phrase: "${phrase}" — connect to discovery or customer decisions instead (§4.7)`,
        path,
      });
    }
  }

  return findings;
}

// ─── §10.1.1: Peer-effect copy gating ───────────────────────────────────

/**
 * Phrases that make a market-context string "peer-effect copy" — they only
 * belong on the report when a real, reproducible peer metric accompanies
 * them (§10.1.1). Exported so the report builder can pre-vet enrichment
 * text bound for `category_profile_context` and drop it instead of letting
 * the lint rule block publication.
 */
export const PEER_EFFECT_PHRASES: readonly string[] = [
  'comparable businesses',
  'competitors',
  'other businesses in your category',
  'businesses in your area',
  'peers',
];

/**
 * Validate that peer-effect copy is only present when a real peer metric
 * is available. The report builder must set `peer_metric` in the market
 * classification when peer-effect language is used.
 */
export const peerEffectGatingRule: LintRule = {
  id: 'peer_effect_gating',
  description: 'Peer-effect copy requires a real, reproducible peer metric (§10.1.1)',
  severity: 'error',
  check: (report) => {
    const findings: LintFinding[] = [];
    const peerPhrases = [...PEER_EFFECT_PHRASES];

    // Check the market classification context for peer language without a metric
    const context = report.market_classification.category_profile_context;
    if (context) {
      const lower = context.toLowerCase();
      const hasPeerLanguage = peerPhrases.some((p) => lower.includes(p));
      // If peer language is present, the builder must have set a peer metric.
      // The metric is stored in the market_classification operational_signals
      // or category_profile_context. This is a heuristic check — the builder
      // is responsible for only including peer language when a metric exists.
      // We check that "peer_claim_rate" or a numeric claim count is present.
      const hasMetric =
        lower.includes('peer_claim_rate') ||
        lower.includes('claimed_count') ||
        lower.includes('eligible_count') ||
        /\d+\s+(of|\/)\s+\d+/.test(context);

      if (hasPeerLanguage && !hasMetric) {
        findings.push({
          rule: 'peer_effect_gating',
          severity: 'error',
          message: 'Peer-effect language present without a reproducible peer metric — omit peer copy or provide a measured metric (§10.1.1)',
          path: 'market_classification.category_profile_context',
        });
      }
    }

    return findings;
  },
};

// ─── All rules ──────────────────────────────────────────────────────────

export const ALL_LINT_RULES: LintRule[] = [
  claimCtaGatingRule,
  factProvenanceRule,
  signalEvidenceBasisRule,
  absenceNotNegativeRule,
  painSeparationRule,
  noAnswerNotNegativeRule,
  peerEffectGatingRule,
];

/**
 * Run all lint rules against a report DTO. The normalizer calls this before
 * publishing a report version. A failing error-severity finding blocks
 * publication (§17.3).
 */
export function lintReport(
  report: SeedIntelligenceReport,
  evidence?: ReportEvidenceOutput,
): LintResult {
  const allFindings: LintFinding[] = [];

  for (const rule of ALL_LINT_RULES) {
    const ruleFindings = rule.check(report, evidence);
    allFindings.push(...ruleFindings);
  }

  const hasErrors = allFindings.some((f) => f.severity === 'error');

  return {
    passed: !hasErrors,
    findings: allFindings,
  };
}
