-- 290_mkt_playbook_delivery_artifacts.sql
--
-- Adds mkt_playbook_catalog.delivery_artifacts — a JSONB declaration of the
-- QR delivery artifacts a play ships (claim card, walk-in card, report card).
--
-- Spec: docs/LocalBiz/QR_OUTREACH_PIPELINE_INTEGRATION_SPEC.md §5.5
--
-- Additive + NOT NULL DEFAULT '[]' — existing rows unaffected.
-- PG-01's declaration is seeded inline (the PG-01 seed script does not set
-- this column, so a re-run of seed-proving-ground-preflight.ts will not
-- clobber it).
--
-- After applying: cd apps/api && doppler run --config local -- pnpm prisma db pull
--                 && pnpm prisma generate   (then the same for --config prd)

BEGIN;

ALTER TABLE mkt_playbook_catalog
  ADD COLUMN IF NOT EXISTS delivery_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN mkt_playbook_catalog.delivery_artifacts IS
  'QR delivery artifacts this play ships, e.g. [{"kind":"claim_qr","variants":["mail","walkin"]},{"kind":"report_qr","channels":["in_person","text"]}]';

UPDATE mkt_playbook_catalog
SET delivery_artifacts = '[{"kind":"claim_qr","variants":["mail","walkin"]},{"kind":"report_qr","channels":["in_person","text"]}]'::jsonb
WHERE code = 'PG-01';

COMMIT;
