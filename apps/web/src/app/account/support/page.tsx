'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import type { CrmTicket } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [ticketList, orderList] = await Promise.allSettled([
          crmCustomerService.listTickets(),
          crmCustomerService.listOrders(),
        ]);

        if (ticketList.status === 'fulfilled') setTickets(ticketList.value);

        // Derive tenant list from orders for the new ticket tenant selector
        if (orderList.status === 'fulfilled') {
          const uniqueTenants = Array.from(
            new Map(orderList.value.map((o: any) => [o.tenant_id, { id: o.tenant_id, name: o.tenant_name || o.tenant_id }])).values()
          );
          setTenants(uniqueTenants);
        }
      } catch (err) {
        console.error('[Customer Support] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreateTicket() {
    if (!newTitle.trim() || !newTenantId) return;
    setSubmitting(true);
    try {
      const ticket = await crmCustomerService.createTicket({
        tenant_id: newTenantId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setTickets(prev => [ticket, ...prev]);
      setShowNewTicket(false);
      setNewTitle('');
      setNewDescription('');
      setNewTenantId('');
    } catch (err) {
      console.error('[Customer Support] Create ticket error:', err);
    } finally {
      setSubmitting(false);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Support</h1>
        <button
          onClick={() => setShowNewTicket(true)}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          + New Ticket
        </button>
      </div>

      {/* New ticket form */}
      {showNewTicket && (
        <Card>
          <CardHeader><CardTitle>Create Support Ticket</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Store</label>
              <select
                value={newTenantId}
                onChange={(e) => setNewTenantId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">Select a store...</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Brief description of your issue"
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Provide more details about your issue..."
                rows={4}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!newTitle.trim() || !newTenantId || submitting}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creating...' : 'Submit Ticket'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-4xl mb-2">🎫</p>
              <p className="text-neutral-500">No support tickets yet</p>
              <p className="text-sm text-neutral-400 mt-1">Click &quot;+ New Ticket&quot; to get help</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <Link
              key={t.id}
              href={`/account/support/${t.id}`}
              className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    <span className="inline-flex items-center gap-1.5">
                      {t.tenant_logo ? (
                        <img src={t.tenant_logo} alt="" className="w-4 h-4 rounded object-cover" />
                      ) : (
                        <span className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500">{(t.tenant_name || t.tenant_id).charAt(0)}</span>
                      )}
                      {t.tenant_name || t.tenant_id}
                    </span> · {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                  {t.priority && (
                    <Badge variant={t.priority === 'urgent' ? 'error' : t.priority === 'high' ? 'warning' : 'default'}>
                      {t.priority}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
