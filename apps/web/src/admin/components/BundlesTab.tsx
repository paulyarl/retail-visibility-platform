/**
 * BSaaS Bundles Tab — bundle CRUD table
 *
 * Lists all bundles with component count, price, discount %,
 * active toggle, edit/delete actions.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminBsaasBundleService,
  type BsaasBundleEntry,
  type BsaasBundleInput,
} from '@/services/AdminBsaasBundleService';
import { adminBsaasCatalogService, type BsaasCatalogEntry } from '@/services/AdminBsaasCatalogService';
import { Button } from '@/components/ui/Button';
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
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import BundleEditModal from './BundleEditModal';

function formatPrice(cents: number, cycle: string) {
  const dollars = (cents / 100).toFixed(2);
  if (cycle === 'one_time') return `$${dollars} one-time`;
  if (cycle === 'annual') return `$${dollars}/yr`;
  if (cycle === 'weekly') return `$${dollars}/wk`;
  return `$${dollars}/mo`;
}

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function BundlesTab({ onError, onSuccess }: Props) {
  const [bundles, setBundles] = useState<BsaasBundleEntry[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<BsaasCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BsaasBundleEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BsaasBundleEntry | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bundleData, catalogData] = await Promise.all([
        adminBsaasBundleService.list(),
        adminBsaasCatalogService.list(),
      ]);
      setBundles(bundleData);
      setCatalogEntries(catalogData);
    } catch (err: any) {
      onError(err.message || 'Failed to load bundles');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = () => {
    setEditingBundle(null);
    setShowEditModal(true);
  };

  const handleEdit = (bundle: BsaasBundleEntry) => {
    setEditingBundle(bundle);
    setShowEditModal(true);
  };

  const handleSave = async (input: BsaasBundleInput) => {
    try {
      setSaving(true);
      if (editingBundle) {
        await adminBsaasBundleService.update(editingBundle.id, input);
        onSuccess('Bundle updated successfully');
      } else {
        await adminBsaasBundleService.create(input);
        onSuccess('Bundle created successfully');
      }
      setShowEditModal(false);
      setEditingBundle(null);
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to save bundle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await adminBsaasBundleService.remove(deleteTarget.id);
      onSuccess(`Deleted "${deleteTarget.marketing_name}"`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to delete bundle');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bundle: BsaasBundleEntry) => {
    try {
      await adminBsaasBundleService.update(bundle.id, { is_active: !bundle.is_active });
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to toggle bundle');
    }
  };

  const getComponentPriceSum = (bundle: BsaasBundleEntry): number => {
    return bundle.bsaas_bundle_items.reduce((sum, item) => {
      const catalogEntry = catalogEntries.find(c => c.feature_key === item.feature_key);
      return sum + (catalogEntry?.price_cents || 0);
    }, 0);
  };

  const getDiscountPercent = (bundle: BsaasBundleEntry): number | null => {
    const sum = getComponentPriceSum(bundle);
    if (sum <= 0) return null;
    const discount = ((sum - bundle.price_cents) / sum) * 100;
    return discount > 0 ? Math.round(discount) : null;
  };

  const availableFeatures = catalogEntries.map(e => ({
    key: e.feature_key,
    name: e.marketing_name || e.feature_key,
    category: e.capability_types?.[0],
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-neutral-500">Loading bundles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Bundle
        </Button>
      </div>

      {bundles.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-300 rounded-lg">
          <Package className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-500">No bundles yet. Click &quot;Add Bundle&quot; to create one.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Bundle Key</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Components</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Cycle</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Trial</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Discount</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Active</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bundles.map((bundle) => {
                const discount = getDiscountPercent(bundle);
                return (
                  <tr key={bundle.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs">{bundle.bundle_key}</td>
                    <td className="px-4 py-3 font-medium">{bundle.marketing_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {bundle.bsaas_bundle_items.map(item => (
                          <Badge key={item.feature_key} variant="secondary">
                            {item.feature_key}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-neutral-400 mt-1 block">
                        {bundle.bsaas_bundle_items.length} component{bundle.bsaas_bundle_items.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatPrice(bundle.price_cents, bundle.billing_cycle)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{bundle.billing_cycle}</Badge>
                    </td>
                    <td className="px-4 py-3">{bundle.trial_days > 0 ? `${bundle.trial_days}d` : '—'}</td>
                    <td className="px-4 py-3">
                      {discount !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Save {discount}%
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{bundle.sort_order}</td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={bundle.is_active}
                        onCheckedChange={() => handleToggleActive(bundle)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(bundle)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(bundle)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      <BundleEditModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        editingBundle={editingBundle}
        availableFeatures={availableFeatures}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Bundle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.marketing_name}&quot;?
              This will remove it from the Feature Store. Existing bundle purchases will not be affected.
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
