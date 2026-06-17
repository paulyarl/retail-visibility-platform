'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';
import type { CrmTicket, CrmAlert } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const ALERT_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  milestone: { icon: '🏆', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  subscription: { icon: '🔔', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  welcome: { icon: '👋', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  info: { icon: 'ℹ️', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  warning: { icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  congratulations: { icon: '🎉', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  order: { icon: '🛒', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
};

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [alerts, setAlerts] = useState<CrmAlert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [alertFilter, setAlertFilter] = useState<'all' | 'order' | 'platform'>('all');
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTenantId, setNewTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [crmFlagsMap, setCrmFlagsMap] = useState<Record<string, PublicCrmOptionsFlags | null>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ticketList, orderList, alertList] = await Promise.allSettled([
          crmCustomerService.listTickets(),
          crmCustomerService.listOrders(),
          crmCustomerService.listAlerts(),
        ]);

        if (ticketList.status === 'fulfilled') setTickets(ticketList.value);

        if (alertList.status === 'fulfilled') {
          setAlerts(alertList.value);
          setUnreadAlertCount(alertList.value.filter((a: CrmAlert) => !a.is_read && !a.is_dismissed).length);
        }

        // Derive tenant list from orders for the new ticket tenant selector
        if (orderList.status === 'fulfilled') {
          const uniqueTenants = Array.from(
            new Map(orderList.value.map((o: any) => [o.tenant_id, { id: o.tenant_id, name: o.tenant_name || o.tenant_id }])).values()
          );
          // Fetch CRM flags for each tenant to filter by customer ticket eligibility
          const flagsEntries = await Promise.all(
            uniqueTenants.map(async (t) => {
              const flags = await unifiedCapabilityService.getCrmOptionsFlags(t.id);
              return [t.id, flags] as [string, PublicCrmOptionsFlags | null];
            })
          );
          const flagsMap = Object.fromEntries(flagsEntries);
          setCrmFlagsMap(flagsMap);
          const eligibleTenants = uniqueTenants.filter(t => {
            const f = flagsMap[t.id];
            return f?.crm_enabled && f?.crm_customer_tickets;
          });
          setTenants(eligibleTenants);
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
    setCreateError(null);
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
    } catch (err: any) {
      console.error('[Customer Support] Create ticket error:', err);
      const msg = err?.message || '';
      if (msg.includes('crm_disabled') || msg.includes('not enabled')) {
        setCreateError('Support tickets are not available for this store.');
      } else if (msg.includes('relationship')) {
        setCreateError('You must have a purchase history with this store to create a ticket.');
      } else {
        setCreateError('Failed to create ticket. Please try again.');
      }
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
        {tenants.length > 0 && (
          <button
            onClick={() => setShowNewTicket(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            + New Ticket
          </button>
        )}
      </div>

      {/* New ticket form */}
      {showNewTicket && (
        <Card>
          <CardHeader><CardTitle>Create Support Ticket</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {createError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
                {createError}
              </div>
            )}
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
                onClick={() => { setShowNewTicket(false); setCreateError(null); }}
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

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alerts ({alerts.length})</CardTitle>
            {unreadAlertCount > 0 && (
              <button
                onClick={async () => { await crmCustomerService.markAllAlertsRead(); const a = await crmCustomerService.listAlerts(); setAlerts(a); setUnreadAlertCount(a.filter((x: CrmAlert) => !x.is_read && !x.is_dismissed).length); }}
                className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
              >
                Mark all read
              </button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2">
              {(['all', 'order', 'platform'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    alertFilter === f
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'order' ? 'Orders' : 'Platform'}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {alerts
                .filter(a => {
                  if (alertFilter === 'order') return a.type === 'order';
                  if (alertFilter === 'platform') return a.type !== 'order';
                  return true;
                })
                .map(a => {
                  const config = ALERT_CONFIG[a.type] || ALERT_CONFIG.info;
                  const orderId = a.metadata?.order_id;
                  const href = a.type === 'order' && orderId ? `/account/orders/${orderId}` : '#';
                  return (
                    <div key={a.id} className={`flex items-start justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 rounded-lg px-2 -mx-2 ${!a.is_read ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {a.icon && <span className="text-base">{a.icon}</span>}
                          <p className={`text-sm font-medium ${!a.is_read ? 'text-purple-800 dark:text-purple-200' : ''}`}>
                            {a.type === 'order' && orderId ? (
                              <Link href={href} className="hover:underline">{a.title}</Link>
                            ) : (
                              a.title
                            )}
                          </p>
                          {!a.is_read && <span className="inline-flex w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        {a.body && (
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{a.body}</p>
                        )}
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {a.type?.replace('_', ' ')} · {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {!a.is_read && (
                          <button
                            onClick={async () => { await crmCustomerService.markAlertRead(a.id); const updated = await crmCustomerService.listAlerts(); setAlerts(updated); setUnreadAlertCount(updated.filter((x: CrmAlert) => !x.is_read && !x.is_dismissed).length); }}
                            className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
                          >
                            Read
                          </button>
                        )}
                        <button
                          onClick={async () => { await crmCustomerService.dismissAlert(a.id); const updated = await crmCustomerService.listAlerts(); setAlerts(updated); setUnreadAlertCount(updated.filter((x: CrmAlert) => !x.is_read && !x.is_dismissed).length); }}
                          className="text-xs text-neutral-400 hover:text-neutral-600"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
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
              {tenants.length > 0 ? (
                <p className="text-sm text-neutral-400 mt-1">Click &quot;+ New Ticket&quot; to get help</p>
              ) : (
                <p className="text-sm text-neutral-400 mt-1">Support tickets are not available for your stores.</p>
              )}
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
