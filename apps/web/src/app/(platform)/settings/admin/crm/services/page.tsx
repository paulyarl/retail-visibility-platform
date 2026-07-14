'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';

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

export default function CrmServicesPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ticketsRes, tasksRes] = await Promise.allSettled([
          crmAdminService.listGlobalTickets({ category: 'platform_service' }),
          crmAdminService.listTasks({ status: 'pending' }),
        ]);
        if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value);
        if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
      } catch (err) {
        console.error('[CRM Services] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeTickets = tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const deliveredTickets = tickets.filter(t => t.status === 'resolved');
  const pendingTasks = tasks.filter(t => t.title?.includes('Platform Service') || t.description?.includes('platform_service'));

  return (
    <CrmPageShell
      title="Platform Services"
      subtitle="Fulfillment overview for platform-offered professional services"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Services' },
      ]}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Active Services" value={activeTickets.length} color="blue" />
            <SummaryCard label="In Progress" value={inProgressTickets.length} color="amber" />
            <SummaryCard label="Delivered" value={deliveredTickets.length} color="green" />
            <SummaryCard label="Pending Tasks" value={pendingTasks.length} color="purple" />
          </div>

          {/* Service tickets table */}
          <Card>
            <CardHeader>
              <CardTitle>Service Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">No platform service tickets</p>
              ) : (
                <div className="overflow-x-auto">
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
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500 text-xs">{t.assigned_to || 'Unassigned'}</td>
                          <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/settings/admin/crm/tickets/${t.id}`} className="text-amber-600 hover:text-amber-700 dark:text-amber-400 text-xs font-medium">
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending tasks */}
          {pendingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Workflow Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-neutral-500">{task.tenant_id}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {task.due_date && (
                          <span className="text-xs text-neutral-500">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <Badge variant={task.priority === 'high' ? 'warning' : 'default'}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </CrmPageShell>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  return (
    <div className={`rounded-lg p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
