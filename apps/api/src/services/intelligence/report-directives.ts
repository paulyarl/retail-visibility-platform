/**
 * report-directives.ts — shared prompt directives for the Automated Seed
 * Intelligence Report (spec §6.1, §6.10).
 *
 * These directives are composed ONCE through the prompt-composition layer
 * (PromptComposerService and any other fragment-assembly surface). They must
 * NOT be copied into individual fragment bodies or seed transforms — that
 * causes tone drift and seed-insertion failures (§6.10 rule).
 *
 * Bump REPORT_DIRECTIVES_VERSION when the directive text changes so
 * execution metadata can identify which directive version produced a run.
 */

export const REPORT_DIRECTIVES_VERSION = 'report_directives_v1';

/**
 * §6.10 — Shared business-intelligence tone directive.
 * Applied to every surface that produces reusable business-facing fragments.
 */
export const SHARED_BUSINESS_INTELLIGENCE_TONE_DIRECTIVE = `SHARED BUSINESS INTELLIGENCE TONE DIRECTIVE

Write for a capable business owner or operator. Be clear, specific, useful, and
forward-looking. The writing should feel intelligent and commercially aware,
never dull, dry, bureaucratic, alarmist, or generic.

Explain why a finding matters to visibility, customer discoverability, marketplace
expectations, or the next practical business decision. Use active language and
concrete observations. Create constructive momentum and, when supported by market
evidence, explain the opportunity to keep pace with comparable businesses.

Do not shame the business. Do not imply that incomplete public information proves
poor business quality. Do not claim that a visibility observation caused lost
customers or revenue unless the evidence explicitly supports that conclusion.
Do not convert an unavailable field into a negative finding.

Separate observed evidence, interpretation, opportunity, and owner-confirmed
information. Use qualified language when evidence is incomplete. Every substantive
claim must be grounded in the structured evidence returned by this prompt.

The result should be engaging enough to start a useful conversation and precise
enough to support an intelligence report.`;

/**
 * §6.1 — Report evidence directive.
 * Adds the additive report_evidence output contract to multitask prompts.
 * Emitted per candidate business, not once per discovery run (§6.0).
 */
export const REPORT_EVIDENCE_DIRECTIVE = `REPORT EVIDENCE DIRECTIVE

In addition to completing the primary task, return a report_evidence object
for EACH candidate business in the run. Each candidate that can become a seed
receives its own evidence block keyed by the candidate's stable run-local key:

  { "candidate_key": string, "business_name": string|null, "city": string|null,
    "state": string|null, "report_evidence": { ... } }

Record only information supported by the supplied research or tool results.
Do not infer missing information as negative evidence.

For every observed business fact:
- identify the field;
- provide the observed value;
- classify the evidence state (confirmed | observed | probable | conflicting |
  not_found_during_discovery | not_checked | owner_confirmed | owner_corrected |
  owner_disputed);
- provide confidence (high | medium | low | unknown);
- identify the source;
- include the source URL when available;
- include the observation date when available.

Use "not_found_during_discovery" when a field was not located in the sources
checked. Do not use "does_not_exist" unless a source explicitly confirms
nonexistence. For platform presence where the source does not establish claimed
or unclaimed status, use claimed_status "not_verified".

Return unresolved questions separately from observations.
Return discovery signals (INT_* codes from the active signal registry only)
separately from business-audit signals.
Do not calculate fees, benchmarks, rankings, or audit deficiencies unless the
primary task explicitly requires them.

report_evidence shape:
  observations          — ReportObservation[] (field, value, state, confidence,
                          source_name, source_type, source_url, observed_at, notes)
  identity_candidates   — IdentityCandidate[] (business_name, address, phone,
                          website, city, state, identity_confidence, basis[],
                          source_observation_ids[])
  category_assessment   — CategoryAssessment|null (category, subcategory,
                          category_fit: verified|probable|insufficient, basis[],
                          source_observation_ids[])
  geographic_assessment — GeographicAssessment|null (location_status:
                          inside_city|adjacent_city|metro_area|outside_market,
                          basis[], source_observation_ids[])
  signals               — ReportSignal[] (code, family: "INT", label, basis,
                          source_observation_ids[])
  unresolved_questions  — UnresolvedQuestion[] (field, question, reason,
                          suggested_verification_method)
  platform_observations — PlatformObservation[] (platform, presence,
                          business_name, address, phone, primary_category,
                          hours_present, website_present, claimed_status,
                          attributes[], source_url, observed_at)`;

/**
 * Compose the shared tone + report-evidence directives for a prompt surface.
 * Returns the two directive blocks joined for appending to an assembled body.
 */
export function composeReportDirectives(): string {
  return [SHARED_BUSINESS_INTELLIGENCE_TONE_DIRECTIVE, REPORT_EVIDENCE_DIRECTIVE].join('\n\n');
}
