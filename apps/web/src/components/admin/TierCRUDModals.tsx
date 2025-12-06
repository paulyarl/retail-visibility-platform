/**
 * Tier CRUD Modals Component
 * 
 * Reusable modals for creating, editing, and deleting tiers
 */

import { useState, useEffect } from 'react';
import { Button, Spinner, Badge, Tooltip } from '@/components/ui';
import { api } from '@/lib/api';

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
  maxSkus?: number;
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
    maxSkus: '',
    maxLocations: '',
    tierType: 'individual' as 'individual' | 'organization',
    sortOrder: '0',
    reason: '',
  });

  if (!isOpen) return null;

  // Check if form is valid
  const isFormValid = () => {
    return form.tierKey.trim() !== '' && 
           form.name.trim() !== '' && 
           form.displayName.trim() !== '' && 
           form.reason.trim() !== '';
  };

  const handleSubmit = async () => {
    if (!form.reason.trim()) {
      alert('Reason is required for audit trail. Please provide a reason for creating this tier.');
      return;
    }
    
    await onSubmit({
      ...form,
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      maxSkus: form.maxSkus ? parseInt(form.maxSkus) : null,
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
                value={form.maxSkus}
                onChange={(e) => setForm({ ...form, maxSkus: e.target.value })}
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
          {!isFormValid() && !submitting ? (
            <Tooltip content="Please fill in all required fields including the reason for creating this tier.">
              <Button 
                variant="primary" 
                onClick={handleSubmit} 
                disabled={submitting || !isFormValid()}
                className="cursor-not-allowed"
              >
                {submitting ? <Spinner size="sm" /> : 'Create Tier'}
              </Button>
            </Tooltip>
          ) : (
            <Button 
              variant="primary" 
              onClick={handleSubmit} 
              disabled={submitting || !isFormValid()}
            >
              {submitting ? <Spinner size="sm" /> : 'Create Tier'}
            </Button>
          )}
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
    name: '',
    displayName: '',
    description: '',
    priceMonthly: '',
    maxSkus: '',
    maxLocations: '',
    tierType: 'individual' as 'individual' | 'organization',
    isActive: true,
    sortOrder: '0',
    reason: '',
  });

  // Update form when tier changes
  useEffect(() => {
    if (tier) {
      setForm({
        name: tier.name || '',
        displayName: tier.displayName || '',
        description: tier.description || '',
        priceMonthly: (tier.priceMonthly / 100).toString(),
        maxSkus: tier.maxSkus?.toString() || '',
        maxLocations: tier.maxLocations?.toString() || '',
        tierType: (tier.tierType || 'individual') as 'individual' | 'organization',
        isActive: tier.isActive ?? true,
        sortOrder: tier.sortOrder?.toString() || '0',
        reason: '',
      });
    }
  }, [tier]);

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    if (!form.reason.trim()) {
      alert('Reason is required for audit trail. Please provide a reason for this change.');
      return;
    }
    
    await onSubmit({
      ...form,
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      maxSkus: form.maxSkus ? parseInt(form.maxSkus) : null,
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
                value={form.maxSkus}
                onChange={(e) => setForm({ ...form, maxSkus: e.target.value })}
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
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Reason* <span className="text-xs text-neutral-500">(required for audit trail)</span>
            </label>
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
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={submitting || !form.reason.trim()}
            title={!form.reason.trim() ? 'Please provide a reason for this change' : undefined}
          >
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

interface EditFeatureModalProps {
  isOpen: boolean;
  tier: Tier | null;
  feature: TierFeature | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

export function EditFeatureModal({ isOpen, tier, feature, onClose, onSubmit, submitting }: EditFeatureModalProps) {
  const [form, setForm] = useState({
    featureKey: '',
    featureName: '',
    isInherited: false,
    reason: '',
  });

  // Update form when feature changes
  useEffect(() => {
    if (feature) {
      setForm({
        featureKey: feature.featureKey || '',
        featureName: feature.featureName || '',
        isInherited: feature.isInherited || false,
        reason: '',
      });
    }
  }, [feature]);

  if (!isOpen || !tier || !feature) return null;

  const handleSubmit = async () => {
    if (!form.reason.trim()) {
      alert('Reason is required for audit trail. Please provide a reason for updating this feature.');
      return;
    }
    
    if (!form.featureKey.trim() || !form.featureName.trim()) {
      alert('Feature key and name are required.');
      return;
    }
    
    await onSubmit({
      featureKey: form.featureKey,
      featureName: form.featureName,
      isInherited: form.isInherited,
      reason: form.reason,
    });
    setForm({ featureKey: '', featureName: '', isInherited: false, reason: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Edit Feature in {tier.displayName}
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
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Reason* <span className="text-xs text-neutral-500">(required for audit trail)</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Updating feature name for clarity"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={submitting || !form.reason.trim() || !form.featureKey.trim() || !form.featureName.trim()}
            title={!form.reason.trim() ? 'Please provide a reason for this change' : 
                    !form.featureKey.trim() || !form.featureName.trim() ? 'Please fill in all required fields' : undefined}
          >
            {submitting ? <Spinner size="sm" /> : 'Update Feature'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

interface InheritTierModalProps {
  isOpen: boolean;
  tier: Tier | null;
  tiers: Tier[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
}

export function InheritTierModal({ isOpen, tier, tiers, onClose, onSubmit, submitting }: InheritTierModalProps) {
  const [form, setForm] = useState({
    sourceTierId: '',
    reason: '',
  });

  // Filter out current tier and enforce hierarchy (can only inherit from lower tiers)
  const availableSourceTiers = tiers.filter(t => {
    // Can't inherit from self
    if (t.id === tier?.id) return false;
    
    // Can only inherit from lower tiers (lower sort order)
    // Lower tiers have smaller sortOrder numbers (e.g., Trial=1, Starter=2, Pro=3)
    return t.sortOrder < (tier?.sortOrder || 0);
  });

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    if (!form.sourceTierId.trim()) {
      alert('Please select a source tier to inherit features from.');
      return;
    }
    
    if (!form.reason.trim()) {
      alert('Reason is required for audit trail. Please provide a reason for inheriting features.');
      return;
    }
    
    await onSubmit({
      sourceTierId: form.sourceTierId,
      reason: form.reason,
    });
    setForm({ sourceTierId: '', reason: '' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Inherit Features to {tier.displayName}
        </h2>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This will copy all features from the selected tier and mark them as inherited. 
              Inherited features will be displayed with an ↑ indicator.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Source Tier* <span className="text-xs text-neutral-500">(tier to inherit features from)</span>
            </label>
            {availableSourceTiers.length > 0 ? (
              <select
                value={form.sourceTierId}
                onChange={(e) => setForm({ ...form, sourceTierId: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">Select a tier to inherit from...</option>
                {availableSourceTiers.map((sourceTier) => (
                  <option key={sourceTier.id} value={sourceTier.id}>
                    {sourceTier.displayName} ({sourceTier.features.length} features)
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
                <p className="text-sm">
                  No lower tiers available to inherit from. 
                  {tier?.sortOrder === 0 || tier?.sortOrder === 1 
                    ? ' This is the lowest tier.'
                    : ' You can only inherit from tiers with lower sort order.'
                  }
                </p>
              </div>
            )}
          </div>

          {form.sourceTierId && (
            <div className="bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <strong>Features to inherit:</strong>{' '}
                {availableSourceTiers.find(t => t.id === form.sourceTierId)?.features.length || 0} features
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Reason* <span className="text-xs text-neutral-500">(required for audit trail)</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g., Inheriting features from Professional tier to maintain consistency"
              rows={2}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={submitting || !form.reason.trim() || !form.sourceTierId.trim()}
            title={!form.reason.trim() ? 'Please provide a reason for this change' : 
                    !form.sourceTierId.trim() ? 'Please select a source tier' : undefined}
          >
            {submitting ? <Spinner size="sm" /> : 'Inherit Features'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AddFeatureModal({ isOpen, tier, onClose, onSubmit, submitting }: AddFeatureModalProps) {
  const [form, setForm] = useState({
    featureKey: '',
    featureName: '',
    isInherited: false,
    reason: '',
  });
  const [existingFeatures, setExistingFeatures] = useState<Array<{featureKey: string, featureName: string}>>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [isCustomFeature, setIsCustomFeature] = useState(false);

  // Load existing features when modal opens
  useEffect(() => {
    if (isOpen) {
      loadExistingFeatures();
    }
  }, [isOpen]);

  const loadExistingFeatures = async () => {
    setLoadingFeatures(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/api/admin/tier-system/features`);
      if (response.ok) {
        const data = await response.json();
        setExistingFeatures(data.features || []);
      }
    } catch (error) {
      console.error('Failed to load existing features:', error);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const handleFeatureSelect = (featureKey: string, featureName: string) => {
    setForm({
      ...form,
      featureKey,
      featureName,
    });
    setIsCustomFeature(false);
  };

  const handleCustomFeature = () => {
    setForm({
      ...form,
      featureKey: '',
      featureName: '',
    });
    setIsCustomFeature(true);
  };

  if (!isOpen || !tier) return null;

  const handleSubmit = async () => {
    if (!form.reason.trim()) {
      alert('Reason is required for audit trail. Please provide a reason for adding this feature.');
      return;
    }
    
    if (!form.featureKey.trim() || !form.featureName.trim()) {
      alert('Please select a feature or create a new one.');
      return;
    }
    
    await onSubmit(form);
    setForm({ featureKey: '', featureName: '', isInherited: false, reason: '' });
    setIsCustomFeature(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          Add Feature to {tier.displayName}
        </h2>

        <div className="space-y-4">
          {/* Feature Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Select Feature*
            </label>
            
            {!isCustomFeature ? (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={form.featureKey}
                    onChange={(e) => {
                      const selected = existingFeatures.find(f => f.featureKey === e.target.value);
                      if (selected) {
                        handleFeatureSelect(selected.featureKey, selected.featureName);
                      }
                    }}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900/50 text-neutral-900 dark:text-neutral-100"
                    disabled={loadingFeatures}
                  >
                    <option value="">
                      {loadingFeatures ? 'Loading features...' : 'Choose an existing feature...'}
                    </option>
                    {existingFeatures.map((feature) => (
                      <option key={feature.featureKey} value={feature.featureKey}>
                        {feature.featureName} ({feature.featureKey})
                      </option>
                    ))}
                  </select>
                  {loadingFeatures && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={handleCustomFeature}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Create a new custom feature
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Feature Name*</label>
                  <input
                    type="text"
                    value={form.featureName}
                    onChange={(e) => setForm({ ...form, featureName: e.target.value })}
                    placeholder="e.g., Custom Branding"
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomFeature(false)}
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline"
                >
                  ← Back to existing features
                </button>
              </div>
            )}
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
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={submitting || !form.reason.trim() || !form.featureKey.trim() || !form.featureName.trim()}
            title={!form.reason.trim() ? 'Please provide a reason for this change' : 
                    !form.featureKey.trim() || !form.featureName.trim() ? 'Please select a feature or create a new one' : undefined}
          >
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
