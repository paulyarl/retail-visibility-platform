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

// ---- Digital footprint (cross-platform presence snapshot) ----
// The analyst already consults multiple platforms to identify the category.
// This block captures what was found on each platform so the operator has
// a richer context for the business without running a full business audit.

const platformPresenceSchema = z.object({
  platform: z.string(),
  url: z.string().nullable().optional(),
  claimed: z.boolean().nullable().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().int().nullable().optional(),
  has_website: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

const digitalFootprintSchema = z.object({
  platforms_found: z.array(platformPresenceSchema).optional(),
  website_url: z.string().nullable().optional(),
  website_status: z.enum(['working', 'broken', 'none_found', 'unable_to_verify']).nullable().optional(),
  social_profiles: z.array(z.object({
    platform: z.string(),
    url: z.string().nullable().optional(),
  })).optional(),
  gbp_primary_category: z.string().nullable().optional(),
  years_in_business_estimate: z.string().nullable().optional(),
  signature_products_services: z.array(z.string()).optional(),
}).passthrough();

// ---- NAP (Name / Address / Phone) ----
// Structured canonical NAP extracted from the cross-platform research.
// The backend post-import hook uses this block to enrich the campaign's
// contact fields (business_name, phone, website_url, address_*).
// Per-field confidence drives the overwrite policy: 'high' confidence
// overwrites existing campaign values; 'medium'/'low' only fill nulls.
// `provenance` records the primary source of the NAP (e.g., "GBP + website").
const napFieldConfidenceSchema = z.object({
  field: z.enum([
    'business_name',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'postal_code',
    'country_code',
    'phone',
    'website',
  ]),
  confidence: confidenceEnum,
  source: z.string().nullable().optional(),
}).passthrough();

const napSchema = z.object({
  canonical_name: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  directory_profile_urls: z.array(z.object({
    platform: z.string(),
    url: z.string(),
  })).optional(),
  field_confidence: z.array(napFieldConfidenceSchema).optional(),
  provenance: z.string().nullable().optional(),
}).passthrough();

// ---- Canonical NAP (name / address / phone) ----
// Required for campaign spawning: the category-identification act endpoint
// forwards this block to deriveBusinessCampaign (phone / website / address /
// directory profiles) and the import flow syncs it onto the campaign with a
// confidence-gated overwrite policy. Optional at the schema level so older
// audits recorded before the block existed still validate.

const napFieldConfidenceSchema = z.object({
  field: z.string(),
  confidence: confidenceEnum,
  source: z.string().nullable().optional(),
}).passthrough();

const napSchema = z.object({
  canonical_name: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  directory_profile_urls: z.array(z.object({
    platform: z.string(),
    url: z.string(),
  }).passthrough()).optional(),
  field_confidence: z.array(napFieldConfidenceSchema).optional(),
  provenance: z.string().nullable().optional(),
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
  // Operator-facing summary of the business's digital footprint — what the
  // analyst found across platforms, written for the operator's context.
  business_summary: z.string().nullable().optional(),
  // Public-safe, SEO-rich description for directory listing pages. Excludes
  // all internal assessment content (scores, tiers, deficiencies). Mirrors
  // the public_narrative field in the business_analysis schema.
  public_narrative: z.string().nullable().optional(),
  // Structured cross-platform presence snapshot.
  digital_footprint: digitalFootprintSchema.optional(),
  // Canonical NAP block — consumed by campaign spawning (deriveBusinessCampaign
  // NAP handoff) and import-time contact enrichment (confidence-gated).
  nap: napSchema.nullable().optional(),
  // Structured NAP (Name / Address / Phone) extracted from the research.
  // Used by the post-import hook to enrich the campaign's contact fields.
  nap: napSchema.optional(),
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
  "business_summary": "<2-4 sentence operator-facing summary of the business's digital footprint across platforms>",
  "public_narrative": "<public-safe, SEO-rich description for directory listing pages — what the business is, where it is, what it is known for. Exclude all internal assessment content.>",
  "digital_footprint": {
    "platforms_found": [
      {
        "platform": "<google|yelp|facebook|bbb|other>",
        "url": "<string|null>",
        "claimed": true | false | null,
        "rating": <number|null>,
        "review_count": <number|null>,
        "has_website": true | false | null,
        "notes": "<string|null>"
      }
    ],
    "website_url": "<string|null>",
    "website_status": "working" | "broken" | "none_found" | "unable_to_verify",
    "social_profiles": [
      { "platform": "<string>", "url": "<string|null>" }
    ],
    "gbp_primary_category": "<string|null>",
    "years_in_business_estimate": "<string|null>",
    "signature_products_services": ["<verified product/service names>"]
  },
  "nap": {
    "canonical_name": "<string|null>",
    "address_line1": "<string|null>",
    "address_line2": "<string|null>",
    "city": "<string|null>",
    "state": "<string|null>",
    "postal_code": "<string|null>",
    "country_code": "<string|null>",
    "phone": "<string|null>",
    "website": "<string|null>",
    "directory_profile_urls": [{ "platform": "<string>", "url": "<string>" }],
    "field_confidence": [{ "field": "<string>", "confidence": "high" | "medium" | "low", "source": "<string|null>" }],
    "provenance": "<string>"
  },
  "nap": {
    "canonical_name": "<string|null>",
    "address_line1": "<string|null>",
    "address_line2": "<string|null>",
    "city": "<string|null>",
    "state": "<string|null>",
    "postal_code": "<string|null>",
    "country_code": "<string|null>",
    "phone": "<string|null>",
    "website": "<string|null>",
    "directory_profile_urls": [
      { "platform": "<google|yelp|facebook|bbb|other>", "url": "<string>" }
    ],
    "field_confidence": [
      { "field": "business_name|address_line1|address_line2|city|state|postal_code|country_code|phone|website", "confidence": "high|medium|low", "source": "<string|null>" }
    ],
    "provenance": "<string|null>"
  },
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
