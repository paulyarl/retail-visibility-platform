'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Key, Trash2, Shield, User as UserIcon, Search, Filter } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import CreateUserModal from '@/components/admin/CreateUserModal';
import ResetPasswordModal from '@/components/admin/ResetPasswordModal';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { canManageUsers, canViewUsers } from '@/lib/auth/access-control';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
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
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const canManage = user ? canManageUsers(user) : false;
  const canView = user ? canViewUsers(user) : false;
  const canCreateUser = user ? (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') : false;
  const canResetPassword = user ? (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_SUPPORT') : false;
  const canDelete = user ? (user.role === 'PLATFORM_ADMIN') : false;
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  
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
        setUsers(data.users || []);
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

  // Filter and paginate users
  const filteredUsers = users.filter(u => {
    // Search matching
    const matchesSearch = !searchQuery || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         u.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Role filtering
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    // Status filtering with robust boolean handling
    const isActive = Boolean(u.is_active);
    const isVerified = Boolean(u.email_verified);
    
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = isActive;
    } else if (statusFilter === 'inactive') {
      matchesStatus = !isActive;
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Test User Management"
        description="Create and manage platform users for testing"
        icon={Icons.Settings}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Platform Users
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredUsers.length} of {users.length} users
            </p>
          </div>
          {canCreateUser ? (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
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
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    statusFilter === 'all' 
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  All Status ({users.length})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('active');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    statusFilter === 'active' 
                      ? 'bg-green-100 text-green-800 border-green-300 ring-2 ring-green-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Active ({users.filter(u => u.is_active).length})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('inactive');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    statusFilter === 'inactive' 
                      ? 'bg-red-100 text-red-800 border-red-300 ring-2 ring-red-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Inactive ({users.filter(u => !u.is_active).length})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('pending');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    statusFilter === 'pending' 
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 ring-2 ring-yellow-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Pending ({users.filter(u => !u.is_active && !u.email_verified).length})
                </button>
              </div>
            </div>
            
            {/* Role Filters */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setRoleFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'all' 
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  All Roles ({users.length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('PLATFORM_ADMIN');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'PLATFORM_ADMIN' 
                      ? 'bg-purple-100 text-purple-800 border-purple-300 ring-2 ring-purple-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Platform Admin ({users.filter(u => u.role === 'PLATFORM_ADMIN').length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('PLATFORM_SUPPORT');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'PLATFORM_SUPPORT' 
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Platform Support ({users.filter(u => u.role === 'PLATFORM_SUPPORT').length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('PLATFORM_VIEWER');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'PLATFORM_VIEWER' 
                      ? 'bg-gray-100 text-gray-800 border-gray-300 ring-2 ring-gray-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Platform Viewer ({users.filter(u => u.role === 'PLATFORM_VIEWER').length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('OWNER');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'OWNER' 
                      ? 'bg-orange-100 text-orange-800 border-orange-300 ring-2 ring-orange-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Tenant Owner ({users.filter(u => u.role === 'OWNER').length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('USER');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'USER' 
                      ? 'bg-green-100 text-green-800 border-green-300 ring-2 ring-green-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Tenant User ({users.filter(u => u.role === 'USER').length})
                </button>
                <button
                  onClick={() => {
                    setRoleFilter('ADMIN');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                    roleFilter === 'ADMIN' 
                      ? 'bg-purple-100 text-purple-800 border-purple-300 ring-2 ring-purple-500' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  Admin ({users.filter(u => u.role === 'ADMIN').length})
                </button>
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
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first test user to get started'}
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
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name || 'Unnamed User'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                            : user.role === 'PLATFORM_SUPPORT'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : user.role === 'PLATFORM_VIEWER'
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            : user.role === 'OWNER'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {(user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') && <Shield className="w-3 h-3" />}
                          {user.role === 'PLATFORM_ADMIN' ? 'Platform Admin' :
                           user.role === 'PLATFORM_SUPPORT' ? 'Platform Support' :
                           user.role === 'PLATFORM_VIEWER' ? 'Platform Viewer' :
                           user.role === 'OWNER' ? 'Tenant Owner' :
                           user.role === 'USER' ? 'Tenant User' :
                           user.role === 'ADMIN' ? 'Admin (Deprecated)' : user.role}
                        </span>
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
                          {canResetPassword ? (
                            <button
                              onClick={() => setResetPasswordModal({ open: true, user })}
                              className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                              title="Reset Password (Platform Admin/Support)"
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
                          {canDelete ? (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete User (Platform Admin only)"
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

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Testing User Journeys
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Create users with different roles to test various user experiences:
            </p>
            <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
              <div>
                <p className="font-semibold mb-1">Platform Users:</p>
                <ul className="ml-4 space-y-1">
                  <li>• <strong>Platform Admin:</strong> Full access, unlimited tenants</li>
                  <li>• <strong>Platform Support:</strong> View all + support (3 tenant limit)</li>
                  <li>• <strong>Platform Viewer:</strong> Read-only access (cannot create)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Tenant Users:</p>
                <ul className="ml-4 space-y-1">
                  <li>• <strong>Tenant Owner:</strong> Can own tenants (tier-based limits)</li>
                  <li>• <strong>Tenant User:</strong> Basic access (tier-based limits)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
              Password Management
            </h3>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Reset passwords for test users as needed. Passwords are hashed and stored securely.
            </p>
            <p className="mt-3 text-sm text-orange-800 dark:text-orange-200">
              <strong>Tip:</strong> Use simple passwords for test accounts (e.g., "password123")
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadUsers}
      />

      {resetPasswordModal.user && (
        <ResetPasswordModal
          isOpen={resetPasswordModal.open}
          onClose={() => setResetPasswordModal({ open: false, user: null })}
          userEmail={resetPasswordModal.user.email}
          userId={resetPasswordModal.user.id}
        />
      )}
    </div>
  );
}
