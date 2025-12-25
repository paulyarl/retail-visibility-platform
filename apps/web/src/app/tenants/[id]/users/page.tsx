"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input, Modal, ModalFooter, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

type TenantUser = {
  id: string;
  email: string;
  name: string;
  platformRole: 'ADMIN' | 'OWNER' | 'USER';
  tenantRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  isActive: boolean;
  lastLogin: string;
  addedAt: string;
};

export default function TenantUsersPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;

  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [adding, setAdding] = useState(false);

  // Change role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [newRole, setNewRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [changingRole, setChangingRole] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadUsers();
    }
  }, [tenantId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/tenants/${tenantId}/users`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load users');
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Tenant Users] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!addEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    try {
      setAdding(true);
      setError(null);

      const res = await api.post(`/api/tenants/${tenantId}/users`, {
        email: addEmail.trim(),
        role: addRole,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to add user');
      }

      setSuccess(`User ${addEmail} added successfully`);
      setShowAddModal(false);
      setAddEmail('');
      setAddRole('MEMBER');
      await loadUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('[Tenant Users] Add error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    try {
      setChangingRole(true);
      setError(null);

      const res = await api.put(`/api/tenants/${tenantId}/users/${selectedUser.id}`, {
        role: newRole,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to change role');
      }

      setSuccess(`Role updated successfully`);
      setShowRoleModal(false);
      setSelectedUser(null);
      await loadUsers();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('[Tenant Users] Change role error:', err);
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setChangingRole(false);
    }
  };

  const handleRemoveUser = async (user: TenantUser) => {
    if (!confirm(`Are you sure you want to remove ${user.name} from this tenant?`)) {
      return;
    }

    try {
      setError(null);
      const res = await api.delete(`/api/tenants/${tenantId}/users/${user.id}`);

      if (res.status === 204 || res.ok) {
        setSuccess(`User removed successfully`);
        await loadUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to remove user');
      }
    } catch (err) {
      console.error('[Tenant Users] Remove error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  const openChangeRoleModal = (user: TenantUser) => {
    setSelectedUser(user);
    setNewRole(user.tenantRole);
    setShowRoleModal(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Badge variant="error">Owner</Badge>;
      case 'ADMIN':
        return <Badge variant="warning">Admin</Badge>;
      case 'MEMBER':
        return <Badge variant="info">Member</Badge>;
      case 'VIEWER':
        return <Badge variant="default">Viewer</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-neutral-50">
          <PageHeader
            title="Tenant Users"
            description="Loading..."
            icon={Icons.Users}
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
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Manage Tenant Users"
          description="Add, remove, and manage user roles within this tenant"
          icon={Icons.Users}
          backLink={{
            href: `/t/${tenantId}`,
            label: 'Back to Tenant'
          }}
          actions={
            <Button onClick={() => setShowAddModal(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </Button>
          }
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Info Alert */}
          <Alert variant="info" title="About Tenant Roles">
            <div className="text-sm space-y-2">
              <p>
                Manage which users have access to this tenant and their permission levels:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Owner:</strong> Full control, can manage all users and settings</li>
                <li><strong>Admin:</strong> Can manage users and settings, but cannot delete tenant</li>
                <li><strong>Member:</strong> Can manage inventory and view analytics</li>
                <li><strong>Viewer:</strong> Read-only access to all data</li>
              </ul>
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

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
              <CardDescription>All users with access to this tenant</CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500">No users found in this tenant</p>
                  <Button onClick={() => setShowAddModal(true)} className="mt-4">
                    Add First User
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {users.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-lg">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-neutral-900">{user.name}</p>
                            {getRoleBadge(user.tenantRole)}
                            {!user.isActive && <Badge variant="default">Inactive</Badge>}
                          </div>
                          <p className="text-sm text-neutral-600">{user.email}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Last login: {user.lastLogin} • Added: {new Date(user.addedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openChangeRoleModal(user)}>
                          Change Role
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveUser(user)}>
                          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add User Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add User to Tenant"
          description="Enter the email address of an existing user to add them to this tenant"
        >
          <div className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="user@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Tenant Role
              </label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={adding}>
              {adding ? 'Adding...' : 'Add User'}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Change Role Modal */}
        <Modal
          isOpen={showRoleModal}
          onClose={() => setShowRoleModal(false)}
          title="Change User Role"
          description={selectedUser ? `Update role for ${selectedUser.name}` : ''}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER')}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={changingRole}>
              {changingRole ? 'Updating...' : 'Update Role'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
