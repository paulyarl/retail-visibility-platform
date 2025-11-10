-- Square POS Integration Tables
-- Phase 1: Infrastructure Setup

-- 1. Square Integrations Table
-- Stores OAuth tokens and connection status per tenant
CREATE TABLE IF NOT EXISTS square_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- OAuth Credentials
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    merchant_id TEXT NOT NULL,
    location_id TEXT,
    
    -- Token Management
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Connection Status
    enabled BOOLEAN DEFAULT true,
    mode TEXT DEFAULT 'production' CHECK (mode IN ('sandbox', 'production')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id)
);

-- 2. Square Product Mappings Table
-- Maps platform products to Square catalog items
CREATE TABLE IF NOT EXISTS square_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES square_integrations(id) ON DELETE CASCADE,
    
    -- Product IDs
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    square_catalog_object_id TEXT NOT NULL,
    square_item_variation_id TEXT,
    
    -- Sync Status
    sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error')),
    last_synced_at TIMESTAMPTZ,
    sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('to_square', 'from_square', 'bidirectional')),
    
    -- Conflict Resolution
    last_platform_update TIMESTAMPTZ,
    last_square_update TIMESTAMPTZ,
    conflict_resolution TEXT DEFAULT 'last_write_wins' CHECK (conflict_resolution IN ('last_write_wins', 'platform_priority', 'square_priority', 'manual')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, inventory_item_id),
    UNIQUE(integration_id, square_catalog_object_id)
);

-- 3. Square Sync Logs Table
-- Tracks all sync operations for debugging and audit
CREATE TABLE IF NOT EXISTS square_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES square_integrations(id) ON DELETE CASCADE,
    mapping_id UUID REFERENCES square_product_mappings(id) ON DELETE SET NULL,
    
    -- Sync Details
    sync_type TEXT NOT NULL CHECK (sync_type IN ('inventory', 'catalog', 'webhook', 'manual')),
    direction TEXT NOT NULL CHECK (direction IN ('to_square', 'from_square')),
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'sync')),
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error', 'skipped')),
    error_message TEXT,
    error_code TEXT,
    
    -- Data
    request_payload JSONB,
    response_payload JSONB,
    items_affected INTEGER DEFAULT 0,
    
    -- Performance
    duration_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_square_integrations_tenant ON square_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_square_integrations_enabled ON square_integrations(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_square_mappings_tenant ON square_product_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_square_mappings_integration ON square_product_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_square_mappings_inventory_item ON square_product_mappings(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_square_mappings_sync_status ON square_product_mappings(sync_status);

CREATE INDEX IF NOT EXISTS idx_square_sync_logs_tenant ON square_sync_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_sync_logs_integration ON square_sync_logs(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_square_sync_logs_status ON square_sync_logs(status, created_at DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE square_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's Square data
CREATE POLICY square_integrations_tenant_isolation ON square_integrations
    FOR ALL
    USING (tenant_id IN (SELECT id FROM tenants WHERE id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY square_mappings_tenant_isolation ON square_product_mappings
    FOR ALL
    USING (tenant_id IN (SELECT id FROM tenants WHERE id = current_setting('app.current_tenant_id')::uuid));

CREATE POLICY square_logs_tenant_isolation ON square_sync_logs
    FOR ALL
    USING (tenant_id IN (SELECT id FROM tenants WHERE id = current_setting('app.current_tenant_id')::uuid));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_square_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER square_integrations_updated_at
    BEFORE UPDATE ON square_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_square_updated_at();

CREATE TRIGGER square_mappings_updated_at
    BEFORE UPDATE ON square_product_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_square_updated_at();

-- Comments for Documentation
COMMENT ON TABLE square_integrations IS 'Stores Square POS OAuth tokens and connection settings per tenant';
COMMENT ON TABLE square_product_mappings IS 'Maps platform inventory items to Square catalog objects for bidirectional sync';
COMMENT ON TABLE square_sync_logs IS 'Audit log of all Square sync operations for debugging and monitoring';

COMMENT ON COLUMN square_integrations.mode IS 'sandbox for testing, production for live data';
COMMENT ON COLUMN square_product_mappings.sync_direction IS 'Controls which direction data flows: to_square, from_square, or bidirectional';
COMMENT ON COLUMN square_product_mappings.conflict_resolution IS 'Strategy for resolving conflicts when both systems have updates';
