-- ============================================================
-- 044: Tenant Bot Embed Licenses
--
-- Enables secure embedding of the bot widget on external sites
-- (WordPress, custom domains) as a purchased service.
--
-- The embed_key replaces data-tenant-id for external embeds,
-- resolving the tenant from the license and validating the
-- requesting domain against allowed_domains.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_bot_embed_licenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(255) NOT NULL,
    embed_key       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    source          VARCHAR(50) NOT NULL DEFAULT 'tier',
    expires_at      TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tbel_status_check CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
    CONSTRAINT tbel_source_check CHECK (source IN ('tier', 'bsaas', 'promo', 'addon', 'comp'))
);

-- Foreign key to tenants table
ALTER TABLE tenant_bot_embed_licenses
    ADD CONSTRAINT fk_bot_embed_licenses_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_tbel_tenant_id ON tenant_bot_embed_licenses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tbel_embed_key ON tenant_bot_embed_licenses (embed_key);
CREATE INDEX IF NOT EXISTS idx_tbel_tenant_status ON tenant_bot_embed_licenses (tenant_id, status);

-- ============================================================
-- Seed the chatbot_external_embed feature key if it doesn't exist
-- This feature gates whether a tenant can use external embedding
-- ============================================================

INSERT INTO features_list (key, name, description, category)
VALUES ('chatbot_external_embed', 'External Bot Embed', 'Allow embedding the bot widget on external websites', 'integration')
ON CONFLICT (key) DO NOTHING;

-- Link to chatbot_options capability type
INSERT INTO capability_features_list (feature_id, capability_type_id)
SELECT
    f.id,
    ct.id
FROM features_list f
CROSS JOIN capability_type_list ct
WHERE f.key = 'chatbot_external_embed'
  AND ct.key = 'chatbot_options'
ON CONFLICT DO NOTHING;
