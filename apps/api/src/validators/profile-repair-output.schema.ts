/**
 * Profile Repair Output Schemas
 *
 * Single source of truth for the shape of profile repair prompt outputs:
 *   - profile_repair_triage: Triage assessment (severity, recommended track, rationale)
 *   - profile_repair_audit: Per-issue audit (NAP drift, unclaimed, platform gap)
 *   - citation_repair_package: Fulfill package (deliverableText, submissionGuide)
 */

import { z } from 'zod';

const coercedNumber = z.coerce.number();

// ============================================================================
// 1. Profile Repair Triage Schema
// ============================================================================

export const PROFILE_REPAIR_TRIAGE_SCHEMA_NAME = 'profile_repair_triage' as const;

export const profileRepairTriageSchema = z.object({
  profile_repair_triage: z.object({
    severity_score: coercedNumber.refine((n) => n >= 1 && n <= 10, {
      message: 'severity_score must be between 1 and 10',
    }),
    recommended_track: z.enum(['standard', 'escalated']),
    issue_type_confirmed: z.string(),
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
    "rationale": "<string>",
    "escalation_signals": ["<string>", ...],
    "standard_signals": ["<string>", ...]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

// ============================================================================
// 2. Profile Repair Audit Schema (Per-Issue Seek Prompts)
// ============================================================================

export const PROFILE_REPAIR_AUDIT_SCHEMA_NAME = 'profile_repair_audit' as const;

export const profileRepairAuditSchema = z.object({
  profile_repair_audit: z.object({
    severityScore: coercedNumber.refine((n) => n >= 1 && n <= 10, {
      message: 'severityScore must be between 1 and 10',
    }),
    issueType: z.string(),
  }).passthrough(),
});

export type ProfileRepairAuditOutput = z.infer<typeof profileRepairAuditSchema>;

export const PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX = `

Return valid JSON only matching this shape:
{
  "profile_repair_audit": {
    "severityScore": <number 1-10>,
    "issueType": "<string>"
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
