'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  DirectoryAttributeDefinitionRow,
} from '@/services/DirectoryPresenceAdminService';
import { Plus, Save, Trash2, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'payments', label: 'Payments accepted' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'service_options', label: 'Service options' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'other', label: 'Other' },
];

const GROUP_KEYS = GROUPS.map((g) => g.key);

interface DraftRow {
  id: string;
  attributeKey: string;
  label: string;
  groupKey: string;
  appliesToCategories: string; // comma-separated; empty = universal
  defaultSourcePlatform: string;
  sortOrder: number;
  isActive: boolean;
}

const toDraft = (d: DirectoryAttributeDefinitionRow): DraftRow => ({
  id: d.id,
  attributeKey: d.attributeKey,
  label: d.label,
  groupKey: d.groupKey || 'other',
  appliesToCategories: (d.appliesToCategories ?? []).join(', '),
  defaultSourcePlatform: d.defaultSourcePlatform ?? '',
  sortOrder: d.sortOrder ?? 100,
  isActive: d.isActive,
});

export default function AttributeDefinitionsPage() {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newDraft, setNewDraft] = useState({
    attributeKey: '',
    label: '',
    groupKey: 'other',
    appliesToCategories: '',
    defaultSourcePlatform: '',
    sortOrder: 100,
  });

  const fetchRows = async () => {
    try {
      setLoading(true);
      const all = await directoryPresenceAdminService.listAllAttributeDefinitions();
      setRows(all.map(toDraft));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attribute presets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const patchRow = (id: string, patch: Partial<DraftRow>) =>
    setRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const parseCategories = (raw: string): string[] =>
    raw.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    if (!newDraft.attributeKey.trim() || !newDraft.label.trim()) {
      setError('Key and label are required.');
      return;
    }
    setSavingId('new');
    try {
      await directoryPresenceAdminService.createAttributeDefinition({
        attributeKey: newDraft.attributeKey.trim(),
        label: newDraft.label.trim(),
        groupKey: newDraft.groupKey,
        appliesToCategories: parseCategories(newDraft.appliesToCategories),
        defaultSourcePlatform: newDraft.defaultSourcePlatform.trim() || null,
        sortOrder: newDraft.sortOrder,
      });
      setSuccess(`Created ${newDraft.label}.`);
      setShowNew(false);
      fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create attribute definition');
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (row: DraftRow) => {
    setError(null);
    setSuccess(null);
    setSavingId(row.id);
    try {
      await directoryPresenceAdminService.updateAttributeDefinition(row.id, {
        label: row.label.trim(),
        groupKey: row.groupKey,
        appliesToCategories: parseCategories(row.appliesToCategories),
        defaultSourcePlatform: row.defaultSourcePlatform.trim() || null,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
      setSuccess(`Saved ${row.label}.`);
      fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attribute definition');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (row: DraftRow) => {
    if (!confirm(`Delete preset "${row.label}"? Listings keep their assigned attributes.`)) return;
    setError(null);
    setSuccess(null);
    setSavingId(row.id);
    try {
      await directoryPresenceAdminService.deleteAttributeDefinition(row.id);
      setSuccess(`Deleted ${row.label}.`);
      fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attribute definition');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Attribute Presets"
          backLink={{ href: '/settings/admin/directory', label: 'Back to directory panel' }}
        />
        <div className="text-center py-12 text-gray-500">Loading attribute presets…</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Attribute Presets"
        description="Predefined attribute chips offered on presence seeds. Category scoping matches the seed's primary category name or slug; empty scope = universal."
        actions={
          <button
            type="button"
            onClick={() => {
              setNewDraft({
                attributeKey: '',
                label: '',
                groupKey: 'other',
                appliesToCategories: '',
                defaultSourcePlatform: '',
                sortOrder: 100,
              });
              setShowNew(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            <Plus size={14} /> New preset
          </button>
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {showNew && newDraft && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New attribute preset</h3>
            <button type="button" onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-700 p-1">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Key (snake_case)</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-xs font-mono"
                value={newDraft.attributeKey}
                onChange={(e) => setNewDraft({ ...newDraft, attributeKey: e.target.value })}
                placeholder="accepts_apple_pay"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm"
                value={newDraft.label}
                onChange={(e) => setNewDraft({ ...newDraft, label: e.target.value })}
                placeholder="Apple Pay"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Group</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-700"
                value={newDraft.groupKey}
                onChange={(e) => setNewDraft({ ...newDraft, groupKey: e.target.value })}
              >
                {GROUP_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Categories (comma-separated, empty = all)</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm"
                value={newDraft.appliesToCategories}
                onChange={(e) => setNewDraft({ ...newDraft, appliesToCategories: e.target.value })}
                placeholder="indian grocery, african grocery"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Default source platform</label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-xs"
                value={newDraft.defaultSourcePlatform}
                onChange={(e) => setNewDraft({ ...newDraft, defaultSourcePlatform: e.target.value })}
                placeholder="apple_maps"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={savingId === 'new'}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} /> Create preset
          </button>
        </div>
      )}

      {GROUPS.map((group) => {
        const groupRows = rows.filter((r) => r.groupKey === group.key);
        if (groupRows.length === 0) return null;
        return (
          <div key={group.key} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {group.label} <span className="text-xs font-normal text-gray-400">({groupRows.length})</span>
            </h2>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {groupRows.map((row) => (
                <div key={row.id} className={`p-4 ${row.isActive ? '' : 'opacity-60'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Key</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-700"
                        value={row.attributeKey}
                        disabled
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm"
                        value={row.label}
                        onChange={(e) => patchRow(row.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Group</label>
                      <select
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-700"
                        value={row.groupKey}
                        onChange={(e) => patchRow(row.id, { groupKey: e.target.value })}
                      >
                        {GROUP_KEYS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Categories (comma-separated, empty = all)</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm"
                        value={row.appliesToCategories}
                        onChange={(e) => patchRow(row.id, { appliesToCategories: e.target.value })}
                        placeholder="indian grocery, african grocery"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sort</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm"
                        value={row.sortOrder}
                        onChange={(e) => patchRow(row.id, { sortOrder: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Default source platform</label>
                      <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-xs"
                        value={row.defaultSourcePlatform}
                        onChange={(e) => patchRow(row.id, { defaultSourcePlatform: e.target.value })}
                        placeholder="apple_maps"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) => patchRow(row.id, { isActive: e.target.checked })}
                      />
                      Active (offered in the seed editor picker)
                    </label>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleUpdate(row)}
                        disabled={savingId === row.id}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save size={13} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={savingId === row.id}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
