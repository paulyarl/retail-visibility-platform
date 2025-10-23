-- v3.5 — Policy Versioning with Temporal Support (REQ-2025-802)
-- Adds history tracking and overlap prevention

-- Add temporal columns to existing policy table
ALTER TABLE sku_billing_policy
  ADD COLUMN IF NOT EXISTS effective_from timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by text;

-- History table for policy changes
CREATE TABLE IF NOT EXISTS sku_billing_policy_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scope text NOT NULL DEFAULT 'global',
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  count_active_private boolean NOT NULL,
  count_preorder boolean NOT NULL,
  count_zero_price boolean NOT NULL,
  require_image boolean NOT NULL,
  require_currency boolean NOT NULL,
  notes text,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_overlap CHECK (
    effective_to IS NULL OR effective_to > effective_from
  )
);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_policy_hist_time 
  ON sku_billing_policy_history (scope, effective_from DESC);

-- Exclusion constraint to prevent overlapping periods per scope
-- Note: Requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE sku_billing_policy_history
  ADD CONSTRAINT no_period_overlap 
  EXCLUDE USING gist (
    scope WITH =,
    tstzrange(effective_from, effective_to, '[)') WITH &&
  );

-- Trigger to archive policy changes to history
CREATE OR REPLACE FUNCTION archive_policy_change() RETURNS trigger AS $$
BEGIN
  -- Close out old policy
  IF TG_OP = 'UPDATE' THEN
    UPDATE sku_billing_policy_history
    SET effective_to = now()
    WHERE scope = OLD.scope AND effective_to IS NULL;
  END IF;
  
  -- Insert new version
  INSERT INTO sku_billing_policy_history (
    scope, effective_from, effective_to,
    count_active_private, count_preorder, count_zero_price,
    require_image, require_currency, notes, updated_by
  )
  VALUES (
    NEW.scope, NEW.effective_from, NEW.effective_to,
    NEW.count_active_private, NEW.count_preorder, NEW.count_zero_price,
    NEW.require_image, NEW.require_currency, NEW.note, NEW.updated_by
  );
  
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_policy_archive ON sku_billing_policy;
CREATE TRIGGER trg_policy_archive
AFTER INSERT OR UPDATE ON sku_billing_policy
FOR EACH ROW EXECUTE FUNCTION archive_policy_change();

-- Backfill existing policy to history
INSERT INTO sku_billing_policy_history (
  scope, effective_from, count_active_private, count_preorder,
  count_zero_price, require_image, require_currency, updated_by
)
SELECT 
  scope, 
  COALESCE(effective_from, created_at, now()),
  count_active_private, 
  count_preorder,
  count_zero_price, 
  require_image, 
  require_currency,
  COALESCE(updated_by, 'system-backfill')
FROM sku_billing_policy
WHERE scope = 'global'
ON CONFLICT DO NOTHING;
