/**
 * Website Positioning Audit Output Schema
 *
 * Single source of truth for the shape of the `website_positioning_audit`
 * prompt output — the dedicated positioning pass for PB-08 / A7 campaigns
 * (spec §6.2). Distinct from `business_analysis`: the business audit is a
 * breadth-first four-platform tri-state assessment; this audit is a depth-first
 * positioning judgment against the category's gold-standard website
 * expectations, and every finding is framed as a conversion implication.
 *
 * Imports land in `mkt_audits_list` with `platform = 'website_positioning'`
 * (the column is free-form VARCHAR(50) — no CHECK). Registered in
 * OUTPUT_SCHEMA_REGISTRY so `importExternalResult` resolves the validator.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §6.2
 */

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────

export const PRESENCE_CLASSIFICATIONS = [
  'no_presence',
  'third_party_only',
  'builder_subdomain',
  'parked',
  'unfinished',
  'broken',
  'present',
] as const;

export const OWNERSHIP_VALUES = ['owned_domain', 'platform_hosted', 'none'] as const;

export const BUILD_SCOPE_RECOMMENDATIONS = [
  'new_build',
  'rebuild',
  'repair',
  'secure_and_refresh',
] as const;

// ─── Sub-shapes ──────────────────────────────────────────────────────────

/** A conversion-framed issue. Every issue carries a conversion implication. */
const websiteIssueSchema = z.object({
  issue: z.string(),
  evidence: z.string().nullable().optional(),
  severity: z.enum(['non_negotiable', 'recommended']).optional(),
  /** "customers can't browse the menu → they call or leave". */
  conversion_implication: z.string().nullable().optional(),
}).passthrough();

/**
 * A positioning gap — same shape as business_analysis.gap_analysis.gaps, but
 * the platform is fixed to 'website' (the expected values come from the gold
 * standard's website/category expectations).
 */
const positioningGapSchema = z.object({
  platform: z.string().optional(), // always 'website'
  field: z.string(),
  expected: z.union([z.string(), z.boolean(), z.number(), z.array(z.union([z.string(), z.boolean(), z.number()]))]).nullable().optional(),
  actual: z.union([z.string(), z.boolean(), z.number(), z.array(z.union([z.string(), z.boolean(), z.number()]))]).nullable().optional(),
  gap_description: z.string().nullable().optional(),
  severity: z.enum(['non_negotiable', 'recommended']).optional(),
}).passthrough();

/** The seed of the FITD deliverable. */
const buildScopeSchema = z.object({
  recommended: z.enum(BUILD_SCOPE_RECOMMENDATIONS),
  scope_notes: z.string().nullable().optional(),
  must_have_pages: z.array(z.string()).optional(),
}).passthrough();

/**
 * One problem → solution pair the operator can deploy verbatim in outreach
 * (Triage & Repair Outreach Problems spec — shared shape with
 * business_analysis and the repair briefings). `problem` is the
 * consequence-first statement; `regular`/`hook` are the two spoken lines;
 * `solution` is a high-level fix summary (not a named package); `evidence`
 * grounds the pair; `outreach_use` is the deployment guidance.
 *
 * .min(1) when present — emit the field or omit it entirely; an empty array
 * is invalid (matches the business_analysis contract).
 */
const outreachProblemEntrySchema = z.object({
  problem: z.string(),
  regular: z.string(),
  hook: z.string(),
  solution: z.string(),
  evidence: z.string(),
  outreach_use: z.string(),
}).passthrough();

// ─── Root schema ─────────────────────────────────────────────────────────

export const websitePositioningAuditSchema = z.object({
  summary: z.string().nullable().optional(),

  presence_classification: z.enum(PRESENCE_CLASSIFICATIONS),
  ownership: z.enum(OWNERSHIP_VALUES),

  /** Every issue carries a conversion implication (the amplification the
   *  business audit lacks). */
  issues: z.array(websiteIssueSchema).optional(),

  /** Positioning gaps vs. the category's gold-standard website expectations. */
  positioning_gaps: z.array(positioningGapSchema).optional(),

  /** The seed of the FITD deliverable. */
  build_scope: buildScopeSchema.optional(),

  /** Canonical signal set for the website dimension (the §3 WC_* codes). */
  detected_signals: z.array(z.string()).optional(),

  /** Optional: how gold-standard exemplar sites position (one line each). */
  competitive_frame: z.array(z.string()).optional(),

  /** Operator outreach ammunition — 1–3 problem → solution pairs (the shared
   *  problem/regular/hook/solution voice contract). */
  outreach_problems: z.array(outreachProblemEntrySchema).min(1).optional(),

  data_quality: z.object({
    verified_fields: z.array(z.string()).optional(),
    unavailable_fields: z.array(z.string()).optional(),
    limitations: z.array(z.string()).optional(),
  }).passthrough().optional(),
}).passthrough();

export type WebsitePositioningAudit = z.infer<typeof websitePositioningAuditSchema>;

export const WEBSITE_POSITIONING_SCHEMA_NAME = 'website_positioning_audit' as const;

/**
 * Human-readable output shape, appended to the rendered prompt via the
 * OUTPUT_SCHEMA_REGISTRY prompt suffix.
 */
export const WEBSITE_POSITIONING_PROMPT_SUFFIX = `
|
Return your response as JSON matching this exact schema:
{
  "summary": "<string>",
  "presence_classification": "no_presence|third_party_only|builder_subdomain|parked|unfinished|broken|present",
  "ownership": "owned_domain|platform_hosted|none",
  "issues": [
    { "issue": "<string>", "evidence": "<string|null>", "severity": "non_negotiable|recommended", "conversion_implication": "<string>" }
  ],
  "positioning_gaps": [
    { "platform": "website", "field": "<string>", "expected": "<string|boolean|number|<array>|null>", "actual": "<string|boolean|number|<array>|null>", "gap_description": "<string>", "severity": "non_negotiable|recommended" }
  ],
  "build_scope": { "recommended": "new_build|rebuild|repair|secure_and_refresh", "scope_notes": "<string>", "must_have_pages": ["<string>"] },
  "detected_signals": ["<WC_* code>", ...],
  "competitive_frame": ["<one line per exemplar>"],
  "outreach_problems": [
    { "problem": "<the web gap as the owner experiences it — the business consequence>", "regular": "<the plain professional line that raises it>", "hook": "<the alternative line — same fact, earns attention>", "solution": "<high-level summary of the fix — what gets built, not a named package>", "evidence": "<the observed fact grounding the pair: the URL/host/state you verified>", "outreach_use": "<cold-call opener | email hook | objection response>" }
  ],
  "data_quality": { "verified_fields": ["<string>"], "unavailable_fields": ["<string>"], "limitations": ["<string>"] }
}

Every issue MUST carry a conversion_implication written for the owner ("customers can't browse the menu → they call or leave"). Return ONLY the JSON object, no markdown fences, no commentary.`;
