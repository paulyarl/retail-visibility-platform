'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { TicketStatus, TicketPriority } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-800',
};

export default function CrmGlobalTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await crmAdminService.listGlobalTickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        });
        setTickets(result);
      } catch (err) {
        console.error('[CRM Global Tickets] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, priorityFilter]);

  return (
    <CrmPageShell
      title="Global Tickets"
      subtitle="All tenant support tickets"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tickets' },
      ]}
      actions={
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
          >
            <option value="">All Priorities</option>
            {Object.keys(PRIORITY_COLORS).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <Card><CardContent><p className="text-center text-neutral-500 py-8">No tickets found</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Tenant</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">Assigned</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/settings/admin/crm/tickets/${t.id}`} className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 block">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    <Link href={`/settings/admin/crm/tenants/${t.tenant_id}`} className="hover:underline">{t.tenant_id}</Link>
                  </td>
                  <td className="px-4 py-3">
                    {updatingId === t.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <select
                        value={t.status}
                        onChange={async (e) => {
                          setUpdatingId(t.id);
                          try {
                            const updated = await crmAdminService.updateTicket(t.id, { status: e.target.value as TicketStatus });
                            setTickets(prev => prev.map(ticket => ticket.id === t.id ? { ...ticket, ...updated } : ticket));
                          } catch (err) { console.error(err); }
                          setUpdatingId(null);
                        }}
                        className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting">Waiting</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {updatingId === t.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <select
                        value={t.priority}
                        onChange={async (e) => {
                          setUpdatingId(t.id);
                          try {
                            const updated = await crmAdminService.updateTicket(t.id, { priority: e.target.value as TicketPriority });
                            setTickets(prev => prev.map(ticket => ticket.id === t.id ? { ...ticket, ...updated } : ticket));
                          } catch (err) { console.error(err); }
                          setUpdatingId(null);
                        }}
                        className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-800'}`}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{t.assigned_to || '—'}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/settings/admin/crm/tickets/${t.id}`} className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium">
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmPageShell>
  );
}
