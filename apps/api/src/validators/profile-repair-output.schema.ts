/**
 * Profile Repair Output Schemas
 *
 * Single source of truth for the shape of profile repair prompt outputs:
 *   - profile_repair_triage: Triage operator briefing (scope, viability, pitch, risks, track)
 *   - profile_repair_audit: Per-issue repair briefing (scope, impact, pitch, risks)
 *   - citation_repair_package: Fulfill package (deliverableText, submissionGuide)
 */

import { z } from 'zod';

const coercedNumber = z.coerce.number();

// ============================================================================
// 1. Profile Repair Triage Schema (Operator Briefing)
// ============================================================================
//
// The triage AI call produces an operator briefing, not just a track label.
// The track decision (recommended_track) is retained for the confirm-button
// UX, but the AI's real value is the scope/viability/pitch/risks briefing
// that gives the operator actionable intelligence for the Openers workspace.
//
// A code-side floor (resolveTrackFromSignals) validates recommended_track:
// the AI may escalate above the rule, never de-escalate below it.

export const PROFILE_REPAIR_TRIAGE_SCHEMA_NAME = 'profile_repair_triage' as const;

export const profileRepairTriageSchema = z.object({
  profile_repair_triage: z.object({
    // Track decision (AI-produced; code validates as a floor)
    severity_score: coercedNumber.refine((n) => n >= 1 && n <= 10, {
      message: 'severity_score must be between 1 and 10',
    }),
    recommended_track: z.enum(['standard', 'escalated']),
    issue_type_confirmed: z.string(),

    // Operator briefing — the actual value of the AI call
    scope: z.object({
      summary: z.string(),
      broken_platforms: z.array(z.string()).default([]),
      drift_details: z.string().default(''),
      missing_assets: z.array(z.string()).default([]),
    }),
    viability: z.object({
      pursuit_recommendation: z.enum(['pursue', 'pursue_with_caveats', 'low_probability']),
      rationale: z.string(),
    }),
    pitch: z.object({
      primary_angle: z.string(),
      opener_hook: z.string(),
      pain_points: z.array(z.string()).default([]),
      marketplace_positioning: z.string(),
    }),
    risks: z.array(z.string()).default([]),

    // Backward-compat fields (still rendered in stage history + signal chips)
    rationale: z.string(),
    escalation_signals: z.array(z.string()).optional().default([]),
    standard_signals: z.array(z.string()).optional().default([]),
  }),
});

export type ProfileRepairTriageOutput = z.infer<typeof profileRepairTriageSchema>;

export const PROFILE_REPAIR_TRIAGE_PROMPT_SUFFIX = `

Return valid JSON only matching this shape:
{
  "profile_repair_triage": {
    "severity_score": <number 1-10>,
    "recommended_track": "standard" | "escalated",
    "issue_type_confirmed": "<string>",
    "scope": {
      "summary": "<1-2 sentence plain-language summary of what is broken>",
      "broken_platforms": ["<platform name>", ...],
      "drift_details": "<specifics: which fields drifted, displayed vs canonical, etc.>",
      "missing_assets": ["<website | apple_maps | photos | hours | ...>", ...]
    },
    "viability": {
      "pursuit_recommendation": "pursue" | "pursue_with_caveats" | "low_probability",
      "rationale": "<why this campaign is or is not worth pursuing>"
    },
    "pitch": {
      "primary_angle": "<the main hook for the opener, category-aware>",
      "opener_hook": "<1-2 sentence opener the operator can use verbatim>",
      "pain_points": ["<category-aware pain point>", ...],
      "marketplace_positioning": "<how this business is positioned in its market>"
    },
    "risks": ["<anything that makes this campaign harder than it looks>", ...],
    "rationale": "<overall reasoning for the track recommendation>",
    "escalation_signals": ["<signal>", ...],
    "standard_signals": ["<signal>", ...]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

// ============================================================================
// 2. Profile Repair Audit Schema (Per-Issue Seek Prompts — Operator Briefing)
// ============================================================================
//
// The 3 per-issue seek prompts (nap_drift, unclaimed_profile, platform_gap)
// produce an issue-specific repair briefing aligned with the triage briefing
// shape. They run at the "Seek → Preview Built" stage (Track A, after triage
// confirms the issue type) and give the operator deeper ammunition for the
// opener conversation, grounded in the actual audit data.
//
// The shape mirrors triage (scope, pitch, risks) but adds `impact` (business
// consequence) and `value_preview` (what the repair package will fix) which
// are the issue-specific depth that these per-issue prompts provide.

export const PROFILE_REPAIR_AUDIT_SCHEMA_NAME = 'profile_repair_audit' as const;

export const profileRepairAuditSchema = z.object({
  profile_repair_audit: z.object({
    severityScore: coercedNumber.refine((n) => n >= 1 && n <= 10, {
      message: 'severityScore must be between 1 and 10',
    }),
    issueType: z.string(),

    // Issue-specific scope (grounded in audit_results)
    scope: z.object({
      summary: z.string(),
      affected_platforms: z.array(z.string()).default([]),
      specifics: z.string().default(''),
    }),

    // Business impact (what the owner is losing)
    impact: z.object({
      primary_consequence: z.string(),
      estimated_reach_loss: z.string().default(''),
      competitive_gap: z.string().default(''),
    }),

    // Category-aware pitch (deeper than triage, issue-specific)
    pitch: z.object({
      opener_hook: z.string(),
      pain_points: z.array(z.string()).default([]),
      value_preview: z.string(),
    }),

    risks: z.array(z.string()).default([]),
  }).passthrough(),
});

export type ProfileRepairAuditOutput = z.infer<typeof profileRepairAuditSchema>;

export const PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX = `

Return valid JSON only matching this shape:
{
  "profile_repair_audit": {
    "severityScore": <number 1-10>,
    "issueType": "<nap_drift | unclaimed_profile | platform_gap>",
    "scope": {
      "summary": "<1-2 sentence plain-language summary of the issue>",
      "affected_platforms": ["<platform name>", ...],
      "specifics": "<issue-specific details: drift fields, missing platforms, missed features, etc.>"
    },
    "impact": {
      "primary_consequence": "<the main business pain: lost calls, lost searchers, lost map clicks, etc.>",
      "estimated_reach_loss": "<qualitative estimate of reach loss>",
      "competitive_gap": "<how far behind competitors who have this fixed>"
    },
    "pitch": {
      "opener_hook": "<1-2 sentence opener the operator can use verbatim, category-aware>",
      "pain_points": ["<category-aware pain point>", ...],
      "value_preview": "<what the repair package will fix — the value proposition>"
    },
    "risks": ["<anything that makes this repair harder than it looks>", ...]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

// ============================================================================
// 3. Citation & Profile Repair Package (Fulfill)
// ============================================================================

export const CITATION_REPAIR_PACKAGE_SCHEMA_NAME = 'citation_repair_package' as const;

export const citationRepairPackageSchema = z.object({
  deliverableText: z.string(),
  submissionGuide: z.string(),
});

export type CitationRepairPackageOutput = z.infer<typeof citationRepairPackageSchema>;

export const CITATION_REPAIR_PACKAGE_PROMPT_SUFFIX = `

Return valid JSON only matching this shape:
{
  "deliverableText": "<string>",
  "submissionGuide": "<string>"
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
