'use client';

import { useState, useEffect } from 'react';
import { X, Building2, Plus, Trash2, Loader2, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui';

interface ManageTenantsModalProps {
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

interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface EditRoleState {
  tenantId: string;
  currentRole: string;
  newRole: string;
}

export default function ManageTenantsModal({ isOpen, onClose, user, onSuccess }: ManageTenantsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [editingRole, setEditingRole] = useState<EditRoleState | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTenantData();
    }
  }, [isOpen, user.id]);

  const loadTenantData = async () => {
    setLoadingTenants(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      // Load user's current tenants from admin endpoint
      const userTenantsResponse = await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      // Load all available tenants from admin endpoint (all tenants for user management)
      const allTenantsResponse = await fetch(`${apiUrl}/api/admin/tenants/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (userTenantsResponse.ok && allTenantsResponse.ok) {
        const userTenantsData = await userTenantsResponse.json();
        const allTenantsData = await allTenantsResponse.json();
        
        console.log('Debug - API responses:', {
          userTenantsData,
          allTenantsData
        });
        
        // Format user tenants to match expected structure
        // Note: API returns "tenant" (singular) not "tenants" (plural)
        const userTenantsArray = userTenantsData.tenant || userTenantsData.tenants || [];
        const formattedUserTenants = userTenantsArray.map((t: any) => ({
          id: t.tenant_id,
          name: t.tenantName,
          role: t.role,
        }));
        
        setUserTenants(formattedUserTenants);
        
        // Filter out tenants the user already has access to
        const userTenantIds = formattedUserTenants.map((t: Tenant) => t.id);
        const allTenantsArray = allTenantsData.tenants || [];
        console.log('Debug - Tenant filtering:', {
          userTenantIds,
          allTenantsArray: allTenantsArray.map((t: any) => ({ id: t.id, name: t.name }))
        });
        const available = allTenantsArray.filter((t: any) => !userTenantIds.includes(t.id));
        setAvailableTenants(available);
        
        console.log('Debug - Processed data:', {
          formattedUserTenants,
          availableTenants: available,
          totalTenants: allTenantsArray.length,
          userTenantCount: formattedUserTenants.length,
          availableCount: available.length
        });
      } else {
        console.error('API responses:', {
          userTenantsStatus: userTenantsResponse.status,
          allTenantsStatus: allTenantsResponse.status,
          userTenantsOk: userTenantsResponse.ok,
          allTenantsOk: allTenantsResponse.ok,
          userTenantsText: await userTenantsResponse.text(),
          allTenantsText: await allTenantsResponse.text()
        });
        
        // Check specific error for the /all endpoint
        if (!allTenantsResponse.ok && allTenantsResponse.status === 403) {
          setError('Insufficient permissions to view all tenants. Platform Admin or Platform Support required.');
        } else {
          setError('Failed to load tenant data');
        }
      }
    } catch (error) {
      console.error('Failed to load tenant data:', error);
      setError('Failed to load tenant data');
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleAddTenant = async () => {
    if (!selectedTenant) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          role: 'ADMIN', // Use ADMIN instead of TENANT_ADMIN to match enum
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to add tenant access');
      }

      setSuccess(`✅ Tenant access added successfully!`);
      setSelectedTenant('');
      await loadTenantData(); // Reload tenant data
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tenant access');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTenant = async (tenantId: string) => {
    if (!confirm('Remove this tenant access? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to remove tenant access');
      }

      setSuccess(`✅ Tenant access removed successfully!`);
      await loadTenantData(); // Reload tenant data
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove tenant access');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (tenantId: string, currentRole: string) => {
    setEditingRole({
      tenantId,
      currentRole,
      newRole: currentRole,
    });
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      // First remove the existing assignment
      await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants/${editingRole.tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Then add with new role
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: editingRole.tenantId,
          role: editingRole.newRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to update tenant role');
      }

      setSuccess(`✅ Tenant role updated successfully!`);
      setEditingRole(null);
      await loadTenantData(); // Reload tenant data
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant role');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      setSelectedTenant('');
      onClose();
      onSuccess?.();
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
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Manage Tenants
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {loadingTenants ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Tenants */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Current Tenant Access ({userTenants.length})
                </h3>
                
                {userTenants.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No tenant access assigned</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Add tenant access below to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userTenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {tenant.name}
                            </p>
                            {editingRole?.tenantId === tenant.id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <select
                                  value={editingRole.newRole}
                                  onChange={(e) => setEditingRole({ ...editingRole, newRole: e.target.value })}
                                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  <option value="OWNER">Owner</option>
                                  <option value="ADMIN">Admin</option>
                                  <option value="MEMBER">Member</option>
                                  <option value="VIEWER">Viewer</option>
                                </select>
                                <Button
                                  size="sm"
                                  onClick={handleSaveRole}
                                  disabled={loading || editingRole.newRole === editingRole.currentRole}
                                  className="px-2 py-1 text-xs"
                                >
                                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={loading}
                                  className="px-2 py-1 text-xs"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Role: <span className="font-medium">{tenant.role}</span>
                                <button
                                  onClick={() => handleEditRole(tenant.id, tenant.role)}
                                  className="ml-2 text-blue-600 hover:text-blue-700 text-xs underline"
                                >
                                  Edit
                                </button>
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTenant(tenant.id)}
                          disabled={loading || editingRole?.tenantId === tenant.id}
                          className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Debug Info - Remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                    Debug Info
                  </h4>
                  <div className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
                    <p>User Tenants: {userTenants.length}</p>
                    <p>Available Tenants: {availableTenants.length}</p>
                    <p>Loading: {loadingTenants ? 'Yes' : 'No'}</p>
                    <p>User ID: {user.id}</p>
                    <div className="mt-2">
                      <p className="font-medium">User Tenants:</p>
                      {userTenants.map(t => (
                        <p key={t.id}>- {t.name} ({t.id})</p>
                      ))}
                    </div>
                    <div className="mt-2">
                      <p className="font-medium">Available Tenants:</p>
                      {availableTenants.length === 0 ? (
                        <p className="text-red-600">No available tenants - user has access to all tenants in the system</p>
                      ) : (
                        availableTenants.map(t => (
                          <p key={t.id}>- {t.name} ({t.id})</p>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Add New Tenant */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Tenant Access
                </h3>
                
                {availableTenants.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No available tenants</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      This user has access to all {userTenants.length} tenants in the system
                    </p>
                    {userTenants.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        To assign new tenants, create additional tenants first, then return here to assign them.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="tenant" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Tenant
                      </label>
                      <select
                        id="tenant"
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Choose a tenant...</option>
                        {availableTenants.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <Button
                      onClick={handleAddTenant}
                      disabled={!selectedTenant || loading}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add Tenant Access
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Tenant Access Management
                </h4>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p>• Users can be assigned to multiple tenants</p>
                  <p>• Each assignment includes a role within that tenant</p>
                  <p>• Removing access does not delete the tenant</p>
                  <p>• Platform admins can manage all tenant assignments</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
