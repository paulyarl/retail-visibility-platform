-- Add is_private flag to bsaas_catalog for private features
-- Private features are not visible in the merchant Feature Store but can be granted via admin

DO $$
BEGIN
    -- Add is_private column with default false
    ALTER TABLE bsaas_catalog
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false NOT NULL;

    -- Add comment
    COMMENT ON COLUMN bsaas_catalog.is_private IS 'Private features are not visible in the merchant Feature Store but can be granted via admin Grant Access modal';

EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'Column is_private already exists in bsaas_catalog';
END $$;

-- Add index for filtering private features in queries
CREATE INDEX IF NOT EXISTS idx_bsaas_catalog_is_private ON bsaas_catalog(is_private);
