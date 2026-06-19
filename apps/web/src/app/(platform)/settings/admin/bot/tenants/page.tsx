'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Spinner, Button, Input } from '@/components/ui';
import { botPlatformAdminService, type BotTenantSummary } from '@/services/bot/BotPlatformAdminService';
import AdminBotPageShell from '@/components/bot/AdminBotPageShell';

export default function BotTenantsPage() {
  const [tenants, setTenants] = useState<BotTenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  async function load() {
    setLoading(true);
    try {
      const result = await botPlatformAdminService.listBotTenants(page, limit, search || undefined);
      setTenants(result.data || []);
      setTotal(result.total);
    } catch (err) {
      console.error('[Bot Tenants] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AdminBotPageShell
      title="Bot Tenants"
      subtitle="All tenants with chatbot configurations"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin', href: '/settings/admin' },
        { label: 'Bot', href: '/settings/admin/bot' },
        { label: 'Tenants' },
      ]}
    >
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tenant ID or bot name..."
          className="max-w-sm"
        />
        <Button type="submit">Search</Button>
      </form>

      <Card>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">No bot configurations found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 font-medium">Tenant ID</th>
                    <th className="text-left py-2 px-3 font-medium">Bot Name</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Tone</th>
                    <th className="text-left py-2 px-3 font-medium">Response</th>
                    <th className="text-left py-2 px-3 font-medium">Escalation</th>
                    <th className="text-left py-2 px-3 font-medium">Conversations</th>
                    <th className="text-left py-2 px-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.tenant_id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-mono text-xs">{t.tenant_id}</td>
                      <td className="py-2 px-3">{t.bot_name || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={t.status === 'active' ? 'success' : 'warning'}>{t.status}</Badge>
                      </td>
                      <td className="py-2 px-3 capitalize">{t.tone || '—'}</td>
                      <td className="py-2 px-3 capitalize">{t.response_length || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={t.escalation_enabled ? 'success' : 'default'}>
                          {t.escalation_enabled ? 'On' : 'Off'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">{t.conversationCount}</td>
                      <td className="py-2 px-3 text-xs text-neutral-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page {page} of {totalPages} ({total} tenants)
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </AdminBotPageShell>
  );
}
