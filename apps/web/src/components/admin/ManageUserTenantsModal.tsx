'use client';

import { useState, useEffect } from 'react';
import { X, Building2, UserCheck, Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface TenantAssignment {
  tenantId: string;
  tenantName: string;
  role: 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER';
}

interface Tenant {
  id: string;
  name: string;
}

// Local user shape for this modal. Named uniquely to avoid clashing with
// other User interfaces in the codebase while remaining structurally
// compatible with the admin users page User type.
interface ManageUserTenantsModalUser {
  id: string;
  email: string;
  // Allow null here so this type is compatible with the admin users page User,
  // which models firstName/lastName as string | null coming from the backend.
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

interface ManageUserTenantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ManageUserTenantsModalUser | null;
  onSuccess?: () => void;
}

export default function ManageUserTenantsModal({ 
  isOpen, 
  onClose, 
  user, 
  onSuccess 
}: ManageUserTenantsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [tenantAssignments, setTenantAssignments] = useState<TenantAssignment[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  
  // New assignment form
  const [newTenantId, setNewTenantId] = useState('');
  const [newRole, setNewRole] = useState<'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER'>('MEMBER');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && user) {
      // Reset state for fresh load
      setTenantAssignments([]);
      setError('');
      setSuccess('');
      setNewTenantId('');
      setNewRole('MEMBER');
      
      // Load fresh data
      loadUserTenants();
      loadAvailableTenants();
    } else if (!isOpen) {
      // Clean up state when modal closes
      setTenantAssignments([]);
      setAvailableTenants([]);
      setError('');
      setSuccess('');
      setNewTenantId('');
      setNewRole('MEMBER');
      setLoading(false);
      setLoadingTenants(false);
    }
  }, [isOpen, user]);

  const loadUserTenants = async () => {
    if (!user) return;
    
    try {
      setLoadingTenants(true);
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await api.get(`/api/admin/users/${user.id}/tenants?t=${timestamp}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('[Modal] Loaded tenant assignments:', data.tenant);
        // Transform API response to match frontend interface
        const transformedAssignments = (data.tenant || []).map((assignment: any) => ({
          tenantId: assignment.tenant_id,
          tenantName: assignment.tenantName,
          role: assignment.role,
        }));
        setTenantAssignments(transformedAssignments);
      } else {
        console.error('[Modal] Failed to load tenant assignments:', data);
        setError(data.error || 'Failed to load tenant assignments');
      }
    } catch (err) {
      console.error('Failed to load user tenants:', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadAvailableTenants = async () => {
    try {
      const response = await api.get('/api/admin/tenants');
      const data = await response.json();
      
      if (response.ok) {
        console.log('[Modal] Loaded available tenants:', data);
        // API returns array directly, not wrapped in { tenants: [...] }
        setAvailableTenants(Array.isArray(data) ? data : []);
      } else {
        console.error('[Modal] Failed to load available tenants:', data);
      }
    } catch (err) {
      console.error('Failed to load available tenants:', err);
    }
  };

  const handleAddTenant = async () => {
    if (!user || !newTenantId) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post(`/api/admin/users/${user.id}/tenants`, {
        tenant_id: newTenantId,
        role: newRole,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to assign tenant');
      }

      setSuccess('✅ Tenant assigned successfully!');
      setNewTenantId('');
      setNewRole('MEMBER');
      await loadUserTenants();
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTenant = async (tenantId: string) => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.delete(`/api/admin/users/${user.id}/tenants/${tenantId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove tenant assignment');
      }

      setSuccess('✅ Tenant assignment removed!');
      await loadUserTenants();
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tenant assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (tenantId: string, newRole: string) => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch(`/api/admin/users/${user.id}/tenants/${tenantId}`, {
        role: newRole,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update role');
      }

      setSuccess('✅ Role updated successfully!');
      await loadUserTenants();
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      OWNER: { label: 'Owner', color: 'bg-purple-100 text-purple-800' },
      ADMIN: { label: 'Admin', color: 'bg-blue-100 text-blue-800' },
      SUPPORT: { label: 'Support', color: 'bg-green-100 text-green-800' },
      MEMBER: { label: 'Member', color: 'bg-gray-100 text-gray-800' },
      VIEWER: { label: 'Viewer', color: 'bg-yellow-100 text-yellow-800' },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.MEMBER;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getAvailableTenantsForAssignment = () => {
    const assignedTenantIds = tenantAssignments.map(assignment => assignment.tenantId);
    return availableTenants.filter(tenant => !assignedTenantIds.includes(tenant.id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Manage Tenant Access</h2>
              <p className="text-sm text-gray-600">
                {user ? `${user.firstName || ''} ${user.lastName || ''} (${user.email})`.trim() : 'User'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          {/* Current Assignments */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Tenant Assignments</h3>
            
            {loadingTenants ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading assignments...</span>
              </div>
            ) : tenantAssignments.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No tenant assignments</p>
                <p className="text-sm text-gray-500">Add a tenant assignment below</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tenantAssignments.map((assignment) => (
                  <div key={assignment.tenantId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{assignment.tenantName}</p>
                        <p className="text-sm text-gray-600">{assignment.tenantId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={assignment.role}
                        onChange={(e) => handleUpdateRole(assignment.tenantId, e.target.value)}
                        disabled={loading}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPPORT">Support</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      {getRoleBadge(assignment.role)}
                      <button
                        onClick={() => handleRemoveTenant(assignment.tenantId)}
                        disabled={loading}
                        className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors disabled:opacity-50"
                        title="Remove assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Assignment */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Tenant Assignment</h3>
            
            {getAvailableTenantsForAssignment().length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">All available tenants are already assigned</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tenant
                  </label>
                  <select
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a tenant...</option>
                    {getAvailableTenantsForAssignment().map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'VIEWER')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="OWNER">Owner - Full control + billing + can delete</option>
                    <option value="ADMIN">Admin - Full operations, no billing, can delete</option>
                    <option value="SUPPORT">Support - Can manage operations but cannot delete tenant/items</option>
                    <option value="MEMBER">Member - Regular member (edit only)</option>
                    <option value="VIEWER">Viewer - Read-only access</option>
                  </select>
                </div>

                <button
                  onClick={handleAddTenant}
                  disabled={loading || !newTenantId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {loading ? 'Adding...' : 'Add Assignment'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
