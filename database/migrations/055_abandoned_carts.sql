-- Migration: 055_abandoned_carts.sql
-- Phase 2D: Abandoned Cart Recovery
-- Tracks carts that were started but not completed, with recovery email state

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  cart_id VARCHAR(255),
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  customer_id VARCHAR(255),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cart_value_cents INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  recovery_email_sent BOOLEAN NOT NULL DEFAULT false,
  recovery_email_sent_at TIMESTAMPTZ,
  converted BOOLEAN NOT NULL DEFAULT false,
  converted_at TIMESTAMPTZ,
  converted_order_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant-scoped queries (merchant dashboard)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_tenant
  ON abandoned_carts (tenant_id, created_at DESC);

-- Index for recovery job: find unconverted, unsent carts in the 1-24h window
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery
  ON abandoned_carts (recovery_email_sent, converted, created_at)
  WHERE recovery_email_sent = false AND converted = false;

-- Index for lookup by cart_id (used when marking converted)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_cart_id
  ON abandoned_carts (cart_id)
  WHERE cart_id IS NOT NULL;

-- Index for lookup by customer_email + tenant (deduplication)
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_tenant
  ON abandoned_carts (tenant_id, customer_email, created_at DESC)
  WHERE customer_email IS NOT NULL;

-- Add relation from tenants table
ALTER TABLE abandoned_carts
  ADD CONSTRAINT fk_abandoned_carts_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(id)
  ON DELETE CASCADE;
