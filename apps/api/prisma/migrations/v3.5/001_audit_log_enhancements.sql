-- v3.5 — Audit Log Enhancements (REQ-2025-801)
-- Builds on existing audit_log structure from v3.4.1

-- Add audit_log table if not exists (idempotent)
CREATE TABLE IF NOT EXISTS audit_log (
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

-- Indexes for fast queries
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

-- Optional: Defense-in-depth trigger (fallback if API layer misses)
CREATE OR REPLACE FUNCTION audit_inventory_fallback() RETURNS trigger AS $$
BEGIN
  -- Only write if no request context (API layer should handle primary audit)
  IF NEW."auditLogId" IS NULL THEN
    INSERT INTO audit_log (
      actor_type, actor_id, tenant_id, entity_type, entity_id, 
      action, diff, metadata
    )
    VALUES (
      'system', 
      'db-trigger', 
      COALESCE(NEW."tenantId", OLD."tenantId"), 
      'inventory_item', 
      COALESCE(NEW.id, OLD.id),
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'create'
        WHEN TG_OP = 'UPDATE' THEN 'update'
        WHEN TG_OP = 'DELETE' THEN 'delete'
      END,
      jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW),
        'hint', 'fallback-trigger'
      ),
      jsonb_build_object('table', 'InventoryItem', 'trigger', true)
    )
    RETURNING id INTO NEW."auditLogId";
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_audit ON "InventoryItem";
CREATE TRIGGER trg_inventory_audit
BEFORE INSERT OR UPDATE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION audit_inventory_fallback();
