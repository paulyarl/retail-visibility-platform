'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Modal, Input, Select, Textarea } from '@/components/ui';
import { botPlatformAdminService, type BotSkill } from '@/services/bot/BotPlatformAdminService';
import AdminBotPageShell from '@/components/bot/AdminBotPageShell';
import { clientLogger } from '@/lib/client-logger';

const STATUS_VARIANT: Record<string, any> = {
  active: 'success',
  beta: 'warning',
  deprecated: 'error',
};

export default function BotSkillsPage() {
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<BotSkill | null>(null);
  const [form, setForm] = useState({
    name: '',
    version: '1.0.0',
    description: '',
    endpoint: '',
    required_capabilities: '',
    tier_gates: '',
    capability_gates: '',
    tenant_status_gates: '',
    featured_aware: false,
    refresh_cadence_minutes: 15,
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  async function loadSkills() {
    setLoading(true);
    try {
      const data = await botPlatformAdminService.listSkills();
      setSkills(data);
    } catch (err) {
      clientLogger.error('[Bot Skills] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSkills(); }, []);

  function openCreate() {
    setEditingSkill(null);
    setForm({
      name: '', version: '1.0.0', description: '', endpoint: '',
      required_capabilities: '', tier_gates: '', capability_gates: '', tenant_status_gates: '',
      featured_aware: false, refresh_cadence_minutes: 15, status: 'active',
    });
    setShowModal(true);
  }

  function openEdit(skill: BotSkill) {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      version: skill.version,
      description: skill.description || '',
      endpoint: skill.endpoint,
      required_capabilities: Array.isArray(skill.required_capabilities) ? skill.required_capabilities.join(', ') : '',
      tier_gates: Array.isArray(skill.tier_gates) ? skill.tier_gates.join(', ') : '',
      capability_gates: Array.isArray(skill.capability_gates) ? skill.capability_gates.join(', ') : '',
      tenant_status_gates: Array.isArray(skill.tenant_status_gates) ? skill.tenant_status_gates.join(', ') : '',
      featured_aware: skill.featured_aware,
      refresh_cadence_minutes: skill.refresh_cadence_minutes,
      status: skill.status,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.endpoint.trim()) return;
    setSaving(true);
    try {
      const parseList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
      const payload: any = {
        name: form.name,
        version: form.version,
        description: form.description || null,
        endpoint: form.endpoint,
        required_capabilities: parseList(form.required_capabilities),
        tier_gates: parseList(form.tier_gates),
        capability_gates: parseList(form.capability_gates),
        tenant_status_gates: parseList(form.tenant_status_gates),
        featured_aware: form.featured_aware,
        refresh_cadence_minutes: form.refresh_cadence_minutes,
        status: form.status,
      };

      if (editingSkill) {
        await botPlatformAdminService.updateSkill(editingSkill.id, payload);
      } else {
        await botPlatformAdminService.createSkill(payload);
      }
      setShowModal(false);
      await loadSkills();
    } catch (err) {
      clientLogger.error('[Bot Skills] Save error:', { detail: err });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this skill?')) return;
    try {
      await botPlatformAdminService.deleteSkill(id);
      await loadSkills();
    } catch (err) {
      clientLogger.error('[Bot Skills] Delete error:', { detail: err });
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
    <AdminBotPageShell
      title="Bot Skills"
      subtitle="Manage the skill registry available to chatbots"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin', href: '/settings/admin' },
        { label: 'Bot', href: '/settings/admin/bot' },
        { label: 'Skills' },
      ]}
      actions={<Button onClick={openCreate}>Add Skill</Button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{skill.name}</CardTitle>
                <Badge variant={STATUS_VARIANT[skill.status] || 'default'}>{skill.status}</Badge>
              </div>
              <p className="text-xs text-neutral-500">v{skill.version}</p>
            </CardHeader>
            <CardContent>
              {skill.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{skill.description}</p>
              )}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Endpoint:</span>
                  <span className="font-mono truncate ml-2 max-w-[180px]">{skill.endpoint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Refresh:</span>
                  <span>{skill.refresh_cadence_minutes}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Featured aware:</span>
                  <span>{skill.featured_aware ? 'Yes' : 'No'}</span>
                </div>
                {skill.tier_gates && skill.tier_gates.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Tier gates:</span>
                    <span>{skill.tier_gates.join(', ')}</span>
                  </div>
                )}
                {skill.bot_skill_configurations && skill.bot_skill_configurations.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Tenants enabled:</span>
                    <span>{skill.bot_skill_configurations.filter((c) => c.enabled).length}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button onClick={() => openEdit(skill)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                <button onClick={() => handleDelete(skill.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {skills.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500 py-8 text-center">No skills configured</p>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingSkill ? 'Edit Skill' : 'Add Skill'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. product_search" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Version</label>
              <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this skill does..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Endpoint</label>
            <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="/api/public/bot/skills/product-search" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Required Capabilities (comma-separated)</label>
            <Input value={form.required_capabilities} onChange={(e) => setForm({ ...form, required_capabilities: e.target.value })} placeholder="chatbot.skills_enabled" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Tier Gates (comma-separated)</label>
              <Input value={form.tier_gates} onChange={(e) => setForm({ ...form, tier_gates: e.target.value })} placeholder="commitment, ecommerce" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tenant Status Gates</label>
              <Input value={form.tenant_status_gates} onChange={(e) => setForm({ ...form, tenant_status_gates: e.target.value })} placeholder="active, trial" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Capability Gates (comma-separated)</label>
            <Input value={form.capability_gates} onChange={(e) => setForm({ ...form, capability_gates: e.target.value })} placeholder="chatbot.skills_enabled" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Refresh Cadence (minutes)</label>
              <Input type="number" min="1" value={form.refresh_cadence_minutes} onChange={(e) => setForm({ ...form, refresh_cadence_minutes: parseInt(e.target.value) || 15 })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="beta">Beta</option>
                <option value="deprecated">Deprecated</option>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured_aware} onChange={(e) => setForm({ ...form, featured_aware: e.target.checked })} />
            Featured Aware
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.endpoint.trim()}>
              {saving ? 'Saving...' : editingSkill ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminBotPageShell>
  );
}
