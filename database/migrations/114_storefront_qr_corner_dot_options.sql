-- Migration 114: Add QR corner dot type and color columns to tenant_storefront_qr_settings
-- These control the inner dots inside the 3 corner squares of the QR code.
-- Defaults match the previous hardcoded behavior: type='dot', color='#ffffff'

ALTER TABLE tenant_storefront_qr_settings
  ADD COLUMN IF NOT EXISTS qr_corner_dot_type VARCHAR(30) DEFAULT 'dot',
  ADD COLUMN IF NOT EXISTS qr_corner_dot_color VARCHAR(20) DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS qr_logo_shape VARCHAR(20) DEFAULT 'square';
