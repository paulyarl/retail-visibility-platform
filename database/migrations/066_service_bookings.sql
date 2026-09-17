-- Migration 066: Create service_bookings table for service product fulfillment
-- Supports booking, scheduling, and management of service-type products

CREATE TABLE IF NOT EXISTS service_bookings (
  id                VARCHAR(255) PRIMARY KEY,
  order_id          VARCHAR(255) NOT NULL,
  order_item_id     VARCHAR(255) NOT NULL,
  tenant_id         VARCHAR(255) NOT NULL,
  customer_email    VARCHAR(500) NOT NULL,
  customer_name     VARCHAR(255),
  customer_phone    VARCHAR(50),
  scheduled_date    DATE,
  scheduled_time    VARCHAR(20),
  duration_minutes  INTEGER DEFAULT 60,
  provider_id       VARCHAR(255),
  provider_name     VARCHAR(255),
  service_location  TEXT,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_bookings_order_id ON service_bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_tenant_id ON service_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_customer_email ON service_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_scheduled_date ON service_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_service_bookings_provider_id ON service_bookings(provider_id);

-- Foreign keys
ALTER TABLE service_bookings
  ADD CONSTRAINT fk_service_bookings_order_id
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE service_bookings
  ADD CONSTRAINT fk_service_bookings_order_item_id
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;

ALTER TABLE service_bookings
  ADD CONSTRAINT fk_service_bookings_tenant_id
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_service_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_bookings_updated_at ON service_bookings;
CREATE TRIGGER trg_service_bookings_updated_at
  BEFORE UPDATE ON service_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_service_bookings_updated_at();

-- RLS Policies
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY service_bookings_tenant_isolation ON service_bookings
    USING (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY service_bookings_customer_access ON service_bookings
    FOR SELECT
    USING (customer_email = current_setting('app.current_customer_email', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
