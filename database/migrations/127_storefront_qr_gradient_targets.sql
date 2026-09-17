-- Add gradient target toggle columns to tenant_storefront_qr_settings
-- These control which QR elements (dots, corners, corner dots) receive the gradient effect

ALTER TABLE tenant_storefront_qr_settings
  ADD COLUMN IF NOT EXISTS qr_gradient_on_dots BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_gradient_on_corners BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_gradient_on_corner_dots BOOLEAN DEFAULT true;
