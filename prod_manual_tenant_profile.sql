BEGIN;

-- 1) Add 'id' column if missing and backfill from tenant_id
ALTER TABLE tenant_business_profile
  ADD COLUMN IF NOT EXISTS id TEXT;
UPDATE tenant_business_profile
  SET id = tenant_id
WHERE id IS NULL;

-- 2) Ensure unique on tenant_id (preserve one profile per tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'tenant_business_profile_tenant_id_key'
  ) THEN
    CREATE UNIQUE INDEX tenant_business_profile_tenant_id_key
      ON tenant_business_profile(tenant_id);
  END IF;
END$$;

-- 3) Switch primary key to 'id'
DO $$
DECLARE pk_name TEXT;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = 'tenant_business_profile'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tenant_business_profile DROP CONSTRAINT %I', pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tenant_business_profile'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE tenant_business_profile
      ALTER COLUMN id SET NOT NULL,
      ADD CONSTRAINT tenant_business_profile_pkey PRIMARY KEY (id);
  END IF;
END$$;

-- 4) Align columns to be non-breaking (timestamps, nullability)
ALTER TABLE tenant_business_profile
  ALTER COLUMN updated_at DROP NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

ALTER TABLE tenant_business_profile
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE tenant_business_profile
  ALTER COLUMN display_map DROP NOT NULL,
  ALTER COLUMN map_privacy_mode DROP NOT NULL;

COMMIT;
