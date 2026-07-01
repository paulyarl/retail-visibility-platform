'use client';

import { useState } from 'react';
import {
  useTenantCustomBadges,
  useCreateCustomBadge,
  useUpdateCustomBadge,
  useDeleteCustomBadge,
} from '@/hooks/useBadgeRegistry';
import { BadgeTypeMeta } from '@/services/BadgeRegistryService';
import { Tag, Plus, Pencil, Trash2, X, AlertCircle, Check, BarChart3, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface CustomBadgeManagerClientProps {
  tenantId: string;
}

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'green', label: 'Green', class: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'red', label: 'Red', class: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-100 text-teal-700 border-teal-300' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-100 text-pink-700 border-pink-300' },
];

const MAX_SLOTS = 10;

export default function CustomBadgeManagerClient({ tenantId }: CustomBadgeManagerClientProps) {
  const { data, isLoading } = useTenantCustomBadges(tenantId);
  const createMutation = useCreateCustomBadge(tenantId);
  const updateMutation = useUpdateCustomBadge(tenantId);
  const deleteMutation = useDeleteCustomBadge(tenantId);

  const [showForm, setShowForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeTypeMeta | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    description: '',
    icon: '',
    color: 'blue',
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const badges = data?.badges ?? [];
  const usedSlots = data?.usedSlots ?? 0;
  const hasAccess = data?.hasAccess ?? false;

  const handleOpenCreate = () => {
    setEditingBadge(null);
    setFormData({ key: '', label: '', description: '', icon: '', color: 'blue' });
    setError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (badge: BadgeTypeMeta) => {
    setEditingBadge(badge);
    setFormData({
      key: badge.key,
      label: badge.label,
      description: badge.description ?? '',
      icon: badge.icon ?? '',
      color: badge.color ?? 'blue',
    });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.key.trim() || !formData.label.trim()) {
      setError('Key and label are required');
      return;
    }

    if (editingBadge) {
      const result = await updateMutation.mutateAsync({
        badgeId: editingBadge.id,
        input: {
          label: formData.label.trim(),
          description: formData.description.trim() || undefined,
          icon: formData.icon.trim() || undefined,
          color: formData.color,
        },
      });
      if (!result) {
        setError('Failed to update badge. Please try again.');
        return;
      }
    } else {
      if (usedSlots >= MAX_SLOTS) {
        setError(`Limit reached (${MAX_SLOTS} max). Delete a badge to create a new one.`);
        return;
      }
      const result = await createMutation.mutateAsync({
        key: formData.key.trim(),
        label: formData.label.trim(),
        description: formData.description.trim() || undefined,
        icon: formData.icon.trim() || undefined,
        color: formData.color,
      });
      if (!result) {
        setError('Failed to create badge. Check that the key is unique.');
        return;
      }
    }

    setShowForm(false);
    setEditingBadge(null);
  };

  const handleDelete = async (badgeId: string) => {
    const success = await deleteMutation.mutateAsync(badgeId);
    if (!success) {
      setError('Failed to delete badge. Please try again.');
    }
    setConfirmDelete(null);
  };

  const handleToggleActive = async (badge: BadgeTypeMeta) => {
    await updateMutation.mutateAsync({
      badgeId: badge.id,
      input: { isActive: !badge.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Custom Badges Not Available</h2>
            <p className="text-sm text-amber-700 mt-1">
              Your current plan does not include custom badge slots. Upgrade to the Professional tier
              or higher to create custom badges for your products.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-gray-600" />
            Custom Badges
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create custom badges to highlight products in your storefront.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={usedSlots >= MAX_SLOTS}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          New Badge
        </button>
      </div>

      {/* Sub-page links */}
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/t/${tenantId}/settings/products/badges/analytics`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          <BarChart3 className="w-4 h-4" /> Analytics
        </Link>
        <Link
          href={`/t/${tenantId}/settings/products/badges/suggestions`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          <Sparkles className="w-4 h-4" /> Suggestions
        </Link>
      </div>

      {/* Slot usage indicator */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Badge Slots Used</span>
          <span className="text-sm text-gray-500">{usedSlots} / {MAX_SLOTS}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(usedSlots / MAX_SLOTS) * 100}%` }}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Badge list */}
      {badges.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No custom badges yet. Click &quot;New Badge&quot; to create one.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`bg-white rounded-lg border p-4 ${badge.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {badge.icon && <span className="text-lg">{badge.icon}</span>}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{badge.label}</p>
                    <p className="text-xs text-gray-500 font-mono">{badge.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(badge)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(badge.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {badge.description && (
                <p className="text-xs text-gray-500 mt-2">{badge.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${
                  COLOR_OPTIONS.find(c => c.value === badge.color)?.class ?? 'bg-gray-100 text-gray-700 border-gray-300'
                }`}>
                  {badge.label}
                </span>
                <button
                  onClick={() => handleToggleActive(badge)}
                  className={`ml-auto text-xs px-2 py-0.5 rounded ${
                    badge.isActive
                      ? 'text-green-600 bg-green-50 hover:bg-green-100'
                      : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {badge.isActive ? (
                    <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Active</span>
                  ) : (
                    'Inactive'
                  )}
                </button>
              </div>

              {/* Delete confirmation */}
              {confirmDelete === badge.id && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-red-600">Delete this badge?</span>
                  <button
                    onClick={() => handleDelete(badge.id)}
                    className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBadge ? 'Edit Badge' : 'Create Custom Badge'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingBadge}
                  placeholder="e.g. eco_friendly"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Lowercase, underscores only. Cannot be changed after creation.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g. Eco Friendly"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description shown to customers"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="e.g. 🌿"
                  maxLength={4}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`px-3 py-1 text-xs rounded-full border-2 transition-all ${
                        color.class
                      } ${formData.color === color.value ? 'ring-2 ring-offset-1 ring-gray-400 border-transparent' : 'border-transparent'}`}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border ${
                  COLOR_OPTIONS.find(c => c.value === formData.color)?.class ?? 'bg-gray-100 text-gray-700 border-gray-300'
                }`}>
                  {formData.icon && <span>{formData.icon}</span>}
                  <span>{formData.label || 'Badge Label'}</span>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {editingBadge ? 'Save Changes' : 'Create Badge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
