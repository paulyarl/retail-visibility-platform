-- Migration 126: Add auto_id column to tenants table
-- Stores the deterministic 4-char alphanumeric hash derived from tenant_id
-- Mirrors the JS generateTenantAutoId() function in apps/api/src/middleware/tenantAutoId.ts

-- 1. Add column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_id VARCHAR(4);

-- 2. Create unique index (after backfill to avoid conflicts on nulls)
-- We'll add the unique constraint after backfill

-- 3. SQL function that replicates generateTenantAutoId()
-- JS: hash = ((hash << 5) - hash) + charCode; hash = hash & hash (32-bit)
-- Then: chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4 chars from abs(hash)
CREATE OR REPLACE FUNCTION generate_tenant_auto_id(tenant_id TEXT) RETURNS VARCHAR(4) AS $$
DECLARE
    h BIGINT := 0;
    temp_hash BIGINT;
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    ch CHAR;
    i INTEGER;
    idx INTEGER;
BEGIN
    FOR i IN 1..length(tenant_id) LOOP
        ch := substring(tenant_id from i for 1);
        -- JS: hash = ((hash << 5) - hash) + charCode
        h := ((h << 5) - h) + ascii(ch);
        -- JS: hash = hash & hash (forces 32-bit signed integer)
        -- Wrap to 32-bit unsigned, then convert to signed
        h := h % 4294967296;  -- mod 2^32
        IF h >= 2147483648 THEN
            h := h - 4294967296;
        END IF;
    END LOOP;

    -- JS: Math.abs(hash)
    temp_hash := abs(h);
    FOR i IN 1..4 LOOP
        idx := temp_hash % length(chars);
        result := result || substring(chars from idx + 1 for 1);
        temp_hash := temp_hash / length(chars);
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Backfill all existing tenants
UPDATE tenants SET auto_id = generate_tenant_auto_id(id) WHERE auto_id IS NULL;

-- 5. Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_auto_id ON tenants(auto_id) WHERE auto_id IS NOT NULL;

-- 6. auto_id is nullable — populated on demand by application code
