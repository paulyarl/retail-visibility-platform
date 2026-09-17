-- Migration 187: Audit Import Metadata
--
-- Adds an import_metadata JSONB column to mkt_audits_list so that externally
-- imported audits can record which AI model produced them. When an operator
-- runs the same prompt on multiple models (ChatGPT, Claude, Gemini, etc.) and
-- imports each result, the metadata lets them tell apart which model produced
-- which audit on the campaign's Audits tab.
--
-- The metadata object is free-form JSON but conventionally contains:
--   { "model": "gpt-4-turbo", "provider": "openai", "run_id": "...", "notes": "..." }
--
-- The column is nullable — legacy audits and audits created through other
-- flows (manual createAudit, etc.) simply have no metadata. The frontend
-- renders the metadata badge only when present.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_audits_list
  ADD COLUMN IF NOT EXISTS import_metadata JSONB;

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_audits_list' AND column_name = 'import_metadata';

COMMIT;
