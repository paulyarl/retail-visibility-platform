'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Modal, Input, Select } from '@/components/ui';
import { botPlatformAdminService, type BotGuardrailRule } from '@/services/bot/BotPlatformAdminService';

const SEVERITY_COLORS: Record<string, any> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export default function BotGuardrailsPage() {
  const [rules, setRules] = useState<BotGuardrailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<BotGuardrailRule | null>(null);
  const [form, setForm] = useState({
    rule_type: 'banned_phrase',
    pattern: '',
    action: 'block',
    severity: 'medium',
    is_active: true,
    replacement: '',
    response_template: '',
  });
  const [saving, setSaving] = useState(false);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await botPlatformAdminService.listGuardrails();
      setRules(data);
    } catch (err) {
      console.error('[Bot Guardrails] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRules(); }, []);

  function openCreate() {
    setEditingRule(null);
    setForm({ rule_type: 'banned_phrase', pattern: '', action: 'block', severity: 'medium', is_active: true, replacement: '', response_template: '' });
    setShowModal(true);
  }

  function openEdit(rule: BotGuardrailRule) {
    setEditingRule(rule);
    setForm({
      rule_type: rule.rule_type,
      pattern: rule.pattern,
      action: rule.action,
      severity: rule.severity,
      is_active: rule.is_active,
      replacement: rule.replacement || '',
      response_template: rule.response_template || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.pattern.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        rule_type: form.rule_type,
        pattern: form.pattern,
        action: form.action,
        severity: form.severity,
        is_active: form.is_active,
      };
      if (form.replacement) payload.replacement = form.replacement;
      if (form.response_template) payload.response_template = form.response_template;

      if (editingRule) {
        await botPlatformAdminService.updateGuardrail(editingRule.id, payload);
      } else {
        await botPlatformAdminService.createGuardrail(payload);
      }
      setShowModal(false);
      await loadRules();
    } catch (err) {
      console.error('[Bot Guardrails] Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this guardrail rule?')) return;
    try {
      await botPlatformAdminService.deleteGuardrail(id);
      await loadRules();
    } catch (err) {
      console.error('[Bot Guardrails] Delete error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bot Guardrails</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage content moderation and safety rules</p>
        </div>
        <Button onClick={openCreate}>Add Rule</Button>
      </div>

      <Card>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">No guardrail rules configured</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Pattern</th>
                    <th className="text-left py-2 px-3 font-medium">Action</th>
                    <th className="text-left py-2 px-3 font-medium">Severity</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3">
                        <span className="font-medium capitalize">{rule.rule_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2 px-3 max-w-xs truncate font-mono text-xs">{rule.pattern}</td>
                      <td className="py-2 px-3 capitalize">{rule.action}</td>
                      <td className="py-2 px-3">
                        <Badge variant={SEVERITY_COLORS[rule.severity] || 'default'}>{rule.severity}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={rule.is_active ? 'success' : 'default'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => openEdit(rule)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">Edit</button>
                        <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRule ? 'Edit Guardrail Rule' : 'Add Guardrail Rule'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Rule Type</label>
            <Select value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
              <option value="banned_phrase">Banned Phrase</option>
              <option value="pii_detection">PII Detection</option>
              <option value="moderation">Moderation</option>
              <option value="competitor">Competitor</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Pattern</label>
            <Input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder="Enter pattern or phrase..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Action</label>
              <Select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                <option value="block">Block</option>
                <option value="flag">Flag</option>
                <option value="mask">Mask</option>
                <option value="replace">Replace</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Severity</label>
              <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </div>
          </div>
          {form.action === 'replace' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Replacement Text</label>
              <Input value={form.replacement} onChange={(e) => setForm({ ...form, replacement: e.target.value })} placeholder="Replacement text..." />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Response Template (optional)</label>
            <Input value={form.response_template} onChange={(e) => setForm({ ...form, response_template: e.target.value })} placeholder="Custom response when rule triggers..." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.pattern.trim()}>
              {saving ? 'Saving...' : editingRule ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
