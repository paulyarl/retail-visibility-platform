"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input, Modal, ModalFooter, Pagination, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import ManageUserTenantsModal from '@/components/admin/ManageUserTenantsModal';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAccessControl } from '@/lib/auth/useAccessControl';
import { canManageUsers } from '@/lib/auth/access-control';

interface User {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'TENANT_ADMIN' | 'USER'; // All supported roles
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
  const [inviteMode, setInviteMode] = useState<'create' | 'assign' | 'invite'>('create');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState<'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'OWNER' | 'TENANT_ADMIN' | 'USER'>('USER');
  
  // Edit user state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'TENANT_ADMIN' | 'USER'>('USER');
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
  
  // Tenant management state
  const [showTenantsModal, setShowTenantsModal] = useState(false);
  const [tenantsUser, setTenantsUser] = useState<User | null>(null);
  
  // Access control
  const { user } = useAccessControl(null, {});
  const canManage = user ? canManageUsers(user) : false;
  const canInvite = user ? (canManageUsers(user) || user.role === 'PLATFORM_SUPPORT') : false;
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'OWNER' | 'USER'>('all');

  // Memoized load users function to prevent unnecessary re-calls
  const loadUsers = useCallback(async () => {
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
  }, []);

  // Load users on mount only
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  
  // Memoized filtered users to prevent unnecessary re-computations
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = searchQuery.toLowerCase();
      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const matchesSearch = userName.toLowerCase().includes(searchLower) ||
             user.email.toLowerCase().includes(searchLower) ||
             user.role.toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchQuery, statusFilter, roleFilter]);
  
  // Memoized paginated users to prevent unnecessary re-computations
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  }, [filteredUsers, currentPage, pageSize]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return <Badge variant="error">Platform Admin</Badge>;
      case 'PLATFORM_SUPPORT':
        return <Badge variant="warning">Platform Support</Badge>;
      case 'PLATFORM_VIEWER':
        return <Badge variant="info">Platform Viewer</Badge>;
      case 'ADMIN':
        return <Badge variant="error">Admin</Badge>;
      case 'OWNER':
        return <Badge variant="warning">Tenant Owner</Badge>;
      case 'TENANT_ADMIN':
        return <Badge variant="info">Tenant Admin</Badge>;
      case 'USER':
        return <Badge variant="default">User</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  const getAssignmentStatus = (user: User) => {
    // Only show assignment status for tenant owners
    if (!user || user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT' || user.role === 'PLATFORM_VIEWER') {
      return null;
    }

    const assignmentCount = user.tenantRoles?.length || 0;
    
    if (assignmentCount === 0) {
      return (
        <Badge variant="warning" className="text-xs">
          Unassigned
        </Badge>
      );
    } else {
      return (
        <Badge variant="success" className="text-xs">
          {assignmentCount} tenant{assignmentCount !== 1 ? 's' : ''}
        </Badge>
      );
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

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      setError('Please provide email and role');
      return;
    }

    if (inviteMode === 'create' && !invitePassword) {
      setError('Please provide a password for the new user');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // For tenant owners, we need to get their owned tenants first
      let targetTenantId = '';
      
      if (user?.role === 'OWNER') {
        // Get the first owned tenant (for simplicity)
        // In a real implementation, you might want to let them choose
        const tenantsResponse = await api.get('/api/admin/tenants');
        const tenantsData = await tenantsResponse.json();
        
        if (tenantsData.success && tenantsData.tenants.length > 0) {
          targetTenantId = tenantsData.tenants[0].id;
        } else {
          throw new Error('No tenants available for assignment');
        }
      }

      let response, data;

      if (inviteMode === 'invite') {
        // Send email invitation
        response = await api.post('/api/admin/users/send-invitation', {
          email: inviteEmail,
          tenantId: targetTenantId,
          role: inviteRole,
        });
        data = await response.json();

        if (response.ok && data.success) {
          setSuccess(`Invitation sent to ${inviteEmail} for role ${inviteRole}`);
        } else {
          throw new Error(data.error || 'Failed to send invitation');
        }
      } else if (inviteMode === 'create') {
        // Create new user and assign to tenant
        response = await api.post('/api/admin/users/create', {
          email: inviteEmail,
          password: invitePassword,
          firstName: inviteFirstName,
          lastName: inviteLastName,
          tenantId: targetTenantId,
          role: inviteRole,
        });
        data = await response.json();

        if (response.ok && data.success) {
          setSuccess(`Successfully created user ${inviteEmail} and assigned to tenant with role ${inviteRole}`);
        } else {
          throw new Error(data.error || 'Failed to create user');
        }
      } else {
        // Assign existing user to tenant
        response = await api.post('/api/admin/users/invite-by-email', {
          email: inviteEmail,
          tenantId: targetTenantId,
          role: inviteRole,
        });
        data = await response.json();

        if (response.ok && data.success) {
          setSuccess(`Successfully assigned ${inviteEmail} to tenant with role ${inviteRole}`);
        } else if (data.action === 'registration_required') {
          setError(data.message);
          return;
        } else {
          throw new Error(data.error || 'Failed to assign user');
        }
      }

      // Reset form and close modal
      setShowInviteModal(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteFirstName('');
      setInviteLastName('');
      setInviteRole('USER');
      await loadUsers(); // Refresh the user list
    } catch (err) {
      console.error('[Users] Invite error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process user');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    setEditName(userName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setShowEditModal(true);
  };

  const handleManageTenantsClick = (user: User) => {
    setTenantsUser(user);
    setShowTenantsModal(true);
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
      // Optimistic update instead of full reload
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === editingUser.id ? 
          { ...u, name: editName, email: editEmail, role: editRole as User['role'], status: editStatus } : u
        )
      );
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('[Users] Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handlePermissionsClick = (user: User) => {
    setPermissionsUser(user);
    // Reset permissions to default for each user
    // TODO: Load user's actual permissions from API instead of using defaults
    setPermissions({
      canCreateTenants: true,
      canEditTenants: true,
      canDeleteTenants: false,
      canManageUsers: false,
      canViewAnalytics: true,
      canManageInventory: true,
      canAccessAdmin: false,
    });
    setShowPermissionsModal(true);
  };

  const handlePermissionsSave = () => {
    if (!permissionsUser) return;
    
    console.log('Updating permissions for user:', permissionsUser.id, permissions);
    // TODO: Implement API call
    setShowPermissionsModal(false);
    setPermissionsUser(null);
  };

  const handlePermissionsClose = () => {
    setShowPermissionsModal(false);
    setPermissionsUser(null);
    // Reset permissions to default to prevent state leakage
    setPermissions({
      canCreateTenants: true,
      canEditTenants: true,
      canDeleteTenants: false,
      canManageUsers: false,
      canViewAnalytics: true,
      canManageInventory: true,
      canAccessAdmin: false,
    });
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
        // Optimistic update instead of full reload
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
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
          <Button onClick={() => setShowInviteModal(true)} disabled={!canInvite} title={!canInvite ? 'View only' : undefined}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite User
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Info Alert */}
        {user?.role === 'OWNER' ? (
          <Alert variant="success" title="Tenant Owner - Secure User Assignment">
            <div className="text-sm space-y-2">
              <p>
                As a <strong>Tenant Owner</strong>, you can manage users assigned to your tenants:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>View Users:</strong> See only users already assigned to your tenants (privacy protected)</li>
                <li><strong>Create User:</strong> Use "Create User" to create new employees and automatically assign them</li>
                <li><strong>Assign by Email:</strong> Use "Assign Existing User" to add users who already registered</li>
                <li><strong>Manage Roles:</strong> Click "Manage Tenants" to modify user roles within your tenants</li>
              </ul>
              <p className="text-xs bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                <strong>🚀 Streamlined:</strong> Create new users directly with automatic tenant assignment, or assign existing users by email. Privacy protected - you only see users assigned to your tenants.
              </p>
            </div>
          </Alert>
        ) : (
          <Alert variant="info" title="About Platform-Level Roles">
            <div className="text-sm space-y-2">
              <p>
                These are <strong>platform-level roles</strong> that determine a user's global access:
              </p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-neutral-900 mb-1">Platform Users:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Platform Admin:</strong> Full system access, unlimited tenants</li>
                  <li><strong>Platform Support:</strong> View all tenants + support actions (3 tenant limit)</li>
                  <li><strong>Platform Viewer:</strong> Read-only access to all tenants (cannot create)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-neutral-900 mb-1">Tenant Users:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Tenant Owner:</strong> Can create/own tenants, manage settings & billing (limits based on subscription tier)</li>
                  <li><strong>Tenant Admin:</strong> Support role for assigned tenants (below Tenant Owner, cannot manage settings/ownership)</li>
                  <li><strong>Tenant User:</strong> Basic access (limits based on subscription tier)</li>
                </ul>
              </div>
            </div>
            <p className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <strong>Tenant Limits:</strong> For Tenant Users and Owners, the number of tenants they can create depends on their <strong>subscription tier</strong>: Trial (1), Google-Only (1), Starter (3), Professional (10), Enterprise (25), Organization (unlimited).
            </p>
            <p className="mt-2">
              <strong>Note:</strong> Users also have <strong>tenant-specific roles</strong> (Tenant Owner, Tenant Support, Tenant Member, Tenant Viewer) for each location they belong to. Those are managed within each tenant's settings, not here.
            </p>
          </div>
        </Alert>
        )}

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
                        {(() => {
                          const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                          return userName.charAt(0).toUpperCase();
                        })()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900">
                          {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                        </p>
                        {getRoleBadge(user.role)}
                        {getStatusBadge(user.status)}
                        {getAssignmentStatus(user)}
                      </div>
                      <p className="text-sm text-neutral-600">{user.email}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Last active: {user.lastActive} • {user.tenants} tenant{user.tenants !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEditClick(user)} disabled={!canManage} title={!canManage ? 'View only' : 'Edit user details and role'}>
                      Edit Role
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleManageTenantsClick(user)} disabled={!canManage} title={!canManage ? 'View only' : 'Manage tenant assignments'}>
                      Manage Tenants
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(user.id)} disabled={!canManage} title={!canManage ? 'View only' : undefined}>
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
        title={inviteMode === 'create' ? 'Create User' : inviteMode === 'invite' ? 'Send Invitation' : 'Assign User by Email'}
        description={inviteMode === 'create' ? 'Create a new user and automatically assign to your tenant' : inviteMode === 'invite' ? 'Send an email invitation to join your tenant' : 'Assign an existing user to your tenant by their email address'}
      >
        <div className="space-y-4">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Action
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={inviteMode === 'create' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setInviteMode('create')}
              >
                Create New User
              </Button>
              <Button
                type="button"
                variant={inviteMode === 'invite' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setInviteMode('invite')}
              >
                Send Invitation
              </Button>
              <Button
                type="button"
                variant={inviteMode === 'assign' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setInviteMode('assign')}
              >
                Assign Existing User
              </Button>
            </div>
          </div>

          <Input
            type="email"
            label="Email Address"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />

          {inviteMode === 'create' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="text"
                  label="First Name"
                  placeholder="John"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                />
                <Input
                  type="text"
                  label="Last Name"
                  placeholder="Doe"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                />
              </div>
              <Input
                type="password"
                label="Password"
                placeholder="Choose a secure password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
              />
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Role
            </label>
            <select 
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'OWNER' | 'TENANT_ADMIN' | 'USER')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <optgroup label="Platform Users">
                <option value="PLATFORM_ADMIN">Platform Admin - Full system access (unlimited tenants)</option>
                <option value="PLATFORM_SUPPORT">Platform Support - View all tenants + support actions (3 tenant limit)</option>
                <option value="PLATFORM_VIEWER">Platform Viewer - Read-only access to all tenants (cannot create)</option>
              </optgroup>
              <optgroup label="Tenant Users">
                <option value="OWNER">Tenant Owner - Can create/own tenants, manage settings & billing (limits based on subscription tier)</option>
                <option value="TENANT_ADMIN">Tenant Admin - Support role for assigned tenants (below Tenant Owner, cannot manage settings/ownership)</option>
                <option value="USER">Tenant User - Basic access (limits based on subscription tier)</option>
              </optgroup>
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!canInvite} title={!canInvite ? 'View only' : undefined}>
            {inviteMode === 'create' ? 'Create User' : inviteMode === 'invite' ? 'Send Invitation' : 'Assign User'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        description={editingUser ? `Update details for ${editingUser.name || `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() || editingUser.email}` : ''}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Full name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={!canManage}
          />
          <Input
            type="email"
            label="Email Address"
            placeholder="user@example.com"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            disabled={!canManage}
          />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Platform Role
            </label>
            <select 
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'TENANT_ADMIN' | 'USER')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-2"
              disabled={!canManage}
            >
              <optgroup label="Platform Users">
                <option value="PLATFORM_ADMIN">Platform Admin - Full system access (unlimited tenants)</option>
                <option value="PLATFORM_SUPPORT">Platform Support - View all tenants + support actions (3 tenant limit)</option>
                <option value="PLATFORM_VIEWER">Platform Viewer - Read-only access to all tenants (cannot create)</option>
              </optgroup>
              <optgroup label="Tenant Users">
                <option value="OWNER">Tenant Owner - Can create/own tenants, manage settings & billing (limits based on subscription tier)</option>
                <option value="TENANT_ADMIN">Tenant Admin - Support role for assigned tenants (below Tenant Owner, cannot manage settings/ownership)</option>
                <option value="USER">Tenant User - Basic access (limits based on subscription tier)</option>
              </optgroup>
              <optgroup label="Deprecated">
                <option value="ADMIN">Admin (Deprecated) - Use Platform Admin instead</option>
              </optgroup>
            </select>
            <p className="text-xs text-neutral-600">
              Platform roles control global access. Users also have tenant-specific roles (Tenant Owner, Tenant Support, Tenant Member, Tenant Viewer) for each location they belong to.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Status
            </label>
            <select 
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive' | 'pending')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={!canManage}
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
          <Button onClick={handleEditSave} disabled={!canManage} title={!canManage ? 'View only' : undefined}>
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={handlePermissionsClose}
        title="User Permissions"
        description={permissionsUser ? `Manage permissions for ${permissionsUser.name || `${permissionsUser.firstName || ''} ${permissionsUser.lastName || ''}`.trim() || permissionsUser.email}` : ''}
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
          <Button variant="ghost" onClick={handlePermissionsClose}>
            Cancel
          </Button>
          <Button onClick={handlePermissionsSave} disabled={!canManage} title={!canManage ? 'View only' : undefined}>
            Save Permissions
          </Button>
        </ModalFooter>
      </Modal>

      {/* Manage User Tenants Modal */}
      <ManageUserTenantsModal
        isOpen={showTenantsModal}
        onClose={() => setShowTenantsModal(false)}
        user={tenantsUser}
        onSuccess={() => {
          // Only reload if tenant assignments actually changed
          // The modal will handle its own state updates
          setShowTenantsModal(false);
        }}
      />

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
