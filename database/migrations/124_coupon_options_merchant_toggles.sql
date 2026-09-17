-- Migration 124: Coupon Options Merchant Toggles
-- Adds per-feature merchant toggle columns to tenant_coupon_options_settings.
-- Each toggle controls whether a coupon feature is available (soft-gated by merchant).
-- Defaults to true so existing tenants are unaffected (opt-out pattern, same as funnels).

ALTER TABLE tenant_coupon_options_settings
  ADD COLUMN IF NOT EXISTS percent_off_enabled      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fixed_amount_enabled     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS free_shipping_enabled    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bogo_enabled             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_products_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_sharing_enabled       BOOLEAN NOT NULL DEFAULT true;
