"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input, Modal, ModalFooter, Pagination, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OWNER' | 'USER'; // Platform-level roles
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
  tenants: number;
  tenantRoles?: Array<{
    tenantId: string;
    tenantName: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; // Tenant-level roles
  }>;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'OWNER' | 'USER'>('USER');
  
  // Edit user state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'OWNER' | 'USER'>('USER');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  
  // Permissions state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState({
    canCreateTenants: true,
    canEditTenants: true,
    canDeleteTenants: false,
    canManageUsers: false,
    canViewAnalytics: true,
    canManageInventory: true,
    canAccessAdmin: false,
  });
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'OWNER' | 'USER'>('all');

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/admin/users');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load users');
      }

      setUsers(Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('[Users] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  // Filter users based on search query, status, and role
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(searchLower) ||
           user.email.toLowerCase().includes(searchLower) ||
           user.role.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });
  
  // Paginate filtered users
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="error">Platform Admin</Badge>;
      case 'OWNER':
        return <Badge variant="warning">Tenant Owner</Badge>;
      case 'USER':
        return <Badge variant="info">User</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'inactive':
        return <Badge variant="default">Inactive</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleInvite = () => {
    console.log('Inviting user:', inviteEmail, 'with role:', inviteRole);
    // TODO: Implement invite API call
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('USER');
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    
    try {
      setError(null);
      const [firstName, ...lastNameParts] = editName.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const res = await api.put(`/api/users/${editingUser.id}`, {
        firstName,
        lastName,
        email: editEmail,
        role: editRole,
        isActive: editStatus === 'active',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }
      
      setSuccess('User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
      await loadUsers();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('[Users] Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handlePermissionsClick = (user: User) => {
    setPermissionsUser(user);
    // TODO: Load user's actual permissions from API
    setShowPermissionsModal(true);
  };

  const handlePermissionsSave = () => {
    if (!permissionsUser) return;
    
    console.log('Updating permissions for user:', permissionsUser.id, permissions);
    // TODO: Implement API call
    setShowPermissionsModal(false);
    setPermissionsUser(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      const res = await api.delete(`/api/users/${userId}`);
      
      if (res.status === 204 || res.ok) {
        setSuccess('User deleted successfully');
        await loadUsers();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('[Users] Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
          <PageHeader
            title="User Management"
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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="User Management"
        description="Manage users, permissions, and access"
        icon={Icons.Users}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin'
        }}
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite User
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Info Alert */}
        <Alert variant="info" title="About Platform-Level Roles">
          <div className="text-sm space-y-2">
            <p>
              These are <strong>platform-level roles</strong> that determine a user's global access:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Platform Admin:</strong> Full system access, can manage all tenants and users</li>
              <li><strong>Tenant Owner:</strong> Can create and own multiple tenants (10 max)</li>
              <li><strong>User:</strong> Basic access, can be assigned to tenants (3 tenant limit)</li>
            </ul>
            <p className="mt-2">
              Users also have <strong>tenant-level roles</strong> (Owner, Admin, Member, Viewer) for each tenant they belong to.
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-900">{users.length}</p>
                <p className="text-sm text-neutral-600 mt-1">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {users.filter(u => u.status === 'active').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">
                  {users.filter(u => u.status === 'pending').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">
                  {users.filter(u => u.role === 'ADMIN').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Admins</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All Status
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending
                </Button>
              </div>

              {/* Role Filter */}
              <div className="flex gap-2">
                <Button
                  variant={roleFilter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setRoleFilter('all')}
                >
                  All Roles
                </Button>
                <Button
                  variant={roleFilter === 'ADMIN' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setRoleFilter('ADMIN')}
                >
                  Platform Admin
                </Button>
                <Button
                  variant={roleFilter === 'OWNER' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setRoleFilter('OWNER')}
                >
                  Tenant Owner
                </Button>
                <Button
                  variant={roleFilter === 'USER' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setRoleFilter('USER')}
                >
                  User
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-500">
                  {searchQuery ? 'No users match your search' : 'No users found'}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-neutral-200">
                  {paginatedUsers.map((user, index) => (
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
                        {getRoleBadge(user.role)}
                        {getStatusBadge(user.status)}
                      </div>
                      <p className="text-sm text-neutral-600">{user.email}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Last active: {user.lastActive} • {user.tenants} tenant{user.tenants !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEditClick(user)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handlePermissionsClick(user)}>
                      Permissions
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(user.id)}>
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </motion.div>
                  ))}
                </div>
                
                {/* Pagination */}
                {filteredUsers.length > 0 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredUsers.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite User"
        description="Send an invitation to join the platform"
      >
        <div className="space-y-4">
          <Input
            type="email"
            label="Email Address"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Role
            </label>
            <select 
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'OWNER' | 'USER')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="USER">User</option>
              <option value="OWNER">Tenant Owner</option>
              <option value="ADMIN">Platform Admin</option>
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite}>
            Send Invitation
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        description={editingUser ? `Update details for ${editingUser.name}` : ''}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Full name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Input
            type="email"
            label="Email Address"
            placeholder="user@example.com"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Role
            </label>
            <select 
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as 'ADMIN' | 'OWNER' | 'USER')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="USER">User</option>
              <option value="OWNER">Tenant Owner</option>
              <option value="ADMIN">Platform Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Status
            </label>
            <select 
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive' | 'pending')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleEditSave}>
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        title="User Permissions"
        description={permissionsUser ? `Manage permissions for ${permissionsUser.name}` : ''}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600">
              Configure what this user can access and manage in the platform.
            </p>
          </div>

          <div className="space-y-3">
            {/* Tenant Permissions */}
            <div className="border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Tenant Management</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.canCreateTenants}
                    onChange={(e) => setPermissions({...permissions, canCreateTenants: e.target.checked})}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Create Tenants</p>
                    <p className="text-xs text-neutral-500">Allow user to create new tenant locations</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.canEditTenants}
                    onChange={(e) => setPermissions({...permissions, canEditTenants: e.target.checked})}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Edit Tenants</p>
                    <p className="text-xs text-neutral-500">Allow user to modify tenant details</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.canDeleteTenants}
                    onChange={(e) => setPermissions({...permissions, canDeleteTenants: e.target.checked})}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Delete Tenants</p>
                    <p className="text-xs text-neutral-500">Allow user to permanently delete tenants</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Inventory Permissions */}
            <div className="border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Inventory</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.canManageInventory}
                  onChange={(e) => setPermissions({...permissions, canManageInventory: e.target.checked})}
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">Manage Inventory</p>
                  <p className="text-xs text-neutral-500">Allow user to add, edit, and delete inventory items</p>
                </div>
              </label>
            </div>

            {/* Analytics Permissions */}
            <div className="border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Analytics</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.canViewAnalytics}
                  onChange={(e) => setPermissions({...permissions, canViewAnalytics: e.target.checked})}
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-neutral-900">View Analytics</p>
                  <p className="text-xs text-neutral-500">Allow user to view reports and analytics</p>
                </div>
              </label>
            </div>

            {/* Admin Permissions */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Administration</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.canManageUsers}
                    onChange={(e) => setPermissions({...permissions, canManageUsers: e.target.checked})}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Manage Users</p>
                    <p className="text-xs text-neutral-500">Allow user to invite and manage other users</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.canAccessAdmin}
                    onChange={(e) => setPermissions({...permissions, canAccessAdmin: e.target.checked})}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Access Admin Dashboard</p>
                    <p className="text-xs text-neutral-500">Allow user to access admin settings and features</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowPermissionsModal(false)}>
            Cancel
          </Button>
          <Button onClick={handlePermissionsSave}>
            Save Permissions
          </Button>
        </ModalFooter>
      </Modal>

      {/* Error/Success Alerts */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert variant="error" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}
      {success && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert variant="success" title="Success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
