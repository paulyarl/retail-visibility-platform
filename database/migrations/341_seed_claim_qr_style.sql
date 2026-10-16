-- Migration 341: seed-level claim-invite QR design
--
-- The seed page's "Claim QR Kit" cards (mail / walkin / social / email) render a
-- tracked-redirect QR per variant. The operator can style that QR via the
-- Design modal — but until now the design lived only in the modal, so the card
-- preview, the card's QR PNG, and the card's Postcard PDF all stayed classic
-- B/W. This column persists ONE shared design for the seed's claim variants
-- (mirroring report_qr_style / migration 340), so the preview and both downloads
-- render it.
--
-- Stored as the camelCase PersistedQrStyle projection (@/lib/qr-engine) — the
-- same shape report_qr_style and the public banner QR consume.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS claim_qr_style JSONB NULL;

COMMIT;
