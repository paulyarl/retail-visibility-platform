-- Migration 284: Directory Enrichment Robust Tasks
--
-- Adds columns for the multi-task enrichment output (shopper_guide, faq,
-- area_breakdown, context) to directory_category_enrichment. These fields
-- are produced by the enrichment campaign run alongside the existing SEO
-- packet (meta_title, description, keywords, body_copy) and are consumed
-- by public page renderers (shopper_guide, faq, area_breakdown) and by
-- downstream enrichment prompts (context).
--
-- All columns are nullable so existing rows are unaffected.
--
-- See:
--   docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md
--   apps/api/src/validators/directory-enrichment.schema.ts (V3 schema)

ALTER TABLE directory_category_enrichment
  ADD COLUMN IF NOT EXISTS shopper_guide TEXT,
  ADD COLUMN IF NOT EXISTS faq JSONB,
  ADD COLUMN IF NOT EXISTS area_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS context JSONB;
