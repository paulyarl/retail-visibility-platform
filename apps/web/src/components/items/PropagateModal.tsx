import { useState } from 'react';
import { Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';

interface PropagateModalProps {
  item: Item;
  organizationId?: string;
  onPropagate: (itemId: string, targetTenants: string[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for propagating items to other tenants
 * Allows selection of target tenants within organization
 */
export default function PropagateModal({
  item,
  organizationId,
  onPropagate,
  onClose,
}: PropagateModalProps) {
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [propagating, setPropagating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock tenants - in real implementation, fetch from API based on organizationId
  const mockTenants = [
    { id: 'tenant-1', name: 'Store Location 1', city: 'New York' },
    { id: 'tenant-2', name: 'Store Location 2', city: 'Los Angeles' },
    { id: 'tenant-3', name: 'Store Location 3', city: 'Chicago' },
    { id: 'tenant-4', name: 'Store Location 4', city: 'Houston' },
  ];

  const toggleTenant = (tenantId: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const selectAll = () => {
    setSelectedTenants(mockTenants.map(t => t.id));
  };

  const deselectAll = () => {
    setSelectedTenants([]);
  };

  const handlePropagate = async () => {
    setPropagating(true);
    setError(null);

    try {
      await onPropagate(item.id, selectedTenants);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propagate item');
    } finally {
      setPropagating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Propagate Item
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Copy this item to other locations
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Info */}
          <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
            <div className="flex items-center gap-3">
              {item.images && item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
              )}
              <div>
                <div className="font-medium text-neutral-900 dark:text-white">
                  {item.name}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  SKU: {item.sku} • ${((item.price ?? 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {/* Selection Controls */}
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Select Target Locations ({selectedTenants.length} selected)
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Select All
              </button>
              <span className="text-neutral-300">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-neutral-600 hover:text-neutral-700"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Tenant List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {mockTenants.map((tenant) => (
              <label
                key={tenant.id}
                className="flex items-center gap-3 p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTenants.includes(tenant.id)}
                  onChange={() => toggleTenant(tenant.id)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {tenant.name}
                  </div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {tenant.city}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Warning */}
          {selectedTenants.length > 0 && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-warning">
                  This will create a copy of this item in {selectedTenants.length} location{selectedTenants.length !== 1 ? 's' : ''}.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <Button variant="secondary" onClick={onClose} disabled={propagating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePropagate}
            disabled={selectedTenants.length === 0 || propagating}
            loading={propagating}
          >
            {propagating ? 'Propagating...' : `Propagate to ${selectedTenants.length} Location${selectedTenants.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
