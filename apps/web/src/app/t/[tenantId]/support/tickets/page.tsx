'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmTicket, CrmActivity } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-800',
};

export default function TenantTicketsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [data, users, activityList] = await Promise.all([
          crmTenantCrmService.listTickets(
            statusFilter !== 'all' ? { status: statusFilter } : undefined
          ),
          tenantUserService.getTenantUsers(tenantId),
          crmTenantCrmService.listActivities({ limit: 100 }),
        ]);
        setTickets(data ?? []);
        setTenantUsers(users ?? []);
        setActivities(activityList ?? []);
      } catch (err) {
        clientLogger.error('[Tenant Tickets] Load error:', { detail: err });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, tenantId]);

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Tickets"
      subtitle="All your support tickets"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Tickets' },
      ]}
      navCounts={{ tickets: tickets.length }}
    >
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const assignedName = t.assigned_to
              ? tenantUsers.find(u => u.id === t.assigned_to)?.name || t.assigned_to
              : null;
            const lastActivity = activities
              .filter(a => a.ticket_id === t.id)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            return (
              <Link
                key={t.id}
                href={`/t/${tenantId}/support/tickets/${t.id}`}
                className="flex items-start justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {assignedName ? `Assigned: ${assignedName}` : 'Unassigned'} · {new Date(t.created_at).toLocaleString()}
                  </p>
                  {lastActivity?.content && (
                    <p className="text-xs text-neutral-400 mt-1 truncate max-w-[90%]">
                      {lastActivity.content} · {new Date(lastActivity.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {t.priority && (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-800'}`}>
                      {t.priority}
                    </span>
                  )}
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </TenantCrmPageShell>
  );
}
