/**
 * Supplier Management Admin Page
 *
 * CRUD interface for managing suppliers.
 * Shows supplier list with health metrics, create/edit modal, delete confirmation.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SupplierService,
  type Supplier,
  type SupplierHealth,
  type SupplierInput,
} from '@/services/SupplierService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { AlertCircle, Plus, Pencil, Trash2, ExternalLink, Activity } from 'lucide-react';

export default function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, SupplierHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState<SupplierInput>({
    name: '',
    connection_type: 'API',
    api_url: '',
    api_key_env: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await SupplierService.listSuppliers();
      setSuppliers(data);

      // Load health metrics in parallel
      const healthResults = await Promise.all(
        data.map((s) => SupplierService.getSupplierHealth(s.id).catch(() => null))
      );
      const hMap: Record<string, SupplierHealth> = {};
      data.forEach((s, idx) => {
        if (healthResults[idx]) hMap[s.id] = healthResults[idx]!;
      });
      setHealthMap(hMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({ name: '', connection_type: 'API', api_url: '', api_key_env: '' });
    setEditingSupplier(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      connection_type: supplier.connection_type,
      api_url: supplier.api_url || '',
      api_key_env: supplier.api_key_env || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.connection_type) {
      setError('Name and connection type are required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      if (editingSupplier) {
        await SupplierService.updateSupplier(editingSupplier.id, formData);
        setSuccess('Supplier updated successfully');
      } else {
        await SupplierService.createSupplier(formData);
        setSuccess('Supplier created successfully');
      }
      setShowDialog(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      await SupplierService.updateSupplier(supplier.id, { active: !supplier.active });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle supplier');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await SupplierService.deleteSupplier(deleteTarget.id);
      setSuccess('Supplier deleted successfully');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete supplier');
    } finally {
      setSaving(false);
    }
  };

  const formatPct = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage catalog suppliers and view health metrics</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No suppliers configured. Click &quot;Add Supplier&quot; to create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Catalog Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">GTIN Coverage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Quarantined</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Mappings</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {suppliers.map((supplier) => {
                const health = healthMap[supplier.id];
                return (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{supplier.name}</span>
                        {supplier.is_builtin && (
                          <Badge variant="secondary" className="text-xs">Built-in</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.connection_type}</td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={supplier.active}
                        onCheckedChange={() => handleToggleActive(supplier)}
                        disabled={supplier.is_builtin}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {health?.total_catalog_items ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {health ? formatPct(health.gtin_coverage_pct) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {health?.quarantined_count ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {health?.mapping_count ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/settings/admin/suppliers/${supplier.id}/catalog`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Browse catalog"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => openEdit(supplier)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!supplier.is_builtin && (
                          <button
                            onClick={() => setDeleteTarget(supplier)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? 'Update supplier connection details.'
                : 'Configure a new catalog supplier.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Acme Distributors"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Connection Type</label>
              <select
                value={formData.connection_type}
                onChange={(e) => setFormData({ ...formData, connection_type: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="API">API</option>
                <option value="CSV">CSV</option>
                <option value="SFTP">SFTP</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">API URL</label>
              <Input
                value={formData.api_url || ''}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://api.supplier.com/v1"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">API Key Env Var</label>
              <Input
                value={formData.api_key_env || ''}
                onChange={(e) => setFormData({ ...formData, api_key_env: e.target.value })}
                placeholder="SUPPLIER_API_KEY"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Name of the environment variable holding the API key</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also delete all catalog items and mappings for this supplier. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
