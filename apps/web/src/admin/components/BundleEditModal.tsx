/**
 * Bundle Edit Modal — create/edit modal for BSaaS bundles
 *
 * Includes component picker with searchable feature keys,
 * price, billing cycle, trial days, sort order, active toggle.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Search, X, Plus } from 'lucide-react';
import type { BsaasBundleEntry, BsaasBundleInput } from '@/services/AdminBsaasBundleService';

interface AvailableFeature {
  key: string;
  name: string;
  category?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBundle: BsaasBundleEntry | null;
  cloningFrom?: BsaasBundleEntry | null;
  availableFeatures: AvailableFeature[];
  onSave: (input: BsaasBundleInput) => Promise<void>;
  saving: boolean;
}

export default function BundleEditModal({
  open,
  onOpenChange,
  editingBundle,
  cloningFrom,
  availableFeatures,
  onSave,
  saving,
}: Props) {
  const [formData, setFormData] = useState<BsaasBundleInput>({
    bundle_key: '',
    marketing_name: '',
    description: '',
    price_cents: 0,
    billing_cycle: 'monthly',
    trial_days: 0,
    trial_eligible: false,
    demo_eligible: true,
    is_private: false,
    is_active: true,
    sort_order: 200,
    items: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeaturePicker, setShowFeaturePicker] = useState(false);

  useEffect(() => {
    if (editingBundle) {
      setFormData({
        bundle_key: editingBundle.bundle_key,
        marketing_name: editingBundle.marketing_name,
        description: editingBundle.description || '',
        price_cents: editingBundle.price_cents,
        billing_cycle: editingBundle.billing_cycle,
        trial_days: editingBundle.trial_days,
        trial_eligible: editingBundle.trial_eligible,
        demo_eligible: editingBundle.demo_eligible,
        is_private: editingBundle.is_private,
        is_active: editingBundle.is_active,
        sort_order: editingBundle.sort_order,
        items: editingBundle.bsaas_bundle_items.map(item => ({
          feature_key: item.feature_key,
          sort_order: item.sort_order,
        })),
      });
    } else if (cloningFrom) {
      setFormData({
        bundle_key: cloningFrom.bundle_key,
        marketing_name: cloningFrom.marketing_name,
        description: cloningFrom.description || '',
        price_cents: cloningFrom.price_cents,
        billing_cycle: cloningFrom.billing_cycle,
        trial_days: cloningFrom.trial_days,
        trial_eligible: cloningFrom.trial_eligible,
        demo_eligible: cloningFrom.demo_eligible,
        is_private: cloningFrom.is_private,
        is_active: cloningFrom.is_active,
        sort_order: cloningFrom.sort_order,
        items: cloningFrom.bsaas_bundle_items.map(item => ({
          feature_key: item.feature_key,
          sort_order: item.sort_order,
        })),
      });
    } else {
      setFormData({
        bundle_key: '',
        marketing_name: '',
        description: '',
        price_cents: 0,
        billing_cycle: 'monthly',
        trial_days: 0,
        trial_eligible: false,
        demo_eligible: true,
        is_private: false,
        is_active: true,
        sort_order: 200,
        items: [],
      });
    }
    setSearchQuery('');
    setShowFeaturePicker(false);
  }, [editingBundle, cloningFrom, open]);

  const selectedItemKeys = useMemo(
    () => new Set(formData.items.map(i => i.feature_key)),
    [formData.items],
  );

  const filteredFeatures = useMemo(() => {
    if (!searchQuery) return availableFeatures;
    const q = searchQuery.toLowerCase();
    return availableFeatures.filter(
      f => f.key.toLowerCase().includes(q) || (f.name || '').toLowerCase().includes(q),
    );
  }, [availableFeatures, searchQuery]);

  const addFeature = (feature: AvailableFeature) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { feature_key: feature.key, sort_order: prev.items.length }],
    }));
  };

  const removeFeature = (featureKey: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items
        .filter(i => i.feature_key !== featureKey)
        .map((i, idx) => ({ ...i, sort_order: idx })),
    }));
  };

  const moveFeature = (featureKey: string, direction: 'up' | 'down') => {
    setFormData(prev => {
      const items = [...prev.items];
      const idx = items.findIndex(i => i.feature_key === featureKey);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= items.length) return prev;
      [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
      return { ...prev, items: items.map((i, iIdx) => ({ ...i, sort_order: iIdx })) };
    });
  };

  const handleSave = async () => {
    if (!formData.bundle_key || !formData.marketing_name || formData.price_cents <= 0) {
      return;
    }
    if (formData.items.length === 0) {
      return;
    }
    await onSave(formData);
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingBundle ? 'Edit Bundle' : cloningFrom ? 'Clone Bundle' : 'Create Bundle'}</DialogTitle>
          <DialogDescription>
            {editingBundle
              ? 'Update the bundle definition. Bundle key cannot be changed after creation.'
              : cloningFrom
                ? 'Clone this bundle with a new unique bundle key. Adjust the key, name, price, and components as needed.'
                : 'Create a new cross-domain feature bundle. All component feature keys must exist in features_list.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bundle Key *</label>
              <Input
                value={formData.bundle_key}
                onChange={(e) => setFormData({ ...formData, bundle_key: e.target.value })}
                placeholder="e.g. customer_engagement_suite"
                disabled={!!editingBundle}
              />
              <p className="text-xs text-neutral-400 mt-1">Unique identifier (snake_case)</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Marketing Name *</label>
              <Input
                value={formData.marketing_name}
                onChange={(e) => setFormData({ ...formData, marketing_name: e.target.value })}
                placeholder="e.g. Customer Engagement Suite"
              />
            </div>
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Price (cents) *</label>
              <Input
                type="number"
                value={formData.price_cents}
                onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                placeholder="e.g. 7900 for $79.00"
              />
              <p className="text-xs text-neutral-400 mt-1">{formatPrice(formData.price_cents)}</p>
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

            <div>
              <label className="text-sm font-medium mb-1 block">Trial Days</label>
              <Input
                type="number"
                value={formData.trial_days}
                onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Sort Order</label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                placeholder="200"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <label className="text-sm">Active (visible in Feature Store)</label>
            </div>
          </div>

          {/* Eligibility Toggles */}
          <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
            <label className="text-sm font-medium block">Eligibility Settings</label>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Trial Eligible</p>
                <p className="text-xs text-neutral-400">Allow merchants to start a free trial (requires trial days &gt; 0)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, trial_eligible: true })}
                  className={`px-3 py-1 text-xs rounded-md border ${formData.trial_eligible ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >Yes</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, trial_eligible: false })}
                  className={`px-3 py-1 text-xs rounded-md border ${!formData.trial_eligible ? 'bg-neutral-200 text-neutral-700 border-neutral-300' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >No</button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Demo Eligible</p>
                <p className="text-xs text-neutral-400">Allow demo tenants to purchase this bundle</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, demo_eligible: true })}
                  className={`px-3 py-1 text-xs rounded-md border ${formData.demo_eligible ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >Yes</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, demo_eligible: false })}
                  className={`px-3 py-1 text-xs rounded-md border ${!formData.demo_eligible ? 'bg-neutral-200 text-neutral-700 border-neutral-300' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >No</button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-neutral-400">Hide from the Feature Store (admin-assigned only)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_private: true })}
                  className={`px-3 py-1 text-xs rounded-md border ${formData.is_private ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >Yes</button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_private: false })}
                  className={`px-3 py-1 text-xs rounded-md border ${!formData.is_private ? 'bg-neutral-200 text-neutral-700 border-neutral-300' : 'bg-white text-neutral-600 border-neutral-200'}`}
                >No</button>
              </div>
            </div>
          </div>

          {/* Component Picker */}
          <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Bundle Components *</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeaturePicker(!showFeaturePicker)}
                className="gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Feature
              </Button>
            </div>

            {formData.items.length === 0 ? (
              <p className="text-sm text-neutral-400 py-2">
                No components selected. Click &quot;Add Feature&quot; to pick features for this bundle.
              </p>
            ) : (
              <div className="space-y-1.5">
                {formData.items.map((item, idx) => {
                  const feature = availableFeatures.find(f => f.key === item.feature_key);
                  return (
                    <div
                      key={item.feature_key}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-md"
                    >
                      <span className="text-xs font-mono text-neutral-400 w-6">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-mono">{item.feature_key}</span>
                        {feature?.name && (
                          <span className="text-xs text-neutral-400 ml-2">— {feature.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFeature(item.feature_key, 'up')}
                          disabled={idx === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveFeature(item.feature_key, 'down')}
                          disabled={idx === formData.items.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(item.feature_key)}
                        >
                          <X className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showFeaturePicker && (
              <div className="border-t border-neutral-200 pt-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search features..."
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-md">
                  {filteredFeatures.length === 0 ? (
                    <p className="text-sm text-neutral-400 p-3 text-center">No features found</p>
                  ) : (
                    filteredFeatures.map(feature => {
                      const selected = selectedItemKeys.has(feature.key);
                      return (
                        <button
                          key={feature.key}
                          onClick={() => !selected && addFeature(feature)}
                          disabled={selected}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-neutral-100 last:border-0 flex items-center justify-between ${
                            selected ? 'opacity-50 cursor-not-allowed bg-neutral-50' : 'hover:bg-blue-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-xs">{feature.key}</span>
                            {feature.name && (
                              <span className="text-xs text-neutral-400 ml-2">— {feature.name}</span>
                            )}
                          </div>
                          {selected ? (
                            <Badge variant="secondary">Added</Badge>
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.bundle_key || !formData.marketing_name || formData.price_cents <= 0 || formData.items.length === 0}
          >
            {saving ? 'Saving...' : editingBundle ? 'Update' : cloningFrom ? 'Clone' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
