'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { adminUsersService, AdminUser } from '@/services/AdminUsersService';

interface Tenant {
  id: string;
  name: string;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdUser?: AdminUser | null) => void;
}

export default function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    platformRole: 'USER' as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'OWNER' | 'USER',
    tenantRole: 'MEMBER' as 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER',
    tenantId: '',
  });

  // Load tenants when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTenants();
    }
  }, [isOpen]);

  const loadTenants = async () => {
    setTenantsLoading(true);
    try {
      const tenantList = await adminUsersService.getAllTenants();
      setTenants(tenantList);
      // Auto-select first tenant if available
      if (tenantList.length > 0 && !formData.tenantId) {
        setFormData(prev => ({ ...prev, tenantId: tenantList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setTenantsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await adminUsersService.createUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.name.split(' ')[0] || '',
        lastName: formData.name.split(' ').slice(1).join(' ') || '',
        role: formData.tenantRole,
        tenantId: formData.tenantId,
        platformRole: formData.platformRole,
      });

      if (!result) {
        throw new Error('Failed to create user');
      }

      setSuccess(`✅ User created successfully! Email: ${formData.email}`);
      
      setTimeout(() => {
        onSuccess?.(result);
        onClose();
        setFormData({ email: '', password: '', name: '', platformRole: 'USER', tenantRole: 'MEMBER', tenantId: tenants[0]?.id || '' });
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create Test User
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add a new user for testing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  For Testing Only
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This creates a user directly in the database. Use for testing different user roles and journeys.
                </p>
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="user@example.com"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimum 8 characters"
              minLength={8}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum 8 characters
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          {/* Tenant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tenant *
            </label>
            {tenantsLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading tenants...
              </div>
            ) : (
              <select
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                required
              >
                <option value="">Select a tenant</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Platform Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Platform Role *
            </label>
            <select
              value={formData.platformRole}
              onChange={(e) => setFormData({ ...formData, platformRole: e.target.value as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'OWNER' | 'USER' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <optgroup label="Platform Roles">
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="PLATFORM_SUPPORT">Platform Support</option>
                <option value="PLATFORM_VIEWER">Platform Viewer</option>
              </optgroup>
              <optgroup label="Tenant Roles">
                <option value="OWNER">Tenant Owner</option>
                <option value="USER">Tenant User</option>
              </optgroup>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.platformRole === 'PLATFORM_ADMIN' && 'Full platform access, unlimited tenants'}
              {formData.platformRole === 'PLATFORM_SUPPORT' && 'View all tenants + support actions'}
              {formData.platformRole === 'PLATFORM_VIEWER' && 'Read-only access to all tenants'}
              {formData.platformRole === 'OWNER' && 'Can create/own tenants'}
              {formData.platformRole === 'USER' && 'Basic tenant user'}
            </p>
          </div>

          {/* Tenant Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tenant Role *
            </label>
            <select
              value={formData.tenantRole}
              onChange={(e) => setFormData({ ...formData, tenantRole: e.target.value as 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPPORT">Support</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.tenantRole === 'OWNER' && 'Full control - can manage all settings and users'}
              {formData.tenantRole === 'ADMIN' && 'Can manage most settings and users, cannot change ownership'}
              {formData.tenantRole === 'SUPPORT' && 'Can manage products, orders, and customer interactions'}
              {formData.tenantRole === 'MEMBER' && 'Standard access - can manage products and view orders'}
              {formData.tenantRole === 'VIEWER' && 'Read-only access - can only view data'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
