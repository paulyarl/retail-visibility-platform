"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input, Modal, ModalFooter } from '@/components/ui';
import { motion } from 'framer-motion';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
  tenants: number;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      email: 'paul.yarl@outlook.com',
      name: 'Paul Yarl',
      role: 'admin',
      status: 'active',
      lastActive: '2 minutes ago',
      tenants: 2,
    },
    {
      id: '2',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'user',
      status: 'active',
      lastActive: '1 hour ago',
      tenants: 1,
    },
  ]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user' | 'viewer'>('user');
  
  // Edit user state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user' | 'viewer'>('user');
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="error">Admin</Badge>;
      case 'user':
        return <Badge variant="info">User</Badge>;
      case 'viewer':
        return <Badge variant="default">Viewer</Badge>;
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
    setInviteRole('user');
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setShowEditModal(true);
  };

  const handleEditSave = () => {
    if (!editingUser) return;
    
    console.log('Updating user:', editingUser.id, {
      name: editName,
      email: editEmail,
      role: editRole,
      status: editStatus,
    });
    
    // Update local state
    setUsers(users.map(u => 
      u.id === editingUser.id 
        ? { ...u, name: editName, email: editEmail, role: editRole, status: editStatus }
        : u
    ));
    
    // TODO: Implement API call
    setShowEditModal(false);
    setEditingUser(null);
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">User Management</h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">Manage users, permissions, and access</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowInviteModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite User
              </Button>
              <Link 
                href="/settings/admin"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
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
                  {users.filter(u => u.role === 'admin').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Admins</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
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
                  </div>
                </motion.div>
              ))}
            </div>
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
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user' | 'viewer')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
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
              onChange={(e) => setEditRole(e.target.value as 'admin' | 'user' | 'viewer')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
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
    </div>
  );
}
