/**
 * Seed script: Business Audit V2 — wire both intelligence profiles into both
 * seek variants.
 *
 * The two Business Audit V2 templates (Category-Integrated + Signal-Aligned)
 * have the Category Intelligence block AND the Gold Standard Benchmark block
 * appended at runtime by MarketingExecutionService.resolvePrompt(). However,
 * the template BODIES did not instruct the model on how to apply those blocks,
 * and the embedded JSON schemas did not define the output fields the blocks
 * require. This script wires both profiles into both bodies:
 *
 *   - mpt-j9bbem3l (Category-Integrated): already had Category Intelligence
 *     wired in; this adds the Gold Standard binding section + schema fields
 *     (profile_url, gap_analysis, quality_gate_results).
 *   - mpt-6oeuiizo (Signal-Aligned): had NEITHER profile wired in; this adds
 *     the Category Intelligence binding section + all missing CI instruction
 *     sections + schema fields, PLUS the Gold Standard binding section +
 *     schema fields.
 *
 * Idempotency: each variant has a marker string. If the marker is already
 * present in the live body, that variant is skipped (update-in-place safety
 * per AGENTS.md — check for the presence of the NEW marker, not the absence
 * of an old section).
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
 *   doppler run --config prd -- npx tsx src/scripts/seed-business-audit-v2-templates.ts
 */

import { MarketingPromptService } from '../services/MarketingPromptService';
import { logger } from '../logger';

// ─── Template IDs ────────────────────────────────────────────────────────
const CATEGORY_INTEGRATED_ID = 'mpt-j9bbem3l';
const SIGNAL_ALIGNED_ID = 'mpt-6oeuiizo';
const BUSINESS_AUDIT_V1_ID = 'mpt-je6m7ru6';
const SEED_BUSINESS_AUDIT_ID = 'mpt-seed-seek-001';

// ─── Output schema declaration ───────────────────────────────────────────
// All three business-audit templates emit business_analysis-shaped output.
// The /prompts/executions/external import endpoint resolves the validator
// via template.output_schema->>'name' through OUTPUT_SCHEMA_REGISTRY —
// without this declaration it 400s with "does not declare a recognized
// output_schema". This is applied even when the body marker is already
// present (the marker only gates BODY transforms, not column fixes).
const BUSINESS_ANALYSIS_OUTPUT_SCHEMA = { name: 'business_analysis' };

// ─── Markers (presence => already wired, skip) ───────────────────────────
// Versioned marker — bump the version string when the seed's content changes
// so already-wired templates get re-applied. The transforms are idempotent
// (they skip insertions that are already present and only apply targeted
// content updates), so re-running on an already-wired body is safe.
const SEED_VERSION_MARKER = '<!-- seed-version: business-audit-v2-2026-09-16-outreach-problems-1 -->';
const GOLD_STANDARD_MARKER = SEED_VERSION_MARKER;
const CATEGORY_INTELLIGENCE_MARKER = SEED_VERSION_MARKER;
const V1_MARKER = SEED_VERSION_MARKER;

// ─── Shared binding-section text ─────────────────────────────────────────

const CATEGORY_INTELLIGENCE_BINDING = `Category Intelligence — Binding for This Audit
A CATEGORY INTELLIGENCE block is appended to this prompt after the audit instructions and before the JSON schema. It contains category-specific terminology, specialized sources, evidence rules, prohibited inferences, and category signals for the business category being audited.

You MUST apply the Category Intelligence block throughout this audit. Specifically:

Terminology — Use the category-specific terms listed in the block as corroboration signals when evaluating whether the business genuinely fits the requested category. A single term is never sufficient; require multiple category-specific indicators.
Specialized Sources — Consult the Specialized Sources listed in the block in addition to the mainstream platforms listed in the Platforms section below. Record every consulted source in specialized_sources_audited and sources.
Evidence Rules — Obey every rule in the block's Category Evidence Rules section. These rules are binding and override any conflicting default behavior.
Prohibited Inferences — Do NOT make any inference listed in the block's PROHIBITED INFERENCES section. These are category-specific guardrails that complement (and are stricter than) the general cautions in this template.
Category Signals — Populate detected_signals with any INT_* codes from the block's Category Signals list when verified public evidence supports them. These are admissible alongside the RA_*, DS_*, WC_*, CP_*, and VP_* signal families defined later in this template. These INT_* taxonomy codes are distinct from the free-text category_signals list in the CATEGORY MARKET CONTEXT block — the former are codes you may emit, the latter is a qualitative checklist for your assessment.
Absence Is Not a Negative — If a website, social profile, delivery option, specialty product, or certification listed in the block is not found, record that it was "not verified." Do not convert absence into a claim that the asset does not exist.
If the Category Intelligence block is missing or empty, proceed with the general audit instructions and note the absence in data_quality.limitations.
`;

const GOLD_STANDARD_BINDING = `Gold Standard Benchmark — Binding for This Audit
A GOLD STANDARD BENCHMARK block is appended to the end of this prompt (after the Category Intelligence block). It contains category-specific expected fields, quality gates, per-platform expected attributes, branding/photo expectations, and pattern exemplars for the business category being audited.

You MUST apply the Gold Standard block as a comparison benchmark throughout this audit. Specifically:

Expected Fields — Compare the business's actual profile against the Universal Expected Fields and each platform's Expected Fields. For every field where the business's actual value differs from the expected value, record a gap entry in gap_analysis.gaps with the platform, field name, expected value, actual value, gap description, and severity (non_negotiable or recommended).
Quality Gates — Evaluate each quality gate (Universal and per-platform). Record pass/fail in quality_gate_results.results with the platform, gate name, passed boolean, severity, and notes.
Profile URLs — Capture the live profile URL for each platform in platforms.{platform}.profile_url so the benchmark comparison references a concrete destination.
Platform Scope — The benchmark may define expected fields for platforms beyond the four audited here (google, yelp, facebook, bbb) — e.g., bing, apple_maps. For those platforms, evaluate the expected fields where publicly observable and record any gaps in gap_analysis.gaps with the platform field set accordingly; do not create platform objects for them in the platforms block.
Absence vs. Non-Negotiable — A non_negotiable quality gate or expected field is recorded as failed (passed: false) ONLY when the field is verified absent. When a field cannot be verified (not found during searched discovery paths), record passed: null and note "not verified" — do NOT convert inability to verify into a failure. This reconciles the benchmark's non_negotiable gates with the Category Intelligence absence-is-not-a-negative rule. Exception: when the Platform Availability Verification directive establishes a business_specific_failure for a platform, the platform's expected fields are recorded as verified absent for that business, and the gates fail accordingly.
Subject-as-Exemplar — If the audited business appears in the benchmark's Pattern Exemplars section, treat those exemplar notes as reference priors only (not as a self-comparison). Use the other exemplar businesses as competitive comparators; do not benchmark the business against itself.
If the Gold Standard block is missing or empty, omit gap_analysis and quality_gate_results and note the absence in data_quality.limitations.
`;

// ─── Targeted content update: amend the Absence vs. Non-Negotiable paragraph
//     in the Gold Standard binding to add the business_specific_failure
//     exception. The GOLD_STANDARD_BINDING const above already has the new
//     text, but insertAfter skips re-insertion when the binding is already
//     present (fingerprint match on the first 80 chars). This replaceFirst
//     updates the paragraph in-place for templates that already have the old
//     binding. Idempotent (no-op if already updated or not present).
const ABSENCE_VS_NONNEGOTIABLE_FROM = "This reconciles the benchmark's non_negotiable gates with the Category Intelligence absence-is-not-a-negative rule.";
const ABSENCE_VS_NONNEGOTIABLE_TO = "This reconciles the benchmark's non_negotiable gates with the Category Intelligence absence-is-not-a-negative rule. Exception: when the Platform Availability Verification directive establishes a business_specific_failure for a platform, the platform's expected fields are recorded as verified absent for that business, and the gates fail accordingly.";

const MARKET_CONTEXT_BINDING = `Market Context Intelligence — Binding for This Audit
A CATEGORY MARKET CONTEXT block and/or a CITY MARKET CONTEXT block may be appended to the end of this prompt (after the Gold Standard block). They contain structural market intelligence produced by prior enrichment runs for this business's category and location. This is analyst-facing intelligence — not shopper-facing copy — that gives you market-aware context for the audit.

You MUST apply the Market Context blocks throughout this audit. Specifically:

Category Market Intelligence — The CATEGORY MARKET CONTEXT block may contain:
  - category_summary: what this category looks like in this market
  - category_profile: the business model for this category (how businesses in this category typically operate, what they sell, who they serve, their online presence pattern, competitive landscape, typical scale)
  - category_signals: free-text qualitative signals that indicate a strong business in this category — use these as a checklist for the business being audited (met / unmet / not verified). These are NOT the INT_* taxonomy codes from the CATEGORY INTELLIGENCE block — do not emit them in detected_signals.
  - market_density: qualitative density of this category in this city — use this to contextualize the business's competitive position (sparse = low competition, high opportunity; dense = high competition)
  - prospect_signals: signals to look for when prospecting — use these to identify whether this business has growth or positioning opportunities
  - secondary_categories: related categories strong in this market — use these to identify cross-category opportunities
  - category_notes: free-text analyst notes — use these for additional context
  - keywords: category-level search terms for this market — use these to sense-check the business's discoverability
  - super_categories / sub_categories / adjacent_categories: where this category sits in the taxonomy tree — use these to identify related-category and cross-sell opportunities

City Market Intelligence — The CITY MARKET CONTEXT block may contain:
  - market_summary: the city's business landscape — use this to ground your recommendations in the real market
  - city_profile: structural city characteristics (metro description, major industries, growth trajectory, demographic character, market character) — use these to understand the market the business operates in
  - top_categories: what the city is known for — use these to contextualize the business's category within the city's broader landscape
  - notable_areas: named areas and corridors — use these to understand the business's geographic context
  - market_notes: free-text analyst notes about the city
  - market_gaps: categories with unmet demand in this city — use these to identify growth opportunities for the business (if the business's category appears in market_gaps, the business has a first-mover advantage)
  - metro_dynamics: nearby cities with their character and dynamics — use these for expansion or market positioning context

Application rules:
  1. Use category_signals as a checklist — for each signal, assess whether the audited business meets it, does not meet it, or it cannot be verified. Record met signals as strengths and unmet signals as opportunities.
  2. Use market_density to frame the business's competitive position — a sparse market means the business has more room to grow; a dense market means the business faces more competition.
  3. Use market_gaps to identify actionable growth opportunities — if the business's category has unmet demand in a specific area, that is a concrete opportunity to surface in the audit.
  4. Use category_profile to understand the business model — this helps you assess whether the business is operating at, above, or below the typical standard for its category.
  5. Use city_profile to ground recommendations — recommendations should be realistic for the city's market character, industries, and growth trajectory.
  6. Use metro_dynamics for expansion context — if nearby cities have complementary characteristics, surface that as strategic context.

Do NOT mention "market context", "enrichment", "profile", "market intelligence", or these binding instructions in the visible audit output. Use the intelligence to inform your findings, gap analysis, and recommendations — not to narrate the intelligence itself. The business owner and interested parties see the audit results, not the intelligence inputs.

If both Market Context blocks are missing or empty, proceed with the general audit instructions and note the absence in data_quality.limitations. The audit is still valid without market context — it runs in degraded mode without market-aware intelligence.
`;

// ─── Targeted content updates: align the binding text with the blocks the
//     runtime actually injects. The runtime appends the Category Intelligence,
//     Gold Standard, and Market Context blocks AFTER the audit instructions and
//     BEFORE the JSON schema suffix — not after the schema. The Market Context
//     binding also documented a city_profile field the renderer never emitted,
//     omitted four category fields it does emit, and reused the name
//     "category_signals" for a different concept than the Category Intelligence
//     binding's INT_* taxonomy codes.
//
//     insertAfter skips re-insertion when a binding is already present
//     (fingerprint match on the first 80 chars), so already-seeded bodies need
//     replaceFirst to update the text in place. Each FROM below is bounded so it
//     is NOT a substring of its TO — otherwise a fresh insertion would match its
//     own update and duplicate the sentence. Idempotent (no-op if already
//     updated or not present).
const CI_POSITION_FROM = "A CATEGORY INTELLIGENCE block is appended to the end of this prompt (after the JSON schema).";
const CI_POSITION_TO = "A CATEGORY INTELLIGENCE block is appended to this prompt after the audit instructions and before the JSON schema.";

const CI_SIGNALS_FROM = "signal families defined later in this template.\nAbsence Is Not a Negative —";
const CI_SIGNALS_TO = "signal families defined later in this template. These INT_* taxonomy codes are distinct from the free-text category_signals list in the CATEGORY MARKET CONTEXT block — the former are codes you may emit, the latter is a qualitative checklist for your assessment.\nAbsence Is Not a Negative —";

const GS_POSITION_FROM = "A GOLD STANDARD BENCHMARK block is appended to the end of this prompt (after the Category Intelligence block).";
const GS_POSITION_TO = "A GOLD STANDARD BENCHMARK block is appended to this prompt after the Category Intelligence block and before the JSON schema.";

const MC_POSITION_FROM = "A CATEGORY MARKET CONTEXT block and/or a CITY MARKET CONTEXT block may be appended to the end of this prompt (after the Gold Standard block).";
const MC_POSITION_TO = "A CATEGORY MARKET CONTEXT block and/or a CITY MARKET CONTEXT block may be appended to this prompt after the Gold Standard block and before the JSON schema.";

const MC_SIGNALS_FROM = "  - category_signals: signals that indicate a strong business in this category — use these as a checklist for the business being audited (met / unmet / not verified)";
const MC_SIGNALS_TO = "  - category_signals: free-text qualitative signals that indicate a strong business in this category — use these as a checklist for the business being audited (met / unmet / not verified). These are NOT the INT_* taxonomy codes from the CATEGORY INTELLIGENCE block — do not emit them in detected_signals.";

const MC_FIELDS_FROM = "  - category_notes: free-text analyst notes — use these for additional context\n\nCity Market Intelligence — The CITY MARKET CONTEXT block may contain:";
const MC_FIELDS_TO = "  - category_notes: free-text analyst notes — use these for additional context\n  - keywords: category-level search terms for this market — use these to sense-check the business's discoverability\n  - super_categories / sub_categories / adjacent_categories: where this category sits in the taxonomy tree — use these to identify related-category and cross-sell opportunities\n\nCity Market Intelligence — The CITY MARKET CONTEXT block may contain:";

/**
 * Apply every binding-alignment replaceFirst to a rendered body. Idempotent.
 *
 * `includeProfileBindings` is false for the V1 template (mpt-je6m7ru6) — it has
 * no Category Intelligence or Gold Standard binding, so only the Market Context
 * alignment applies.
 */
function alignBindingText(out: string, includeProfileBindings: boolean): string {
  if (includeProfileBindings) {
    out = replaceFirst(out, CI_POSITION_FROM, CI_POSITION_TO);
    out = replaceFirst(out, CI_SIGNALS_FROM, CI_SIGNALS_TO);
    out = replaceFirst(out, GS_POSITION_FROM, GS_POSITION_TO);
  }
  out = replaceFirst(out, MC_POSITION_FROM, MC_POSITION_TO);
  out = replaceFirst(out, MC_SIGNALS_FROM, MC_SIGNALS_TO);
  out = replaceFirst(out, MC_FIELDS_FROM, MC_FIELDS_TO);
  return out;
}

// ─── Schema fragment: profile_url (inserted before data_status in each
//     platform object) ────────────────────────────────────────────────────
const PROFILE_URL_SCHEMA_LINE = '"profile_url": null,\n      "data_status": "unavailable"';

// ─── Schema fragment: requested_business with variable placeholders.
//     Replaces the empty-string defaults in the requested_business block so
//     the rendered prompt pre-fills the requested business identity in the
//     JSON schema template. The model sees both the "Business" instruction
//     section (with the same substituted values) AND the requested_business
//     schema block — no ambiguity about which business to audit.
//
//     The {{business_address}} / {{business_phone}} placeholders render as
//     empty strings when the campaign has no address/phone on file. The
//     model treats empty strings the same as null for optional fields.
const REQUESTED_BUSINESS_PLACEHOLDERS_FROM = `"requested_business": {
      "business_name": "",
      "city": "",
      "state": "",
      "category": "",
      "address": null,
      "phone": null
    }`;

const REQUESTED_BUSINESS_PLACEHOLDERS_TO = `"requested_business": {
      "business_name": "{{business_name}}",
      "city": "{{city}}",
      "state": "{{state}}",
      "category": "{{category}}",
      "address": "{{business_address}}",
      "phone": "{{business_phone}}"
    }`;

// ─── Declared variables: all 6 business-scope variables referenced by the
//     "Business" instruction section + requested_business schema. The
//     previous declaration only listed 3 (business_name, city, category),
//     omitting state, business_address, business_phone.
const FULL_BUSINESS_VARIABLES = [
  'business_name', 'city', 'state', 'category',
  'business_address', 'business_phone', 'business_origin',
];

// ─── Top-of-prompt business identity block. Inserted right after the intro
//     cautions ("Never invent or assume data.") and BEFORE any Category
//     Intelligence / Gold Standard binding sections. This ensures the model
//     sees the business identity FIRST, before the 5000+ chars of binding
//     instructions. Mirrors the original mpt-seed-seek-001 pattern which had
//     the business name prominently at the top.
const BUSINESS_IDENTITY_BLOCK = `

---

## Business to Audit

| Field | Value |
| --- | --- |
| Business Name | {{business_name}} |
| City | {{city}} |
| State | {{state}} |
| Category | {{category}} |
| Origin | {{business_origin}} |
| Address | {{business_address}} |
| Phone | {{business_phone}} |

Audit the business above. If address, phone, or origin is blank, the field was not provided — do not treat blank as a negative signal.
`;

// ─── Idempotent replace: add Origin row to existing identity blocks that
//     were inserted before the origin row was added. The FROM string is the
//     Category → Address boundary in the old block; the TO string inserts
//     the Origin row between them. No-op if already replaced (FROM not found).
const BUSINESS_IDENTITY_ORIGIN_FROM = '| Category | {{category}} |\n| Address | {{business_address}} |';
const BUSINESS_IDENTITY_ORIGIN_TO = '| Category | {{category}} |\n| Origin | {{business_origin}} |\n| Address | {{business_address}} |';

// ─── Idempotent replace: update the old "address or phone" blank-field
//     caveat to include origin. No-op if already replaced.
const BUSINESS_IDENTITY_CAVEAT_FROM = 'If address or phone is blank, the field was not provided — do not treat blank as a negative signal.';
const BUSINESS_IDENTITY_CAVEAT_TO = 'If address, phone, or origin is blank, the field was not provided — do not treat blank as a negative signal.';

// ─── Schema fragment: public_narrative (inserted after "summary": "" in the
//     top-level JSON schema). This field is the public-safe description that
//     will appear on the place listing page — no internal assessment content.
const PUBLIC_NARRATIVE_SCHEMA_LINE = '"summary": "",\n  "public_narrative": ""';

// ─── Directive: public_narrative instruction (inserted after the Summary
//     instruction section in the prompt body). Tells the analyst to write a
//     public-safe, factual description of the business for the directory
//     listing page. Must exclude all Tier C / internal assessment content.
const PUBLIC_NARRATIVE_DIRECTIVE = `
### Public Narrative (required)

Write a factual, public-safe, SEO-rich description of the business for the \`public_narrative\` field. This text will appear on a public directory listing page that visitors and the business owner will see, and it is the primary long-tail SEO surface for unclaimed listings — it must help the listing rank for the searches real customers actually type.

Include:
* What the business is (category, format, specialization — use the specific category label, not a generic one)
* Where it is located (neighborhood, corridor, district, city — use geo-modified phrasing a searcher would use, e.g. "African grocery in Kansas City's Northeast neighborhood")
* What it is known for (signature products, services, dishes, or community role — name the specific items verified in the audit, not generic categories; e.g. "frozen cassava leaves, dried beans, frozen fish" beats "spices and grains")
* Community, cultural, or ownership context when verifiable (e.g. "Central African-owned," "Congolese-style prepared foods")
* Services offered (catering, in-store pickup, online ordering, tax service) when verified

SEO guidance:
* Surface category-defining terms (the niche/category label), culturally specific terms (regional cuisine, product names), and geo-modified terms (neighborhood + city + corridor) that a searcher would actually type.
* Prefer concrete, verified product and service names over abstract category words — "frozen cassava leaves and dried beans" is stronger SEO than "spices and grains."
* Weave keywords naturally into readable prose — do not keyword-stuff or list comma-separated terms without sentence flow.

Exclude (these are internal assessment content — never public):
* Digital Opportunity Score, tier classifications, or alignment labels
* Review response rates, unanswered review counts, or deficiency language
* Recommended services, pricing, or upsell language
* Competitive benchmark comparisons
* Any language that could embarrass the business owner or signal weakness
* Health inspection outcomes, license status, closure/suspension reports

Tone: warm and professional — a knowledgeable local describing the business to a neighbor. Welcoming and plain-spoken, never casual or promotional: third person only, no exclamation marks, no superlatives, no hype. The business did not write this text and has not claimed the listing — write about the business, not as or for it.

Length: 2-4 sentences, 300-600 characters. Write in third person. Be specific and vivid — this is the first thing a visitor reads on the listing page and the primary text search engines will index. Do not invent details; use only verified public information. If the business is richly sourced, use the verified specifics to fill the range. If too thinly sourced for a rich narrative, write a shorter factual sentence using what is verified — but never pad with generic filler.
`;

// ─── Directive: Website Accessibility Verification (inserted at the end of
//     the Website Assessment section, after the intrusive-testing line).
//     Requires the analyst to actually load every discovered website URL as an
//     ordinary public visitor before recording positive website attributes.
//     A search-result snippet or indexed page is NOT proof of availability.
//     Details (initial URL, final URL, redirect chain, access barriers) are
//     routed into the existing `website.issues` string array — no schema change.
const WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE = `
### Website Accessibility Verification — REQUIRED

For every non-null website URL discovered during the audit — whether surfaced by a discovery lead, a directory listing, a GBP/Yelp/Facebook profile, or any other source — attempt to load the URL as an ordinary public visitor BEFORE recording any positive website attribute. A search-result snippet, indexed page preview, or directory listing that displays a URL is NOT proof that the website loads; the URL itself must be visited.

Website condition is a high-value opportunity target for this platform: a missing or unusable website is a gap the platform can confidently fill. Accurate website-status classification is therefore essential. Do not record positive website attributes (contact information, CTAs, ordering, category content, mobile usability, service information, HTTPS) unless the business website content actually loaded for an ordinary visitor.

Record the following in \`website.issues\`:

* the initial URL requested
* the final URL after any redirects
* whether the requested site content loaded
* whether a bot-defense, CAPTCHA, notification-permission, login, or other access-blocking page appeared instead of business content
* whether the business website content was observable
* any HTTP, TLS, redirect, or browser errors that are publicly observable

Do not grant notification permissions, bypass bot defenses, solve access controls, or perform intrusive testing.

Distinguish four states and record them honestly:

* URL discovered — a website link exists in a profile or directory (the URL is known but has not been confirmed to load).
* Website reachable — the URL loads without an access-blocking challenge.
* Website content verified — business content is actually visible on the loaded page.
* Website conversion verified — CTAs, ordering, contact, and other conversion functions are observable on the loaded page.

Only "website content verified" justifies positive website content fields. Only "website conversion verified" justifies positive conversion fields (\`call_to_action_present\`, \`click_to_call_available\`, \`conversion_opportunities\`).

If the URL redirects to a bot-defense, notification-permission, login, or other access-blocking page and the business website content does not load:

* classify \`website.status\` as \`broken\` when the visitor-facing URL is verified to be unusable;
* otherwise classify \`website.status\` as \`unable_to_verify\` when the audit cannot distinguish a temporary challenge from a persistent failure;
* set the website content and conversion fields (\`contact_information_visible\`, \`click_to_call_available\`, \`call_to_action_present\`, \`service_information_present\`, \`location_information_present\`, \`mobile_friendly\`, \`https\`) to \`unable_to_verify\`;
* do not claim contact information, CTAs, ordering, category content, mobile usability, or service information;
* add \`WC_BROKEN_WEBSITE\` to \`detected_signals\` ONLY when the public visitor path is verified to be inaccessible (\`status\` = \`broken\`) — do NOT add it for \`unable_to_verify\`;
* record the redirect chain and access barrier in \`website.issues\` and \`gap_analysis.gaps\` (when a Gold Standard block is present).
`;

// ─── Targeted content update: broaden WC_BROKEN_WEBSITE signal definition to
//     include access-blocking redirects (bot-defense / notification-permission /
//     login walls), consistent with the Website Accessibility Verification
//     directive above. Idempotent via replaceFirst (no-op if already updated).
const WC_BROKEN_WEBSITE_DEFINITION_FROM = '* `WC_BROKEN_WEBSITE`: Website URL returns 404, SSL error, or dead domain.';
const WC_BROKEN_WEBSITE_DEFINITION_TO = '* `WC_BROKEN_WEBSITE`: Website URL returns 404, SSL error, dead domain, or redirects to a bot-defense / notification-permission / login / access-blocking page that prevents an ordinary visitor from reaching business content (per the Website Accessibility Verification directive).';

// ─── Directive: Platform Availability Verification (inserted at the end of
//     the Platforms section for Signal-Aligned, or after the Website
//     Accessibility directive for Category-Integrated which has no Platforms
//     heading). Requires the analyst to attempt a gold-standard control URL
//     on the same platform before emitting any missing-profile signal, so
//     bare render failures (bot defense, JS gating) are not converted into
//     business findings. Control attempts are recorded in the top-level
//     render_controls array (Option B per spec §5).
const PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE = `
### Platform Availability Verification — REQUIRED

For every platform in scope (google, yelp, facebook, bbb, and any platform named in the Gold Standard block), attempt to load the business's profile URL as an ordinary public visitor before recording any positive platform attribute or emitting any missing-profile signal. A directory entry, search-result snippet, or indexed preview that displays a URL is NOT proof that the profile is reachable.

A render failure is only interpretable relative to a control. The Gold Standard block provides control businesses in the same category with per-platform destination URLs. A control is a profile known to exist on that platform. Attempt at least one control URL on the same platform as the business profile you are testing.

Determine the outcome:

* Control rendered AND the business profile did not render → the failure is specific to this business. Record the platform as unavailable for this business.
* Control rendered AND the business profile rendered → the platform is available. Proceed with the normal platform audit.
* Control did not render, or no control exists for this platform → the failure is not attributable to the business. Record the platform as unable_to_verify and emit NO missing-profile signal.

If the Gold Standard block is absent, no control is available. Record every unrendered platform as unable_to_verify and note the absence of a control set in data_quality.limitations.

Record each control attempt in the top-level \`render_controls\` array (one entry per platform attempted):

* \`platform\` — the platform name (google, yelp, facebook, bbb, bing, apple_maps, ...)
* \`business_profile_url\` — the business profile URL requested, and \`business_rendered\` — whether it rendered
* \`control_business\` — the control business name, and \`control_url\` — the control URL requested, and \`control_rendered\` — whether it rendered
* \`access_barrier\` — whether an access-blocking page appeared instead of profile content: none | js_required | bot_defense | captcha | login_wall | rate_limit | timeout | not_attempted
* \`determination\` — the resulting outcome: business_specific_failure | platform_available | unable_to_verify

When a determination is reached, set the platform object's \`data_status\` accordingly:

* \`business_specific_failure\` → set \`data_status: "unavailable"\` (the profile is verified absent, not merely unrendered). Set \`profile_status: "unable_to_verify"\` and null out any positive fields (rating, reviews, hours, categories, attribute chips) — they cannot be observed on a profile that does not render.
* \`platform_available\` → leave \`data_status\` to the normal platform audit (complete / partial / unavailable based on what loaded).
* \`unable_to_verify\` → set \`data_status: "unable_to_verify"\` unless the profile partially loaded — in that case use \`partial\` and note the partial load in \`data_quality.limitations\`.

For platforms beyond the four primary platforms (google, yelp, facebook, bbb) — e.g. bing, apple_maps — that are named in the Gold Standard block but have no platform object in the \`platforms\` block, record the control attempt in \`render_controls\` only. Do not create a platform object for them.

Do not bypass bot defenses, solve access controls, or perform intrusive testing.

Do not record positive platform attributes (rating, reviews, hours, categories, attribute chips) unless the profile content actually loaded.

Emit \`DS_MISSING_PROFILE\` ONLY when the control rendered on that platform and the business profile did not. Do not emit it when the control also failed, when no control was available, or when the platform was not attempted. Non-primary platforms (bing, apple_maps, etc.) record \`business_specific_failure\` in \`render_controls\` but do NOT emit \`DS_MISSING_PROFILE\` — the signal is restricted to the four primary platforms (google, yelp, facebook, bbb).
`;

// ─── Targeted content update: fix the buggy "bbb has no platform object" note
//     from availability-control-1/2 and replace it with the data_status mapping
//     + corrected non-primary platform guidance. The directive's insertAfter
//     is idempotent on the heading fingerprint, so a re-run with a new marker
//     won't re-insert the corrected directive — this replaceFirst updates the
//     old text in-place. Idempotent (no-op if already updated or not present).
const PLATFORM_DIRECTIVE_BUG_FROM = 'Note: \`bbb\` has no platform object in the \`platforms\` block today. A bbb control-confirmed absence is recorded in \`render_controls\` only — do not attempt to create a \`platforms.bbb\` object. The same applies to bing, apple_maps, and any other non-primary platform named in the Gold Standard block.';
const PLATFORM_DIRECTIVE_BUG_TO = 'When a determination is reached, set the platform object\'s \`data_status\` accordingly:\n\n* \`business_specific_failure\` → set \`data_status: "unavailable"\` (the profile is verified absent, not merely unrendered). Set \`profile_status: "unable_to_verify"\` and null out any positive fields (rating, reviews, hours, categories, attribute chips) — they cannot be observed on a profile that does not render.\n* \`platform_available\` → leave \`data_status\` to the normal platform audit (complete / partial / unavailable based on what loaded).\n* \`unable_to_verify\` → set \`data_status: "unable_to_verify"\` unless the profile partially loaded — in that case use \`partial\` and note the partial load in \`data_quality.limitations\`.\n\nFor platforms beyond the four primary platforms (google, yelp, facebook, bbb) — e.g. bing, apple_maps — that are named in the Gold Standard block but have no platform object in the \`platforms\` block, record the control attempt in \`render_controls\` only. Do not create a platform object for them.';

// ─── Schema fragment: render_controls array (inserted after signal_checklist
//     in the embedded JSON schema, before the top-level close). Idempotent
//     via replaceFirst — no-op if already present.
const RENDER_CONTROLS_SCHEMA = `  "render_controls": [
    {
      "platform": "",
      "business_profile_url": null,
      "business_rendered": null,
      "control_business": null,
      "control_url": null,
      "control_rendered": null,
      "access_barrier": "none",
      "determination": "unable_to_verify"
    }
  ]`;

// ─── Targeted content update: amend DS_MISSING_PROFILE definition to require
//     a render control. Two FROM variants — the Category-Integrated template
//     uses bare text (no bullet/markdown), the Signal-Aligned template uses
//     markdown bullet + backticks. Idempotent via replaceFirst (no-op if
//     already updated).
const DS_MISSING_PROFILE_FROM_CATEGORY = 'DS_MISSING_PROFILE: Business missing entirely on a primary platform (Google, Yelp, Facebook, BBB).';
const DS_MISSING_PROFILE_TO_CATEGORY = 'DS_MISSING_PROFILE: Business missing entirely on a primary platform (Google, Yelp, Facebook, BBB). Emit ONLY when a render control established business_specific_failure for that platform per the Platform Availability Verification directive.';
const DS_MISSING_PROFILE_FROM_SIGNAL = '* `DS_MISSING_PROFILE`: Business missing entirely on a primary platform (Google, Yelp, Facebook, BBB).';
const DS_MISSING_PROFILE_TO_SIGNAL = '* `DS_MISSING_PROFILE`: Business missing entirely on a primary platform (Google, Yelp, Facebook, BBB). Emit ONLY when a render control established business_specific_failure for that platform per the Platform Availability Verification directive.';

// ─── Schema fragment: gap_analysis + quality_gate_results (inserted before
//     the final closing brace, after the sources array) ───────────────────
const GAP_AND_GATES_SCHEMA = `  "gap_analysis": {
    "gaps": [
      {
        "platform": "",
        "field": "",
        "expected": null,
        "actual": null,
        "gap_description": "",
        "severity": "non_negotiable"
      }
    ],
    "summary": ""
  },
  "quality_gate_results": {
    "results": [
      {
        "platform": "",
        "gate": "",
        "passed": null,
        "severity": "non_negotiable",
        "notes": ""
      }
    ],
    "summary": ""
  }`;

// ─── Schema fragment: market_opportunities + signal_checklist (Seed Market
//     Intel Sidebar — Phase 0). Inserted after quality_gate_results, before
//     the top-level close. Two SEPARATE replaceFirst calls — never combine
//     into one (AGENTS.md: independent re-application on partial-wire bodies;
//     each field must be independently idempotent so a re-run after a partial
//     failure self-heals instead of silently dropping the second field).
const MARKET_OPPORTUNITIES_SCHEMA = `  "market_opportunities": [
    {
      "title": "",
      "description": "",
      "impact": "HIGH"
    }
  ]`;

const SIGNAL_CHECKLIST_SCHEMA = `  "signal_checklist": [
    {
      "signal": "",
      "met": null,
      "evidence": null
    }
  ]`;

// ─── Directive: Market Intelligence Output Fields (inserted AFTER the
//     headingless MARKET_CONTEXT_BINDING — which itself is inserted AFTER all
//     removeSection calls per AGENTS.md). Has a heading so removeSection can
//     manage re-runs. Tells the analyst to populate the two new top-level
//     output fields when Market Context was provided.
const MARKET_INTEL_OUTPUT_DIRECTIVE = `
### Market Intelligence Output Fields — REQUIRED when Market Context is present

When a Market Context block was provided above, populate these two top-level output fields in addition to gap_analysis and quality_gate_results:

market_opportunities — an array of business-specific growth opportunities synthesized from gap_analysis, relevant market_gaps, and website.conversion_opportunities. Each entry: { "title": short label, "description": one-sentence rationale, "impact": "HIGH"|"MEDIUM"|"LOW" }. Rank by impact (HIGH first). Omit the field entirely (do not emit an empty array) when no market context was provided.

signal_checklist — an array with one entry per category_signals item from the Category Market Context block, evaluated for THIS business. Each entry: { "signal": the signal label, "met": true|false|null (null when unable to verify), "evidence": one-sentence observed evidence or null }. The audit performs the evaluation against observed evidence — do not join signals to evidence generically. Omit the field entirely when no category context was provided.
`;

// ─── Directive: Operator Outreach Problems & Solutions (Triage & Repair
//     Outreach Problems spec §2.2/§4.3). Audit-context variant: the input is
//     this audit's own findings (gap_analysis, detected_signals, website,
//     platforms); solutions stay high-level (the analyst doesn't know the
//     package catalog — recommended_services is a hint, not a lookup table);
//     playbook alignment means deliverability in kind. The Gold Standard
//     clause carries real weight in the V2 templates (benchmark block is
//     injected at render time); V1 + mpt-seed-seek-001 fall back to audit
//     results + category intelligence alone. Has a heading so removeSection
//     manages re-runs — the removeSection must precede this insertion in
//     each transform, and the insertion must come AFTER all removeSection
//     calls in the transform (AGENTS.md).
const OUTREACH_PROBLEMS_DIRECTIVE = `
### Operator Outreach Problems & Solutions — REQUIRED

Produce \`outreach_problems\` — an array of ONE to THREE (1–3) problem-and-solution pairs the operator can use directly in outreach to the prospect (the business owner). Return only the most painful problems, ranked by severity: when the audit surfaces a single real issue, return just that one — never pad the count. Each entry ships two spoken lines — a plain professional statement and a hook alternative — followed by the solution. Shape:

{ "problem": "<the problem as the prospect experiences it — the business consequence>",
  "regular": "<the plain professional line that raises this problem>",
  "hook": "<the alternative line — same fact, earns attention>",
  "solution": "<high-level summary of the fix — what gets done, not a named package>",
  "evidence": "<the audit-data observation that grounds this problem: platform + observed fact>",
  "outreach_use": "<how the operator deploys this pair — cold-call opener, email hook, objection response>" }

Rules:
* 1–3 entries — the most painful problems only, ranked by severity. One well-grounded pair beats three thin ones: if the audit surfaces a single real issue (e.g. no website, everything else clean), return just that one. Never pad the count with duplicated, weak, or invented problems; never exceed three — when pains are numerous, the three most painful win. Each entry addresses a distinct customer-facing consequence — do not restate the same defect once per platform.
* Playbook alignment — deliverability in kind. Every pair must be the KIND of fix the operator's packages deliver (repair packages, claim service, listing cleanup, website/visibility work) — the entries converge on the pitch this audit is already making rather than scattering across every observed weakness. \`recommended_services\` is a hint at the kinds of fixes in scope, not a lookup table — you summarize the fix; you do not name the product. Off-scope pains belong in the other audit fields, never in \`outreach_problems\`. Rank by severity *within* the deliverable set.
* Ground every \`problem\` in THIS audit's findings — \`gap_analysis\`, \`detected_signals\`, \`website\`, \`platforms\`. Do not invent drift, missing platforms, or missed assets that are not present in the audit results. You MAY visit the business's live profile or website as an ordinary public visitor to confirm what is observable today before writing the pair (same access rules as the verification directives: no bypassing bot defenses, no logins, no intrusive testing). \`evidence\` cites what was actually observed — platform + observed fact.
* When a Gold Standard block is present, it is your primary evidence source for pairs — a verified gap in \`gap_analysis\` / \`quality_gate_results\` against an expected field or quality gate IS the problem, and "close the gap to benchmark" frames the solution. When the block is absent, ground pairs in the audit results and the category intelligence block alone.
* Use the category intelligence block (when present) to make problems and solutions category-aware — what resonates for an African Grocery Store differs from a plumbing contractor.
* Frame problems as business consequences ("customers asking Siri for your category are sent to a competitor"), never as technical labels ("NAP inconsistency").
* Every entry carries two spoken lines: \`regular\` — the plain professional way to raise the problem — and \`hook\` — the alternative that earns attention with the same fact (a curiosity gap, a "try being your own customer" moment, a specific number). The hook must stay 100% true to the evidence: no clickbait, no invented stakes, no fear-mongering.
* Solutions must be deliverable by the operator — never promise platform-side behavior the operator cannot control. Stay high-level: you do not know the platform's package catalog, so articulate the solution summary or high-level steps (e.g. "claim the listing and correct the phone across Google and Yelp") rather than naming a specific product — the operator maps your summary to the actual offer.
* Frame every pair in the develop-value-first motion: the platform seeds the prospect's directory presence first and invites the owner to claim it — the pairs ease pains the owner can already see. Problems land as "we surfaced this on your listing," solutions as "claim your profile and we fix it" — never as "buy an audit." Do not assert a published listing exists unless the audit data shows one; the claim-and-fix framing works whether or not the seed is already live (the seed is created as part of the outreach motion).
* \`outreach_use\` must be concrete enough to act on without rework.
* Tone — warm, professional, helpful: write copy the operator can read aloud to the owner with a straight face and a smile. Never dry, never dull.
`;

// ─── Prompt 2 (Signal-Aligned) missing CI instruction sections ───────────

const STORE_FORMAT_SECTION_MD = `
### Store format classification (required)

Classify the matched business's primary operational format and record it in \`matched_business.store_format\`. Use one of:

* grocery
* grocery_plus_prepared_foods
* bakery
* butcher
* restaurant
* caterer
* wholesaler
* beauty_retailer
* online_seller
* service
* unknown

If the business is a hybrid (e.g., grocery + restaurant), set \`store_format\` to the primary format and describe the secondary operation in \`matched_business.hybrid_role\`. Compare like-for-like when benchmarking.
`;

const SPECIALIZED_SOURCES_MD = `Additionally, consult the Specialized Sources listed in the Category Intelligence block. These may include delivery marketplaces, social platforms (Instagram, TikTok, WhatsApp), vertical directories, importer/wholesaler locators, community organizations, cultural event vendor lists, and business registration records. Record every source consulted in \`specialized_sources_audited\`.

Per the Category Intelligence evidence rules, do not treat absence from a platform as evidence that the business is inactive, nonexistent, or unqualified.
`;

const CATEGORY_FIT_MD = `* Category fit assessment (required): Evaluate whether the GBP primary_category and additional_categories reflect the requested business category or a generic/incorrect label. Record your assessment in \`platforms.google.category_fit_assessment\`. Per the Category Intelligence evidence rules, a generic category label alone does not establish or deny category fit — corroborate with multiple indicators.
`;

const CATEGORY_CONTENT_CHECK_MD = `* Category-specific content check: Evaluate whether the website surfaces category-relevant products, services, terminology, or ordering/pickup options as defined in the Category Intelligence block. Record findings in \`website.category_specific_content_present\` and \`website.ordering_or_pickup_info_present\`. Absence of category-specific content is recorded as "not_verified," not as a negative claim.
`;

// ─── Directive: Sourced Attribute Capture (inserted after the Category Fit
//     bullet in the Google Business Profile Assessment). Requires the analyst
//     to record the attribute chips each platform profile actually displays —
//     feeds the directory listing attribute picker (migrations 267/268).
const ATTRIBUTES_CAPTURE_DIRECTIVE = `
### Sourced Attribute Capture — REQUIRED

For each platform block (platforms.google, platforms.yelp, platforms.facebook, platforms.bbb), record the attribute chips the business's public profile on that platform actually displays, in \`platforms.{platform}.attributes\` — an array of:

{ "key": "<snake_case_key>", "label": "<display label>", "source_url": "<profile URL where observed or null>", "as_of": "<ISO date observed or null>" }

Scope: payments accepted (Apple Pay, Google Pay, credit cards, cash, contactless), accessibility (wheelchair accessible, accessible parking/entrance/restroom), ownership (family-owned, immigrant-owned, woman-owned), service options (curbside pickup, delivery, takeout, in-store shopping, online ordering), and certifications (halal, kosher) — exactly as the platform profile displays them.

Rules:
* Evidence per attribute — record each attribute only when the profile itself displays it (attribute chips, amenity sections, payment badges). Never infer attributes from the business's category, name, or neighborhood.
* Omit the attributes field entirely when the platform profile displays no attribute chips — do not fabricate an empty inventory.
* SNAP/EBT is NEVER recorded here — it has dedicated fields (snap_ebt_reported) and a stricter regulatory contract.
* Attributes are a VISIBILITY inventory only — they never represent payment processing capability.
`;

// ─── Directive: Recommended Attribute Suggestions (inserted immediately
//     after the Sourced Attribute Capture section — its anchor is that
//     section's closing rule, which step 4g/5b/0b guarantees is present).
//     Advisory recommendations for attribute chips the owner could enable,
//     derived from the Gold Standard block's per-platform expected
//     attributes + the Category Intelligence attribute lists + verified
//     audit evidence. Distinct from sourced attributes: recommendations
//     fill gaps, they never restate observed chips.
const RECOMMENDED_ATTRIBUTES_DIRECTIVE = `
### Recommended Attribute Suggestions — ADVISORY

Beyond the sourced inventory above, recommend attribute chips the owner could enable on each platform in \`recommended_attributes\` — a top-level array of:

{ "key": "<snake_case_key>", "label": "<display label>", "platform": "<platform or null>", "basis": "gold_standard_expected|category_intelligence|audit_evidence", "rationale": "<string|null>", "current_state": "not_observed|unverifiable|verify_with_owner" }

Rules:
* Basis — recommendations may draw on the Gold Standard block's per-platform expected attributes, the Category Intelligence block's required/recommended attribute lists, and verified audit evidence (e.g. a delivery page observed on the business website). Unlike sourced attributes, inference from category and benchmark context is the purpose of this field.
* current_state — "not_observed" when the profile rendered and the chip was absent; "unverifiable" when the profile could not be fully rendered (JavaScript-gated, login-walled); "verify_with_owner" when the attribute depends on a fact only the owner can confirm (identity designations, certification status, payment-program enrollment).
* Never recommend an attribute already recorded in \`platforms.{platform}.attributes\` — recommendations fill gaps; they do not restate observed chips.
* Owner-designated identity attributes (e.g. Black-owned, women-led, veteran-owned) are framed as slots the owner MAY enable if applicable — never assert the identity as fact.
* Evidence-gated attributes (e.g. SNAP/EBT, delivery) recommend verification — "verify authorization and enable the chip" — never assume the underlying fact.
* Omit the field entirely when no recommendation is warranted — do not fabricate suggestions.
* Recommended attributes are advisory only — they are not evidence the attribute is enabled, and they never appear in \`platforms.{platform}.attributes\`.
`;

const NAP_ABSENCE_MD = `Do not add points solely because information is unavailable (per the Category Intelligence evidence rule \`absence_is_not_a_negative\`).
`;

const INT_SIGNALS_MD = `
### Category Intelligence Signals
Use any \`INT_*\` signal codes defined in the Category Intelligence block's "Category Signals" section. Apply them only when verified public evidence supports the signal. Common examples include (but are not limited to — defer to the block's exact definitions):

* \`INT_MULTISOURCE_IDENTITY\`: Identity corroborated across multiple independent sources.
* \`INT_ACTIVE_OPERATIONAL_EVIDENCE\`: Recent owner updates, current hours, recent customer activity, current ordering, or recent posts/reviews support active operation.
* \`INT_CATEGORY_SPECIALIZATION\`: Multiple category-specific indicators confirm the requested category specialization.
* \`INT_UNDEREXPOSED_CREDENTIAL\`: A relevant credential is present but underexposed digitally.
* \`INT_POSSIBLE_CATEGORY_MISALIGNMENT\`: Directory categories or descriptions conflict with the requested specialization.
* \`INT_VERTICAL_SOURCE_DISCOVERY\`: Business was discoverable primarily through a vertical/specialized source rather than mainstream directories.
* \`INT_RECENT_BUSINESS_EVIDENCE\`: Evidence of recent business activity within the last 90 days.
* \`INT_LOW_VISIBILITY\`: Low mainstream directory visibility despite verifiable operation.
* \`INT_WEAK_MAINSTREAM_INDEXING\`: Mainstream directory listings are sparse, stale, or poorly categorized.
* \`INT_SINGLE_SOURCE\`: Business is verifiable from only one independent source.
* \`INT_HIDDEN_TRUST\`: Strong community or vertical trust signals with weak mainstream trust signals.

If the Category Intelligence block defines additional or different \`INT_*\` codes, use the block's definitions.
`;

const OPERATIONAL_STATUS_SECTION_MD = `
---

## Operational Status

Determine whether the business is currently operational based on recent evidence (per the Category Intelligence rule \`active_operation_requires_recent_evidence\`). Recent evidence includes: recent owner updates, current hours, recent customer activity, current ordering availability, recent product posts, or recent reviews.

Do not infer active operation solely from an old listing. Record your finding in \`operational_status\`:

* status: one of active / likely_active / inactive / unable_to_verify
* last_activity_evidence: concise description of the most recent operational evidence found
* last_activity_date: ISO 8601 date of the most recent activity, or null
* evidence_sources: array of source platforms where the activity was observed
`;

const COMPETITIVE_BENCHMARK_SECTION_MD = `---

## Competitive Benchmark (Category-Relative Positioning)

Identify up to 3 competitive benchmarks in the same market that are demonstrably in the same business category (per the Category Intelligence rule \`leader_requires_category_fit\`). High mainstream visibility alone is insufficient — each benchmark must have verified evidence of category fit.

For each benchmark, record:

* business_name
* store_format (same enum as the audited business)
* geographic_reach
* product_breadth: narrow / moderate / broad
* prepared_food_component: true/false
* delivery_model: none / marketplace / direct / both / unknown
* regional_specialization: null or a concise description
* google_rating, google_review_count, yelp_rating, yelp_review_count (when available)
* profile_completeness_score: 0–10 (your rubric: claimed status, hours, photos, description, website link, ordering link, posts, categories, attributes, NAP consistency)
* format_context_note: one sentence explaining comparability to the audited business
* specialization_evidence_direct: true if category fit is directly evidenced; false if inferred

Do not include a business as a benchmark solely because of high mainstream visibility. Disclose any benchmark whose category specialization is inferred rather than directly evidenced.

If no qualified benchmarks are found, return an empty array.
`;

const CATEGORY_THEMES_MD = `Additionally, consider category-specific themes suggested by the Category Intelligence block (e.g., product authenticity/freshness, regional assortment gaps, prepared-foods quality, imports cost, category-specific service gaps).
`;

const CATEGORY_SERVICES_MD = `Additionally, consider category-specific services suggested by the Category Intelligence block (e.g., category-specific GBP optimization, delivery marketplace listing cleanup, community/social channel activation, vertical directory enrollment).
`;

// ─── Prompt 2 schema fragments ───────────────────────────────────────────

const P2_MATCHED_BUSINESS_SCHEMA = `    "matched_business": {
      "business_name": null,
      "category": null,
      "store_format": "unknown",
      "hybrid_role": null,
      "address": null,
      "phone": null,
      "website": null
    },
    "identity_status": "confirmed",
    "identity_confidence": "high",
    "identity_corroboration_sources": [],
    "limitations": []`;

const P2_GOOGLE_CATEGORY_FIT = `      "additional_categories": [],
      "category_fit_assessment": null,
      "displayed_name": null,`;

const P2_SPECIALIZED_SOURCES_SCHEMA = `  "specialized_sources_audited": [
    {
      "source": "",
      "tier": 1,
      "source_type": "",
      "consulted": false,
      "findings": "",
      "url": null,
      "accessed_date": ""
    }
  ],
  "combined_review_metrics": {`;

const P2_WEBSITE_CATEGORY_FIELDS = `    "location_information_present": "unable_to_verify",
    "category_specific_content_present": "unable_to_verify",
    "ordering_or_pickup_info_present": "unable_to_verify",
    "issues": [],`;

const P2_OPERATIONAL_STATUS_SCHEMA = `  "operational_status": {
    "status": "unable_to_verify",
    "last_activity_evidence": null,
    "last_activity_date": null,
    "evidence_sources": []
  },
  "competitive_benchmarks": [
    {
      "business_name": "",
      "store_format": "",
      "geographic_reach": "",
      "product_breadth": "",
      "prepared_food_component": false,
      "delivery_model": "",
      "regional_specialization": null,
      "google_rating": null,
      "google_review_count": null,
      "yelp_rating": null,
      "yelp_review_count": null,
      "profile_completeness_score": 0,
      "format_context_note": "",
      "specialization_evidence_direct": true
    }
  ],
  "unanswered_negative_review_examples": [`;

// ─── Insertion helpers ───────────────────────────────────────────────────

/**
 * Extract a fingerprint from insertion text — the first 80 chars of the
 * trimmed content. Used for idempotency: if the fingerprint is already in
 * the body, the insertion is skipped (the section was already wired).
 */
function fingerprint(text: string): string {
  return text.trim().slice(0, 80);
}

/** Insert `insertion` immediately after the first occurrence of `anchor`. */
function insertAfter(body: string, anchor: string, insertion: string): string {
  // Idempotent: skip if the insertion content is already present.
  if (body.includes(fingerprint(insertion))) {
    return body;
  }
  const idx = body.indexOf(anchor);
  if (idx === -1) {
    throw new Error(`Anchor not found in body:\n  ${anchor.slice(0, 120)}...`);
  }
  return body.slice(0, idx + anchor.length) + insertion + body.slice(idx + anchor.length);
}

/** Insert `insertion` immediately before the first occurrence of `anchor`. */
function insertBefore(body: string, anchor: string, insertion: string): string {
  // Idempotent: skip if the insertion content is already present.
  if (body.includes(fingerprint(insertion))) {
    return body;
  }
  const idx = body.indexOf(anchor);
  if (idx === -1) {
    throw new Error(`Anchor not found in body:\n  ${anchor.slice(0, 120)}...`);
  }
  return body.slice(0, idx) + insertion + body.slice(idx);
}

/**
 * Replace the first occurrence of `from` with `to`. Idempotent: if `from`
 * is not found (already replaced or not present in this template variant),
 * returns the body unchanged instead of throwing.
 */
function replaceFirst(body: string, from: string, to: string): string {
  const idx = body.indexOf(from);
  if (idx === -1) {
    return body;
  }
  return body.slice(0, idx) + to + body.slice(idx + from.length);
}

/**
 * Remove a section starting with `headingMarker` up to (but not including)
 * the next markdown heading (`## ` or `### `). Used to strip a
 * previously-inserted directive before re-inserting an updated version
 * when the seed version marker is bumped.
 */
function removeSection(body: string, headingMarker: string): string {
  const startIdx = body.indexOf(headingMarker);
  if (startIdx === -1) return body;
  const afterMarker = body.slice(startIdx + headingMarker.length);
  const nextHeadingMatch = afterMarker.search(/\n#{2,3} /);
  if (nextHeadingMatch === -1) {
    // No next heading — trim to end.
    return body.slice(0, startIdx).replace(/\s+$/, '');
  }
  const endIdx = startIdx + headingMarker.length + nextHeadingMatch;
  return body.slice(0, startIdx) + body.slice(endIdx);
}

// ─── Prompt 1 (Category-Integrated) transformation ───────────────────────

function transformCategoryIntegrated(body: string): string {
  // 0. Insert business identity block at the top, right after the intro
  //    cautions and BEFORE the Category Intelligence binding. This ensures
  //    the model sees the business identity first.
  let out = insertAfter(body, 'Never invent or assume data.', BUSINESS_IDENTITY_BLOCK);

  // 0b. Add Origin row to existing identity blocks (idempotent — no-op if
  //     the block already has the Origin row, e.g. fresh inserts).
  out = replaceFirst(out, BUSINESS_IDENTITY_ORIGIN_FROM, BUSINESS_IDENTITY_ORIGIN_TO);
  out = replaceFirst(out, BUSINESS_IDENTITY_CAVEAT_FROM, BUSINESS_IDENTITY_CAVEAT_TO);

  // 1. Insert Gold Standard binding section after the Category Intelligence
  //    binding section (which ends with the "If the Category Intelligence
  //    block is missing or empty..." line).
  out = insertAfter(
    out,
    'If the Category Intelligence block is missing or empty, proceed with the general audit instructions and note the absence in data_quality.limitations.',
    '\n' + GOLD_STANDARD_BINDING,
  );

  // 1a. Amend the Absence vs. Non-Negotiable paragraph in the Gold Standard
  //     binding to add the business_specific_failure exception. Runs after
  //     step 1 so it updates both fresh insertions (no-op — new text already
  //     present) and pre-existing bindings (replaces old text). Idempotent.
  out = replaceFirst(out, ABSENCE_VS_NONNEGOTIABLE_FROM, ABSENCE_VS_NONNEGOTIABLE_TO);

  // 2. Add profile_url to each platform object in the embedded JSON schema.
  //    All four platform objects end with `"data_status": "unavailable"`.
  //    Idempotent: skip if profile_url is already present.
  if (!out.includes('"profile_url"')) {
    out = out.split('"data_status": "unavailable"').join(PROFILE_URL_SCHEMA_LINE);
  }

  // 3. Add gap_analysis + quality_gate_results after the sources array
  //    (replacing the sources close + top-level close with sources close +
  //    comma + new fields + top-level close).
  out = replaceFirst(out, '  ]\n}', '  ],\n' + GAP_AND_GATES_SCHEMA + '\n}');

  // 3a. Add market_opportunities after quality_gate_results (before the
  //     top-level close). Separate replaceFirst — idempotent (no-op if the
  //     field is already present, so a re-run after marker bump self-heals
  //     without duplicating). The anchor is the quality_gate_results
  //     summary close + top-level close (gap_analysis's summary close has
  //     a comma, so this pattern is unique to quality_gate_results).
  out = replaceFirst(
    out,
    '    "summary": ""\n  }\n}',
    '    "summary": ""\n  },\n' + MARKET_OPPORTUNITIES_SCHEMA + '\n}',
  );

  // 3b. Add signal_checklist after market_opportunities (before the
  //     top-level close). Separate replaceFirst — idempotent (no-op if the
  //     field is already present).
  out = replaceFirst(
    out,
    MARKET_OPPORTUNITIES_SCHEMA + '\n}',
    MARKET_OPPORTUNITIES_SCHEMA + ',\n' + SIGNAL_CHECKLIST_SCHEMA + '\n}',
  );

  // 3c. Add render_controls after signal_checklist (before the top-level
  //     close). Separate replaceFirst — idempotent (no-op if the field is
  //     already present, so a re-run after marker bump self-heals without
  //     duplicating).
  out = replaceFirst(
    out,
    SIGNAL_CHECKLIST_SCHEMA + '\n}',
    SIGNAL_CHECKLIST_SCHEMA + ',\n' + RENDER_CONTROLS_SCHEMA + '\n}',
  );

  // 4. Targeted content update: delivery_model enum now includes 'unknown'.
  out = out.replace(
    'delivery_model: none / marketplace / direct / both\n',
    'delivery_model: none / marketplace / direct / both / unknown\n',
  );

  // 4b. Add public_narrative to the JSON schema (after "summary": "").
  //     Idempotent: skip if public_narrative is already present.
  if (!out.includes('"public_narrative"')) {
    out = out.replace('"summary": ""', PUBLIC_NARRATIVE_SCHEMA_LINE);
  }

  // 4c. Add the public_narrative directive section after the Summary
  //     instruction section. Try "## Summary" heading first, then fall back
  //     to the Gold Standard binding section end (which was inserted in step 1
  //     and exists in all templates that have the Gold Standard block).
  //     Remove any prior version of the directive first (seed version bump).
  out = removeSection(out, '### Public Narrative (required)');
  try {
    out = insertAfter(out, '## Summary', PUBLIC_NARRATIVE_DIRECTIVE);
  } catch {
    // Fallback: insert after the Gold Standard binding section's last line.
    out = insertAfter(
      out,
      'If the Gold Standard block is missing or empty, omit gap_analysis and quality_gate_results and note the absence in data_quality.limitations.',
      '\n' + PUBLIC_NARRATIVE_DIRECTIVE,
    );
  }

  // 4c2. Remove any prior version of the Market Intel Output directive
  //      (seed version bump). Has a heading so removeSection can manage it.
  //      Runs BEFORE the headingless MARKET_CONTEXT_BINDING insertion (4i)
  //      per AGENTS.md — headingless bindings go after all removeSection
  //      calls so each run self-heals.
  out = removeSection(out, '### Market Intelligence Output Fields');

  // 4c3. Remove any prior version of the Operator Outreach Problems
  //      directive (seed version bump). Has a heading; the re-insertion at
  //      4j2 runs after ALL removeSection calls so each run self-heals.
  out = removeSection(out, '### Operator Outreach Problems');

  // 4d. Website Accessibility Verification directive — insert at the end of
  //     the Website Assessment section (after the intrusive-testing line).
  //     Idempotent via fingerprint. Fallback anchors cover variant bodies
  //     where the intrusive-testing line may be absent or reworded.
  try {
    out = insertAfter(
      out,
      'Do not perform intrusive testing, vulnerability scanning, or security exploitation.',
      WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE,
    );
  } catch {
    try {
      out = insertAfter(out, '* Conversion opportunities', WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE);
    } catch {
      out = insertAfter(out, '## Website Assessment', WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE);
    }
  }

  // 4e. Broaden WC_BROKEN_WEBSITE signal definition to include access-blocking
  //     redirects. Idempotent (no-op if already updated).
  out = replaceFirst(out, WC_BROKEN_WEBSITE_DEFINITION_FROM, WC_BROKEN_WEBSITE_DEFINITION_TO);

  // 4e2. Platform Availability Verification directive — insert after the
  //      Website Accessibility Verification directive (Category-Integrated
  //      has no ## Platforms heading). Idempotent via fingerprint. Fallback
  //      anchors cover bodies where the website directive's last line may
  //      be absent (e.g. the website directive wasn't inserted).
  try {
    out = insertAfter(
      out,
      'record the redirect chain and access barrier in `website.issues` and `gap_analysis.gaps` (when a Gold Standard block is present).',
      PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE,
    );
  } catch {
    try {
      out = insertAfter(
        out,
        'Do not perform intrusive testing, vulnerability scanning, or security exploitation.',
        PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE,
      );
    } catch {
      out = insertAfter(out, 'Never invent or assume data.', PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE);
    }
  }

  // 4e3. Amend DS_MISSING_PROFILE definition to require a render control.
  //      Idempotent (no-op if already updated).
  out = replaceFirst(out, DS_MISSING_PROFILE_FROM_CATEGORY, DS_MISSING_PROFILE_TO_CATEGORY);

  // 4e4. Fix the buggy "bbb has no platform object" note from earlier seed
  //      versions and replace it with the data_status mapping + corrected
  //      non-primary platform guidance. Idempotent (no-op if already updated).
  out = replaceFirst(out, PLATFORM_DIRECTIVE_BUG_FROM, PLATFORM_DIRECTIVE_BUG_TO);

  // 4f. Replace requested_business empty-string defaults with variable
  //     placeholders so the rendered prompt pre-fills the requested business
  //     identity in the JSON schema template. Idempotent (no-op if already
  //     replaced — the FROM string won't be found).
  out = replaceFirst(out, REQUESTED_BUSINESS_PLACEHOLDERS_FROM, REQUESTED_BUSINESS_PLACEHOLDERS_TO);

  // 4g. Sourced Attribute Capture directive — after the Category Fit bullet
  //     in the Google Business Profile Assessment. Fallback anchors cover
  //     variant bodies; the last fallback anchors on the business-identity
  //     intro, which step 0 guarantees exists in this body.
  try {
    out = insertAfter(out, 'corroborate with multiple indicators.', ATTRIBUTES_CAPTURE_DIRECTIVE);
  } catch {
    try {
      out = insertAfter(out, '* Duplicate or conflicting listing signals', ATTRIBUTES_CAPTURE_DIRECTIVE);
    } catch {
      out = insertAfter(out, 'Never invent or assume data.', ATTRIBUTES_CAPTURE_DIRECTIVE);
    }
  }

  // 4h. Recommended Attribute Suggestions — immediately after the Sourced
  //     Attribute Capture section (anchor is that section's closing rule).
  out = insertAfter(out, 'they never represent payment processing capability.', RECOMMENDED_ATTRIBUTES_DIRECTIVE);

  // 4i. Market Context binding — after the Gold Standard binding section's
  //     last line. This MUST run after step 4c's removeSection('### Public
  //     Narrative (required)'): the PN directive's fallback anchor is the
  //     Gold Standard binding's last line, which can interleave the PN
  //     heading before this headingless binding — and removeSection would
  //     then swallow the binding on the next run. Inserting it last
  //     guarantees the final body contains it.
  out = insertAfter(
    out,
    'If the Gold Standard block is missing or empty, omit gap_analysis and quality_gate_results and note the absence in data_quality.limitations.',
    '\n' + MARKET_CONTEXT_BINDING,
  );

  // 4j. Market Intel Output directive — after the headingless
  //     MARKET_CONTEXT_BINDING (inserted in 4i). Has a heading so the
  //     removeSection in 4c2 can manage re-runs. Inserted AFTER the binding
  //     per AGENTS.md (headingless bindings before headed directives).
  out = insertAfter(
    out,
    'The audit is still valid without market context — it runs in degraded mode without market-aware intelligence.',
    MARKET_INTEL_OUTPUT_DIRECTIVE,
  );

  // 4j2. Operator Outreach Problems directive — anchored on the Market Intel
  //      Output directive's final line (guaranteed present by step 4j). Runs
  //      after ALL removeSection calls (4c, 4c2, 4c3) so each run self-heals.
  out = insertAfter(
    out,
    'Omit the field entirely when no category context was provided.',
    OUTREACH_PROBLEMS_DIRECTIVE,
  );

  // 4k. Align the binding text with the blocks the runtime actually injects —
  //     position claims, the phantom city_profile field, undocumented category
  //     fields, and the category_signals name collision. Idempotent.
  out = alignBindingText(out, true);

  // 5. Append seed version marker for idempotency tracking.
  if (!out.includes(SEED_VERSION_MARKER)) {
    out = out + '\n' + SEED_VERSION_MARKER;
  }

  return out;
}

// ─── Prompt 2 (Signal-Aligned) transformation ───────────────────────────

function transformSignalAligned(body: string): string {
  let out = body;

  // 0. Insert business identity block at the top, right after the intro
  //    cautions and BEFORE any binding sections. This ensures the model
  //    sees the business identity first.
  out = insertAfter(out, 'Never invent or assume data.', BUSINESS_IDENTITY_BLOCK);

  // 0b. Add Origin row to existing identity blocks (idempotent — no-op if
  //     the block already has the Origin row, e.g. fresh inserts).
  out = replaceFirst(out, BUSINESS_IDENTITY_ORIGIN_FROM, BUSINESS_IDENTITY_ORIGIN_TO);
  out = replaceFirst(out, BUSINESS_IDENTITY_CAVEAT_FROM, BUSINESS_IDENTITY_CAVEAT_TO);

  // 0c. Remove any prior version of the Market Intel Output directive
  //     (seed version bump). Runs BEFORE the headingless MARKET_CONTEXT_BINDING
  //     insertion (step 1) and the directive insertion (step 1b) per
  //     AGENTS.md — headingless bindings + headed directives go AFTER all
  //     removeSection calls so each run self-heals.
  out = removeSection(out, '### Market Intelligence Output Fields');

  // 0c2. Remove any prior version of the Operator Outreach Problems
  //     directive (seed version bump). The re-insertion at step 19h runs
  //     after ALL removeSection calls (0c, 0c2, 19c) so each run self-heals.
  out = removeSection(out, '### Operator Outreach Problems');

  // 1. Insert the binding sections after the business identity block's
  //    last line (the "do not treat blank as a negative signal" note).
  //    This keeps the bindings AFTER the business identity, not before it.
  //    The Market Context binding is a SEPARATE insertAfter — combining it
  //    with the CI+GS bindings would let insertAfter's fingerprint check
  //    (first 80 chars = the CI binding) skip the whole insertion on bodies
  //    already wired with CI+GS, silently dropping the market binding.
  out = insertAfter(
    out,
    'Audit the business above. If address or phone is blank, the field was not provided — do not treat blank as a negative signal.',
    '\n\n' + CATEGORY_INTELLIGENCE_BINDING + '\n' + GOLD_STANDARD_BINDING,
  );

  // 1a. Amend the Absence vs. Non-Negotiable paragraph in the Gold Standard
  //     binding to add the business_specific_failure exception. Runs after
  //     the CI+GS binding insertion so it updates both fresh insertions
  //     (no-op — new text already present) and pre-existing bindings
  //     (replaces old text). Idempotent.
  out = replaceFirst(out, ABSENCE_VS_NONNEGOTIABLE_FROM, ABSENCE_VS_NONNEGOTIABLE_TO);

  out = insertAfter(
    out,
    'If the Gold Standard block is missing or empty, omit gap_analysis and quality_gate_results and note the absence in data_quality.limitations.',
    '\n' + MARKET_CONTEXT_BINDING,
  );

  // 1b. Market Intel Output directive — after the headingless
  //     MARKET_CONTEXT_BINDING (inserted in step 1). Has a heading so the
  //     removeSection in 19c2 can manage re-runs. Inserted AFTER the binding
  //     per AGENTS.md (headingless bindings before headed directives).
  out = insertAfter(
    out,
    'The audit is still valid without market context — it runs in degraded mode without market-aware intelligence.',
    MARKET_INTEL_OUTPUT_DIRECTIVE,
  );

  // 2. Store format classification — after the identity-verification conflict
  //    paragraph.
  out = insertAfter(
    out,
    'When multiple matching businesses exist and the correct business cannot be determined, set identity status to ambiguous and explain the conflict in the data quality section.',
    STORE_FORMAT_SECTION_MD,
  );

  // 3. Specialized sources — after the platform list's review-response note.
  out = insertAfter(
    out,
    'Do not estimate review-response counts unless an authorized source explicitly provides an estimate.',
    '\n' + SPECIALIZED_SOURCES_MD,
  );

  // 4. Category fit assessment — after "Duplicate or conflicting listing
  //    signals" in the Google Business Profile Assessment.
  out = insertAfter(
    out,
    '* Duplicate or conflicting listing signals',
    '\n' + CATEGORY_FIT_MD,
  );

  // 5. Category-specific content check — after "Conversion opportunities" in
  //    the Website Assessment.
  out = insertAfter(
    out,
    '* Conversion opportunities',
    '\n' + CATEGORY_CONTENT_CHECK_MD,
  );

  // 5b. Sourced Attribute Capture directive — after the Category Fit bullet
  //     (Google Business Profile Assessment). Fallback anchors cover variant
  //     bodies; the last fallback anchors on the review-response note, which
  //     step 3 guarantees exists in this body.
  try {
    out = insertAfter(out, 'corroborate with multiple indicators.', ATTRIBUTES_CAPTURE_DIRECTIVE);
  } catch {
    try {
      out = insertAfter(out, '* Duplicate or conflicting listing signals', ATTRIBUTES_CAPTURE_DIRECTIVE);
    } catch {
      out = insertAfter(out, 'Do not estimate review-response counts unless an authorized source explicitly provides an estimate.', ATTRIBUTES_CAPTURE_DIRECTIVE);
    }
  }

  // 5c. Recommended Attribute Suggestions — immediately after the Sourced
  //     Attribute Capture section (anchor is that section's closing rule).
  out = insertAfter(out, 'they never represent payment processing capability.', RECOMMENDED_ATTRIBUTES_DIRECTIVE);

  // 6. Absence rule — replace the existing NAP-score line in Digital
  //    Opportunity Score.
  out = replaceFirst(
    out,
    'Do not add points solely because information is unavailable.',
    NAP_ABSENCE_MD,
  );

  // 7. INT_* signals — after the VP_STALE_SOCIAL_ACTIVITY line, before the
  //    "---" that closes the Detected Audit Signals section.
  out = insertAfter(
    out,
    '* `VP_STALE_SOCIAL_ACTIVITY`: Social media profile has no posts in $>60$ days.',
    INT_SIGNALS_MD,
  );

  // 8. Operational Status + Competitive Benchmark sections — after the
  //    Detected Audit Signals section's closing "---", before "## Unanswered
  //    Negative Review Examples".
  out = insertBefore(
    out,
    '## Unanswered Negative Review Examples',
    OPERATIONAL_STATUS_SECTION_MD + COMPETITIVE_BENCHMARK_SECTION_MD + '\n---\n\n',
  );

  // 9. Category-specific themes — after "Unresolved complaints" in Negative
  //    Review Themes.
  out = insertAfter(out, '* Unresolved complaints', '\n' + CATEGORY_THEMES_MD);

  // 10. Category-specific services — after "Reputation reporting" in
  //     Recommended Services.
  out = insertAfter(out, '* Reputation reporting', '\n' + CATEGORY_SERVICES_MD);

  // 11. Store format in Summary — after the alignment-classification line.
  //     Wrapped in try/catch: the Signal-Aligned template's Summary section
  //     has a different structure (heading-only, no bullet list) and may not
  //     contain this anchor. Skip gracefully if not found.
  try {
    out = insertAfter(
      out,
      '* Alignment classification (e.g., ADMIN_NEGLECT, BALANCED_HEALTHY, etc.)',
      '\n* Store format / hybrid role',
    );
  } catch {
    // Summary section doesn't have the expected bullet list — skip.
  }

  // ── Schema insertions ──────────────────────────────────────────────────

  // 12. matched_business: add store_format, hybrid_role, and
  //     identity_corroboration_sources.
  out = replaceFirst(
    out,
    `    "matched_business": {
      "business_name": null,
      "category": null,
      "address": null,
      "phone": null,
      "website": null
    },
    "identity_status": "confirmed",
    "identity_confidence": "high",
    "limitations": []`,
    P2_MATCHED_BUSINESS_SCHEMA,
  );

  // 13. google: add category_fit_assessment after additional_categories.
  out = replaceFirst(
    out,
    `      "additional_categories": [],
      "displayed_name": null,`,
    P2_GOOGLE_CATEGORY_FIT,
  );

  // 14. Add profile_url to each platform object in the schema.
  //     Idempotent: skip if profile_url is already present.
  if (!out.includes('"profile_url"')) {
    out = out.split('"data_status": "unavailable"').join(PROFILE_URL_SCHEMA_LINE);
  }

  // 15. specialized_sources_audited — insert before combined_review_metrics.
  out = replaceFirst(
    out,
    '  "combined_review_metrics": {',
    P2_SPECIALIZED_SOURCES_SCHEMA,
  );

  // 16. website: add category-specific content fields.
  out = replaceFirst(
    out,
    `    "location_information_present": "unable_to_verify",
    "issues": [],`,
    P2_WEBSITE_CATEGORY_FIELDS,
  );

  // 17. operational_status + competitive_benchmarks — insert before
  //     unanswered_negative_review_examples.
  out = replaceFirst(
    out,
    '  "unanswered_negative_review_examples": [',
    P2_OPERATIONAL_STATUS_SCHEMA,
  );

  // 18. gap_analysis + quality_gate_results — after the sources array.
  out = replaceFirst(out, '  ]\n}', '  ],\n' + GAP_AND_GATES_SCHEMA + '\n}');

  // 18a. market_opportunities after quality_gate_results (before top-level
  //      close). Separate replaceFirst — idempotent.
  out = replaceFirst(
    out,
    '    "summary": ""\n  }\n}',
    '    "summary": ""\n  },\n' + MARKET_OPPORTUNITIES_SCHEMA + '\n}',
  );

  // 18b. signal_checklist after market_opportunities (before top-level
  //      close). Separate replaceFirst — idempotent.
  out = replaceFirst(
    out,
    MARKET_OPPORTUNITIES_SCHEMA + '\n}',
    MARKET_OPPORTUNITIES_SCHEMA + ',\n' + SIGNAL_CHECKLIST_SCHEMA + '\n}',
  );

  // 18c. render_controls after signal_checklist (before top-level close).
  //      Separate replaceFirst — idempotent (no-op if already present).
  out = replaceFirst(
    out,
    SIGNAL_CHECKLIST_SCHEMA + '\n}',
    SIGNAL_CHECKLIST_SCHEMA + ',\n' + RENDER_CONTROLS_SCHEMA + '\n}',
  );

  // 19. Targeted content update: delivery_model enum now includes 'unknown'.
  out = out.replace(
    'delivery_model: none / marketplace / direct / both\n',
    'delivery_model: none / marketplace / direct / both / unknown\n',
  );

  // 19b. Add public_narrative to the JSON schema (after "summary": "").
  //      Idempotent: skip if public_narrative is already present.
  if (!out.includes('"public_narrative"')) {
    out = out.replace('"summary": ""', PUBLIC_NARRATIVE_SCHEMA_LINE);
  }

  // 19c. Add the public_narrative directive section after the Summary
  //      instruction section. Remove any prior version first (seed bump).
  out = removeSection(out, '### Public Narrative (required)');
  out = insertAfter(out, '## Summary', PUBLIC_NARRATIVE_DIRECTIVE);

  // (Market Intel Output directive removeSection moved to step 0c —
  //  must run BEFORE the directive insertion in 1b, not after.)

  // 19d. Website Accessibility Verification directive — insert at the end of
  //      the Website Assessment section (after the intrusive-testing line).
  //      Idempotent via fingerprint. Fallback anchors cover variant bodies
  //      where the intrusive-testing line may be absent or reworded.
  try {
    out = insertAfter(
      out,
      'Do not perform intrusive testing, vulnerability scanning, or security exploitation.',
      WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE,
    );
  } catch {
    try {
      out = insertAfter(out, '* Conversion opportunities', WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE);
    } catch {
      out = insertAfter(out, '## Website Assessment', WEBSITE_ACCESSIBILITY_VERIFICATION_DIRECTIVE);
    }
  }

  // 19e. Broaden WC_BROKEN_WEBSITE signal definition to include access-blocking
  //      redirects. Idempotent (no-op if already updated).
  out = replaceFirst(out, WC_BROKEN_WEBSITE_DEFINITION_FROM, WC_BROKEN_WEBSITE_DEFINITION_TO);

  // 19e2. Platform Availability Verification directive — insert at the end
  //       of the Platforms section. Idempotent via fingerprint. Fallback
  //       anchors cover bodies where the Platforms section's last line may
  //       be absent or reworded.
  try {
    out = insertAfter(
      out,
      'Per the Category Intelligence evidence rules, do not treat absence from a platform as evidence that the business is inactive, nonexistent, or unqualified.',
      PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE,
    );
  } catch {
    try {
      out = insertAfter(out, '## Platforms', PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE);
    } catch {
      try {
        out = insertAfter(
          out,
          'record the redirect chain and access barrier in `website.issues` and `gap_analysis.gaps` (when a Gold Standard block is present).',
          PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE,
        );
      } catch {
        out = insertAfter(out, 'Do not perform intrusive testing, vulnerability scanning, or security exploitation.', PLATFORM_AVAILABILITY_VERIFICATION_DIRECTIVE);
      }
    }
  }

  // 19e3. Amend DS_MISSING_PROFILE definition to require a render control.
  //       Idempotent (no-op if already updated).
  out = replaceFirst(out, DS_MISSING_PROFILE_FROM_SIGNAL, DS_MISSING_PROFILE_TO_SIGNAL);

  // 19e4. Fix the buggy "bbb has no platform object" note from earlier seed
  //       versions and replace it with the data_status mapping + corrected
  //       non-primary platform guidance. Idempotent (no-op if already updated).
  out = replaceFirst(out, PLATFORM_DIRECTIVE_BUG_FROM, PLATFORM_DIRECTIVE_BUG_TO);

  // 19f. Replace requested_business empty-string defaults with variable
  //      placeholders so the rendered prompt pre-fills the requested business
  //      identity in the JSON schema template. Idempotent (no-op if already
  //      replaced — the FROM string won't be found).
  out = replaceFirst(out, REQUESTED_BUSINESS_PLACEHOLDERS_FROM, REQUESTED_BUSINESS_PLACEHOLDERS_TO);

  // 19g. Align the binding text with the blocks the runtime actually injects.
  //      Idempotent.
  out = alignBindingText(out, true);

  // 19h. Operator Outreach Problems directive — anchored on the Market Intel
  //      Output directive's final line (guaranteed present by step 1b).
  //      Placed here — after ALL removeSection calls in this transform
  //      (0c, 0c2, 19c) — so each run self-heals per AGENTS.md.
  out = insertAfter(
    out,
    'Omit the field entirely when no category context was provided.',
    OUTREACH_PROBLEMS_DIRECTIVE,
  );

  // 20. Append seed version marker for idempotency tracking.
  if (!out.includes(SEED_VERSION_MARKER)) {
    out = out + '\n' + SEED_VERSION_MARKER;
  }

  return out;
}

// ─── Prompt 3 (Business Audit V1) transformation ─────────────────────────
// mpt-je6m7ru6 ("Seek: Business Audit V1") has the same "Business" instruction
// section with 6 variable placeholders and the same requested_business schema
// block with empty-string defaults. It does NOT have the Category Intelligence
// or Gold Standard bindings (those are V2-only), but it DOES get the Market
// Context binding — the market intelligence blocks are appended at runtime
// by buildMarketContextBlock regardless of template version. This transform
// aligns the requested_business schema block with the V2 templates and wires
// the market context binding.

function transformBusinessAuditV1(body: string): string {
  let out = body;

  // 0. Insert business identity block at the top, right after the intro
  //    cautions. V1 has no CI/GS bindings, so this goes right before the
  //    existing "## Business" section deeper in the body.
  out = insertAfter(out, 'Never invent or assume data.', BUSINESS_IDENTITY_BLOCK);

  // 0a. Remove any prior version of the Market Intel Output directive
  //     (seed version bump). Runs BEFORE the headingless MARKET_CONTEXT_BINDING
  //     insertion below per AGENTS.md — headingless bindings go after all
  //     removeSection calls so each run self-heals.
  out = removeSection(out, '### Market Intelligence Output Fields');
  out = removeSection(out, '### Operator Outreach Problems');

  // 0a. Insert Market Context binding after the business identity block.
  //     V1 has no CI/GS bindings, but the market context binding is
  //     independent — it tells the analyst how to use the CATEGORY MARKET
  //     CONTEXT and CITY MARKET CONTEXT blocks that buildMarketContextBlock
  //     appends at runtime.
  out = insertAfter(
    out,
    'Audit the business above. If address, phone, or origin is blank, the field was not provided — do not treat blank as a negative signal.',
    '\n\n' + MARKET_CONTEXT_BINDING,
  );

  // 0a2. Market Intel Output directive — after the headingless
  //      MARKET_CONTEXT_BINDING. Has a heading so the removeSection in 0a
  //      can manage re-runs. V1 does NOT get the schema field insertions
  //      (no GAP_AND_GATES_SCHEMA anchor — V1 has a different embedded JSON
  //      schema structure and is absent in prd; the directive alone tells
  //      the analyst to populate the fields, and the validator accepts
  //      them as optional).
  out = insertAfter(
    out,
    'The audit is still valid without market context — it runs in degraded mode without market-aware intelligence.',
    MARKET_INTEL_OUTPUT_DIRECTIVE,
  );

  // 0a3. Operator Outreach Problems directive — after the Market Intel
  //      Output directive's final line. V1 gets the directive (the validator
  //      accepts outreach_problems as optional); no embedded-schema insertion
  //      here — same rationale as the market intel fields (0a2).
  out = insertAfter(
    out,
    'Omit the field entirely when no category context was provided.',
    OUTREACH_PROBLEMS_DIRECTIVE,
  );

  // 0b. Add Origin row to existing identity blocks (idempotent — no-op if
  //     the block already has the Origin row, e.g. fresh inserts).
  out = replaceFirst(out, BUSINESS_IDENTITY_ORIGIN_FROM, BUSINESS_IDENTITY_ORIGIN_TO);
  out = replaceFirst(out, BUSINESS_IDENTITY_CAVEAT_FROM, BUSINESS_IDENTITY_CAVEAT_TO);

  // 0b. Sourced Attribute Capture directive — after the Category Fit bullet
  //     (same anchor chain as the V2 transforms; the last fallback anchors on
  //     the business-identity intro, which step 0 guarantees exists).
  try {
    out = insertAfter(out, 'corroborate with multiple indicators.', ATTRIBUTES_CAPTURE_DIRECTIVE);
  } catch {
    try {
      out = insertAfter(out, '* Duplicate or conflicting listing signals', ATTRIBUTES_CAPTURE_DIRECTIVE);
    } catch {
      out = insertAfter(out, 'Never invent or assume data.', ATTRIBUTES_CAPTURE_DIRECTIVE);
    }
  }

  // 0c. Recommended Attribute Suggestions — immediately after the Sourced
  //     Attribute Capture section (anchor is that section's closing rule).
  out = insertAfter(out, 'they never represent payment processing capability.', RECOMMENDED_ATTRIBUTES_DIRECTIVE);

  // 1. Replace requested_business empty-string defaults with variable
  //    placeholders. Idempotent (no-op if already replaced).
  out = replaceFirst(out, REQUESTED_BUSINESS_PLACEHOLDERS_FROM, REQUESTED_BUSINESS_PLACEHOLDERS_TO);

  // 1a. Align the Market Context binding text. V1 has no Category Intelligence
  //     or Gold Standard binding, so only the Market Context alignment applies.
  //     Idempotent.
  out = alignBindingText(out, false);

  // 2. Append seed version marker for idempotency tracking.
  if (!out.includes(SEED_VERSION_MARKER)) {
    out = out + '\n' + SEED_VERSION_MARKER;
  }

  return out;
}

// ─── Prompt 4 (Seed Business Audit — mpt-seed-seek-001) transformation ────
// The minimal legacy "Seek: Business Audit" template (~1.9k chars): no
// embedded JSON schema, no Category/Gold/Market-Context bindings — it relies
// entirely on BUSINESS_ANALYSIS_PROMPT_SUFFIX for its output shape. Folded
// into the outreach-problems contract per spec §4.4.1: it gets the directive
// (audit-context variant — the input is its own audit findings) and nothing
// else. Its output_schema.name is already 'business_analysis'.

function transformSeedBusinessAudit(body: string): string {
  let out = body;

  // Self-heal on re-run: drop any prior version of the directive (and the
  // trailing marker, which removeSection swallows as headingless tail
  // content — step 2 re-appends it).
  out = removeSection(out, '### Operator Outreach Problems');

  // Anchor on the body's closing line — the directive lands at the end.
  out = insertAfter(out, 'Format as structured JSON.', OUTREACH_PROBLEMS_DIRECTIVE);

  // Append seed version marker for idempotency tracking.
  if (!out.includes(SEED_VERSION_MARKER)) {
    out = out + '\n' + SEED_VERSION_MARKER;
  }

  return out;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const service = MarketingPromptService.getInstance();
  const prisma = (service as any).prisma;

  const tasks: Array<{
    id: string;
    label: string;
    marker: string;
    transform: (body: string) => string;
    /** Declared variables written on transform. Omit to leave the column
     *  untouched (mpt-seed-seek-001 keeps its own 3-var declaration). */
    variables?: string[];
  }> = [
    {
      id: CATEGORY_INTEGRATED_ID,
      label: 'Business Digital Audit - Cohesive (Category-Integrated)',
      marker: GOLD_STANDARD_MARKER,
      transform: transformCategoryIntegrated,
      variables: FULL_BUSINESS_VARIABLES,
    },
    {
      id: SIGNAL_ALIGNED_ID,
      label: 'Business Digital Audit - Alignment Scoring (Signal-Aligned)',
      marker: CATEGORY_INTELLIGENCE_MARKER,
      transform: transformSignalAligned,
      variables: FULL_BUSINESS_VARIABLES,
    },
    {
      id: BUSINESS_AUDIT_V1_ID,
      label: 'Seek: Business Audit V1',
      marker: V1_MARKER,
      transform: transformBusinessAuditV1,
      variables: FULL_BUSINESS_VARIABLES,
    },
    {
      id: SEED_BUSINESS_AUDIT_ID,
      label: 'Seek: Business Audit (mpt-seed-seek-001)',
      marker: SEED_VERSION_MARKER,
      transform: transformSeedBusinessAudit,
      // variables intentionally omitted — the minimal legacy body only uses
      // business_name/city/category; do not widen its declaration.
    },
  ];

  let updated = 0;
  let skipped = 0;

  for (const task of tasks) {
    try {
      const existing = await prisma.mkt_prompt_templates_list.findUnique({
        where: { id: task.id },
      });

      if (!existing) {
        logger.error(`Template not found: ${task.id} (${task.label})`);
        continue;
      }

      const needsOutputSchema =
        (existing.output_schema as { name?: string } | null)?.name !==
        BUSINESS_ANALYSIS_OUTPUT_SCHEMA.name;

      if (existing.body.includes(task.marker)) {
        if (!needsOutputSchema) {
          logger.info(`Already wired — skipping: ${task.label}`);
          skipped++;
          continue;
        }
        // Body already wired — apply the output_schema column fix only.
        await prisma.mkt_prompt_templates_list.update({
          where: { id: task.id },
          data: {
            output_schema: BUSINESS_ANALYSIS_OUTPUT_SCHEMA,
            updated_at: new Date(),
          },
        });
        logger.info(`Declared output_schema on already-wired template: ${task.label}`, undefined, {
          templateId: task.id,
        });
        updated++;
        continue;
      }

      const newBody = task.transform(existing.body);

      // Safety: confirm the marker is now present after transformation.
      if (!newBody.includes(task.marker)) {
        logger.error(`Transformation did not produce marker for: ${task.label}`);
        continue;
      }

      await prisma.mkt_prompt_templates_list.update({
        where: { id: task.id },
        data: {
          body: newBody,
          ...(task.variables ? { variables: task.variables } : {}),
          output_schema: BUSINESS_ANALYSIS_OUTPUT_SCHEMA,
          updated_at: new Date(),
        },
      });

      logger.info(`Wired both profiles into: ${task.label}`, undefined, {
        templateId: task.id,
        oldLength: existing.body.length,
        newLength: newBody.length,
      });
      updated++;
    } catch (err) {
      console.error(`[FAILED] ${task.label}:`, err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) console.error(err.stack);
      logger.error(`Failed to wire template: ${task.label}`, undefined, {
        templateId: task.id,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
    }
  }

  logger.info(`Seed complete: ${updated} updated, ${skipped} skipped (already wired)`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
