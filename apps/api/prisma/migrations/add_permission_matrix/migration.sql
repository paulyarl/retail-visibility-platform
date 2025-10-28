-- Permission Matrix System
-- Allows platform admins to configure role-based permissions dynamically

-- Permission actions enum
CREATE TYPE permission_action AS ENUM (
  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.delete',
  'tenant.manage_users',
  'inventory.create',
  'inventory.read',
  'inventory.update',
  'inventory.delete',
  'analytics.view',
  'admin.access_dashboard',
  'admin.manage_settings'
);

-- Permission matrix table
CREATE TABLE IF NOT EXISTS permission_matrix (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role TEXT NOT NULL, -- 'PLATFORM_ADMIN', 'TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MEMBER', 'TENANT_VIEWER'
  action permission_action NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(role, action)
);

-- Create index for faster lookups
CREATE INDEX idx_permission_matrix_role ON permission_matrix(role);
CREATE INDEX idx_permission_matrix_action ON permission_matrix(action);

-- Seed default permissions
INSERT INTO permission_matrix (role, action, allowed, description) VALUES
  -- Platform Admin (all permissions)
  ('PLATFORM_ADMIN', 'tenant.create', true, 'Create unlimited tenants'),
  ('PLATFORM_ADMIN', 'tenant.read', true, 'View all tenants'),
  ('PLATFORM_ADMIN', 'tenant.update', true, 'Update any tenant'),
  ('PLATFORM_ADMIN', 'tenant.delete', true, 'Delete any tenant'),
  ('PLATFORM_ADMIN', 'tenant.manage_users', true, 'Manage users for any tenant'),
  ('PLATFORM_ADMIN', 'inventory.create', true, 'Create items in any tenant'),
  ('PLATFORM_ADMIN', 'inventory.read', true, 'View items in any tenant'),
  ('PLATFORM_ADMIN', 'inventory.update', true, 'Update items in any tenant'),
  ('PLATFORM_ADMIN', 'inventory.delete', true, 'Delete items in any tenant'),
  ('PLATFORM_ADMIN', 'analytics.view', true, 'View analytics for any tenant'),
  ('PLATFORM_ADMIN', 'admin.access_dashboard', true, 'Access admin dashboard'),
  ('PLATFORM_ADMIN', 'admin.manage_settings', true, 'Manage platform settings'),
  
  -- Tenant Owner
  ('TENANT_OWNER', 'tenant.create', true, 'Create tenants (with tier limits)'),
  ('TENANT_OWNER', 'tenant.read', true, 'View own tenants'),
  ('TENANT_OWNER', 'tenant.update', true, 'Update own tenants'),
  ('TENANT_OWNER', 'tenant.delete', true, 'Delete own tenants'),
  ('TENANT_OWNER', 'tenant.manage_users', true, 'Manage users in own tenants'),
  ('TENANT_OWNER', 'inventory.create', true, 'Create items'),
  ('TENANT_OWNER', 'inventory.read', true, 'View items'),
  ('TENANT_OWNER', 'inventory.update', true, 'Update items'),
  ('TENANT_OWNER', 'inventory.delete', true, 'Delete items'),
  ('TENANT_OWNER', 'analytics.view', true, 'View analytics'),
  ('TENANT_OWNER', 'admin.access_dashboard', true, 'Access tenant admin dashboard'),
  ('TENANT_OWNER', 'admin.manage_settings', false, 'Cannot manage platform settings'),
  
  -- Tenant Admin
  ('TENANT_ADMIN', 'tenant.create', false, 'Cannot create tenants'),
  ('TENANT_ADMIN', 'tenant.read', true, 'View assigned tenants'),
  ('TENANT_ADMIN', 'tenant.update', true, 'Update assigned tenants'),
  ('TENANT_ADMIN', 'tenant.delete', false, 'Cannot delete tenants'),
  ('TENANT_ADMIN', 'tenant.manage_users', true, 'Manage users in assigned tenants'),
  ('TENANT_ADMIN', 'inventory.create', true, 'Create items'),
  ('TENANT_ADMIN', 'inventory.read', true, 'View items'),
  ('TENANT_ADMIN', 'inventory.update', true, 'Update items'),
  ('TENANT_ADMIN', 'inventory.delete', true, 'Delete items'),
  ('TENANT_ADMIN', 'analytics.view', true, 'View analytics'),
  ('TENANT_ADMIN', 'admin.access_dashboard', true, 'Access tenant admin dashboard'),
  ('TENANT_ADMIN', 'admin.manage_settings', false, 'Cannot manage platform settings'),
  
  -- Tenant Member
  ('TENANT_MEMBER', 'tenant.create', false, 'Cannot create tenants'),
  ('TENANT_MEMBER', 'tenant.read', true, 'View assigned tenants'),
  ('TENANT_MEMBER', 'tenant.update', false, 'Cannot update tenants'),
  ('TENANT_MEMBER', 'tenant.delete', false, 'Cannot delete tenants'),
  ('TENANT_MEMBER', 'tenant.manage_users', false, 'Cannot manage users'),
  ('TENANT_MEMBER', 'inventory.create', true, 'Create items'),
  ('TENANT_MEMBER', 'inventory.read', true, 'View items'),
  ('TENANT_MEMBER', 'inventory.update', true, 'Update items'),
  ('TENANT_MEMBER', 'inventory.delete', false, 'Cannot delete items'),
  ('TENANT_MEMBER', 'analytics.view', true, 'View analytics'),
  ('TENANT_MEMBER', 'admin.access_dashboard', false, 'Cannot access admin dashboard'),
  ('TENANT_MEMBER', 'admin.manage_settings', false, 'Cannot manage platform settings'),
  
  -- Tenant Viewer
  ('TENANT_VIEWER', 'tenant.create', false, 'Cannot create tenants'),
  ('TENANT_VIEWER', 'tenant.read', true, 'View assigned tenants'),
  ('TENANT_VIEWER', 'tenant.update', false, 'Cannot update tenants'),
  ('TENANT_VIEWER', 'tenant.delete', false, 'Cannot delete tenants'),
  ('TENANT_VIEWER', 'tenant.manage_users', false, 'Cannot manage users'),
  ('TENANT_VIEWER', 'inventory.create', false, 'Cannot create items'),
  ('TENANT_VIEWER', 'inventory.read', true, 'View items'),
  ('TENANT_VIEWER', 'inventory.update', false, 'Cannot update items'),
  ('TENANT_VIEWER', 'inventory.delete', false, 'Cannot delete items'),
  ('TENANT_VIEWER', 'analytics.view', true, 'View analytics'),
  ('TENANT_VIEWER', 'admin.access_dashboard', false, 'Cannot access admin dashboard'),
  ('TENANT_VIEWER', 'admin.manage_settings', false, 'Cannot manage platform settings')
ON CONFLICT (role, action) DO NOTHING;

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role TEXT NOT NULL,
  action permission_action NOT NULL,
  old_value BOOLEAN,
  new_value BOOLEAN NOT NULL,
  changed_by TEXT NOT NULL, -- user ID
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX idx_permission_audit_role ON permission_audit_log(role);
CREATE INDEX idx_permission_audit_changed_by ON permission_audit_log(changed_by);
CREATE INDEX idx_permission_audit_changed_at ON permission_audit_log(changed_at);
