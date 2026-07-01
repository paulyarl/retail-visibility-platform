/**
 * Supplier Mappings Management Page
 *
 * Table of existing supplier mappings with sync mode toggle and unlink capability.
 */

'use client';

import { useState, useEffect } from 'react';
import { Link2, Link2Off, RefreshCw, AlertCircle, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import SupplierImportService, { type SupplierMapping } from '@/services/SupplierImportService';

interface SupplierMappingsProps {
  tenantId: string;
}

export default function SupplierMappings({ tenantId }: SupplierMappingsProps) {
  const [mappings, setMappings] = useState<SupplierMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SupplierImportService.getMappings(tenantId);
      setMappings(data);
    } catch {
      setError('Failed to load supplier mappings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMappings();
  }, [tenantId]);

  const handleToggleSyncMode = async (mappingId: string, currentMode: string) => {
    setUpdating(mappingId);
    try {
      const newMode = currentMode === 'auto' ? 'manual' : 'auto';
      await SupplierImportService.updateSyncMode(tenantId, mappingId, newMode);
      setMappings(prev =>
        prev.map(m => (m.id === mappingId ? { ...m, sync_mode: newMode as any } : m))
      );
    } catch {
      setError('Failed to update sync mode');
    } finally {
      setUpdating(null);
    }
  };

  const handleUnlink = async (mappingId: string) => {
    if (!confirm('Are you sure you want to unlink this mapping?')) return;
    setUpdating(mappingId);
    try {
      await SupplierImportService.unlinkMapping(tenantId, mappingId);
      setMappings(prev => prev.filter(m => m.id !== mappingId));
    } catch {
      setError('Failed to unlink mapping');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Mappings</h1>
        <p className="text-gray-600">Manage mappings between supplier catalog items and your inventory</p>
      </div>

      {error && (
        <Alert className="mb-6" variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Mappings ({mappings.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={loadMappings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No supplier mappings yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Import products from supplier catalogs to create mappings.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Supplier</th>
                    <th className="pb-3 pr-4 font-medium">SKU</th>
                    <th className="pb-3 pr-4 font-medium">Inventory Item</th>
                    <th className="pb-3 pr-4 font-medium">Sync Mode</th>
                    <th className="pb-3 pr-4 font-medium">Last Sync</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(mapping => (
                    <tr key={mapping.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <span className="font-medium">{mapping.supplier_name || mapping.supplier_id}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{mapping.supplier_sku}</code>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-gray-600">{mapping.inventory_item_name || mapping.inventory_item_id}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={mapping.sync_mode === 'auto' ? 'success' : 'default'}
                        >
                          {mapping.sync_mode}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {formatDate(mapping.last_sync)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleSyncMode(mapping.id, mapping.sync_mode)}
                            disabled={updating === mapping.id}
                          >
                            <Link2 className="h-3 w-3" />
                            {mapping.sync_mode === 'auto' ? 'Set Manual' : 'Set Auto'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnlink(mapping.id)}
                            disabled={updating === mapping.id}
                          >
                            <Link2Off className="h-3 w-3" />
                            Unlink
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
