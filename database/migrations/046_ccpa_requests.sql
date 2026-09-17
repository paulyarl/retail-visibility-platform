-- 046: CCPA Compliance — ccpa_requests table
-- Stores "Do Not Sell My Personal Information" requests and other CCPA data requests

CREATE TABLE IF NOT EXISTS ccpa_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT NOT NULL,
  tenant_id TEXT,
  request_type VARCHAR(20) NOT NULL DEFAULT 'opt_out_sale'
    CHECK (request_type IN ('opt_out_sale', 'know', 'delete')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'denied')),
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccpa_requests_email ON ccpa_requests (email);
CREATE INDEX IF NOT EXISTS idx_ccpa_requests_tenant_id ON ccpa_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccpa_requests_status ON ccpa_requests (status);
CREATE INDEX IF NOT EXISTS idx_ccpa_requests_created_at ON ccpa_requests (created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ccpa_requests_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS trg_ccpa_requests_updated_at ON ccpa_requests;
CREATE TRIGGER trg_ccpa_requests_updated_at
  BEFORE UPDATE ON ccpa_requests
  FOR EACH ROW EXECUTE FUNCTION update_ccpa_requests_updated_at();

-- Enable RLS
ALTER TABLE ccpa_requests ENABLE ROW LEVEL SECURITY;

-- Policy: platform admins can see all, tenants can see their own
DROP POLICY IF EXISTS "ccpa_requests_admin_all" ON ccpa_requests;
CREATE POLICY "ccpa_requests_admin_all" ON ccpa_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = current_setting('request.jwt.claims', true)::json->>'sub' AND users.role = 'PLATFORM_ADMIN'::user_role)
  );

DROP POLICY IF EXISTS "ccpa_requests_tenant_own" ON ccpa_requests;
CREATE POLICY "ccpa_requests_tenant_own" ON ccpa_requests
  FOR ALL USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_tenants ut
      WHERE ut.tenant_id = ccpa_requests.tenant_id
      AND ut.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
