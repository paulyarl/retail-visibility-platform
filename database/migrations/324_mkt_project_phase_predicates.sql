-- 324_mkt_project_phase_predicates.sql
--
-- Marketing Ops project-phase spec §5/§13 (docs/LocalBiz/marketing_ops_project_phase_spec.md):
-- phase selection predicates are versioned DATA, not hardcoded per archetype
-- or prospect. Each row is one phase's predicate at one predicate version:
-- the `any_of` signal set, optional per-signal `min_severity` floors (null in
-- seed v1 per D10), the INT_* rank-modifier map, and the phase's copy keys
-- (project_phase.<phase_key>.<slot>).
--
-- Keyed (phase_key, predicate_version): a new predicate version inserts new
-- rows — never edits history — so `predicateSeedVersion` recorded on a plan
-- remains reproducible provenance. This is seed-side state, explicitly NOT
-- "plan persistence" (spec §2/§17.3).
--
-- Idempotent (IF NOT EXISTS). Apply manually via the Supabase SQL Editor,
-- staging then production (manual-sql-migration-policy).

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_project_phase_predicates (
  id                  varchar(60) PRIMARY KEY,
  phase_key           varchar(40)  NOT NULL,
  predicate_version   int          NOT NULL,
  signals             jsonb        NOT NULL DEFAULT '[]'::jsonb,
  min_severity        jsonb,
  int_rank_modifiers  jsonb        NOT NULL DEFAULT '[]'::jsonb,
  copy_keys           jsonb        NOT NULL DEFAULT '{}'::jsonb,
  seed_version        text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_mppp_phase_version'
  ) THEN
    ALTER TABLE mkt_project_phase_predicates
      ADD CONSTRAINT uq_mppp_phase_version UNIQUE (phase_key, predicate_version);
  END IF;
END $$;

COMMIT;
