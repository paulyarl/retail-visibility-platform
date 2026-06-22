/**
 * BSaaS Catalog Management Admin Page
 *
 * CRUD interface for managing purchasable features in bsaas_catalog.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminBsaasCatalogService,
  type BsaasCatalogEntry,
  type BsaasCatalogInput,
} from '@/services/AdminBsaasCatalogService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
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
import { AlertCircle, Plus, Pencil, Trash2, ShoppingCart, Gift } from 'lucide-react';
import ComplimentaryAccessForm from './ComplimentaryAccessForm';

export default function BsaasCatalogManagement() {
  const [entries, setEntries] = useState<BsaasCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BsaasCatalogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BsaasCatalogEntry | null>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);

  const [formData, setFormData] = useState<BsaasCatalogInput>({
    feature_key: '',
    marketing_name: '',
    description: '',
    price_cents: 0,
    billing_cycle: 'monthly',
    trial_days: 0,
    is_active: true,
    sort_order: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminBsaasCatalogService.list();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      feature_key: '',
      marketing_name: '',
      description: '',
      price_cents: 0,
      billing_cycle: 'monthly',
      trial_days: 0,
      is_active: true,
      sort_order: 0,
    });
    setEditingEntry(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (entry: BsaasCatalogEntry) => {
    setEditingEntry(entry);
    setFormData({
      feature_key: entry.feature_key,
      marketing_name: entry.marketing_name || '',
      description: entry.description || '',
      price_cents: entry.price_cents,
      billing_cycle: entry.billing_cycle,
      trial_days: entry.trial_days,
      is_active: entry.is_active,
      sort_order: entry.sort_order,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.feature_key || formData.price_cents < 0) {
      setError('Feature key and a valid price are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingEntry) {
        await adminBsaasCatalogService.update(editingEntry.id, formData);
        setSuccess('Catalog entry updated successfully');
      } else {
        await adminBsaasCatalogService.create(formData);
        setSuccess('Catalog entry created successfully');
      }

      setShowDialog(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save catalog entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setSaving(true);
      await adminBsaasCatalogService.remove(deleteTarget.id);
      setSuccess(`Deleted "${deleteTarget.marketing_name || deleteTarget.feature_key}"`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete catalog entry');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (entry: BsaasCatalogEntry) => {
    try {
      await adminBsaasCatalogService.update(entry.id, { is_active: !entry.is_active });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle entry');
    }
  };

  const formatPrice = (cents: number, cycle: string) => {
    const dollars = (cents / 100).toFixed(2);
    if (cycle === 'one_time') return `$${dollars} one-time`;
    if (cycle === 'annual') return `$${dollars}/yr`;
    return `$${dollars}/mo`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-neutral-500">Loading BSaaS catalog...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            BSaaS Feature Catalog
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Manage purchasable à la carte features, pricing, and availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGrantDialog(true)} className="gap-2">
            <Gift className="w-4 h-4" />
            Grant Access
          </Button>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Feature
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{error}</p>
            <button className="text-xs underline mt-1" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <div className="flex-1">
            <p className="text-sm">{success}</p>
            <button className="text-xs underline mt-1" onClick={() => setSuccess(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-300 rounded-lg">
          <ShoppingCart className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-500">No catalog entries yet. Click "Add Feature" to create one.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Feature Key</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Cycle</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Trial</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Active</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">{entry.feature_key}</td>
                  <td className="px-4 py-3">{entry.marketing_name || <span className="text-neutral-400">—</span>}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(entry.price_cents, entry.billing_cycle)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{entry.billing_cycle}</Badge>
                  </td>
                  <td className="px-4 py-3">{entry.trial_days > 0 ? `${entry.trial_days}d` : '—'}</td>
                  <td className="px-4 py-3">{entry.sort_order}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={entry.is_active}
                      onCheckedChange={() => handleToggleActive(entry)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(entry)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Catalog Entry' : 'Add Catalog Entry'}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? 'Update the feature catalog entry. Feature key cannot be changed after creation.'
                : 'Create a new purchasable feature. The feature key must exist in features_list.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Feature Key *</label>
              <Input
                value={formData.feature_key}
                onChange={(e) => setFormData({ ...formData, feature_key: e.target.value })}
                placeholder="e.g. chatbot_skill_crm_assistant"
                disabled={!!editingEntry}
              />
              <p className="text-xs text-neutral-400 mt-1">Must match a key in features_list</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Marketing Name</label>
              <Input
                value={formData.marketing_name || ''}
                onChange={(e) => setFormData({ ...formData, marketing_name: e.target.value })}
                placeholder="e.g. CRM Assistant Skill"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Short description shown to merchants in the Feature Store"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Price (cents) *</label>
                <Input
                  type="number"
                  value={formData.price_cents}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                  placeholder="e.g. 1900 for $19.00"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Billing Cycle</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
                  value={formData.billing_cycle}
                  onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Trial Days</label>
                <Input
                  type="number"
                  value={formData.trial_days}
                  onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Sort Order</label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <label className="text-sm">Active (visible in Feature Store)</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Catalog Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.marketing_name || deleteTarget?.feature_key}"?
              This will remove it from the Feature Store. Existing purchases will not be affected.
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

      {/* Complimentary Access Dialog */}
      <ComplimentaryAccessForm
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
      />
    </div>
  );
}
