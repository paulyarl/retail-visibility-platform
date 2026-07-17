'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { adminUsersService } from '@/services/AdminUsersService';
import { clientLogger } from '@/lib/client-logger';

interface DeleteTestTenantModalProps {
  onClose: () => void;
}

interface Tenant {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

export default function DeleteTestTenantModal({ onClose }: DeleteTestTenantModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedInfo, setDeletedInfo] = useState<any>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const data = await platformHomeService.getTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      clientLogger.error('Failed to fetch tenants:', { detail: err });
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTenantId) {
      setError('Please select a tenant to delete');
      return;
    }

    const selectedTenant = tenants.find(t => t.id === selectedTenantId);
    if (confirmText !== selectedTenant?.name) {
      setError(`Please type "${selectedTenant?.name}" to confirm deletion`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await adminUsersService.deleteTestTenant(selectedTenantId);
      setDeletedInfo(data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete test tenant');
    } finally {
      setLoading(false);
    }
  };

  if (success && deletedInfo) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">Tenant Deleted!</h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            The test tenant and all associated data have been removed
          </p>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tenant ID:</span>
              <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{deletedInfo.tenantId}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Products Deleted:</span>
              <span className="font-medium">{deletedInfo.deletedProducts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Categories Deleted:</span>
              <span className="font-medium">{deletedInfo.deletedCategories}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Delete Test Tenant</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Permanently remove a test tenant and all its data
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Tenant to Delete <span className="text-red-500">*</span>
            </label>
            {loadingTenants ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value);
                  setConfirmText('');
                  setError(null);
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                disabled={loading}
              >
                <option value="">-- Select a tenant --</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.city && `(${tenant.city}, ${tenant.state})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedTenant && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type "{selectedTenant.name}" to confirm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={selectedTenant.name}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                disabled={loading}
              />
            </div>
          )}
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-semibold mb-1">⚠️ Warning: This action cannot be undone!</p>
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The tenant and all its settings</li>
                <li>All products in the tenant</li>
                <li>All categories in the tenant</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || !selectedTenantId || confirmText !== selectedTenant?.name}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Delete Tenant
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
