/**
 * Bulk Propagation Modal
 * Propagate multiple items to other organization locations
 */

'use client';

import { useState, useEffect } from 'react';
import { Modal, Alert, Button } from '@/components/ui';
import { propagationService, type OrganizationTenant } from '@/services/PropagationService';

interface BulkPropagationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemIds: string[];
  itemNames: string[];
  currentTenantId: string;
  organizationId: string;
  onSuccess?: () => void;
}

interface BulkPropagationResult {
  success: boolean;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  errors?: Array<{ item_id: string; error: string }>;
}

export default function BulkPropagationModal({
  isOpen,
  onClose,
  itemIds,
  itemNames,
  currentTenantId,
  organizationId,
  onSuccess,
}: BulkPropagationModalProps) {
  const [tenants, setTenants] = useState<OrganizationTenant[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'create_only' | 'update_only' | 'create_or_update'>('create_or_update');
  const [loading, setLoading] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkPropagationResult | null>(null);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);

  // Load tenants when modal opens
  useEffect(() => {
    if (isOpen && organizationId && !tenantsLoaded && !loading) {
      loadTenants();
    }
  }, [isOpen, organizationId, tenantsLoaded, loading]);

  const loadTenants = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const organizationTenants = await propagationService.getOrganizationTenants(organizationId);
      // Filter out current tenant
      const otherTenants = organizationTenants.filter(tenant => tenant.id !== currentTenantId);
      setTenants(otherTenants);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load locations');
    } finally {
      setLoading(false);
      setTenantsLoaded(true);
    }
  };

  // Handle bulk propagation
  const handlePropagate = async () => {
    if (!organizationId || selectedTenantIds.length === 0 || itemIds.length === 0) return;

    setPropagating(true);
    setError(null);
    setResult(null);

    try {
      const propagationResult = await propagationService.propagateItemsBulk(organizationId, {
        sourceItemIds: itemIds,
        targetTenantIds: selectedTenantIds,
        mode
      });
      
      setResult(propagationResult);

      if (propagationResult.summary.created > 0 || propagationResult.summary.updated > 0) {
        onSuccess?.();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to propagate items');
    } finally {
      setPropagating(false);
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedTenantIds([]);
    setResult(null);
    setError(null);
    setTenantsLoaded(false);
    setTenants([]);
    onClose();
  };

  // Select/deselect all tenants
  const toggleAllTenants = () => {
    if (selectedTenantIds.length === tenants.length) {
      setSelectedTenantIds([]);
    } else {
      setSelectedTenantIds(tenants.map(t => t.id));
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Propagate ${itemIds.length} Items to Other Locations`}
      description="Copy selected items to other locations in your organization"
      size="lg"
    >
      <div className="space-y-6">
        {/* Items Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>{itemIds.length} item(s)</strong> selected for propagation
          </p>
          {itemNames.length <= 5 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {itemNames.join(', ')}
            </p>
          )}
          {itemNames.length > 5 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {itemNames.slice(0, 3).join(', ')} and {itemNames.length - 3} more...
            </p>
          )}
        </div>

        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Propagation Mode
          </label>
          <div className="flex gap-2">
            <Button
              variant={mode === 'create_only' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create_only')}
            >
              Create Only
            </Button>
            <Button
              variant={mode === 'update_only' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('update_only')}
            >
              Update Only
            </Button>
            <Button
              variant={mode === 'create_or_update' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create_or_update')}
            >
              Create or Update
            </Button>
          </div>
        </div>

        {/* Tenant Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Locations ({selectedTenantIds.length} selected)
            </label>
            {tenants.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAllTenants}>
                {selectedTenantIds.length === tenants.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading locations...</p>
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No other locations available in this organization
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tenants.map((tenant) => (
                <label
                  key={tenant.id}
                  className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedTenantIds.includes(tenant.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTenantIds([...selectedTenantIds, tenant.id]);
                      } else {
                        setSelectedTenantIds(selectedTenantIds.filter(id => id !== tenant.id));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {tenant.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {tenant.id}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="error" title="Propagation Error">
            {error}
          </Alert>
        )}

        {/* Success Display */}
        {result && (
          <Alert variant="success" title="Bulk Propagation Complete!">
            <div className="space-y-1">
              {result.summary.created > 0 && (
                <p>✅ Created: {result.summary.created} item(s) across locations</p>
              )}
              {result.summary.updated > 0 && (
                <p>✅ Updated: {result.summary.updated} item(s) across locations</p>
              )}
              {result.summary.failed > 0 && (
                <p>❌ Failed: {result.summary.failed} operation(s)</p>
              )}
              {result.summary.skipped > 0 && (
                <p>⏭️ Skipped: {result.summary.skipped} item(s)</p>
              )}
            </div>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={handleClose} disabled={propagating}>
            Cancel
          </Button>
          <Button
            onClick={handlePropagate}
            disabled={propagating || selectedTenantIds.length === 0 || itemIds.length === 0}
            loading={propagating}
          >
            {propagating ? 'Propagating...' : `Propagate ${itemIds.length} Item${itemIds.length !== 1 ? 's' : ''} to ${selectedTenantIds.length} Location${selectedTenantIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
