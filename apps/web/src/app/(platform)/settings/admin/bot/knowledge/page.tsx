'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Select, Modal } from '@/components/ui';
import { botPlatformAdminService, type BotKnowledgeStatus } from '@/services/bot/BotPlatformAdminService';
import AdminBotPageShell from '@/components/bot/AdminBotPageShell';
import { clientLogger } from '@/lib/client-logger';

export default function BotKnowledgePage() {
  const [tenants, setTenants] = useState<BotKnowledgeStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshModal, setRefreshModal] = useState<BotKnowledgeStatus | null>(null);
  const [refreshType, setRefreshType] = useState<'faq' | 'product' | 'both'>('both');
  const limit = 25;

  async function load() {
    setLoading(true);
    try {
      const result = await botPlatformAdminService.listKnowledgeStatus(page, limit);
      setTenants(result.data || []);
      setTotal(result.total);
    } catch (err) {
      clientLogger.error('[Bot Knowledge] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function handleRefresh() {
    if (!refreshModal) return;
    setRefreshing(refreshModal.tenantId);
    try {
      await botPlatformAdminService.refreshEmbeddings(refreshModal.tenantId, refreshType);
      setRefreshModal(null);
      await load();
    } catch (err) {
      clientLogger.error('[Bot Knowledge] Refresh error:', { detail: err });
    } finally {
      setRefreshing(null);
    }
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
      title="Knowledge Base"
      subtitle="FAQ and product embedding status across all tenants"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin', href: '/settings/admin' },
        { label: 'Bot', href: '/settings/admin/bot' },
        { label: 'Knowledge' },
      ]}
    >
      <Card>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">No tenants with active chatbots</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 px-3 font-medium">Tenant</th>
                    <th className="text-left py-2 px-3 font-medium">Bot Name</th>
                    <th className="text-left py-2 px-3 font-medium">FAQ Embeddings</th>
                    <th className="text-left py-2 px-3 font-medium">Product Embeddings</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.tenantId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 px-3 font-mono text-xs">{t.tenantId}</td>
                      <td className="py-2 px-3">{t.botName || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={t.faqEmbeddings > 0 ? 'success' : 'default'}>{t.faqEmbeddings}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={t.productEmbeddings > 0 ? 'success' : 'default'}>{t.productEmbeddings}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={t.status === 'active' ? 'success' : 'warning'}>{t.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setRefreshModal(t)}
                          disabled={refreshing === t.tenantId}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                        >
                          {refreshing === t.tenantId ? 'Refreshing...' : 'Refresh'}
                        </button>
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

      <Modal
        isOpen={!!refreshModal}
        onClose={() => setRefreshModal(null)}
        title="Refresh Embeddings"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Refresh embeddings for tenant <span className="font-mono font-medium">{refreshModal?.tenantId}</span>?
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Embedding Type</label>
            <Select value={refreshType} onChange={(e) => setRefreshType(e.target.value as any)}>
              <option value="both">Both (FAQ + Product)</option>
              <option value="faq">FAQ only</option>
              <option value="product">Product only</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRefreshModal(null)}>Cancel</Button>
            <Button onClick={handleRefresh} disabled={!!refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminBotPageShell>
  );
}
