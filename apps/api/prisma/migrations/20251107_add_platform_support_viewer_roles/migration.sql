-- Add PLATFORM_SUPPORT and PLATFORM_VIEWER roles to UserRole enum
-- This closes the gap for platform-level users who need access across all tenants
-- but don't need full admin privileges

-- AlterEnum: Add PLATFORM_SUPPORT and PLATFORM_VIEWER to user_role enum
ALTER TYPE "user_role" ADD VALUE 'PLATFORM_SUPPORT';
ALTER TYPE "user_role" ADD VALUE 'PLATFORM_VIEWER';

-- Note: These roles provide different levels of platform-wide access:
-- PLATFORM_ADMIN: Full control (create, update, delete)
-- PLATFORM_SUPPORT: View all + limited actions (password resets, unlock accounts)
-- PLATFORM_VIEWER: Read-only access (analytics, sales, legal, compliance)
