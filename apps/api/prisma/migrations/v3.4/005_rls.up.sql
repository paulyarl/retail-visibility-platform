-- Enable Row Level Security (adapt if not using Supabase Auth)
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy using auth.uid() (Supabase). If not using Supabase, replace with your auth context.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auth') THEN
    -- Drop and recreate to be idempotent
    DROP POLICY IF EXISTS inventory_item_tenant_isolation ON "InventoryItem";
    CREATE POLICY inventory_item_tenant_isolation ON "InventoryItem"
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());
  END IF;
END $$;
