'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';

interface DashboardStats {
  openTickets: number;
  overdueTasks: number;
  activeTenants: number;
  avgResponseTimeMs: number | null;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return `${hours}h ${rem}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, ticketsRes, activityRes] = await Promise.allSettled([
          crmAdminService.getDashboardStats(),
          crmAdminService.listGlobalTickets({ status: 'open' }),
          crmAdminService.listGlobalActivities({ limit: 8 }),
        ]);

        if (statsRes.status === 'fulfilled') setStats(statsRes.value);

        if (ticketsRes.status === 'fulfilled') {
          setMyTickets(ticketsRes.value.slice(0, 5));
        }

        if (activityRes.status === 'fulfilled') {
          setRecentActivity(activityRes.value.slice(0, 8));
        }
      } catch (err) {
        console.error('[CRM Dashboard] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <CrmPageShell
      title="CRM Dashboard"
      subtitle="Platform support overview"
      breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Admin' }, { label: 'CRM' }]}
      navCounts={{
        tickets: stats?.openTickets,
        tasks: stats?.overdueTasks,
      }}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Open Tickets" value={stats?.openTickets ?? 0} href="/settings/admin/crm/tickets" color="blue" />
        <StatCard label="Overdue Tasks" value={stats?.overdueTasks ?? 0} href="/settings/admin/crm/tasks" color="red" />
        <StatCard label="Active Tenants" value={stats?.activeTenants ?? 0} href="/settings/admin/crm/tenants" color="green" />
        <StatCard label="Avg Response" value={formatDuration(stats?.avgResponseTimeMs ?? null)} color="purple" />
      </div>

      {/* My Tickets + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {myTickets.length === 0 ? (
              <p className="text-sm text-neutral-500">No open tickets</p>
            ) : (
              <div className="space-y-2">
                {myTickets.map((t: any) => (
                  <Link key={t.id} href={`/settings/admin/crm/tenants/${t.tenant_id}`} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-neutral-500">{t.tenant_id}</p>
                    </div>
                    <Badge variant={t.priority === 'urgent' ? 'error' : t.priority === 'high' ? 'warning' : 'default'}>
                      {t.priority}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-neutral-500">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a: any) => (
                  <div key={a.id} className="flex gap-2 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{a.content}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {a.actor_name} · {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    {a.is_internal && <Badge variant="warning">Internal</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CrmPageShell>
  );
}

function StatCard({ label, value, href, color }: { label: string; value: number | string; href?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  const content = (
    <div className={`rounded-lg p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

