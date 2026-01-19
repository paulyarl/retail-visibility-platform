'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Key, Trash2, Shield, User as UserIcon, Search, Filter, Edit, Building2, Mail, Power, UserCheck, ChevronDown, ChevronRight, Eye, EyeOff, Save, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui';
import CreateUserModal from '@/components/admin/CreateUserModal';
import ResetPasswordModal from '@/components/admin/ResetPasswordModal';
import EditUserModal from '@/components/admin/EditUserModal';
import ManageTenantsModal from '@/components/admin/ManageTenantsModal';
import UserStatusModal from '@/components/admin/UserStatusModal';
import { useAuth } from '@/contexts/AuthContext';
import { canManageUsers, canViewUsers } from '@/lib/auth/access-control';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  created_at: string;
  last_login_at?: string;
  is_active: boolean;
  email_verified: boolean;
  tenants?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export default function PlatformUserMaintenancePage() {
  const { user } = useAuth();
  const canManage = user ? canManageUsers(user) : false;
  const canView = user ? canViewUsers(user) : false;
  const canCreateUser = user ? (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') : false;
  const canResetPassword = user ? (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') : false;
  const canDelete = user ? (user.role === 'PLATFORM_ADMIN') : false;
  const canEditRole = user ? (user.role === 'PLATFORM_ADMIN') : false;
  const canManageTenants = user ? (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') : false;
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [manageTenantsModal, setManageTenantsModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [statusModal, setStatusModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingTenantRole, setEditingTenantRole] = useState<{ userId: string; tenantId: string; currentRole: string } | null>(null);
  
  // Pagination and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('DEBUG: API Response:', data);
        console.log('DEBUG: Users from API:', data.users);
        console.log('DEBUG: First user tenants:', data.users?.[0]?.tenants);
        
        // Debug specific user email verification status
        const targetUser = data.users?.find((u: any) => u.id === 'adminuser-ZQTQ003Q');
        if (targetUser) {
          console.log('DEBUG: Target user status:', {
            id: targetUser.id,
            email: targetUser.email,
            is_active: targetUser.is_active,
            email_verified: targetUser.email_verified,
            combined_status: targetUser.is_active && targetUser.email_verified ? 'active' : 
                           targetUser.is_active && !targetUser.email_verified ? 'active_unverified' :
                           !targetUser.is_active && targetUser.email_verified ? 'inactive' : 'pending'
          });
        }
        
        // Fetch tenant data for each user
        const usersWithTenants = await Promise.all(
          (data.users || []).map(async (user: any) => {
            try {
              const tenantResponse = await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              
              if (tenantResponse.ok) {
                const tenantData = await tenantResponse.json();
                const userTenantsArray = tenantData.tenant || tenantData.tenants || [];
                const formattedTenants = userTenantsArray.map((t: any) => ({
                  id: t.tenant_id,
                  name: t.tenantName,
                  role: t.role,
                }));
                
                console.log(`DEBUG: Fetched tenants for user ${user.id}:`, formattedTenants);
                
                return {
                  ...user,
                  tenants: formattedTenants
                };
              } else {
                console.log(`DEBUG: Failed to fetch tenants for user ${user.id}`);
                return {
                  ...user,
                  tenants: []
                };
              }
            } catch (error) {
              console.error(`DEBUG: Error fetching tenants for user ${user.id}:`, error);
              return {
                ...user,
                tenants: []
              };
            }
          })
        );
        
        console.log('DEBUG: Users with tenants:', usersWithTenants);
        setUsers(usersWithTenants);
      } else {
        console.error('Failed to load users:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleToggleUserStatus = async (userId: string, userEmail: string, currentStatus: boolean, currentEmailVerified: boolean) => {
    let newStatus: boolean;
    let newEmailVerified: boolean;
    let action: string;

    // Determine the next status
    if (currentStatus && currentEmailVerified) {
      // Active & Verified -> Inactive
      newStatus = false;
      newEmailVerified = true;
      action = 'deactivate';
    } else if (!currentStatus && currentEmailVerified) {
      // Inactive & Verified -> Pending
      newStatus = false;
      newEmailVerified = false;
      action = 'set to pending';
    } else {
      // Pending -> Active & Verified
      newStatus = true;
      newEmailVerified = true;
      action = 'activate';
    }

    const confirmMessage = `${action.charAt(0).toUpperCase() + action.slice(1)} user ${userEmail}?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: newStatus,
          emailVerified: newEmailVerified,
        }),
      });

      if (response.ok) {
        await loadUsers();
      } else {
        alert('Failed to update user status');
      }
    } catch (error) {
      console.error('Failed to update user status:', error);
      alert('Failed to update user status');
    }
  };

  // Filter and paginate users
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         u.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    const isActive = Boolean(u.is_active);
    const isVerified = Boolean(u.email_verified);
    
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = isActive && isVerified;
    } else if (statusFilter === 'active_unverified') {
      matchesStatus = isActive && !isVerified;
    } else if (statusFilter === 'inactive') {
      matchesStatus = !isActive && isVerified;
    } else if (statusFilter === 'pending') {
      matchesStatus = !isActive && !isVerified;
    }
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'PLATFORM_SUPPORT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'PLATFORM_VIEWER':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'OWNER':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'USER':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'Platform Admin';
      case 'PLATFORM_SUPPORT':
        return 'Platform Support';
      case 'PLATFORM_VIEWER':
        return 'Platform Viewer';
      case 'OWNER':
        return 'Tenant Owner';
      case 'USER':
        return 'Tenant User';
      case 'ADMIN':
        return 'Admin (Deprecated)';
      default:
        return role;
    }
  };

  const toggleRowExpansion = (userId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  const handleEditTenantRole = (userId: string, tenantId: string, currentRole: string) => {
    setEditingTenantRole({ userId, tenantId, currentRole });
  };

  const handleSaveTenantRole = async (userId: string, tenantId: string, newRole: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      // First remove the existing assignment
      const deleteResponse = await fetch(`${apiUrl}/api/admin/users/${userId}/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!deleteResponse.ok) {
        const data = await deleteResponse.json();
        throw new Error(data.message || data.error || 'Failed to remove existing tenant assignment');
      }

      // Then add with new role
      const addResponse = await fetch(`${apiUrl}/api/admin/users/${userId}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          role: newRole,
        }),
      });

      if (!addResponse.ok) {
        const data = await addResponse.json();
        throw new Error(data.message || data.error || 'Failed to add tenant with new role');
      }

      // Refresh users to get updated tenant data
      await loadUsers();
      setEditingTenantRole(null);
    } catch (error) {
      console.error('Failed to update tenant role:', error);
      alert(`Failed to update tenant role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingTenantRole(null);
  };

  const getTenantRoleOptions = () => [
    { value: 'OWNER', label: 'Owner', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' },
    { value: 'ADMIN', label: 'Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
    { value: 'SUPPORT', label: 'Support', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    { value: 'MEMBER', label: 'Member', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    { value: 'VIEWER', label: 'Viewer', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  ];

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Platform User Maintenance
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage platform users, roles, and tenant assignments
        </p>
      </div>

      {/* User Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-2xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-2xl text-green-600">{users.filter(u => u.is_active).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Users</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{users.filter(u => !u.email_verified).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admin Users</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{users.filter(u => ['PLATFORM_ADMIN', 'ADMIN'].includes(u.role)).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inactive Users</CardDescription>
            <CardTitle className="text-2xl text-red-600">{users.filter(u => !u.is_active).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Platform Users
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {filteredUsers.length} of {users.length} users
          </p>
        </div>
        {canCreateUser ? (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </Button>
        ) : (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
            <Shield className="w-4 h-4 inline mr-2" />
            {canView ? 'Read-Only Access' : 'No Access'}
          </div>
        )}
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, name, or role..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Filter Chips */}
        <div className="space-y-3">
          {/* Status Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All Status', count: users.length },
                { value: 'active', label: 'Active', count: users.filter(u => u.is_active && u.email_verified).length },
                { value: 'active_unverified', label: 'Active (Unverified)', count: users.filter(u => u.is_active && !u.email_verified).length },
                { value: 'inactive', label: 'Inactive', count: users.filter(u => !u.is_active && u.email_verified).length },
                { value: 'pending', label: 'Pending', count: users.filter(u => !u.is_active && !u.email_verified).length }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    statusFilter === filter.value 
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
          
          {/* Role Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All Roles', count: users.length },
                { value: 'PLATFORM_ADMIN', label: 'Platform Admin', count: users.filter(u => u.role === 'PLATFORM_ADMIN').length },
                { value: 'PLATFORM_SUPPORT', label: 'Platform Support', count: users.filter(u => u.role === 'PLATFORM_SUPPORT').length },
                { value: 'PLATFORM_VIEWER', label: 'Platform Viewer', count: users.filter(u => u.role === 'PLATFORM_VIEWER').length },
                { value: 'OWNER', label: 'Tenant Owner', count: users.filter(u => u.role === 'OWNER').length },
                { value: 'USER', label: 'Tenant User', count: users.filter(u => u.role === 'USER').length }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setRoleFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === filter.value 
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'No users match your filters' : 'No users yet'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first user to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedUsers.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name || 'Unnamed User'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active && user.email_verified
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : !user.is_active && user.email_verified
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : user.is_active && !user.email_verified
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                          }`}>
                            {user.is_active && user.email_verified ? 'Active' : 
                             !user.is_active && user.email_verified ? 'Inactive' :
                             user.is_active && !user.email_verified ? 'Active (Unverified)' : 'Pending'}
                          </span>
                          {!user.email_verified && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Email not verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {(user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') && <Shield className="w-3 h-3" />}
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          <button
                            onClick={() => toggleRowExpansion(user.id)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span>{user.tenants?.length || 0} tenant{(user.tenants?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <span className="ml-2 text-blue-600 dark:text-blue-400 text-xs font-bold">
                              {expandedRows.has(user.id) ? '-' : '+'}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.last_login_at 
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Role */}
                          {canEditRole ? (
                            <button
                              onClick={() => setEditModalOpen({ open: true, user })}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit Role"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-gray-300 dark:text-gray-700 cursor-not-allowed"
                              title="Platform Admin only"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Manage Tenants */}
                          {canManageTenants ? (
                            <button
                              onClick={() => setManageTenantsModal({ open: true, user })}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              title="Manage Tenants"
                            >
                              <Building2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-gray-300 dark:text-gray-700 cursor-not-allowed"
                              title="Platform Admin/Support only"
                            >
                              <Building2 className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Reset Password */}
                          {canResetPassword ? (
                            <button
                              onClick={() => setResetPasswordModal({ open: true, user })}
                              className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-gray-300 dark:text-gray-700 cursor-not-allowed"
                              title="Platform Admin/Support only"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Manage Status */}
                          {canEditRole ? (
                            <button
                              onClick={() => setStatusModal({ open: true, user })}
                              className={`${
                                user.is_active && user.email_verified
                                  ? 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300'
                                  : !user.is_active && user.email_verified
                                  ? 'text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300'
                                  : 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
                              }`}
                              title="Manage User Status"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-gray-300 dark:text-gray-700 cursor-not-allowed"
                              title="Platform Admin only"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Delete User */}
                          {canDelete ? (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="text-gray-300 dark:text-gray-700 cursor-not-allowed"
                              title="Platform Admin only"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expandable Tenant Details Row */}
                    {expandedRows.has(user.id) && user.tenants && user.tenants.length > 0 && (
                      <tr key={`tenant-details-${user.id}`} className="bg-gray-50 dark:bg-gray-900/50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                              <Building2 className="w-4 h-4" />
                              <span>Tenant Assignments ({user.tenants.length})</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {user.tenants.map((tenant) => (
                                <div
                                  key={tenant.id}
                                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                                        {tenant.name}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        ID: {tenant.id}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Role Display/Edit */}
                                    {editingTenantRole?.userId === user.id && editingTenantRole?.tenantId === tenant.id ? (
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={editingTenantRole.currentRole}
                                          onChange={(e) => setEditingTenantRole({ ...editingTenantRole, currentRole: e.target.value })}
                                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                          {getTenantRoleOptions().map(option => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => handleSaveTenantRole(user.id, tenant.id, editingTenantRole.currentRole)}
                                          className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                          title="Save"
                                        >
                                          <Save className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={handleCancelEdit}
                                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                          tenant.role === 'OWNER' 
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                            : tenant.role === 'ADMIN'
                                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                                            : tenant.role === 'SUPPORT'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                            : tenant.role === 'MEMBER'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                          {tenant.role}
                                        </span>
                                        {canManageTenants && (
                                          <button
                                            onClick={() => handleEditTenantRole(user.id, tenant.id, tenant.role)}
                                            className="p-1 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                                            title="Edit role"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {filteredUsers.length > pageSize && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadUsers}
      />

      {editModalOpen.user && (
        <EditUserModal
          isOpen={editModalOpen.open}
          onClose={() => setEditModalOpen({ open: false, user: null })}
          user={editModalOpen.user}
          onSuccess={loadUsers}
        />
      )}

      {manageTenantsModal.user && (
        <ManageTenantsModal
          isOpen={manageTenantsModal.open}
          onClose={() => setManageTenantsModal({ open: false, user: null })}
          user={manageTenantsModal.user}
          onSuccess={loadUsers}
        />
      )}

      {resetPasswordModal.user && (
        <ResetPasswordModal
          isOpen={resetPasswordModal.open}
          onClose={() => setResetPasswordModal({ open: false, user: null })}
          userEmail={resetPasswordModal.user.email}
          userId={resetPasswordModal.user.id}
        />
      )}

      {/* User Status Modal */}
      {statusModal.open && statusModal.user && (
        <UserStatusModal
          isOpen={statusModal.open}
          onClose={() => setStatusModal({ open: false, user: null })}
          user={statusModal.user}
          onSuccess={loadUsers}
        />
      )}
    </div>
  );
}
