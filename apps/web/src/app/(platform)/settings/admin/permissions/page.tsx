"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/lib/api';

type Permission = {
  id: string;
  role: string;
  action: string;
  allowed: boolean;
  description: string | null;
};

type GroupedPermissions = Record<string, Permission[]>;

// Tenant-level roles only (UserTenant.role)
// Platform Admin always has full access and bypasses these checks
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  TENANT_OWNER: 'Tenant Owner',
  TENANT_ADMIN: 'Tenant Admin',
  TENANT_MEMBER: 'Tenant Member',
  TENANT_VIEWER: 'Tenant Viewer',
};

const ACTION_CATEGORIES: Record<string, string[]> = {
  'Tenant Management': ['tenant_create', 'tenant_read', 'tenant_update', 'tenant_delete', 'tenant_manage_users'],
  'Inventory': ['inventory_create', 'inventory_read', 'inventory_update', 'inventory_delete'],
  'Analytics': ['analytics_view'],
  'Administration': ['admin_access_dashboard', 'admin_manage_settings'],
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [grouped, setGrouped] = useState<GroupedPermissions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/permissions');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load permissions');
      }

      setPermissions(data.permissions || []);
      setGrouped(data.grouped || {});
    } catch (err) {
      console.error('[Permissions] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId: string, currentValue: boolean) => {
    const newChanges = new Map(changes);
    newChanges.set(permissionId, !currentValue);
    setChanges(newChanges);
  };

  const hasChanges = () => changes.size > 0;

  const saveChanges = async () => {
    if (!hasChanges()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updates = Array.from(changes.entries()).map(([id, allowed]) => ({
        id,
        allowed,
      }));

      const res = await api.post('/api/permissions/bulk-update', {
        updates,
        reason: 'Updated via admin UI',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save changes');
      }

      setSuccess(`Successfully updated ${data.updated} permission(s)`);
      setChanges(new Map());
      await loadPermissions();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('[Permissions] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    setChanges(new Map());
    setError(null);
    setSuccess(null);
  };

  const getPermissionValue = (permission: Permission): boolean => {
    return changes.has(permission.id) ? changes.get(permission.id)! : permission.allowed;
  };

  const getActionDisplay = (action: string): string => {
    // Convert tenant_create or tenant.create to "Tenant Create"
    return action
      .replace(/_/g, '.')
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <div className="min-h-screen bg-neutral-50">
          <PageHeader
            title="Tenant Permission Matrix"
            description="Loading..."
            icon={Icons.Settings}
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Platform Permission Matrix"
          description="Manage role-based permissions across the platform"
          icon={Icons.Settings}
          backLink={{
            href: '/settings/admin',
            label: 'Back to Admin'
          }}
          actions={
            hasChanges() ? (
              <div className="flex gap-2">
                <Button onClick={cancelChanges} variant="secondary" disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveChanges} disabled={saving}>
                  {saving ? 'Saving...' : `Save ${changes.size} Change(s)`}
                </Button>
              </div>
            ) : (
              <Button onClick={loadPermissions} variant="secondary">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
            )
          }
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Info Alert */}
          <Alert variant="info" title="About Tenant-Level Permissions">
            <div className="text-sm space-y-2">
              <p>
                This matrix configures permissions for <strong>tenant-level roles</strong> (Owner, Admin, Member, Viewer).
              </p>
              <p>
                <strong>Platform Admins</strong> always have full access to all features and bypass these permission checks.
                Platform Owners and Users receive permissions through their tenant role assignments.
              </p>
            </div>
          </Alert>

          {error && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" title="Success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {hasChanges() && (
            <Alert variant="info" title="Unsaved Changes">
              You have {changes.size} unsaved change(s). Click "Save" to apply them.
            </Alert>
          )}

          {Object.entries(ACTION_CATEGORIES).map(([category, actions]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  Configure which roles can perform these actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">Action</th>
                        {Object.keys(ROLE_DISPLAY_NAMES).map(role => (
                          <th key={role} className="text-center py-3 px-4 font-medium text-neutral-700">
                            {ROLE_DISPLAY_NAMES[role]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map(action => (
                        <tr key={action} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="py-3 px-4 font-medium text-neutral-900">
                            {getActionDisplay(action)}
                          </td>
                          {Object.keys(ROLE_DISPLAY_NAMES).map(role => {
                            const permission = permissions.find(
                              p => p.role === role && p.action === action
                            );
                            
                            if (!permission) {
                              return <td key={role} className="text-center py-3 px-4">-</td>;
                            }

                            const isAllowed = getPermissionValue(permission);
                            const hasChange = changes.has(permission.id);

                            return (
                              <td key={role} className="text-center py-3 px-4">
                                <button
                                  onClick={() => togglePermission(permission.id, permission.allowed)}
                                  className={`
                                    relative inline-flex items-center justify-center w-12 h-6 rounded-full transition-colors
                                    ${isAllowed ? 'bg-green-500' : 'bg-neutral-300'}
                                    ${hasChange ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
                                    hover:opacity-80
                                  `}
                                  title={permission.description || undefined}
                                >
                                  <span
                                    className={`
                                      absolute w-4 h-4 bg-white rounded-full transition-transform
                                      ${isAllowed ? 'translate-x-3' : '-translate-x-3'}
                                    `}
                                  />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                    <div className="w-4 h-4 bg-white rounded-full" />
                  </div>
                  <span className="text-sm text-neutral-700">Permission Allowed</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-6 bg-neutral-300 rounded-full flex items-center justify-start px-1">
                    <div className="w-4 h-4 bg-white rounded-full" />
                  </div>
                  <span className="text-sm text-neutral-700">Permission Denied</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-6 bg-green-500 rounded-full ring-2 ring-primary-500 ring-offset-2 flex items-center justify-end px-1">
                    <div className="w-4 h-4 bg-white rounded-full" />
                  </div>
                  <span className="text-sm text-neutral-700">Unsaved Change</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
