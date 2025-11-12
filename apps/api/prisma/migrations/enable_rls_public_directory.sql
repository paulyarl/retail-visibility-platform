-- Add public access policies for directory features
-- Run this AFTER enable_rls_minimal.sql

-- ============================================
-- DIRECTORY_LISTINGS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'directory_listings') THEN
    -- Enable RLS
    ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to directory_listings" ON directory_listings;
    DROP POLICY IF EXISTS "Public can view published directory listings" ON directory_listings;
    
    -- Service role full access (API server)
    CREATE POLICY "Service role has full access to directory_listings"
    ON directory_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view published listings (anonymous + authenticated users)
    CREATE POLICY "Public can view published directory listings"
    ON directory_listings FOR SELECT TO anon, authenticated USING (is_published = true);
    
    RAISE NOTICE 'RLS enabled on directory_listings table with public read access';
  ELSE
    RAISE NOTICE 'directory_listings table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- DIRECTORY_SETTINGS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'directory_settings') THEN
    -- Enable RLS
    ALTER TABLE directory_settings ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to directory_settings" ON directory_settings;
    DROP POLICY IF EXISTS "Public can view directory settings" ON directory_settings;
    
    -- Service role full access
    CREATE POLICY "Service role has full access to directory_settings"
    ON directory_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view settings (for SEO, etc.)
    CREATE POLICY "Public can view directory settings"
    ON directory_settings FOR SELECT TO anon, authenticated USING (true);
    
    RAISE NOTICE 'RLS enabled on directory_settings table with public read access';
  ELSE
    RAISE NOTICE 'directory_settings table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- TENANT TABLE (for directory locations)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant') THEN
    -- Enable RLS
    ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to tenant" ON tenant;
    DROP POLICY IF EXISTS "Public can view active tenants" ON tenant;
    
    -- Service role full access
    CREATE POLICY "Service role has full access to tenant"
    ON tenant FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view active tenants (for directory)
    CREATE POLICY "Public can view active tenants"
    ON tenant FOR SELECT TO anon, authenticated USING (is_active = true);
    
    RAISE NOTICE 'RLS enabled on tenant table with public read access';
  ELSE
    RAISE NOTICE 'tenant table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- INVENTORY_ITEM TABLE (for storefront products)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_item') THEN
    -- Enable RLS
    ALTER TABLE inventory_item ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to inventory_item" ON inventory_item;
    DROP POLICY IF EXISTS "Public can view active public items" ON inventory_item;
    
    -- Service role full access
    CREATE POLICY "Service role has full access to inventory_item"
    ON inventory_item FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view active, public items (for storefront)
    CREATE POLICY "Public can view active public items"
    ON inventory_item FOR SELECT TO anon, authenticated 
    USING (item_status = 'active' AND visibility = 'public');
    
    RAISE NOTICE 'RLS enabled on inventory_item table with public read access';
  ELSE
    RAISE NOTICE 'inventory_item table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- TENANT_CATEGORY TABLE (for product categories)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_category') THEN
    -- Enable RLS
    ALTER TABLE tenant_category ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to tenant_category" ON tenant_category;
    DROP POLICY IF EXISTS "Public can view categories" ON tenant_category;
    
    -- Service role full access
    CREATE POLICY "Service role has full access to tenant_category"
    ON tenant_category FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view all categories (for storefront navigation)
    CREATE POLICY "Public can view categories"
    ON tenant_category FOR SELECT TO anon, authenticated USING (true);
    
    RAISE NOTICE 'RLS enabled on tenant_category table with public read access';
  ELSE
    RAISE NOTICE 'tenant_category table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- TENANT_BUSINESS_PROFILE TABLE (for storefront info)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_business_profile') THEN
    -- Enable RLS
    ALTER TABLE tenant_business_profile ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Service role has full access to tenant_business_profile" ON tenant_business_profile;
    DROP POLICY IF EXISTS "Public can view business profiles" ON tenant_business_profile;
    
    -- Service role full access
    CREATE POLICY "Service role has full access to tenant_business_profile"
    ON tenant_business_profile FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public can view all business profiles (for storefront)
    CREATE POLICY "Public can view business profiles"
    ON tenant_business_profile FOR SELECT TO anon, authenticated USING (true);
    
    RAISE NOTICE 'RLS enabled on tenant_business_profile table with public read access';
  ELSE
    RAISE NOTICE 'tenant_business_profile table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Public Directory & Storefront RLS Policies Added!';
  RAISE NOTICE 'Anonymous users can now:';
  RAISE NOTICE '  - View published directory listings';
  RAISE NOTICE '  - View directory settings';
  RAISE NOTICE '  - View active tenants';
  RAISE NOTICE '  - View storefront products (active + public)';
  RAISE NOTICE '  - View product categories';
  RAISE NOTICE '  - View business profiles';
  RAISE NOTICE 'Service role still has full access';
  RAISE NOTICE '============================================';
END $$;
