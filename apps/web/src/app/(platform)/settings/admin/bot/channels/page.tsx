'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Spinner, Button, Input, Modal, ModalFooter } from '@/components/ui';
import { botPlatformAdminService, type WhatsAppChannel, type WhatsAppChannelStatus } from '@/services/bot/BotPlatformAdminService';
import AdminBotPageShell from '@/components/bot/AdminBotPageShell';
import { clientLogger } from '@/lib/client-logger';

export default function BotChannelsPage() {
  const [channels, setChannels] = useState<WhatsAppChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<WhatsAppChannel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({ tenantId: '', phoneNumberId: '', displayPhoneNumber: '', accessToken: '' });
  const [rotateToken, setRotateToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await botPlatformAdminService.listChannels();
      setChannels(data || []);
    } catch (err) {
      clientLogger.error('[Bot Channels] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await botPlatformAdminService.createChannel({
        tenantId: form.tenantId.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        displayPhoneNumber: form.displayPhoneNumber.trim() || undefined,
        accessToken: form.accessToken,
      });
      setNotice(`Channel created — token fingerprint ${created.tokenFingerprint ?? 'stored'}`);
      setCreateOpen(false);
      setForm({ tenantId: '', phoneNumberId: '', displayPhoneNumber: '', accessToken: '' });
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create channel');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(channel: WhatsAppChannel, status: WhatsAppChannelStatus) {
    try {
      await botPlatformAdminService.updateChannel(channel.id, { status });
      await load();
    } catch (err) {
      clientLogger.error('[Bot Channels] Status update error:', { detail: err });
    }
  }

  async function handleRotate(e: React.FormEvent) {
    e.preventDefault();
    if (!rotateTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await botPlatformAdminService.rotateChannelToken(rotateTarget.id, rotateToken);
      setNotice(`Token rotated — fingerprint ${updated.tokenFingerprint ?? 'updated'}`);
      setRotateTarget(null);
      setRotateToken('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to rotate token');
    } finally {
      setSaving(false);
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
      title="WhatsApp Channels"
      subtitle="Platform-owned WhatsApp Business channels routed to tenant bots"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin', href: '/settings/admin' },
        { label: 'Bot', href: '/settings/admin/bot' },
        { label: 'Channels' },
      ]}
    >
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {notice}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => { setFormError(null); setCreateOpen(true); }}>Add Channel</Button>
      </div>

      <Card>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              No WhatsApp channels configured. Add the platform WABA phone number to enable inbound WhatsApp bot replies.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 font-medium">Channel ID</th>
                    <th className="text-left py-2 px-3 font-medium">Tenant</th>
                    <th className="text-left py-2 px-3 font-medium">Phone Number ID</th>
                    <th className="text-left py-2 px-3 font-medium">Display Number</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-mono text-xs">{c.id}</td>
                      <td className="py-2 px-3 font-mono text-xs">{c.tenantId}</td>
                      <td className="py-2 px-3 font-mono text-xs">{c.phoneNumberId}</td>
                      <td className="py-2 px-3">{c.displayPhoneNumber || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={c.status === 'active' ? 'success' : c.status === 'disabled' ? 'warning' : 'destructive'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-neutral-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex justify-end gap-2">
                          {c.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatus(c, c.status === 'active' ? 'disabled' : 'active')}
                            >
                              {c.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setFormError(null); setRotateToken(''); setRotateTarget(c); }}
                          >
                            Rotate Token
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create channel modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add WhatsApp Channel">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tenant ID</label>
            <Input
              value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
              placeholder="tenant the channel routes to"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number ID</label>
            <Input
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="Meta WABA phone_number_id"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display Phone Number (optional)</label>
            <Input
              value={form.displayPhoneNumber}
              onChange={(e) => setForm({ ...form, displayPhoneNumber: e.target.value })}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <Input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder="Meta system-user access token — write-only"
              autoComplete="off"
              required
            />
            <p className="text-xs text-neutral-500 mt-1">
              Encrypted immediately and never shown again. Only a last-4 fingerprint is returned.
            </p>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Channel'}</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Rotate token modal */}
      <Modal isOpen={!!rotateTarget} onClose={() => setRotateTarget(null)} title="Rotate Access Token">
        <form onSubmit={handleRotate} className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Paste the new access token for channel <span className="font-mono text-xs">{rotateTarget?.id}</span>.
            The previous token stops working immediately after rotation.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">New Access Token</label>
            <Input
              type="password"
              value={rotateToken}
              onChange={(e) => setRotateToken(e.target.value)}
              placeholder="New Meta access token — write-only"
              autoComplete="off"
              required
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setRotateTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Rotating…' : 'Rotate Token'}</Button>
          </ModalFooter>
        </form>
      </Modal>
    </AdminBotPageShell>
  );
}
