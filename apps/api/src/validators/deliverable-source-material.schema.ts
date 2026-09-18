/**
 * Deliverable Source Material Output Schema
 *
 * Single source of truth for the shape of `deliverable_source_material` prompt
 * output — the signal-gated source blocks the eight deliverable types consume.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §4.1
 *
 * `auditPlatform` is null in OUTPUT_SCHEMA_REGISTRY — this is NOT an audit. Its
 * output lives on the prompt execution (raw_output / filtered_output), the same
 * pattern as profile_repair_audit / citation_repair_package.
 */

import { z } from 'zod';

// ─── Per-type source blocks ──────────────────────────────────────────────
// Each is nullable: populated ONLY when the type's governing signal fired
// (spec §3.2). The service also nulls out ineligible blocks post-parse (§7.1).

const reviewResponseSourceSchema = z.object({
  reviews: z.array(z.object({
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    text: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
    theme: z.string().nullable().optional(),
    is_negative_first: z.boolean().optional(),
  })).min(1),
}).passthrough();

const serviceMenuSourceSchema = z.object({
  services: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    evidence: z.string().nullable().optional(),
  })).min(1),
  pricing_tiers_present: z.boolean().nullable().optional(),
}).passthrough();

const gbpAuditSourceSchema = z.object({
  claimed: z.boolean().nullable().optional(),
  primary_category: z.string().nullable().optional(),
  additional_categories: z.array(z.string()).optional(),
  photo_count: z.number().nullable().optional(),
  photo_types_present: z.array(z.string()).optional(),
  photo_types_missing: z.array(z.string()).optional(),
  hours_present: z.boolean().nullable().optional(),
  special_hours_present: z.boolean().nullable().optional(),
  profile_issues: z.array(z.string()).optional(),
  attributes_displayed: z.array(z.string()).optional(),
}).passthrough();

const testimonialCardsSourceSchema = z.object({
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
  })).min(1),
}).passthrough();

const napReportSourceSchema = z.object({
  canonical: z.object({
    name: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).passthrough(),
  platform_status: z.array(z.object({
    platform: z.string(),
    name: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional(), // consistent | drift | missing | unverified
  })).optional(),
  material_issues: z.array(z.string()).optional(),
}).passthrough();

const seoContentSourceSchema = z.object({
  service_pages: z.array(z.object({
    service: z.string(),
    target_terms: z.array(z.string()).optional(),
    differentiators: z.array(z.string()).optional(),
    local_context: z.string().nullable().optional(),
  })).min(1),
  public_narrative: z.string().nullable().optional(),
}).passthrough();

const leadMagnetSourceSchema = z.object({
  offer: z.object({
    title: z.string(),
    promise: z.string(),
    audience: z.string().nullable().optional(),
  }).passthrough(),
  friction_points: z.array(z.string()).optional(),
  conversion_opportunities: z.array(z.string()).optional(),
}).passthrough();

const productVisibilitySourceSchema = z.object({
  product_categories: z.array(z.string()).optional(),
  catalog_gaps: z.array(z.string()).optional(),
  browsing_gaps: z.array(z.string()).optional(),
  availability_inquiry_present: z.boolean().nullable().optional(),
  pickup_delivery_present: z.boolean().nullable().optional(),
  photo_types_missing: z.array(z.string()).optional(),
}).passthrough();

export const deliverableSourceMaterialSchema = z.object({
  // The canonical signal set the analyst consumed (filtered to deliverable-
  // relevant families — spec G-12).
  signals_consumed: z.array(z.string()).default([]),

  deliverable_sources: z.object({
    review_responses: reviewResponseSourceSchema.nullable().optional(),
    service_menu: serviceMenuSourceSchema.nullable().optional(),
    gbp_audit: gbpAuditSourceSchema.nullable().optional(),
    testimonial_cards: testimonialCardsSourceSchema.nullable().optional(),
    nap_report: napReportSourceSchema.nullable().optional(),
    seo_content: seoContentSourceSchema.nullable().optional(),
    lead_magnet: leadMagnetSourceSchema.nullable().optional(),
    product_visibility_preview: productVisibilitySourceSchema.nullable().optional(),
  }).passthrough(),

  data_quality: z.object({
    verified_fields: z.array(z.string()).optional(),
    unavailable_fields: z.array(z.string()).optional(),
    limitations: z.array(z.string()).optional(),
  }).passthrough().optional(),
}).passthrough();

export type DeliverableSourceMaterial = z.infer<typeof deliverableSourceMaterialSchema>;

export const DELIVERABLE_SOURCE_MATERIAL_SCHEMA_NAME = 'deliverable_source_material' as const;

/**
 * Human-readable description of the deliverable_source_material output shape,
 * appended to the prompt sent to the AI agent.
 */
export const DELIVERABLE_SOURCE_MATERIAL_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "signals_consumed": ["<SignalCode>", ...],
  "deliverable_sources": {
    "review_responses": { "reviews": [{ "platform": "<string|null>", "rating": <number|null>, "date": "<ISO|null>", "author": "<string|null>", "text": "<verbatim review>", "sentiment": "positive|neutral|negative|null", "theme": "<string|null>", "is_negative_first": <boolean> }] } | null,
    "service_menu": { "services": [{ "name": "<string>", "description": "<string|null>", "evidence": "<string|null>" }], "pricing_tiers_present": <boolean|null> } | null,
    "gbp_audit": { "claimed": <boolean|null>, "primary_category": "<string|null>", "additional_categories": ["<string>"], "photo_count": <number|null>, "photo_types_present": ["<string>"], "photo_types_missing": ["<string>"], "hours_present": <boolean|null>, "special_hours_present": <boolean|null>, "profile_issues": ["<string>"], "attributes_displayed": ["<string>"] } | null,
    "testimonial_cards": { "testimonials": [{ "quote": "<verbatim>", "author": "<string|null>", "platform": "<string|null>", "rating": <number|null>, "date": "<ISO|null>" }] } | null,
    "nap_report": { "canonical": { "name": "<string|null>", "address": "<string|null>", "phone": "<string|null>" }, "platform_status": [{ "platform": "<string>", "name": "<string|null>", "address": "<string|null>", "phone": "<string|null>", "status": "consistent|drift|missing|unverified" }], "material_issues": ["<string>"] } | null,
    "seo_content": { "service_pages": [{ "service": "<string>", "target_terms": ["<string>"], "differentiators": ["<string>"], "local_context": "<string|null>" }], "public_narrative": "<string|null>" } | null,
    "lead_magnet": { "offer": { "title": "<string>", "promise": "<string>", "audience": "<string|null>" }, "friction_points": ["<string>"], "conversion_opportunities": ["<string>"] } | null,
    "product_visibility_preview": { "product_categories": ["<string>"], "catalog_gaps": ["<string>"], "browsing_gaps": ["<string>"], "availability_inquiry_present": <boolean|null>, "pickup_delivery_present": <boolean|null>, "photo_types_missing": ["<string>"] } | null
  },
  "data_quality": { "verified_fields": ["<string>"], "unavailable_fields": ["<string>"], "limitations": ["<string>"] }
}

Every block you are not populating MUST be null. Return ONLY the JSON object, no markdown fences, no commentary.`;
