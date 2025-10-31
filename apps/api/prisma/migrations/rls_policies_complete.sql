-- ============================================================================
-- Row Level Security (RLS) Policies - Complete Implementation
-- ============================================================================
-- Purpose: Enforce multi-tenant data isolation at the database level
-- Status: Production-ready
-- Date: October 31, 2025
-- ============================================================================

-- Note: RLS is already ENABLED on all tables
-- This script creates the policies for tenant isolation

-- ============================================================================
-- TENANT TABLE POLICIES
-- ============================================================================

-- Users can view tenants they belong to
CREATE POLICY "users_view_own_tenants"
ON "Tenant"
FOR SELECT
USING (
  id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update their own tenants
CREATE POLICY "users_update_own_tenants"
ON "Tenant"
FOR UPDATE
USING (
  id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can create tenants (new signup)
CREATE POLICY "users_create_tenants"
ON "Tenant"
FOR INSERT
WITH CHECK (true);  -- Allow creation, user_tenants link created separately

-- Users can delete their own tenants (if they're the owner)
CREATE POLICY "owners_delete_tenants"
ON "Tenant"
FOR DELETE
USING (
  id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- ============================================================================
-- INVENTORY ITEM TABLE POLICIES
-- ============================================================================

-- Users can view items from their tenants
CREATE POLICY "users_view_tenant_items"
ON "InventoryItem"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert items to their tenants
CREATE POLICY "users_insert_tenant_items"
ON "InventoryItem"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update items from their tenants
CREATE POLICY "users_update_tenant_items"
ON "InventoryItem"
FOR UPDATE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete items from their tenants
CREATE POLICY "users_delete_tenant_items"
ON "InventoryItem"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- PHOTO ASSET TABLE POLICIES
-- ============================================================================

-- Users can view photos from their tenants
CREATE POLICY "users_view_tenant_photos"
ON "PhotoAsset"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert photos to their tenants
CREATE POLICY "users_insert_tenant_photos"
ON "PhotoAsset"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update photos from their tenants
CREATE POLICY "users_update_tenant_photos"
ON "PhotoAsset"
FOR UPDATE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete photos from their tenants
CREATE POLICY "users_delete_tenant_photos"
ON "PhotoAsset"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- PRODUCT PERFORMANCE TABLE POLICIES
-- ============================================================================

-- Users can view performance data from their tenants
CREATE POLICY "users_view_tenant_performance"
ON "ProductPerformance"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert performance data to their tenants
CREATE POLICY "users_insert_tenant_performance"
ON "ProductPerformance"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update performance data from their tenants
CREATE POLICY "users_update_tenant_performance"
ON "ProductPerformance"
FOR UPDATE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete performance data from their tenants
CREATE POLICY "users_delete_tenant_performance"
ON "ProductPerformance"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- SYNC JOB TABLE POLICIES
-- ============================================================================

-- Users can view sync jobs from their tenants
CREATE POLICY "users_view_tenant_sync_jobs"
ON "SyncJob"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert sync jobs to their tenants
CREATE POLICY "users_insert_tenant_sync_jobs"
ON "SyncJob"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update sync jobs from their tenants
CREATE POLICY "users_update_tenant_sync_jobs"
ON "SyncJob"
FOR UPDATE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete sync jobs from their tenants
CREATE POLICY "users_delete_tenant_sync_jobs"
ON "SyncJob"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- TENANT BUSINESS PROFILE TABLE POLICIES
-- ============================================================================

-- Users can view business profiles from their tenants
CREATE POLICY "users_view_tenant_business_profiles"
ON tenant_business_profile
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert business profiles to their tenants
CREATE POLICY "users_insert_tenant_business_profiles"
ON tenant_business_profile
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update business profiles from their tenants
CREATE POLICY "users_update_tenant_business_profiles"
ON tenant_business_profile
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete business profiles from their tenants
CREATE POLICY "users_delete_tenant_business_profiles"
ON tenant_business_profile
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- GOOGLE OAUTH ACCOUNTS TABLE POLICIES
-- ============================================================================

-- Users can view Google OAuth accounts from their tenants
CREATE POLICY "users_view_tenant_google_oauth"
ON google_oauth_accounts
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert Google OAuth accounts to their tenants
CREATE POLICY "users_insert_tenant_google_oauth"
ON google_oauth_accounts
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update Google OAuth accounts from their tenants
CREATE POLICY "users_update_tenant_google_oauth"
ON google_oauth_accounts
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete Google OAuth accounts from their tenants
CREATE POLICY "users_delete_tenant_google_oauth"
ON google_oauth_accounts
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- ORGANIZATION TABLE POLICIES
-- ============================================================================

-- Users can view organizations they belong to (through their tenants)
CREATE POLICY "users_view_own_organizations"
ON organization
FOR SELECT
USING (
  id IN (
    SELECT "organizationId" 
    FROM "Tenant" 
    WHERE id IN (
      SELECT tenant_id 
      FROM user_tenants 
      WHERE user_id = auth.uid()
    )
  )
);

-- Only organization owners can update
CREATE POLICY "owners_update_organizations"
ON organization
FOR UPDATE
USING ("ownerId" = auth.uid());

-- Only organization owners can delete
CREATE POLICY "owners_delete_organizations"
ON organization
FOR DELETE
USING ("ownerId" = auth.uid());

-- Users can create organizations
CREATE POLICY "users_create_organizations"
ON organization
FOR INSERT
WITH CHECK ("ownerId" = auth.uid());

-- ============================================================================
-- ORGANIZATION REQUESTS TABLE POLICIES
-- ============================================================================

-- Users can view organization requests for their tenants
CREATE POLICY "users_view_tenant_org_requests"
ON organization_requests
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can create organization requests for their tenants
CREATE POLICY "users_create_tenant_org_requests"
ON organization_requests
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can update organization requests for their tenants
CREATE POLICY "users_update_tenant_org_requests"
ON organization_requests
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete organization requests for their tenants
CREATE POLICY "users_delete_tenant_org_requests"
ON organization_requests
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- USER TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "users_view_own_profile"
ON users
FOR SELECT
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON users
FOR UPDATE
USING (id = auth.uid());

-- Admins can view all users
CREATE POLICY "admins_view_all_users"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- Allow user creation (signup)
CREATE POLICY "allow_user_creation"
ON users
FOR INSERT
WITH CHECK (true);  -- Supabase Auth handles validation

-- ============================================================================
-- USER TENANTS TABLE POLICIES (Junction Table)
-- ============================================================================

-- Users can view their own tenant memberships
CREATE POLICY "users_view_own_memberships"
ON user_tenants
FOR SELECT
USING (user_id = auth.uid());

-- Tenant owners can view all memberships for their tenants
CREATE POLICY "owners_view_tenant_memberships"
ON user_tenants
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Tenant owners can add members to their tenants
CREATE POLICY "owners_add_tenant_members"
ON user_tenants
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Tenant owners can update member roles
CREATE POLICY "owners_update_member_roles"
ON user_tenants
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Tenant owners can remove members
CREATE POLICY "owners_remove_members"
ON user_tenants
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_tenants 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Users can remove themselves from tenants
CREATE POLICY "users_leave_tenants"
ON user_tenants
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- PLATFORM SETTINGS TABLE POLICIES (Admin Only)
-- ============================================================================

-- Only admins can view platform settings
CREATE POLICY "admins_view_platform_settings"
ON platform_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- Only admins can update platform settings
CREATE POLICY "admins_update_platform_settings"
ON platform_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- Only admins can insert platform settings
CREATE POLICY "admins_insert_platform_settings"
ON platform_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- Only admins can delete platform settings
CREATE POLICY "admins_delete_platform_settings"
ON platform_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify policies are working correctly

-- Check all policies created
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check RLS is enabled on all tables
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND rowsecurity = true;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Service role key bypasses ALL RLS policies (used by Railway API)
-- 2. These policies only apply when using anon key or user JWT
-- 3. All policies use auth.uid() which comes from Supabase Auth JWT
-- 4. Policies are permissive (OR logic) - if any policy allows, access granted
-- 5. Test thoroughly before relying on RLS for security

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- If you need to remove all policies:
-- 
-- DROP POLICY IF EXISTS "users_view_own_tenants" ON "Tenant";
-- DROP POLICY IF EXISTS "users_update_own_tenants" ON "Tenant";
-- ... (drop all policies)
--
-- Or disable RLS entirely:
-- ALTER TABLE "Tenant" DISABLE ROW LEVEL SECURITY;
-- ... (for all tables)

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================
