'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Pencil, Trash2, Palette, Check } from 'lucide-react';
import marketingOpsService, { BrandingConfig, BrandingCreateInput } from '@/services/MarketingOpsService';
import SuggestiveSelect, { distinctValues } from '@/components/marketing-ops/SuggestiveSelect';

const BASE_FONTS = ['helvetica', 'times', 'courier'];

export default function BrandingConfigClient() {
  const [configs, setConfigs] = useState<BrandingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BrandingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [vocab, setVocab] = useState({ fonts: [] as string[] });

  const [form, setForm] = useState<BrandingCreateInput>({
    operator_name: '',
    operator_logo_url: '',
    primary_color: '#111827',
    accent_color: '#3B82F6',
    text_color: '#1F2937',
    font_family: 'helvetica',
    footer_disclaimer: '',
    is_active: true,
  });

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.listBrandingConfigs();
      setConfigs(data);
      setVocab({ fonts: [...new Set([...BASE_FONTS, ...distinctValues(data, (c) => c.font_family)])].sort() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleEdit = (config: BrandingConfig) => {
    setEditingConfig(config);
    setForm({
      operator_name: config.operator_name,
      operator_logo_url: config.operator_logo_url || '',
      primary_color: config.primary_color || '#111827',
      accent_color: config.accent_color || '#3B82F6',
      text_color: config.text_color || '#1F2937',
      font_family: config.font_family || 'helvetica',
      footer_disclaimer: config.footer_disclaimer || '',
      is_active: config.is_active,
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setForm({
      operator_name: '',
      operator_logo_url: '',
      primary_color: '#111827',
      accent_color: '#3B82F6',
      text_color: '#1F2937',
      font_family: 'helvetica',
      footer_disclaimer: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.operator_name.trim()) return;
    setSaving(true);
    try {
      if (editingConfig) {
        await marketingOpsService.updateBrandingConfig(editingConfig.id, form);
      } else {
        await marketingOpsService.createBrandingConfig(form);
      }
      setShowModal(false);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding config');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this branding config?')) return;
    try {
      await marketingOpsService.deleteBrandingConfig(id);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branding config');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfigs}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Config
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branding Configuration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage operator branding applied to generated deliverable PDFs.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Palette className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No branding configs yet.</p>
          <button
            onClick={handleCreate}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create First Config
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: config.primary_color || '#111827' }}
                  >
                    {config.operator_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{config.operator_name}</h3>
                    {config.is_active && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: config.primary_color || '#111827' }} />
                  <span className="text-xs text-gray-500">{config.primary_color}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: config.accent_color || '#3B82F6' }} />
                  <span className="text-xs text-gray-500">{config.accent_color}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: config.text_color || '#1F2937' }} />
                  <span className="text-xs text-gray-500">{config.text_color}</span>
                </div>
              </div>

              {config.footer_disclaimer && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 line-clamp-2">
                  {config.footer_disclaimer}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(config)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingConfig ? 'Edit Branding Config' : 'New Branding Config'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operator Name</label>
                <input
                  type="text"
                  value={form.operator_name}
                  onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g. Acme Marketing"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL (optional)</label>
                <input
                  type="text"
                  value={form.operator_logo_url || ''}
                  onChange={(e) => setForm({ ...form, operator_logo_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary</label>
                  <input
                    type="color"
                    value={form.primary_color || '#111827'}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accent</label>
                  <input
                    type="color"
                    value={form.accent_color || '#3B82F6'}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Text</label>
                  <input
                    type="color"
                    value={form.text_color || '#1F2937'}
                    onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Family</label>
                <SuggestiveSelect
                  value={form.font_family || 'helvetica'}
                  onChange={(v) => setForm({ ...form, font_family: v })}
                  options={vocab.fonts}
                  emptyLabel="-- Select font --"
                  newLabel="+ New font..."
                  newInputPlaceholder="Enter new font family"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Footer Disclaimer (optional)</label>
                <textarea
                  rows={3}
                  value={form.footer_disclaimer || ''}
                  onChange={(e) => setForm({ ...form, footer_disclaimer: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g. This report is confidential and for the sole use of the recipient."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  Set as active config (deactivates all others)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.operator_name.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
