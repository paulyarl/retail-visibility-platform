-- Simple RLS setup - Core tables only
-- Run this first, then enable RLS on other tables as needed

-- ============================================
-- USERS TABLE
-- ============================================
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
CREATE POLICY "Service role has full access to users"
ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- ORGANIZATION TABLE
-- ============================================
ALTER TABLE IF EXISTS organization ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to organization" ON organization;
CREATE POLICY "Service role has full access to organization"
ON organization FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- USER_TENANTS TABLE
-- ============================================
ALTER TABLE IF EXISTS user_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to user_tenants" ON user_tenants;
CREATE POLICY "Service role has full access to user_tenants"
ON user_tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- ITEMS TABLE
-- ============================================
ALTER TABLE IF EXISTS items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to items" ON items;
CREATE POLICY "Service role has full access to items"
ON items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- DIRECTORY LISTINGS TABLE
-- ============================================
ALTER TABLE IF EXISTS directory_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to directory_listings" ON directory_listings;
DROP POLICY IF EXISTS "Public can view published directory listings" ON directory_listings;

CREATE POLICY "Service role has full access to directory_listings"
ON directory_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can view published directory listings"
ON directory_listings FOR SELECT TO anon, authenticated USING (is_published = true);

-- ============================================
-- DIRECTORY SETTINGS TABLE
-- ============================================
ALTER TABLE IF EXISTS directory_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to directory_settings" ON directory_settings;
CREATE POLICY "Service role has full access to directory_settings"
ON directory_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- PLATFORM SETTINGS TABLE
-- ============================================
ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "Public can view platform settings" ON platform_settings;

CREATE POLICY "Service role has full access to platform_settings"
ON platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can view platform settings"
ON platform_settings FOR SELECT TO anon, authenticated USING (true);
