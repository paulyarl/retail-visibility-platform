-- v3.5 — Audit Log Enhancements (REQ-2025-801)
-- Works with existing audit_log table structure

-- Check if we need to migrate from old structure to new
DO $$ 
BEGIN
  -- If old simple structure exists, migrate it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_log' AND column_name = 'payload'
  ) THEN
    -- Rename old table
    ALTER TABLE audit_log RENAME TO audit_log_old;
    
    -- Create new enhanced structure
    CREATE TABLE audit_log (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      actor_type text NOT NULL CHECK (actor_type IN ('user','system','integration')),
      actor_id text NOT NULL,
      tenant_id text NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      entity_type text NOT NULL CHECK (entity_type IN ('inventory_item','tenant','policy','oauth','other')),
      entity_id text NOT NULL,
      action text NOT NULL CHECK (action IN ('create','update','delete','sync','policy_apply','oauth_connect','oauth_refresh')),
      request_id text,
      ip inet,
      user_agent text,
      diff jsonb NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}',
      pii_scrubbed boolean NOT NULL DEFAULT true
    );
    
    -- Migrate old data
    INSERT INTO audit_log (
      occurred_at, actor_type, actor_id, tenant_id, entity_type, entity_id,
      action, diff, metadata
    )
    SELECT 
      created_at,
      'user',
      COALESCE(actor, 'unknown'),
      tenant_id,
      'other',
      tenant_id,
      action,
      COALESCE(payload, '{}'::jsonb),
      '{}'::jsonb
    FROM audit_log_old;
    
    -- Drop old table
    DROP TABLE audit_log_old CASCADE;
  END IF;
  
  -- If new structure already exists, just ensure columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_log' AND column_name = 'occurred_at'
  ) THEN
    -- Table exists but is the old structure, already migrated above
    NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_log (request_id) WHERE request_id IS NOT NULL;

-- Add FK from InventoryItem if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'InventoryItem' AND column_name = 'auditLogId'
  ) THEN
    ALTER TABLE "InventoryItem" ADD COLUMN "auditLogId" text REFERENCES audit_log(id);
  END IF;
END $$;

-- Defense-in-depth trigger (fallback if API layer misses)
CREATE OR REPLACE FUNCTION audit_inventory_fallback() RETURNS trigger AS $$
DECLARE
  v_audit_id text;
BEGIN
  -- Only write if no request context (API layer should handle primary audit)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW."auditLogId" IS NULL THEN
    INSERT INTO audit_log (
      actor_type, actor_id, tenant_id, entity_type, entity_id, 
      action, diff, metadata
    )
    VALUES (
      'system', 
      'db-trigger', 
      NEW."tenantId", 
      'inventory_item', 
      NEW.id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'create'
        WHEN TG_OP = 'UPDATE' THEN 'update'
      END,
      jsonb_build_object(
        'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        'new', to_jsonb(NEW),
        'hint', 'fallback-trigger'
      ),
      jsonb_build_object('table', 'InventoryItem', 'trigger', true)
    )
    RETURNING id INTO v_audit_id;
    
    NEW."auditLogId" := v_audit_id;
  END IF;
  
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_audit ON "InventoryItem";
CREATE TRIGGER trg_inventory_audit
BEFORE INSERT OR UPDATE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION audit_inventory_fallback();
