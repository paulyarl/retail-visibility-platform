/**
 * Review Intake Output Schema
 *
 * Single source of truth for the shape of `review_intake` prompt output — the
 * operator-pasted reviews, parsed and structured.
 *
 * Resolves G-1 (spec Appendix B.4, Option D): the business_analysis audit emits
 * no verbatim review text, so the review-bearing deliverable source blocks are
 * populated from this intake (copy-paste bridge execution mode) instead.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §5.7
 *
 * `auditPlatform` is null in OUTPUT_SCHEMA_REGISTRY — this is NOT an audit. Its
 * output lives on the prompt execution (raw_output / filtered_output).
 */

import { z } from 'zod';

export const reviewIntakeSchema = z.object({
  reviews: z.array(z.object({
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    text: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
    is_negative_first: z.boolean().optional(),
    answered: z.boolean().optional(),
    owner_response: z.string().nullable().optional(),
  })).default([]),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    date: z.string().nullable().optional(),
  })).optional(),
}).passthrough();

export type ReviewIntake = z.infer<typeof reviewIntakeSchema>;

export const REVIEW_INTAKE_SCHEMA_NAME = 'review_intake' as const;

/**
 * Human-readable description of the review_intake output shape, appended to the
 * prompt sent to the AI agent.
 */
export const REVIEW_INTAKE_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "reviews": [
    {
      "platform": "<google|yelp|facebook|other|null>",
      "rating": <1-5|null>,
      "date": "<ISO date|null>",
      "author": "<name|null>",
      "text": "<the review text, verbatim>",
      "sentiment": "positive|neutral|negative|null",
      "is_negative_first": <boolean>,
      "answered": <boolean>,
      "owner_response": "<existing owner response|null>"
    }
  ],
  "testimonials": [
    {
      "quote": "<verbatim quote from a positive review, >= 12 words>",
      "author": "<name|null>",
      "platform": "<google|yelp|facebook|other|null>",
      "rating": <number|null>,
      "date": "<ISO date|null>"
    }
  ]
}

Preserve review text verbatim. Return ONLY the JSON object, no markdown fences, no commentary.`;
