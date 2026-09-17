-- Migration 195: Category Intelligence Profile Store
--
-- Creates the mkt_intelligence_profiles table for reusable, versioned,
-- per-category discovery knowledge (spec §9–§13).
--
-- Key design properties:
--   - Immutable version rows (unlike prompt templates today) — historical
--     runs reference the exact version used (§43). A new version is a new row;
--     the old row is never mutated.
--   - One active version per profile; one profile per category key (enforced
--     via partial unique index on category_key WHERE status = 'active').
--   - status: 'draft' | 'active' | 'retired' — draft-by-default with human
--     activation (GAP-P8 normative rule 1). The resolver only returns active
--     profiles, so both consumers (business audit resolution, intelligence
--     discovery) pick up newly activated profiles for free.
--   - configuration_json holds the §10 profile structure (terminology,
--     specialized_sources with capabilities/limitations, evidence rules,
--     prohibited_inferences, category_signals) in a single JSONB column.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 195)

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_intelligence_profiles (
  id                  VARCHAR(64)  NOT NULL,
  category_key        VARCHAR(100) NOT NULL,
  category_name       VARCHAR(100) NOT NULL,
  version             INT          NOT NULL DEFAULT 1,
  configuration_json  JSONB        NOT NULL,
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_mkt_intelligence_profiles PRIMARY KEY (id, version)
);

-- One active version per category key (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_intel_profiles_active_category
  ON mkt_intelligence_profiles (category_key)
  WHERE status = 'active';

-- Lookup by profile id (all versions)
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_id
  ON mkt_intelligence_profiles (id);

-- Lookup by status (for draft listing)
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_status
  ON mkt_intelligence_profiles (status);

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_intelligence_profiles' ORDER BY ordinal_position;

COMMIT;
