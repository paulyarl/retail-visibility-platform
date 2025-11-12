-- Minimal RLS setup - Only core tables that definitely exist
-- Run this to secure the most critical tables

-- ============================================
-- USERS TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to users" ON users;
    CREATE POLICY "Service role has full access to users"
    ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
    RAISE NOTICE 'RLS enabled on users table';
  ELSE
    RAISE NOTICE 'users table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- ORGANIZATION TABLE
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization') THEN
    ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role has full access to organization" ON organization;
    CREATE POLICY "Service role has full access to organization"
    ON organization FOR ALL TO service_role USING (true) WITH CHECK (true);
    RAISE NOTICE 'RLS enabled on organization table';
  ELSE
    RAISE NOTICE 'organization table does not exist, skipping';
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
    RAISE NOTICE 'RLS enabled on user_tenants table';
  ELSE
    RAISE NOTICE 'user_tenants table does not exist, skipping';
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
    
    CREATE POLICY "Public can view platform settings"
    ON platform_settings FOR SELECT TO anon, authenticated USING (true);
    
    RAISE NOTICE 'RLS enabled on platform_settings table';
  ELSE
    RAISE NOTICE 'platform_settings table does not exist, skipping';
  END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('users', 'organization', 'user_tenants', 'platform_settings');
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RLS Setup Complete!';
  RAISE NOTICE 'Processed % critical tables', table_count;
  RAISE NOTICE 'Your API service role has full access';
  RAISE NOTICE '============================================';
END $$;
