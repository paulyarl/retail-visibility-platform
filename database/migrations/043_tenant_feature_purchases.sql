-- ============================================================
-- 043: Tenant Feature Purchases (BSaaS Infrastructure)
--
-- Enables à la carte feature purchases that flow through the
-- existing EffectiveCapabilityResolver as a third merge source
-- alongside org-tier and tenant-tier features.
--
-- The fetchRawCapabilities() function in EffectiveCapabilityResolver.ts
-- queries this table and merges active, non-expired purchases into
-- the same mergedFeatures map using most-permissive-wins logic.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_feature_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(255) NOT NULL,
    feature_key     TEXT NOT NULL,
    source          VARCHAR(50) NOT NULL DEFAULT 'bsaas',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tfp_status_check CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
    CONSTRAINT tfp_source_check CHECK (source IN ('bsaas', 'promo', 'addon', 'comp', 'tier_overage')),
    CONSTRAINT tfp_unique_tenant_feature UNIQUE (tenant_id, feature_key)
);

-- Foreign key to tenants table
ALTER TABLE tenant_feature_purchases
    ADD CONSTRAINT fk_feature_purchases_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_tfp_tenant_status ON tenant_feature_purchases (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tfp_feature_key ON tenant_feature_purchases (feature_key);
CREATE INDEX IF NOT EXISTS idx_tfp_expires_at ON tenant_feature_purchases (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- Auto-expire function: a scheduled job can call this to mark
-- expired purchases. The resolver also checks expires_at at
-- runtime, so this is a housekeeping optimization.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_feature_purchases()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE tenant_feature_purchases
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
