import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRoleGroup, requirePermission } from '../middleware/role-validation';

const router = Router();

function getAccessLevelSummary(userRole: string, groups: string[], permissions: string[]): string {
  if (permissions.includes('CAN_ADMIN_PLATFORM')) {
    return 'Platform Administrator (Full System Access)';
  }
  if (permissions.includes('CAN_SUPPORT_PLATFORM')) {
    return 'Platform Support (System Troubleshooting)';
  }
  if (groups.includes('IS_TENANT_OWNER')) {
    return 'Tenant Owner (Billing & Critical Settings)';
  }
  if (groups.includes('IS_TENANT_ADMIN')) {
    return 'Tenant Administrator (Users & Settings)';
  }
  if (groups.includes('IS_TENANT_MANAGER')) {
    return 'Tenant Manager (Operations & Analytics)';
  }
  if (groups.includes('IS_TENANT_USER')) {
    return 'Tenant User (Basic Access)';
  }
  return 'Limited Access';
}

router.get('/api/auth/role-groups', authenticateToken, (req, res) => {
  try {
    const { ROLE_GROUPS } = require('../config/role-groups');
    res.json(ROLE_GROUPS);
  } catch (error) {
    console.error('[API] Failed to load role groups:', error);
    res.status(500).json({ error: 'Failed to load role groups' });
  }
});

router.get('/api/auth/user-groups', authenticateToken, (req, res) => {
  try {
    const { getUserRoleGroups } = require('../config/role-groups');
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    const userGroups = getUserRoleGroups(userRole);
    res.json({
      userId: req.user?.id,
      userRole,
      groups: userGroups
    });
  } catch (error) {
    console.error('[API] Failed to get user groups:', error);
    res.status(500).json({ error: 'Failed to get user groups' });
  }
});

router.get('/api/auth/permissions', authenticateToken, (req, res) => {
  try {
    const { getAllPermissions } = require('../config/role-groups');
    const permissions = getAllPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('[API] Failed to load permissions:', error);
    res.status(500).json({ error: 'Failed to load permissions' });
  }
});

router.get('/api/auth/user-permissions', authenticateToken, (req, res) => {
  try {
    const { getUserPermissions, isValidRole } = require('../config/role-groups');
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    if (!isValidRole(userRole)) {
      return res.status(401).json({ error: 'Invalid user role', userRole });
    }

    const userPermissions = getUserPermissions(userRole);
    res.json({
      userId: req.user?.id,
      userRole,
      permissions: userPermissions
    });
  } catch (error) {
    console.error('[API] Failed to get user permissions:', error);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
});

router.get('/api/auth/user-access', authenticateToken, (req, res) => {
  try {
    const { getUserRoleGroups, getUserPermissions, isValidRole } = require('../config/role-groups');
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    if (!isValidRole(userRole)) {
      return res.status(401).json({ error: 'Invalid user role', userRole });
    }

    const userGroups = getUserRoleGroups(userRole);
    const userPermissions = getUserPermissions(userRole);

    res.json({
      userId: req.user?.id,
      userRole,
      access: {
        groups: userGroups,
        permissions: userPermissions
      },
      summary: {
        totalGroups: userGroups.length,
        totalPermissions: userPermissions.length,
        accessLevel: getAccessLevelSummary(userRole, userGroups, userPermissions)
      }
    });
  } catch (error) {
    console.error('[API] Failed to get user access:', error);
    res.status(500).json({ error: 'Failed to get user access' });
  }
});

router.get('/api/admin/system/status', authenticateToken, requireRoleGroup('IS_PLATFORM_ADMIN'), (req, res) => {
  res.json({ message: 'Platform admin access granted', status: 'operational' });
});

router.get('/api/admin/support/tools', authenticateToken, requireRoleGroup('IS_PLATFORM_SUPPORT'), (req, res) => {
  res.json({ message: 'Platform support access granted', tools: ['debug', 'logs', 'user_impersonation'] });
});

router.get('/api/tenants/:id/users/manage', authenticateToken, requirePermission('CAN_MANAGE_TENANT_USERS'), (req, res) => {
  res.json({ message: 'User management access granted', tenantId: req.params.id });
});

router.get('/api/tenants/:id/billing/manage', authenticateToken, requirePermission('CAN_MANAGE_TENANT_BILLING'), (req, res) => {
  res.json({ message: 'Billing management access granted', tenantId: req.params.id });
});

router.get('/api/tenants/:id/analytics', authenticateToken, requirePermission('CAN_MANAGE_TENANT_ANALYTICS'), (req, res) => {
  res.json({ message: 'Analytics access granted', tenantId: req.params.id });
});

router.get('/api/tenants/:id/inventory', authenticateToken, requirePermission('CAN_MANAGE_TENANT_INVENTORY'), (req, res) => {
  res.json({ message: 'Inventory management access granted', tenantId: req.params.id });
});

router.get('/api/tenants/:id/export', authenticateToken, requirePermission('CAN_EXPORT_TENANT_DATA'), (req, res) => {
  res.json({ message: 'Data export access granted', tenantId: req.params.id });
});

router.get('/api/admin/system/logs', authenticateToken, requirePermission('CAN_VIEW_PLATFORM_LOGS'), (req, res) => {
  res.json({ message: 'System logs access granted', logs: ['system.log', 'error.log', 'access.log'] });
});

router.get('/api/admin/system/tools', authenticateToken, requirePermission('CAN_ACCESS_SYSTEM_TOOLS'), (req, res) => {
  res.json({ message: 'System tools access granted', tools: ['database-backup', 'cache-clear', 'system-diagnostic'] });
});

router.get('/api/data/sensitive', authenticateToken, requirePermission('CAN_VIEW_SENSITIVE_DATA'), (req, res) => {
  res.json({ message: 'Sensitive data access granted', dataLevel: 'confidential' });
});

router.get('/api/data/bulk-operations', authenticateToken, requirePermission('CAN_BULK_OPERATIONS'), (req, res) => {
  res.json({ message: 'Bulk operations access granted', operations: ['bulk-import', 'bulk-export', 'bulk-delete'] });
});

export default router;
