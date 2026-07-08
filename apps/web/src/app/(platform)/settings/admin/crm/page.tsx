'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import { useAuth } from '@/contexts/AuthContext';
import CrmPageShell from '@/components/crm/CrmPageShell';
import { IconBroadcast } from '@tabler/icons-react';

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
  const [promoStats, setPromoStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'my-work'>('all');
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const ticketFilters: { status?: string; assignedTo?: string } = { status: 'open' };
        if (viewMode === 'my-work' && user?.id) {
          ticketFilters.assignedTo = user.id;
        }

        const [statsRes, ticketsRes, activityRes, promoRes] = await Promise.allSettled([
          crmAdminService.getDashboardStats(),
          crmAdminService.listGlobalTickets(ticketFilters),
          crmAdminService.listGlobalActivities({ limit: 8 }),
          crmAdminService.getPromotionStats(),
        ]);

        if (statsRes.status === 'fulfilled') setStats(statsRes.value);

        if (ticketsRes.status === 'fulfilled') {
          setMyTickets(ticketsRes.value.slice(0, 5));
        }

        if (activityRes.status === 'fulfilled') {
          setRecentActivity(activityRes.value.slice(0, 8));
        }

        if (promoRes.status === 'fulfilled') setPromoStats(promoRes.value);
      } catch (err) {
        console.error('[CRM Dashboard] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [viewMode, user?.id]);

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
      actions={
        <Link href="/settings/admin/crm/broadcast">
          <Button variant="default" size="sm">
            <IconBroadcast size={16} />
            Broadcast Alert
          </Button>
        </Link>
      }
    >
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === 'all'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setViewMode('my-work')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === 'my-work'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          My Work
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={viewMode === 'my-work' ? 'My Tickets' : 'Open Tickets'} value={myTickets.length} href="/settings/admin/crm/tickets" color="blue" />
        <StatCard label="Overdue Tasks" value={stats?.overdueTasks ?? 0} href="/settings/admin/crm/tasks" color="red" />
        <StatCard label="Active Tenants" value={stats?.activeTenants ?? 0} href="/settings/admin/crm/tenants" color="green" />
        <StatCard label="Avg Response" value={formatDuration(stats?.avgResponseTimeMs ?? null)} color="purple" />
      </div>

      {/* My Tickets + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{viewMode === 'my-work' ? 'My Open Tickets' : 'Open Tickets'}</CardTitle>
          </CardHeader>
          <CardContent>
            {myTickets.length === 0 ? (
              <p className="text-sm text-neutral-500">No open tickets</p>
            ) : (
              <div className="space-y-2">
                {myTickets.map((t: any) => (
                  <Link key={t.id} href={`/settings/admin/crm/tickets/${t.id}`} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
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
                {recentActivity.map((a: any) => {
                  const currentUserName = user?.firstName || user?.lastName
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : null;
                  const displayName = a.actor_id === user?.id ? currentUserName : a.actor_name;
                  return (
                    <div key={a.id} className="flex gap-2 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{a.content}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {displayName} · {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                      {a.is_internal && <Badge variant="warning">Internal</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Directory Promotions Widget */}
      {promoStats && (
        <DirectoryPromotionsWidget stats={promoStats} />
      )}
    </CrmPageShell>
  );
}

function DirectoryPromotionsWidget({ stats }: { stats: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Directory Promotions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <MiniStat label="Active" value={stats.activeCount ?? 0} />
          <MiniStat label="Revenue (Active)" value={`$${((stats.totalRevenueCents ?? 0) / 100).toFixed(0)}`} />
          <MiniStat label="Grace Period" value={stats.gracePeriodCount ?? 0} />
          <MiniStat label="Expired" value={stats.expiredCount ?? 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming Renewals */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Upcoming Renewals (7d)</p>
            {stats.upcomingRenewals?.length ? (
              <div className="space-y-1">
                {stats.upcomingRenewals.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <Link href={`/settings/admin/crm/tenants/${p.tenantId}`} className="text-amber-600 hover:underline truncate">
                      {p.tenantId}
                    </Link>
                    <span className="text-neutral-500 ml-2 shrink-0">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No upcoming renewals</p>
            )}
          </div>

          {/* Grace Period */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">In Grace Period</p>
            {stats.gracePeriodPromotions?.length ? (
              <div className="space-y-1">
                {stats.gracePeriodPromotions.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <Link href={`/settings/admin/crm/tenants/${p.tenantId}`} className="text-red-600 hover:underline truncate">
                      {p.tenantId}
                    </Link>
                    <span className="text-neutral-500 ml-2 shrink-0">
                      {p.gracePeriodEndsAt ? new Date(p.gracePeriodEndsAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">None in grace period</p>
            )}
          </div>

          {/* Recent Activations */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Recent Activations</p>
            {stats.recentActivations?.length ? (
              <div className="space-y-1">
                {stats.recentActivations.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <Link href={`/settings/admin/crm/tenants/${p.tenantId}`} className="text-amber-600 hover:underline truncate">
                      {p.tenantId}
                    </Link>
                    <span className="text-neutral-500 ml-2 shrink-0 capitalize">{p.tier}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No recent activations</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg p-3 bg-neutral-50 dark:bg-neutral-800/50">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
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

