-- Add SUPPORT role to UserTenantRole enum
-- This role is for support staff at large organizations who need operational access
-- but should not be able to delete tenants or items

-- Add the new enum value
ALTER TYPE "user_tenant_role" ADD VALUE IF NOT EXISTS 'SUPPORT';

-- Note: Existing ADMIN roles will remain as ADMIN
-- SUPPORT is a new role for organizations that want to distinguish between:
-- - ADMIN: Full operational control (can manage everything except billing)
-- - SUPPORT: Support operations (can view, edit, change status/visibility, but cannot delete)
