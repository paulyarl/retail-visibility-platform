-- Create the missing directory_listings table
-- This table aggregates data from tenant and tenant_business_profile for the public directory

CREATE TABLE IF NOT EXISTS directory_listings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    business_name TEXT,
    slug TEXT UNIQUE,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    primary_category TEXT,
    secondary_categories TEXT[],
    logo_url TEXT,
    description TEXT,
    rating_avg DOUBLE PRECISION DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    product_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'trial',
    use_custom_website BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_directory_listings_tenant_id ON directory_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_directory_listings_slug ON directory_listings(slug);
CREATE INDEX IF NOT EXISTS idx_directory_listings_city ON directory_listings(city);
CREATE INDEX IF NOT EXISTS idx_directory_listings_state ON directory_listings(state);
CREATE INDEX IF NOT EXISTS idx_directory_listings_is_published ON directory_listings(is_published);
CREATE INDEX IF NOT EXISTS idx_directory_listings_primary_category ON directory_listings(primary_category);
CREATE INDEX IF NOT EXISTS idx_directory_listings_is_featured ON directory_listings(is_featured);

-- Check what tables exist and debug
DO $$
DECLARE
    tenant_table_exists BOOLEAN := FALSE;
    profile_table_exists BOOLEAN := FALSE;
    inventory_table_exists BOOLEAN := FALSE;
BEGIN
    -- Check for tenant table (could be 'tenant' or 'Tenant')
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('tenant', 'Tenant')
    ) INTO tenant_table_exists;

    -- Check for business profile table
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('tenant_business_profile', 'TenantBusinessProfile')
    ) INTO profile_table_exists;

    -- Check for inventory table
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('inventory_item', 'InventoryItem')
    ) INTO inventory_table_exists;

    RAISE NOTICE 'Table existence check:';
    RAISE NOTICE '  tenant table exists: %', tenant_table_exists;
    RAISE NOTICE '  tenant_business_profile exists: %', profile_table_exists;
    RAISE NOTICE '  inventory_item exists: %', inventory_table_exists;

    IF NOT tenant_table_exists THEN
        RAISE EXCEPTION 'Tenant table does not exist. Please run Prisma migrations first.';
    END IF;
END $$;

-- Populate the table with existing tenant data (using actual table names)
DO $$
DECLARE
    tenant_table_name TEXT;
    profile_table_name TEXT;
    inventory_table_name TEXT;
BEGIN
    -- Find the actual table names (handle case sensitivity)
    SELECT table_name INTO tenant_table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('tenant', 'Tenant')
    LIMIT 1;

    SELECT table_name INTO profile_table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('tenant_business_profile', 'TenantBusinessProfile')
    LIMIT 1;

    SELECT table_name INTO inventory_table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('inventory_item', 'InventoryItem')
    LIMIT 1;

    RAISE NOTICE 'Using table names: %, %, %', tenant_table_name, profile_table_name, inventory_table_name;

    -- Insert data using dynamic table names
    EXECUTE format('
        INSERT INTO directory_listings (
            id,
            tenant_id,
            business_name,
            slug,
            address,
            city,
            state,
            zip_code,
            phone,
            email,
            website,
            latitude,
            longitude,
            logo_url,
            subscription_tier,
            use_custom_website
        )
        SELECT
            t.id,
            t.id as tenant_id,
            COALESCE(p.business_name, t.name) as business_name,
            LOWER(REPLACE(COALESCE(p.business_name, t.name), '' '', ''-'')) || ''-'' || t.id as slug,
            COALESCE(p.address_line1, '''') as address,
            p.city,
            p.state,
            p.postal_code as zip_code,
            p.phone_number as phone,
            p.email,
            p.website,
            p.latitude,
            p.longitude,
            p.logo_url,
            COALESCE(t."subscriptionTier", ''trial'') as subscription_tier,
            false as use_custom_website
        FROM %I t
        LEFT JOIN %I p ON t.id = p.tenant_id
        WHERE t.id NOT IN (SELECT tenant_id FROM directory_listings)
        ON CONFLICT (id) DO NOTHING
    ', tenant_table_name, COALESCE(profile_table_name, tenant_table_name || '_business_profile'));

    -- Update product counts if inventory table exists
    IF inventory_table_name IS NOT NULL THEN
        EXECUTE format('
            UPDATE directory_listings
            SET product_count = (
                SELECT COUNT(*)
                FROM %I ii
                WHERE ii."tenantId" = directory_listings.tenant_id
                AND ii."itemStatus" = ''active''
                AND ii.visibility = ''public''
            )
        ', inventory_table_name);
    END IF;

    RAISE NOTICE 'Directory listings populated successfully';
END $$;

-- Enable RLS on the directory_listings table
ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to directory_listings" ON directory_listings;
DROP POLICY IF EXISTS "Public can view published directory listings" ON directory_listings;

-- Service role full access (API server)
CREATE POLICY "Service role has full access to directory_listings"
ON directory_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public can view published listings (anonymous + authenticated users)
CREATE POLICY "Public can view published directory listings"
ON directory_listings FOR SELECT TO anon, authenticated USING (is_published = true);

-- Create function to refresh directory listings (call this periodically or after tenant updates)
CREATE OR REPLACE FUNCTION refresh_directory_listings()
RETURNS void AS $$
DECLARE
    tenant_table_name TEXT := 'Tenant';
    profile_table_name TEXT := 'tenant_business_profile';
    inventory_table_name TEXT := 'inventory_item';
BEGIN
    -- Insert new tenants - use dynamic table names
    EXECUTE format('
        INSERT INTO directory_listings (
            id,
            tenant_id,
            business_name,
            slug,
            address,
            city,
            state,
            zip_code,
            phone,
            email,
            website,
            latitude,
            longitude,
            logo_url,
            subscription_tier,
            use_custom_website
        )
        SELECT
            t.id,
            t.id as tenant_id,
            COALESCE(p.business_name, t.name) as business_name,
            LOWER(REPLACE(COALESCE(p.business_name, t.name), '' '', ''-'')) || ''-'' || t.id as slug,
            COALESCE(p.address_line1, '''') as address,
            p.city,
            p.state,
            p.postal_code as zip_code,
            p.phone_number as phone,
            p.email,
            p.website,
            p.latitude,
            p.longitude,
            p.logo_url,
            COALESCE(t."subscriptionTier", ''trial'') as subscription_tier,
            false as use_custom_website
        FROM %I t
        LEFT JOIN %I p ON t.id = p.tenant_id
        WHERE t.id NOT IN (SELECT tenant_id FROM directory_listings)
        ON CONFLICT (id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            slug = EXCLUDED.slug,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip_code = EXCLUDED.zip_code,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            website = EXCLUDED.website,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            logo_url = EXCLUDED.logo_url,
            subscription_tier = EXCLUDED.subscription_tier,
            updated_at = NOW()
    ', tenant_table_name, profile_table_name);

    -- Update product counts for all listings
    EXECUTE format('
        UPDATE directory_listings
        SET product_count = (
            SELECT COUNT(*)
            FROM %I ii
            WHERE ii."tenantId" = directory_listings.tenant_id
            AND ii."itemStatus" = ''active''
            AND ii.visibility = ''public''
        )
    ', inventory_table_name);

    RAISE NOTICE 'Directory listings refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Run initial refresh
SELECT refresh_directory_listings();

-- Grant necessary permissions
GRANT SELECT ON directory_listings TO anon;
GRANT SELECT ON directory_listings TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Directory listings table created and populated successfully';
END $$;
