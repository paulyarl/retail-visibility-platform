"use client";

import { useEffect, useState } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Item } from '@/services/itemsDataService';

interface TrashBinClientProps {
  tenantId: string;
}

interface TrashCapacity {
  current: number;
  capacity: number;
  remaining: number;
  percent: number;
  status: 'healthy' | 'warning' | 'critical';
  color: 'green' | 'yellow' | 'red';
  isFull: boolean;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TrashBinClient({ tenantId }: TrashBinClientProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<TrashCapacity | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: async () => {},
  });

  // Removed viewMode - using simple list view only

  // Load trashed items and capacity
  const loadTrash = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load items and capacity in parallel
      const [itemsResponse, capacityResponse] = await Promise.all([
        api.get(`/api/items?tenantId=${tenantId}&status=trashed&limit=100`),
        api.get(`/api/trash/capacity?tenantId=${tenantId}`)
      ]);
      
      if (!itemsResponse.ok) throw new Error('Failed to load trash');
      const itemsData = await itemsResponse.json();
      setItems(itemsData.items || []);
      
      if (capacityResponse.ok) {
        const capacityData = await capacityResponse.json();
        setCapacity(capacityData);
      }
    } catch (err) {
      console.error('[TrashBin] Load error:', err);
      setError('Failed to load trash bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadTrash();
    }
  }, [tenantId]);

  // Restore item
  const handleRestore = async (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restore Item',
      message: `Restore "${item.name}" from trash? It will be set back to active status.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          const response = await api.patch(`/api/items/${item.id}/restore`);
          if (!response.ok) throw new Error('Failed to restore');
          await loadTrash();
        } catch (err) {
          console.error('[TrashBin] Restore error:', err);
          setError('Failed to restore item');
        }
      },
    });
  };

  // Permanently delete item
  const handlePurge = async (item: Item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete',
      message: `Are you sure you want to permanently delete "${item.name}"? This action CANNOT be undone!`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await api.delete(`/api/items/${item.id}/purge`);
          if (!response.ok) throw new Error('Failed to purge');
          await loadTrash();
        } catch (err) {
          console.error('[TrashBin] Purge error:', err);
          setError('Failed to permanently delete item');
        }
      },
    });
  };

  // Empty entire trash
  const handleEmptyTrash = async () => {
    if (items.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Empty Trash',
      message: `Are you sure you want to permanently delete ALL ${items.length} items in trash? This action CANNOT be undone!`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(items.map(item => api.delete(`/api/items/${item.id}/purge`)));
          await loadTrash();
        } catch (err) {
          console.error('[TrashBin] Empty trash error:', err);
          setError('Failed to empty trash');
        }
      },
    });
  };

  // Get capacity color classes
  const getCapacityColorClasses = () => {
    if (!capacity) return { bg: 'bg-green-500', text: 'text-green-900', border: 'border-green-200' };
    if (capacity.color === 'red') return { bg: 'bg-red-500', text: 'text-red-900', border: 'border-red-200' };
    if (capacity.color === 'yellow') return { bg: 'bg-yellow-500', text: 'text-yellow-900', border: 'border-yellow-200' };
    return { bg: 'bg-green-500', text: 'text-green-900', border: 'border-green-200' };
  };

  const colorClasses = getCapacityColorClasses();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash Bin"
        description={`${items.length} item${items.length !== 1 ? 's' : ''} in trash`}
        actions={
          items.length > 0 && (
            <Button
              onClick={handleEmptyTrash}
              variant="danger"
              size="sm"
            >
              Empty Trash
            </Button>
          )
        }
      />

      {/* Capacity Indicator */}
      {capacity && (
        <div className={`border ${colorClasses.border} rounded-lg p-4 ${capacity.status === 'critical' ? 'bg-red-50' : capacity.status === 'warning' ? 'bg-yellow-50' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Trash Capacity</span>
              <span className={`text-sm ${colorClasses.text}`}>
                {capacity.current} / {capacity.capacity} items ({capacity.percent}%)
              </span>
            </div>
            {capacity.isFull && (
              <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">
                FULL
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`${colorClasses.bg} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(100, capacity.percent)}%` }}
            />
          </div>
          {capacity.status === 'critical' && (
            <p className="text-xs text-red-600 mt-2">
              ⚠️ Trash is full! Purge some items before you can delete more.
            </p>
          )}
          {capacity.status === 'warning' && (
            <p className="text-xs text-yellow-700 mt-2">
              ⚠️ Trash is {capacity.percent}% full. Consider purging items you don't need.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-error/10 text-error px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted">Loading trash...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-base-200 rounded-lg">
          <svg className="w-16 h-16 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Trash is Empty</h3>
          <p className="text-muted">Items you delete will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
                )}
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.sku}</p>
                  <p className="text-sm text-gray-500">${item.price}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleRestore(item)}
                  title="Restore from trash"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handlePurge(item)}
                  title="Permanently delete"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Purge
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={async () => {
          await confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
