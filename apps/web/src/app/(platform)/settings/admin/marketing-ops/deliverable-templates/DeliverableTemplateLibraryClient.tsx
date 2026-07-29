'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Plus, Pencil, Trash2, FileText, Layout } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { DeliverableTemplate, DeliverableType, DeliverableTemplateCreateInput } from '@/services/MarketingOpsService';

const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  review_responses: 'Review Responses',
  service_menu: 'Service Menu',
  gbp_audit: 'GBP Audit Report',
  testimonial_cards: 'Testimonial Cards',
  nap_report: 'NAP Consistency Report',
  seo_content: 'SEO Content',
  lead_magnet: 'Lead Magnet',
};

const DELIVERABLE_TYPE_COLORS: Record<DeliverableType, string> = {
  review_responses: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  service_menu: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  gbp_audit: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  testimonial_cards: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  nap_report: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  seo_content: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  lead_magnet: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
};

const ALL_TYPES: DeliverableType[] = ['review_responses', 'service_menu', 'gbp_audit', 'testimonial_cards', 'nap_report', 'seo_content', 'lead_magnet'];

export default function DeliverableTemplateLibraryClient() {
  const [templates, setTemplates] = useState<DeliverableTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<DeliverableType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeliverableTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<DeliverableTemplateCreateInput>({
    name: '',
    deliverable_type: 'review_responses',
    layout_spec: { sections: [{ type: 'heading', text: 'New Deliverable' }, { type: 'body', text: 'Content here...' }] },
    page_size: 'letter',
    orientation: 'portrait',
    is_default: false,
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.listDeliverableTemplates({
        is_active: true,
        ...(filterType !== 'all' ? { deliverable_type: filterType } : {}),
      });
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleEdit = (template: DeliverableTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      deliverable_type: template.deliverable_type,
      category: template.category || undefined,
      layout_spec: template.layout_spec,
      page_size: template.page_size || 'letter',
      orientation: template.orientation || 'portrait',
      is_default: template.is_default,
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setForm({
      name: '',
      deliverable_type: 'review_responses',
      layout_spec: { sections: [{ type: 'heading', text: 'New Deliverable' }, { type: 'body', text: 'Content here...' }] },
      page_size: 'letter',
      orientation: 'portrait',
      is_default: false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingTemplate) {
        await marketingOpsService.updateDeliverableTemplate(editingTemplate.id, form);
      } else {
        await marketingOpsService.createDeliverableTemplate(form);
      }
      setShowModal(false);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await marketingOpsService.deleteDeliverableTemplate(id);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const updateLayoutSpec = (specText: string) => {
    try {
      const parsed = JSON.parse(specText);
      setForm({ ...form, layout_spec: parsed });
    } catch {
      // keep raw text for editing, will validate on save
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/admin/marketing-ops" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTemplates}
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
            New Template
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deliverable Templates</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage PDF deliverable layout templates for campaigns.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          All Types
        </button>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              filterType === type
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {DELIVERABLE_TYPE_LABELS[type]}
          </button>
        ))}
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
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layout className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No deliverable templates yet.</p>
          <button
            onClick={handleCreate}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                </div>
                {template.is_default && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Default
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 text-xs rounded-full ${DELIVERABLE_TYPE_COLORS[template.deliverable_type]}`}>
                  {DELIVERABLE_TYPE_LABELS[template.deliverable_type]}
                </span>
                {template.category && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    {template.category}
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                {template.page_size || 'letter'} - {template.orientation || 'portrait'} - v{template.version}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
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
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingTemplate ? 'Edit Template' : 'New Deliverable Template'}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g. Standard Review Responses"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deliverable Type</label>
                <select
                  value={form.deliverable_type}
                  onChange={(e) => setForm({ ...form, deliverable_type: e.target.value as DeliverableType })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {ALL_TYPES.map((type) => (
                    <option key={type} value={type}>{DELIVERABLE_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category (optional)</label>
                <input
                  type="text"
                  value={form.category || ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g. Restaurant, Retail"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page Size</label>
                  <select
                    value={form.page_size || 'letter'}
                    onChange={(e) => setForm({ ...form, page_size: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="letter">Letter</option>
                    <option value="a4">A4</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orientation</label>
                  <select
                    value={form.orientation || 'portrait'}
                    onChange={(e) => setForm({ ...form, orientation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Layout Spec (JSON)
                </label>
                <textarea
                  rows={8}
                  defaultValue={JSON.stringify(form.layout_spec, null, 2)}
                  onChange={(e) => updateLayoutSpec(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs"
                  placeholder='{"sections":[{"type":"heading","text":"Title"},{"type":"body","text":"Content"}]}'
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sections: heading, subheading, body, divider, spacing
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default || false}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700 dark:text-gray-300">
                  Set as default for this deliverable type
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
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
