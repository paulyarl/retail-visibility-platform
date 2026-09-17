-- Migration 183: Gallery Short Codes (SMS-friendly URLs)
--
-- Adds a short_code column to mkt_deliverable_preview_tokens so that
-- diagnostic gallery (and multi-diagnostic gallery) tokens can be shared
-- via short URLs of the form /g/{shortCode} instead of the 32-char
-- /preview/{token} URL. This mirrors the coupon /s/{autoId} pattern and
-- makes the link practical for SMS / text-message outreach to prospects
-- who only have a phone number on file.
--
-- short_code is a 6-char value from a curated 32-char alphabet
-- (ABCDEFGHJKLMNPQRSTUVWXYZ23456789 — no 0/O/1/I), giving ~1B combinations.
-- It is unique across all token types and is the lookup key for the
-- /api/gallery-code/:shortCode resolution endpoint.
--
-- Existing rows get a short_code backfilled in the application layer on
-- next access (lazy backfill) — the column is nullable so old tokens keep
-- working via the long URL until they are touched.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8);

-- Unique index for short-code resolution. Partial index (WHERE short_code
-- IS NOT NULL) so that legacy rows without a short code don't conflict and
-- the index stays small.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_preview_tokens_short_code
  ON mkt_deliverable_preview_tokens (short_code)
  WHERE short_code IS NOT NULL;

-- Verification queries (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mkt_deliverable_preview_tokens' AND column_name = 'short_code';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'mkt_deliverable_preview_tokens' AND indexname = 'idx_mkt_preview_tokens_short_code';

COMMIT;
