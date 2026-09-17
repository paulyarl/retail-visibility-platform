-- ============================================================
-- Migration 136: Marketing Ops — Prompt Template Output Schema
-- ============================================================
-- Description:
--   - Adds `output_schema` (JSONB) to mkt_prompt_templates_list so
--     each prompt template can declare the expected shape of the
--     AI/external agent's JSON response.
--   - Drives two flows from a single source of truth:
--       1. Render/copy/download appends the schema to the prompt
--          text sent externally so agents return the expected shape.
--       2. The external-import endpoint validates pasted JSON
--          against the declared schema and decides audit creation
--          by `output_schema->>'name'` (NOT prompt_type, which
--          encodes pipeline stage, not output shape).
--   - Seeds the canonical `market_analysis` schema onto the
--     existing "Seek: Category Analysis" seed template
--     (mpt-seed-seek-002), which is typed prompt_type='seek' but
--     produces market-analysis-shaped JSON.
-- Prerequisite: 135_marketing_ops_prompt_scope.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Add output_schema column (nullable — existing templates
--         have no declared schema until seeded or edited)
-- ============================================================

ALTER TABLE mkt_prompt_templates_list
  ADD COLUMN IF NOT EXISTS output_schema JSONB;

-- ============================================================
-- STEP 2: Seed market_analysis schema onto mpt-seed-seek-002
--         (Seek: Category Analysis — produces market-analysis JSON
--          despite prompt_type='seek')
--         Idempotent: only seeds when output_schema IS NULL.
-- ============================================================

UPDATE mkt_prompt_templates_list
  SET output_schema = jsonb_build_object(
    'name', 'market_analysis',
    'description', 'Category- or city-level market analysis with GBP metrics, top competitors, pain points, opportunity gaps, and a recommended outreach angle.',
    'schema', jsonb_build_object(
      'market_analysis', jsonb_build_object(
        'location', 'string',
        'industry', 'string',
        'total_approximate_businesses', 'number',
        'average_gbp_metrics', jsonb_build_object(
          'average_rating', 'number',
          'average_review_count', 'number'
        ),
        'gbp_claimed_percentage', 'number',
        'website_presence_percentage', 'number',
        'top_5_competitors', jsonb_build_array(jsonb_build_object(
          'name', 'string',
          'approximate_rating', 'number',
          'approximate_review_count', 'number',
          'location_status', 'string'
        )),
        'common_pain_points', jsonb_build_array('string'),
        'opportunity_gaps', jsonb_build_array('string'),
        'recommended_outreach_angle', 'string'
      )
    )
  )
  WHERE id = 'mpt-seed-seek-002'
    AND output_schema IS NULL;

-- ============================================================
-- Verification queries (run manually after applying)
-- ============================================================
-- SELECT id, name, scope, prompt_type, output_schema->>'name' AS schema_name
--   FROM mkt_prompt_templates_list
--   WHERE output_schema IS NOT NULL
--   ORDER BY id;
--
-- Expected: mpt-seed-seek-002 | Seek: Category Analysis | category | seek | market_analysis
