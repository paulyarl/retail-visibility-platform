-- Migration 176: Diagnostic Gallery Metadata Columns
--
-- Adds 6 gallery-specific columns to mkt_deliverable_preview_tokens so a
-- preview token can carry the diagnostic gallery payload (title, subtitle,
-- friction summary, CTA label/amount, archetype). All columns are nullable
-- so existing deliverable/demo tokens are unaffected.
--
-- The gallery token (token_type = 'diagnostic_gallery') doubles as the pay
-- token (Option A in spec section 4.4) -- no second token is minted. The
-- pay endpoint resolves the campaign from the token regardless of type.
--
-- Conventions:
--   * mkt_* family: no ENABLE ROW LEVEL SECURITY, no updated_at triggers.
--   * tenant_id on the token is NOT set by generateCampaignToken (existing
--     behavior) -- gallery tokens will have tenant_id = null, consistent
--     with existing deliverable/demo tokens.
--   * cta_amount_cents is display-only for MVP -- must equal
--     campaign.package_price_cents (enforced at the application layer).
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate.
-- Date: 2026-08-08

-- --- 1. Gallery metadata columns ---

ALTER TABLE mkt_deliverable_preview_tokens
  ADD COLUMN IF NOT EXISTS gallery_title     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gallery_subtitle  TEXT,
  ADD COLUMN IF NOT EXISTS friction_summary  JSONB,
  ADD COLUMN IF NOT EXISTS cta_label         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cta_amount_cents  INTEGER,
  ADD COLUMN IF NOT EXISTS gallery_archetype VARCHAR(10);

-- --- Verification ---
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mkt_deliverable_preview_tokens'
--   AND column_name IN ('gallery_title','gallery_subtitle','friction_summary','cta_label','cta_amount_cents','gallery_archetype')
-- ORDER BY column_name;
