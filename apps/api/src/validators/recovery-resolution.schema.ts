/**
 * Recovery Resolution Output Schema
 *
 * Single source of truth for the shape of `recovery_resolution` prompt output.
 * The Recovery AI Agent returns this shape; RecoveryResolutionService validates
 * against it before persisting the deliverable.
 *
 * Sprint 3 — Recovery Management Engine.
 */

import { z } from 'zod';

export const recoveryResolutionSchema = z.object({
  recovery_resolution: z.object({
    deliverableText: z.string().min(50, 'deliverableText must be at least 50 characters'),
    submissionGuide: z.string().min(20, 'submissionGuide must be at least 20 characters'),
  }),
});

export type RecoveryResolutionOutput = z.infer<typeof recoveryResolutionSchema>;

export const RECOVERY_RESOLUTION_SCHEMA_NAME = 'recovery_resolution' as const;

/**
 * Human-readable description of the recovery_resolution output shape,
 * appended to the prompt sent to the AI agent.
 */
export const RECOVERY_RESOLUTION_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "recovery_resolution": {
    "deliverableText": "<string — the drafted response to the complaint platform, >= 50 chars>",
    "submissionGuide": "<string — step-by-step guide for the owner on how to submit, >= 20 chars>"
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
