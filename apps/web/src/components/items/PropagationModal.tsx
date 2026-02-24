/**
 * Platform-Aligned Propagation Modal
 * Uses platform UI components and service patterns
 */

'use client';

import { useState } from 'react';
import { Modal, Alert, Button } from '@/components/ui';
import { propagationService, type PropagationRequest, type PropagationResult, type OrganizationTenant } from '@/services/PropagationService';

interface PropagationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  currentTenantId: string;
  organizationId: string;
  onSuccess?: () => void;
}

export default function PropagationModal({
  isOpen,
  onClose,
  itemId,
  itemName,
  currentTenantId,
  organizationId,
  onSuccess,
}: PropagationModalProps) {
  const [tenants, setTenants] = useState<OrganizationTenant[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'create_only' | 'update_only' | 'create_or_update'>('create_or_update');
  const [loading, setLoading] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PropagationResult | null>(null);

  // Load tenants when modal opens
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
    }
  };

  // Handle propagation
  const handlePropagate = async () => {
    if (!organizationId || selectedTenantIds.length === 0) return;

    setPropagating(true);
    setError(null);
    setResult(null);

    try {
      const request: PropagationRequest = {
        sourceItemId: itemId,
        sourceTenantId: currentTenantId,
        targetTenantIds: selectedTenantIds,
        mode
      };

      const propagationResult = await propagationService.propagateItem(organizationId, request);
      setResult(propagationResult);

      if (propagationResult.summary.created > 0 || propagationResult.summary.updated > 0) {
        onSuccess?.();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to propagate item');
    } finally {
      setPropagating(false);
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedTenantIds([]);
    setResult(null);
    setError(null);
    onClose();
  };

  // Load tenants when modal opens
  if (isOpen && tenants.length === 0 && !loading) {
    loadTenants();
  }

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Propagate Item to Other Locations"
      description={`Copy "${itemName}" to other locations in your organization`}
      size="lg"
    >
      <div className="space-y-6">
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Locations ({selectedTenantIds.length} selected)
          </label>
          
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
          <Alert variant="success" title="Propagation Complete!">
            <div className="space-y-1">
              {result.summary.created > 0 && (
                <p>✅ Created: {result.summary.created} location{result.summary.created !== 1 ? 's' : ''}</p>
              )}
              {result.summary.updated > 0 && (
                <p>✅ Updated: {result.summary.updated} location{result.summary.updated !== 1 ? 's' : ''}</p>
              )}
              {result.summary.failed > 0 && (
                <p>❌ Failed: {result.summary.failed} location{result.summary.failed !== 1 ? 's' : ''}</p>
              )}
              {result.summary.skipped > 0 && (
                <p>⏭️ Skipped: {result.summary.skipped} location{result.summary.skipped !== 1 ? 's' : ''}</p>
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
            disabled={propagating || selectedTenantIds.length === 0}
            loading={propagating}
          >
            {propagating ? 'Propagating...' : `Propagate to ${selectedTenantIds.length} Location${selectedTenantIds.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
