-- Add PLATFORM_ADMIN to UserRole enum
-- This makes the platform admin role explicit and removes ambiguity

-- AlterEnum: Add PLATFORM_ADMIN to user_role enum
ALTER TYPE "user_role" ADD VALUE 'PLATFORM_ADMIN';

-- Note: ADMIN is kept for backward compatibility but should be migrated to PLATFORM_ADMIN
-- Existing ADMIN users should be updated to PLATFORM_ADMIN in a separate data migration
