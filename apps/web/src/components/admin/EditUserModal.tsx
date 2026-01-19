'use client';

import { useState } from 'react';
import { X, Edit2, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  onSuccess?: () => void;
}

export default function EditUserModal({ isOpen, onClose, user, onSuccess }: EditUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: user.name?.split(' ')[0] || '',
    lastName: user.name?.split(' ').slice(1).join(' ') || '',
    role: user.role as 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'ADMIN' | 'OWNER' | 'USER' | 'TENANT_OWNER' | 'TENANT_ADMIN' | 'TENANT_MANAGER' | 'TENANT_MEMBER' | 'TENANT_VIEWER',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}`, {
        method: 'PUT', // Use PUT instead of PATCH
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update user');
      }

      const result = await response.json();
      setSuccess(`✅ User updated successfully!`);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Edit User Role
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-green-800 dark:text-green-200 font-medium">{success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name (Optional)
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter first name"
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name (Optional)
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter last name"
                />
              </div>

              {/* Role Field */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <optgroup label="Platform Roles">
                    <option value="PLATFORM_ADMIN">Platform Admin</option>
                    <option value="PLATFORM_SUPPORT">Platform Support</option>
                    <option value="PLATFORM_VIEWER">Platform Viewer</option>
                  </optgroup>
                  <optgroup label="Legacy Roles">
                    <option value="ADMIN">Admin (Legacy)</option>
                  </optgroup>
                  <optgroup label="Tenant Roles">
                    <option value="OWNER">Owner</option>
                    <option value="USER">User</option>
                    <option value="TENANT_OWNER">Tenant Owner</option>
                    <option value="TENANT_ADMIN">Tenant Admin</option>
                    <option value="TENANT_MANAGER">Tenant Manager</option>
                    <option value="TENANT_MEMBER">Tenant Member</option>
                    <option value="TENANT_VIEWER">Tenant Viewer</option>
                  </optgroup>
                </select>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Select the appropriate role for this user. Platform roles have system-wide access.
                </p>
              </div>

              {/* Role Description */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Role Permissions</h4>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {formData.role === 'PLATFORM_ADMIN' && (
                    <>
                      <p>• Full platform access and control</p>
                      <p>• Can manage all users and tenants</p>
                      <p>• Can delete users and modify system settings</p>
                    </>
                  )}
                  {formData.role === 'PLATFORM_SUPPORT' && (
                    <>
                      <p>• View all platform data</p>
                      <p>• Can reset passwords and manage users</p>
                      <p>• Limited to 3 tenant creation</p>
                    </>
                  )}
                  {formData.role === 'PLATFORM_VIEWER' && (
                    <>
                      <p>• Read-only access to platform data</p>
                      <p>• Cannot create or modify users</p>
                      <p>• Cannot create tenants</p>
                    </>
                  )}
                  {formData.role === 'ADMIN' && (
                    <>
                      <p>• Legacy platform admin role</p>
                      <p>• Full platform access (deprecated)</p>
                      <p>• Use PLATFORM_ADMIN instead</p>
                    </>
                  )}
                  {(formData.role === 'OWNER' || formData.role === 'TENANT_OWNER') && (
                    <>
                      <p>• Full control over assigned tenants</p>
                      <p>• Can manage tenant users</p>
                      <p>• Subject to tier-based limits</p>
                    </>
                  )}
                  {(formData.role === 'USER' || formData.role === 'TENANT_MEMBER') && (
                    <>
                      <p>• Basic tenant access</p>
                      <p>• Can view and edit inventory</p>
                      <p>• No administrative functions</p>
                    </>
                  )}
                  {formData.role === 'TENANT_ADMIN' && (
                    <>
                      <p>• Administrative access to tenants</p>
                      <p>• Can manage tenant operations</p>
                      <p>• Cannot delete tenants</p>
                    </>
                  )}
                  {formData.role === 'TENANT_MANAGER' && (
                    <>
                      <p>• Day-to-day tenant management</p>
                      <p>• Can manage inventory and orders</p>
                      <p>• Limited administrative functions</p>
                    </>
                  )}
                  {formData.role === 'TENANT_VIEWER' && (
                    <>
                      <p>• Read-only tenant access</p>
                      <p>• Can view inventory and reports</p>
                      <p>• No editing capabilities</p>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Update Role
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
