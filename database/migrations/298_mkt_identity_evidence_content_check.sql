-- Migration 298: repair mkt_identity_evidence's content constraint
--
-- Two defects in the content guard shipped by migration 297, both of which
-- let a row through (or wrongly reject one) at the DB layer:
--
-- 1. The FIRST revision of 297 created `chk_identity_evidence_corroborates_nonempty`
--    as a plain `array_length(corroborates, 1) >= 1`, with no owner-contact
--    escape. That rejects the supported "owner contact only" row — the case the
--    service writes when an operator captures an owner's cell without yet
--    confirming the NAP. Because the write path is best-effort/operator-driven,
--    a 23514 there surfaces as a 500 rather than a validation error. 297's
--    CREATE TABLE is IF NOT EXISTS and its constraints are guarded, so
--    re-running 297 does NOT remove the legacy constraint — it has to be
--    dropped explicitly.
--
-- 2. The replacement `chk_identity_evidence_content` tested
--    `array_length(corroborates, 1) >= 1`. Postgres returns NULL (not 0) for
--    array_length of an EMPTY array, `NULL >= 1` is NULL, and a CHECK whose
--    expression evaluates to NULL PASSES. So the guard did not actually bite
--    for an empty corroborates array — the exact case it exists to catch.
--    COALESCE(..., 0) makes it evaluate to FALSE and reject.
--
-- The service still validates this in code (IdentityEvidenceService.create
-- throws `evidence_empty` before inserting), so this is a backstop for any
-- future writer that bypasses the service — which is precisely how migrations
-- 259/262/273/289 silently dropped rows.
--
-- Idempotent. Apply to `local` + `prd`:
--   psql $DATABASE_URL -f database/migrations/298_mkt_identity_evidence_content_check.sql

-- 1. Remove the legacy owner-less variant (present only if 297 rev A ran).
ALTER TABLE mkt_identity_evidence
  DROP CONSTRAINT IF EXISTS chk_identity_evidence_corroborates_nonempty;

-- 2. Re-add the content guard in its correct, actually-biting form.
ALTER TABLE mkt_identity_evidence
  DROP CONSTRAINT IF EXISTS chk_identity_evidence_content;

ALTER TABLE mkt_identity_evidence
  ADD CONSTRAINT chk_identity_evidence_content CHECK (
    COALESCE(array_length(corroborates, 1), 0) >= 1
    OR owner_name IS NOT NULL
    OR owner_phone IS NOT NULL
    OR owner_email IS NOT NULL
  );
