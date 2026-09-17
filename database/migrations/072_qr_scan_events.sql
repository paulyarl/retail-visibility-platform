-- Migration 072: QR scan events table for demo tenant QR code tracking
-- Tracks scans of QR codes generated for demo tenants

CREATE TABLE IF NOT EXISTS qr_scan_events (
  id          VARCHAR(255) PRIMARY KEY,
  tenant_id   VARCHAR(255) NOT NULL,
  source      VARCHAR(100) DEFAULT 'qr_code',
  referrer    TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_tenant_id ON qr_scan_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_created_at ON qr_scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_tenant_created ON qr_scan_events (tenant_id, created_at DESC);

-- RLS
ALTER TABLE qr_scan_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY qr_scan_events_all ON qr_scan_events
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Foreign key to tenants
DO $$ BEGIN
  ALTER TABLE qr_scan_events
    ADD CONSTRAINT fk_qr_scan_events_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
