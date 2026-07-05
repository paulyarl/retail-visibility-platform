/**
 * BSaaS Features Tab — extracted from BsaasCatalogManagement
 *
 * Shows the existing bsaas_catalog CRUD table with capability type column
 * and feature type badges.
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
import { adminCapabilityService, type CapabilityType } from '@/services/AdminCapabilityService';

function getFeatureTypeBadge(featureKey: string): { label: string; className: string } {
  if (featureKey.endsWith('_flexible')) return { label: 'Flexible', className: 'bg-purple-100 text-purple-800' };
  if (featureKey.includes('_level_')) return { label: 'Level', className: 'bg-blue-100 text-blue-800' };
  if (featureKey.endsWith('_disabled')) return { label: 'Gate', className: 'bg-red-100 text-red-800' };
  if (featureKey.endsWith('_enabled')) return { label: 'Gate', className: 'bg-green-100 text-green-800' };
  return { label: 'Individual', className: 'bg-gray-100 text-gray-800' };
}

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

function humanizeFeatureKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOpt\b/g, 'Options')
    .trim();
}

export default function BsaasFeaturesTab({ onError, onSuccess }: Props) {
  const [entries, setEntries] = useState<BsaasCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BsaasCatalogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BsaasCatalogEntry | null>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);

  const [capabilityTypes, setCapabilityTypes] = useState<CapabilityType[]>([]);
  const [selectedCapType, setSelectedCapType] = useState<string>('');

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
      const [data, capTypes] = await Promise.all([
        adminBsaasCatalogService.list(),
        adminCapabilityService.getCapabilityTypes().catch(() => [] as CapabilityType[]),
      ]);
      setEntries(data);
      setCapabilityTypes(capTypes.filter((ct) => ct.is_active !== false));
    } catch (err: any) {
      onError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [onError]);

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
    setSelectedCapType('');
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
    const matchingCapType = capabilityTypes.find((ct) =>
      ct.allowed_features?.includes(entry.feature_key),
    );
    setSelectedCapType(matchingCapType?.capability_type_key || '');
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.feature_key || formData.price_cents < 0) {
      onError('Feature key and a valid price are required');
      return;
    }

    try {
      setSaving(true);
      if (editingEntry) {
        await adminBsaasCatalogService.update(editingEntry.id, formData);
        onSuccess('Catalog entry updated successfully');
      } else {
        await adminBsaasCatalogService.create(formData);
        onSuccess('Catalog entry created successfully');
      }
      setShowDialog(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to save catalog entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await adminBsaasCatalogService.remove(deleteTarget.id);
      onSuccess(`Deleted "${deleteTarget.marketing_name || deleteTarget.feature_key}"`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to delete catalog entry');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (entry: BsaasCatalogEntry) => {
    try {
      await adminBsaasCatalogService.update(entry.id, { is_active: !entry.is_active });
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to toggle entry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-neutral-500">Loading BSaaS catalog...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowGrantDialog(true)} className="gap-2">
          <Gift className="w-4 h-4" />
          Grant Access
        </Button>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Feature
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-300 rounded-lg">
          <ShoppingCart className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-500">No catalog entries yet. Click &quot;Add Feature&quot; to create one.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Feature Key</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Capability</th>
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
              {entries.map((entry) => {
                const badge = getFeatureTypeBadge(entry.feature_key);
                return (
                  <tr key={entry.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs">{entry.feature_key}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.capability_types && entry.capability_types.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.capability_types.map(ct => (
                            <Badge key={ct} variant="secondary">{ct}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
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
                );
              })}
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
            {capabilityTypes.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Capability Type</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm disabled:bg-neutral-50 disabled:text-neutral-500"
                  value={selectedCapType}
                  disabled={!!editingEntry}
                  onChange={(e) => {
                    setSelectedCapType(e.target.value);
                    setFormData({ ...formData, feature_key: '' });
                  }}
                >
                  <option value="">— Select capability type (optional) —</option>
                  {capabilityTypes.map((ct) => (
                    <option key={ct.capability_type_key} value={ct.capability_type_key}>
                      {ct.capability_type_name} ({ct.allowed_features?.length || 0} features)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400 mt-1">
                  {editingEntry ? 'Associated capability type (read-only)' : 'Filters the feature key dropdown below'}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Feature Key *</label>
              {selectedCapType && capabilityTypes.length > 0 ? (
                <select
                  className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm font-mono disabled:bg-neutral-50 disabled:text-neutral-500"
                  value={formData.feature_key}
                  disabled={!!editingEntry}
                  onChange={(e) => {
                    const key = e.target.value;
                    setFormData({
                      ...formData,
                      feature_key: key,
                      marketing_name: formData.marketing_name || humanizeFeatureKey(key),
                    });
                  }}
                >
                  <option value="">— Select a feature key —</option>
                  {(() => {
                    const allowed = capabilityTypes
                      .find((ct) => ct.capability_type_key === selectedCapType)
                      ?.allowed_features || [];
                    const features = editingEntry && formData.feature_key && !allowed.includes(formData.feature_key)
                      ? [formData.feature_key, ...allowed]
                      : allowed;
                    return features.map((feat) => (
                      <option key={feat} value={feat}>{feat}</option>
                    ));
                  })()}
                </select>
              ) : (
                <Input
                  value={formData.feature_key}
                  onChange={(e) => setFormData({ ...formData, feature_key: e.target.value })}
                  placeholder="e.g. chatbot_skill_crm_assistant"
                  disabled={!!editingEntry}
                />
              )}
              <p className="text-xs text-neutral-400 mt-1">
                {editingEntry ? 'Feature key is locked after creation' : 'Must match a key in features_list'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Marketing Name</label>
              <Input
                value={formData.marketing_name || ''}
                onChange={(e) => setFormData({ ...formData, marketing_name: e.target.value })}
                placeholder="e.g. CRM Assistant Skill"
              />
              {!editingEntry && formData.feature_key && !formData.marketing_name && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline mt-1"
                  onClick={() => setFormData({ ...formData, marketing_name: humanizeFeatureKey(formData.feature_key) })}
                >
                  Auto-fill from feature key
                </button>
              )}
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
                  <option value="weekly">Weekly</option>
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
              Are you sure you want to delete &quot;{deleteTarget?.marketing_name || deleteTarget?.feature_key}&quot;?
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
