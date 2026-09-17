-- Migration 067: Organization Commerce Settings — Product Type Specific Fields
-- Adds type-specific commerce columns for physical, digital, service, and hybrid products

-- Physical product settings
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS physical_shipping_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS physical_pickup_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS physical_default_shipping_cents INTEGER DEFAULT 0;

-- Digital product settings
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS digital_delivery_method TEXT DEFAULT 'download',
  ADD COLUMN IF NOT EXISTS digital_access_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS digital_download_limit INTEGER;

-- Service product settings
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS service_booking_lead_time_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS service_cancellation_policy TEXT DEFAULT 'flexible';

-- Hybrid product settings
ALTER TABLE organization_commerce_settings
  ADD COLUMN IF NOT EXISTS hybrid_fulfillment_split BOOLEAN DEFAULT true;

-- Updated timestamp
ALTER TABLE organization_commerce_settings
  ALTER COLUMN updated_at SET DEFAULT now();
