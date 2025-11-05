'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  metadata?: {
    businessName?: string;
  };
}

interface PropagateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  currentTenantId: string;
  organizationId?: string;
  onSuccess?: () => void;
}

export default function PropagateItemModal({
  isOpen,
  onClose,
  itemId,
  itemName,
  currentTenantId,
  organizationId,
  onSuccess,
}: PropagateItemModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen && organizationId) {
      loadTenants();
    }
  }, [isOpen, organizationId]);

  const loadTenants = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/organizations/${organizationId}`);
      if (!res.ok) throw new Error('Failed to load organization');
      
      const data = await res.json();
      // Filter out current tenant
      const otherTenants = data.tenants.filter((t: Tenant) => t.id !== currentTenantId);
      setTenants(otherTenants);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTenant = (tenantId: string) => {
    setSelectedTenantIds(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTenantIds.length === tenants.length) {
      setSelectedTenantIds([]);
    } else {
      setSelectedTenantIds(tenants.map(t => t.id));
    }
  };

  const handlePropagate = async () => {
    if (!organizationId || selectedTenantIds.length === 0) return;

    setPropagating(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.post(`/api/organizations/${organizationId}/items/propagate`, {
        sourceItemId: itemId,
        targetTenantIds: selectedTenantIds,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to propagate item');
      }

      const data = await res.json();
      setResult(data);
      
      if (data.summary.created > 0) {
        onSuccess?.();
      }
    } catch (err: any) {
      console.error('Failed to propagate:', err);
      setError(err.message || 'Failed to propagate item');
    } finally {
      setPropagating(false);
    }
  };

  const handleClose = () => {
    setSelectedTenantIds([]);
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  if (!organizationId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Not Available
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            This location is not part of a chain organization. Item propagation is only available for chain accounts.
          </p>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          Propagate Item to Other Locations
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Copy "{itemName}" to other locations in your chain
        </p>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Loading locations...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              Propagation Complete!
            </h4>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <p>✅ Created: {result.summary.created} location{result.summary.created !== 1 ? 's' : ''}</p>
              {result.summary.skipped > 0 && (
                <p>⏭️ Skipped: {result.summary.skipped} (already exists)</p>
              )}
              {result.summary.errors > 0 && (
                <p>❌ Errors: {result.summary.errors}</p>
              )}
            </div>
          </div>
        )}

        {!loading && !result && tenants.length === 0 && (
          <div className="text-center py-8 text-neutral-600 dark:text-neutral-400">
            No other locations found in this organization.
          </div>
        )}

        {!loading && !result && tenants.length > 0 && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTenantIds.length === tenants.length}
                  onChange={handleSelectAll}
                  className="rounded border-neutral-300 dark:border-neutral-600"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Select All ({tenants.length} locations)
                </span>
              </label>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {selectedTenantIds.length} selected
              </span>
            </div>

            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded p-3">
              {tenants.map(tenant => (
                <label
                  key={tenant.id}
                  className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTenantIds.includes(tenant.id)}
                    onChange={() => handleToggleTenant(tenant.id)}
                    className="rounded border-neutral-300 dark:border-neutral-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900 dark:text-white">
                      {tenant.metadata?.businessName || tenant.name}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
            disabled={propagating}
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handlePropagate}
              disabled={propagating || selectedTenantIds.length === 0 || loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {propagating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Propagating...
                </span>
              ) : (
                `Propagate to ${selectedTenantIds.length} Location${selectedTenantIds.length !== 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
