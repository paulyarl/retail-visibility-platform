'use client';

import { useState, useEffect, useCallback } from 'react';
import adminPolicyTemplateService, { PolicyTemplateEntry, PolicyTemplateInput } from '@/services/AdminPolicyTemplateService';

const POLICY_TYPES = ['return_policy', 'shipping_policy', 'privacy_policy', 'terms_of_service', 'refund_policy'];
const STOREFRONT_TYPES = ['online', 'retail', 'service', 'social', 'all'];
const JURISDICTIONS = ['GLOBAL', 'US', 'EU', 'UK', 'AU', 'CA'];
const PLATFORMS = ['generic', 'meta', 'tiktok', 'google'];

export default function PolicyTemplateAdminClient() {
  const [templates, setTemplates] = useState<PolicyTemplateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PolicyTemplateEntry | null>(null);
  const [filterStorefront, setFilterStorefront] = useState('');
  const [filterPolicy, setFilterPolicy] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminPolicyTemplateService.list({
        storefront_type: filterStorefront || undefined,
        policy_type: filterPolicy || undefined,
      });
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [filterStorefront, filterPolicy]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template: PolicyTemplateEntry) => {
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this template?')) return;
    try {
      await adminPolicyTemplateService.deactivate(id);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate template');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-neutral-200 rounded"></div>
        <div className="h-64 bg-neutral-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={filterStorefront}
          onChange={(e) => setFilterStorefront(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Storefront Types</option>
          {STOREFRONT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterPolicy}
          onChange={(e) => setFilterPolicy(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Policy Types</option>
          {POLICY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button
          onClick={handleCreate}
          className="ml-auto px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
        >
          + New Template
        </button>
      </div>

      {/* Templates table */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Title</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Key</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Type</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Storefront</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Jurisdiction</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Version</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Tags</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                  No templates found. Click &quot;New Template&quot; to create one.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{t.title}</td>
                  <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{t.template_key}</td>
                  <td className="px-4 py-3 text-neutral-600">{t.policy_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-neutral-600">{t.storefront_type}</td>
                  <td className="px-4 py-3 text-neutral-600">{t.jurisdiction}</td>
                  <td className="px-4 py-3 text-neutral-600">{t.platform}</td>
                  <td className="px-4 py-3 text-neutral-600">{t.version}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(t.compliance_tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      t.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      {t.is_active && (
                        <button
                          onClick={() => handleDeactivate(t.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: PolicyTemplateEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyTemplateInput>({
    template_key: template?.template_key ?? '',
    policy_type: template?.policy_type ?? 'return_policy',
    storefront_type: template?.storefront_type ?? 'all',
    product_type: template?.product_type ?? 'all',
    fulfillment_mode: template?.fulfillment_mode ?? 'all',
    jurisdiction: template?.jurisdiction ?? 'GLOBAL',
    platform: template?.platform ?? 'generic',
    title: template?.title ?? '',
    description: template?.description ?? '',
    content_markdown: template?.content_markdown ?? '',
    placeholder_schema: template?.placeholder_schema ?? [],
    compliance_tags: template?.compliance_tags ?? [],
    version: template?.version ?? '1.0.0',
    sort_order: template?.sort_order ?? 0,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (template) {
        await adminPolicyTemplateService.update(template.id, form);
      } else {
        await adminPolicyTemplateService.create(form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{template ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Standard Return Policy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Template Key</label>
            <input
              value={form.template_key}
              onChange={(e) => setForm({ ...form, template_key: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="online_standard_return"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Policy Type</label>
            <select
              value={form.policy_type}
              onChange={(e) => setForm({ ...form, policy_type: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              {POLICY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Storefront Type</label>
            <select
              value={form.storefront_type}
              onChange={(e) => setForm({ ...form, storefront_type: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              {STOREFRONT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Jurisdiction</label>
            <select
              value={form.jurisdiction}
              onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              {JURISDICTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            >
              {PLATFORMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Version</label>
            <input
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              placeholder="1.0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Brief description of this template"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Compliance Tags (comma-separated)</label>
          <input
            value={(form.compliance_tags ?? []).join(', ')}
            onChange={(e) => setForm({ ...form, compliance_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            placeholder="CCPA, GDPR, FTC_MAIL_ORDER"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Content (Markdown)</label>
          <textarea
            value={form.content_markdown}
            onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
            rows={12}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono resize-y"
            placeholder="## Return Policy&#10;&#10;Use [BRACKETED] placeholders for customizable values..."
          />
          <p className="text-xs text-neutral-500 mt-1">
            Use [BRACKETED_UPPERCASE] placeholders. Define them in the placeholder schema below.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Placeholder Schema (JSON)</label>
          <textarea
            value={JSON.stringify(form.placeholder_schema ?? [], null, 2)}
            onChange={(e) => {
              try {
                setForm({ ...form, placeholder_schema: JSON.parse(e.target.value) });
              } catch {
                // ignore parse errors while typing
              }
            }}
            rows={6}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono resize-y"
            placeholder='[{"key":"STORE_NAME","label":"Store Name","type":"text","required":true}]'
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title || !form.template_key || !form.content_markdown}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
