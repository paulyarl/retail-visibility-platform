/**
 * Tier CRUD Modals Component
 * 
 * Reusable modals for creating, editing, and deleting tiers
 */

import { useState } from 'react';
import { Button, Spinner, Badge } from '@/components/ui';

interface TierFeature {
  id: string;
  featureKey: string;
  featureName: string;
  isInherited: boolean;
}

interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  maxSKUs?: number;
  maxLocations?: number;
  tierType: 'individual' | 'organization';
  isActive: boolean;
  sortOrder: number;
  features: TierFeature[];
}

interface CreateTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

export function CreateTierModal({ isOpen, onClose, onSubmit, submitting }: CreateTierModalProps) {
  const [form, setForm] = useState({
    tierKey: '',
    name: '',
    displayName: '',
    description: '',
    priceMonthly: '',
    maxSKUs: '',
    maxLocations: '',
    tierType: 'individual' as 'individual' | 'organization',
    sortOrder: '0',
    reason: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async () => {
    await onSubmit({
      ...form,
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      maxSKUs: form.maxSKUs ? parseInt(form.maxSKUs) : null,
      maxLocations: form.maxLocations ? parseInt(form.maxLocations) : null,
      sortOrder: parseInt(form.sortOrder) || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">Create New Tier</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Tier Key* <span className="text-xs text-neutral-500">(lowercase_with_underscores)</span>
              </label>
              <input
                type="text"
                value={form.tierKey}
                onChange={(e) => setForm({ ...form, tierKey: e.target.value })}
                placeholder="e.g., premium_plus"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Display Name*</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g., Premium Plus"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Name*</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Premium Plus"
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this tier"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Price ($/month)*</label>
              <input
                type="number"
                value={form.priceMonthly}
                onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                placeholder="e.g., 99.00"
                step="0.01"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Tier Type*</label>
              <select
                value={form.tierType}
                onChange={(e) => setForm({ ...form, tierType: e.target.value as 'individual' | 'organization' })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Max SKUs <span className="text-xs text-neutral-500">(blank = unlimited)</span>
              </label>
              <input
                type="number"
                value={form.maxSKUs}
                onChange={(e) => setForm({ ...form, maxSKUs: e.target.value })}
                placeholder="e.g., 5000"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Max Locations</label>
              <input
                type="number"
                value={form.maxLocations}
                onChange={(e) => setForm({ ...form, maxLocations: e.target.value })}
                placeholder="e.g., 10"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Reason* <span className="text-xs text-neutral-500">(for audit trail)</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Creating new tier for enterprise customers with custom requirements"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Create Tier'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

interface EditTierModalProps {
  isOpen: boolean;
  tier: Tier | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

export function EditTierModal({ isOpen, tier, onClose, onSubmit, submitting }: EditTierModalProps) {
  const [form, setForm] = useState({
    name: tier?.name || '',
    displayName: tier?.displayName || '',
    description: tier?.description || '',
    priceMonthly: tier ? (tier.priceMonthly / 100).toString() : '',
    maxSKUs: tier?.maxSKUs?.toString() || '',
    maxLocations: tier?.maxLocations?.toString() || '',
    tierType: (tier?.tierType || 'individual') as 'individual' | 'organization',
    isActive: tier?.isActive ?? true,
    sortOrder: tier?.sortOrder.toString() || '0',
    reason: '',
  });

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    await onSubmit({
      ...form,
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      maxSKUs: form.maxSKUs ? parseInt(form.maxSKUs) : null,
      maxLocations: form.maxLocations ? parseInt(form.maxLocations) : null,
      sortOrder: parseInt(form.sortOrder) || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Edit Tier: {tier.displayName}
        </h2>

        <div className="space-y-4">
          <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">Tier Key:</span>
            <span className="ml-2 font-mono text-neutral-900 dark:text-neutral-100">{tier.tierKey}</span>
            <span className="ml-4 text-neutral-500">(cannot be changed)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Display Name*</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Name*</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Price ($/month)*</label>
              <input
                type="number"
                value={form.priceMonthly}
                onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                step="0.01"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Tier Type*</label>
              <select
                value={form.tierType}
                onChange={(e) => setForm({ ...form, tierType: e.target.value as 'individual' | 'organization' })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Max SKUs</label>
              <input
                type="number"
                value={form.maxSKUs}
                onChange={(e) => setForm({ ...form, maxSKUs: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Max Locations</label>
              <input
                type="number"
                value={form.maxLocations}
                onChange={(e) => setForm({ ...form, maxLocations: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              Active
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Reason* (for audit trail)</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Updated pricing based on market analysis"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Update Tier'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DeleteTierModalProps {
  isOpen: boolean;
  tier: Tier | null;
  onClose: () => void;
  onSubmit: (data: { reason: string; hardDelete: boolean }) => Promise<void>;
  submitting: boolean;
}

export function DeleteTierModal({ isOpen, tier, onClose, onSubmit, submitting }: DeleteTierModalProps) {
  const [reason, setReason] = useState('');
  const [hardDelete, setHardDelete] = useState(false);

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    await onSubmit({ reason, hardDelete });
    setReason('');
    setHardDelete(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Delete Tier: {tier.displayName}
        </h2>

        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Warning:</strong> Deleting a tier will affect all tenants using this tier.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              Hard Delete (permanently remove from database)
            </label>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 ml-6">
              {hardDelete 
                ? 'Tier will be permanently deleted. Cannot be undone.'
                : 'Tier will be deactivated but remain in database.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Reason* (for audit trail)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Tier no longer needed, consolidating with another tier"
              rows={3}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? <Spinner size="sm" /> : hardDelete ? 'Delete Permanently' : 'Deactivate'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AddFeatureModalProps {
  isOpen: boolean;
  tier: Tier | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

export function AddFeatureModal({ isOpen, tier, onClose, onSubmit, submitting }: AddFeatureModalProps) {
  const [form, setForm] = useState({
    featureKey: '',
    featureName: '',
    isInherited: false,
    reason: '',
  });

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    await onSubmit(form);
    setForm({ featureKey: '', featureName: '', isInherited: false, reason: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Add Feature to {tier.displayName}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Feature Key* <span className="text-xs text-neutral-500">(e.g., custom_branding)</span>
            </label>
            <input
              type="text"
              value={form.featureKey}
              onChange={(e) => setForm({ ...form, featureKey: e.target.value })}
              placeholder="e.g., custom_branding"
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Feature Name*</label>
            <input
              type="text"
              value={form.featureName}
              onChange={(e) => setForm({ ...form, featureName: e.target.value })}
              placeholder="e.g., Custom Branding"
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={form.isInherited}
                onChange={(e) => setForm({ ...form, isInherited: e.target.checked })}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              Inherited from lower tier
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Reason* (for audit trail)</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Adding feature based on customer feedback"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Spinner size="sm" /> : 'Add Feature'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
