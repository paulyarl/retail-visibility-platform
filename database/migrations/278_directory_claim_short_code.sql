-- Migration 278: Add short_code column to directory_claim_tokens
--
-- Mirrors the gallery short-code pattern (mkt_deliverable_preview_tokens.short_code)
-- so claim-invite links can render as /c/{shortCode} instead of the long
-- /place/claim/claim-{29chars} URL. The QR tracked redirect also gains a
-- short-code variant (/api/public/qr/c/{shortCode}) so QR codes encode a
-- compact URL — fewer QR modules = more legible at small print sizes.
--
-- 6-char codes from a curated 32-char alphabet (no 0/O/1/I) give ~1B
-- combinations. Nullable so legacy tokens minted before this migration
-- still work; a backfill (ensureClaimShortCode) lazily stamps a code on
-- old tokens when they're next fetched.

ALTER TABLE directory_claim_tokens
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dct_short_code
  ON directory_claim_tokens (short_code)
  WHERE short_code IS NOT NULL;
