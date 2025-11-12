-- Enable RLS on all tables
-- This migration sets up Row Level Security policies for production

-- ============================================
-- DISABLE RLS FOR SERVICE ROLE (API Server)
-- ============================================
-- The API server uses the service role key which bypasses RLS
-- This is the recommended approach for server-side applications

-- ============================================
-- USERS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    
    -- Drop policy if exists
    DROP POLICY IF EXISTS "Service role has full access to users" ON users;
    
    -- Allow service role full access (API server)
    CREATE POLICY "Service role has full access to users"
    ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- ORGANIZATION TABLE (mapped from Tenant model)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization') THEN
    ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Service role has full access to organization" ON organization;
    
    CREATE POLICY "Service role has full access to organization"
    ON organization
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- USER_TENANTS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_tenants') THEN
    ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to user_tenants" ON user_tenants;
    CREATE POLICY "Service role has full access to user_tenants"
    ON user_tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- ITEMS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items') THEN
    ALTER TABLE items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to items" ON items;
    CREATE POLICY "Service role has full access to items"
    ON items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- DIRECTORY LISTINGS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'directory_listings') THEN
    ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to directory_listings" ON directory_listings;
    DROP POLICY IF EXISTS "Public can view published directory listings" ON directory_listings;
    
    CREATE POLICY "Service role has full access to directory_listings"
    ON directory_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public read access for published listings
    CREATE POLICY "Public can view published directory listings"
    ON directory_listings FOR SELECT TO anon, authenticated USING (is_published = true);
  END IF;
END $$;

-- ============================================
-- DIRECTORY SETTINGS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'directory_settings') THEN
    ALTER TABLE directory_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to directory_settings" ON directory_settings;
    CREATE POLICY "Service role has full access to directory_settings"
    ON directory_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- PLATFORM SETTINGS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_settings') THEN
    ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to platform_settings" ON platform_settings;
    DROP POLICY IF EXISTS "Public can view platform settings" ON platform_settings;
    
    CREATE POLICY "Service role has full access to platform_settings"
    ON platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    -- Public read access for platform settings
    CREATE POLICY "Public can view platform settings"
    ON platform_settings FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ============================================
-- ALL OTHER TABLES
-- ============================================
-- Enable RLS and grant service role access to all other tables

DO $$
DECLARE
    t text;
    policy_name text;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            'users', 'organization', 'user_tenants', 'items', 
            'directory_listings', 'directory_settings', 
            'platform_settings'
        )
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policy if it exists
        policy_name := 'Service role has full access to ' || t;
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);
        
        -- Create new policy
        EXECUTE format('
            CREATE POLICY %I
            ON %I
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true)
        ', policy_name, t);
    END LOOP;
END$$;
