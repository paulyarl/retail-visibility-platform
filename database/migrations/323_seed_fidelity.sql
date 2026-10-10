-- 323_seed_fidelity.sql
--
-- Marketing Ops project-phase spec §4/§6 (docs/LocalBiz/marketing_ops_project_phase_spec.md):
-- the seed is the plan's engagement wedge, and the wedge is only honest when
-- the seed faithfully mirrors the prospect's real public footprint. One
-- persisted verdict per seed — 'aligned'|'thin'|'misaligned'|'unknown' — is
-- consulted by every claim surface (place page, outreach merge vars, QR kits,
-- seed reports). 'misaligned' degrades claim CTAs to the inquiry path.
--
-- seed_fidelity_audit_id records which business_analysis audit the verdict was
-- computed against so plan resolution can lazily refresh when a newer audit
-- exists (spec D5: publish-time verdict is authoritative for public surfaces;
-- lazy refresh at plan resolution). seed_fidelity_checked_at is the write
-- timestamp for operator debugging.
--
-- Idempotent (IF NOT EXISTS / DROP IF EXISTS). Apply manually via the
-- Supabase SQL Editor, staging then production (manual-sql-migration-policy).

BEGIN;

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS seed_fidelity varchar(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS seed_fidelity_audit_id varchar(60),
  ADD COLUMN IF NOT EXISTS seed_fidelity_checked_at timestamptz;

ALTER TABLE directory_presence_seeds
  DROP CONSTRAINT IF EXISTS chk_dps_seed_fidelity;
ALTER TABLE directory_presence_seeds
  ADD CONSTRAINT chk_dps_seed_fidelity
  CHECK (seed_fidelity IN ('aligned', 'thin', 'misaligned', 'unknown'));

COMMIT;
