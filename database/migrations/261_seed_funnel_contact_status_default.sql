-- 261_seed_funnel_contact_status_default.sql
-- Fix the contact_status column default to match the evidence-safety contract.
--
-- Migration 258 added `contact_status TEXT NOT NULL DEFAULT 'unverified'`, but
-- the spec (§2) and all service code use 'contact_unverified' as the
-- absence-of-evidence state — never 'unreachable', and never an unnamed third
-- state. The 258 backfill already rewrote every existing 'unverified' row to
-- 'contactable' or 'contact_unverified', and createSeed always inserts an
-- explicit value, so no live row should hold 'unverified'. This migration
-- fixes the column default so a future raw INSERT that omits the column lands
-- in the correct absence state.
--
-- 258 is already applied — fix forward, never edit an applied migration.
-- See: docs/LocalBiz/seed_funnel_benchmark_gates_sprint_plan.md §5 W6

ALTER TABLE directory_presence_seeds
  ALTER COLUMN contact_status SET DEFAULT 'contact_unverified';

-- Safety: rewrite any straggler 'unverified' rows that a race or manual
-- insert may have left behind. Idempotent — no-op if none exist.
UPDATE directory_presence_seeds
  SET contact_status = 'contact_unverified'
  WHERE contact_status = 'unverified';
