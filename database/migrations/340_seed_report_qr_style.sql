-- Migration 340: seed-level report QR design
--
-- The seed page's "Report QR Kit" cards each render a tracked-redirect QR for a
-- delivery channel (in_person / text / email / social / phone). The operator can
-- style that QR via the Design modal — but until now the design lived only in
-- the modal, so the card preview, the card's QR PNG, and the card's Postcard PDF
-- all stayed classic B/W. This column persists ONE shared design for the seed's
-- delivery channels (the "one design for all channels" decision), so the preview
-- and both downloads render it.
--
-- Stored as the camelCase PersistedQrStyle projection (@/lib/qr-engine) — the
-- same shape the public place page's banner QR consumes. The on-page banner
-- keeps its own persistence (tenant_storefront_qr_settings) because that design
-- renders on the public listing.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS report_qr_style JSONB NULL;

COMMIT;
