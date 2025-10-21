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
    console.log('Inviting user:', inviteEmail);
    // TODO: Implement invite API call
    setShowInviteModal(false);
    setInviteEmail('');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">User Management</h1>
              <p className="text-neutral-600 mt-1">Manage users, permissions, and access</p>
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
                    <Button size="sm" variant="secondary">
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary">
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
            <select className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
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
    </div>
  );
}
