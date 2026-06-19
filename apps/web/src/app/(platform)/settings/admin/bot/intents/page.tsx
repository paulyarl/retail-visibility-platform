'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Spinner, Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { botPlatformAdminService, type BotIntent } from '@/services/bot/BotPlatformAdminService';

export default function BotIntentsPage() {
  const [intents, setIntents] = useState<BotIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIntent, setEditingIntent] = useState<BotIntent | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    examples: '',
    confidence_threshold: 0.85,
    mapped_skill: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  async function loadIntents() {
    setLoading(true);
    try {
      const data = await botPlatformAdminService.listIntents();
      setIntents(data);
    } catch (err) {
      console.error('[Bot Intents] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIntents(); }, []);

  function openCreate() {
    setEditingIntent(null);
    setForm({ name: '', category: '', description: '', examples: '', confidence_threshold: 0.85, mapped_skill: '', is_active: true });
    setShowModal(true);
  }

  function openEdit(intent: BotIntent) {
    setEditingIntent(intent);
    setForm({
      name: intent.name,
      category: intent.category,
      description: intent.description || '',
      examples: Array.isArray(intent.examples) ? intent.examples.join('\n') : '',
      confidence_threshold: intent.confidence_threshold,
      mapped_skill: intent.mapped_skill || '',
      is_active: intent.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category.trim()) return;
    setSaving(true);
    try {
      const examples = form.examples.split('\n').map((s) => s.trim()).filter(Boolean);
      const payload: any = {
        name: form.name,
        category: form.category,
        description: form.description || null,
        examples,
        confidence_threshold: form.confidence_threshold,
        mapped_skill: form.mapped_skill || null,
        is_active: form.is_active,
      };

      if (editingIntent) {
        await botPlatformAdminService.updateIntent(editingIntent.id, payload);
      } else {
        await botPlatformAdminService.createIntent(payload);
      }
      setShowModal(false);
      await loadIntents();
    } catch (err) {
      console.error('[Bot Intents] Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this intent?')) return;
    try {
      await botPlatformAdminService.deleteIntent(id);
      await loadIntents();
    } catch (err) {
      console.error('[Bot Intents] Delete error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const categories = [...new Set(intents.map((i) => i.category))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bot Intents</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage intent classification rules</p>
        </div>
        <Button onClick={openCreate}>Add Intent</Button>
      </div>

      {categories.map((cat) => (
        <Card key={cat}>
          <CardContent>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">{cat}</h2>
            <div className="space-y-2">
              {intents.filter((i) => i.category === cat).map((intent) => (
                <div key={intent.id} className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{intent.name.replace(/_/g, ' ')}</span>
                      <Badge variant={intent.is_active ? 'success' : 'default'}>
                        {intent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {intent.mapped_skill && <Badge variant="info">{intent.mapped_skill}</Badge>}
                    </div>
                    {intent.description && (
                      <p className="text-xs text-neutral-500 mt-1">{intent.description}</p>
                    )}
                    {Array.isArray(intent.examples) && intent.examples.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {intent.examples.slice(0, 5).map((ex, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            {ex}
                          </span>
                        ))}
                        {intent.examples.length > 5 && (
                          <span className="text-xs text-neutral-400">+{intent.examples.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-neutral-500">{(intent.confidence_threshold * 100).toFixed(0)}%</span>
                    <button onClick={() => openEdit(intent)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(intent.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {intents.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500 py-8 text-center">No intents configured</p>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingIntent ? 'Edit Intent' : 'Add Intent'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. product_search" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. commerce" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this intent detects..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Examples (one per line)</label>
            <Textarea value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} placeholder={"I want to buy a product\nShow me what's on sale"} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Confidence Threshold</label>
              <Input type="number" step="0.05" min="0" max="1" value={form.confidence_threshold} onChange={(e) => setForm({ ...form, confidence_threshold: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mapped Skill (optional)</label>
              <Input value={form.mapped_skill} onChange={(e) => setForm({ ...form, mapped_skill: e.target.value })} placeholder="e.g. product_search" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.category.trim()}>
              {saving ? 'Saving...' : editingIntent ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
