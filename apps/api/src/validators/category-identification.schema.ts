/**
 * Category Identification Output Schema
 *
 * Single source of truth for the shape of the "Business Category Identification"
 * seek prompt output. This prompt takes a business name + location (NO category
 * input) and identifies which niche category the business belongs to, producing
 * ranked candidate categories with confidence scores.
 *
 * Imported by:
 *   - The render/copy/download flow (to append the expected shape to the
 *     prompt text sent to external agents).
 *   - The external-import endpoint (to validate pasted JSON before storing
 *     an execution + audit).
 *
 * Audit creation is keyed off `template.output_schema->>'name' === 'category_identification'`,
 * which creates an audit with `platform = 'category_identification'` so the
 * CategoryIdentificationAuditCard renders it in the campaign's Audits tab.
 *
 * The schema is intentionally permissive about extra object properties
 * (`.passthrough()`) so minor additions in agent output do not cause false
 * validation failures.
 */

import { z } from 'zod';

// ---- Shared enums ----

const confidenceEnum = z.enum(['high', 'medium', 'low']);
const businessTypeEnum = z.enum(['service', 'product', 'hybrid', 'unable_to_verify']);

// ---- Sub-schemas ----

const auditMetadataSchema = z.object({
  audit_date: z.string(),
  requested_business: z.object({
    business_name: z.string(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
}).passthrough();

const evidenceSourceSchema = z.object({
  source: z.string(),
  url: z.string().nullable().optional(),
  finding: z.string(),
}).passthrough();

const candidateCategorySchema = z.object({
  category: z.string().min(1),
  confidence: confidenceEnum,
  is_known_category: z.boolean(),
  subcategory: z.string().nullable().optional(),
  reasoning: z.string(),
  evidence_sources: z.array(evidenceSourceSchema).optional(),
}).passthrough();

const dataQualitySchema = z.object({
  sources_consulted: z.number().int().min(0).optional(),
  limitations: z.array(z.string()).optional(),
  overall_confidence: confidenceEnum.optional(),
}).passthrough();

// ---- Top-level schema ----

export const categoryIdentificationSchema = z.object({
  audit_metadata: auditMetadataSchema,
  business_name: z.string(),
  business_type: businessTypeEnum.nullable().optional(),
  candidate_categories: z.array(candidateCategorySchema).min(1),
  primary_category: z.string(),
  primary_category_confidence: confidenceEnum,
  reasoning: z.string(),
  evidence_sources: z.array(evidenceSourceSchema).optional(),
  data_quality: dataQualitySchema.optional(),
}).passthrough();

export type CategoryIdentificationOutput = z.infer<typeof categoryIdentificationSchema>;

export const CATEGORY_IDENTIFICATION_SCHEMA_NAME = 'category_identification' as const;

/**
 * Human-readable description of the category_identification output shape,
 * suitable for appending to a prompt sent to an external agent.
 * Kept in sync with `categoryIdentificationSchema` above.
 */
export const CATEGORY_IDENTIFICATION_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "audit_metadata": {
    "audit_date": "<ISO date>",
    "requested_business": {
      "business_name": "<string>",
      "city": "<string|null>",
      "state": "<string|null>",
      "address": "<string|null>",
      "phone": "<string|null>"
    }
  },
  "business_name": "<string>",
  "business_type": "service" | "product" | "hybrid" | "unable_to_verify",
  "candidate_categories": [
    {
      "category": "<category label>",
      "confidence": "high" | "medium" | "low",
      "is_known_category": true | false,
      "subcategory": "<string|null>",
      "reasoning": "<why this category fits>",
      "evidence_sources": [
        { "source": "<platform name>", "url": "<string|null>", "finding": "<what was found>" }
      ]
    }
  ],
  "primary_category": "<best-fit category label>",
  "primary_category_confidence": "high" | "medium" | "low",
  "reasoning": "<overall justification for the primary category choice>",
  "evidence_sources": [
    { "source": "<platform name>", "url": "<string|null>", "finding": "<what was found>" }
  ],
  "data_quality": {
    "sources_consulted": <number>,
    "limitations": ["<string>"],
    "overall_confidence": "high" | "medium" | "low"
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
