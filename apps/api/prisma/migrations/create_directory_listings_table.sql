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

-- Populate the table with existing tenant data
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
    primary_category,
    logo_url,
    subscription_tier,
    use_custom_website
)
SELECT
    t.id,
    t.id as tenant_id,
    COALESCE(tbp.business_name, t.name) as business_name,
    LOWER(REPLACE(COALESCE(tbp.business_name, t.name), ' ', '-')) || '-' || t.id as slug,
    COALESCE(tbp.address_line1, '') as address,
    tbp.city,
    tbp.state,
    tbp.postal_code as zip_code,
    tbp.phone_number as phone,
    tbp.email,
    tbp.website,
    tbp.latitude,
    tbp.longitude,
    NULL as primary_category, -- Will be populated separately if categories exist
    tbp.logo_url,
    COALESCE(t.subscription_tier, 'trial') as subscription_tier,
    false as use_custom_website
FROM tenant t
LEFT JOIN tenant_business_profile tbp ON t.id = tbp.tenant_id
WHERE t.id NOT IN (SELECT tenant_id FROM directory_listings)
ON CONFLICT (id) DO NOTHING;

-- Update product counts
UPDATE directory_listings
SET product_count = (
    SELECT COUNT(*)
    FROM inventory_item ii
    WHERE ii.tenant_id = directory_listings.tenant_id
    AND ii.item_status = 'active'
    AND ii.visibility = 'public'
);

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
BEGIN
    -- Insert new tenants
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
        COALESCE(tbp.business_name, t.name) as business_name,
        LOWER(REPLACE(COALESCE(tbp.business_name, t.name), ' ', '-')) || '-' || t.id as slug,
        COALESCE(tbp.address_line1, '') as address,
        tbp.city,
        tbp.state,
        tbp.postal_code as zip_code,
        tbp.phone_number as phone,
        tbp.email,
        tbp.website,
        tbp.latitude,
        tbp.longitude,
        tbp.logo_url,
        COALESCE(t.subscription_tier, 'trial') as subscription_tier,
        false as use_custom_website
    FROM tenant t
    LEFT JOIN tenant_business_profile tbp ON t.id = tbp.tenant_id
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
        updated_at = NOW();

    -- Update product counts for all listings
    UPDATE directory_listings
    SET product_count = (
        SELECT COUNT(*)
        FROM inventory_item ii
        WHERE ii.tenant_id = directory_listings.tenant_id
        AND ii.item_status = 'active'
        AND ii.visibility = 'public'
    );

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
