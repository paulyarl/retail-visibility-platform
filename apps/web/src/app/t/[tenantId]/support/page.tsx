'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmTicket, CrmTask, CrmActivity, CrmInquiry, CrmAlert } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  pending: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
};

export default function TenantSupportPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [inquiries, setInquiries] = useState<CrmInquiry[]>([]);
  const [alerts, setAlerts] = useState<CrmAlert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'my-work'>('all');
  const { user } = useAuth();
  const allCaps = useAllCapabilities(tenantId);
  const isWritable = allCaps.data?.subscriptionContext?.writable ?? true;
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);

  // Activity read tracking (per tenant, per browser)
  const activityReadKey = `crm-activity-last-read-${tenantId}-${user?.id || 'anon'}`;
  const [lastReadActivityAt, setLastReadActivityAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(activityReadKey);
  });

  const unreadActivityCount = activities.filter(
    (a) => !lastReadActivityAt || new Date(a.created_at).getTime() > new Date(lastReadActivityAt).getTime()
  ).length;

  function markActivitiesRead() {
    const now = new Date().toISOString();
    localStorage.setItem(activityReadKey, now);
    setLastReadActivityAt(now);
  }

  useEffect(() => {
    async function load() {
      try {
        const users = await tenantUserService.getTenantUsers(tenantId);
        setTenantUsers(users ?? []);
        if (viewMode === 'my-work' && user?.id) {
          const [ticketList, taskList, inquiryList, stats] = await Promise.all([
            crmTenantCrmService.listTickets({ assignedTo: user.id }),
            crmTenantCrmService.listTasks({ assignedTo: user.id }),
            crmTenantCrmService.listInquiries({ assignedTo: user.id }),
            crmTenantCrmService.getStats(),
          ]);
          setTickets(ticketList ?? []);
          setTasks(taskList ?? []);
          setInquiries(inquiryList ?? []);
          setActivities((stats?.recent_activities ?? []).filter((a: any) => !a.is_internal));
          setAlerts(stats?.recent_alerts ?? []);
          setUnreadAlertCount(stats?.unread_alert_count ?? 0);
        } else {
          const stats = await crmTenantCrmService.getStats();
          setTickets(stats?.open_tickets ?? []);
          setTasks(stats?.pending_tasks ?? []);
          setActivities((stats?.recent_activities ?? []).filter((a: any) => !a.is_internal));
          setInquiries(stats?.open_inquiries ?? []);
          setAlerts(stats?.recent_alerts ?? []);
          setUnreadAlertCount(stats?.unread_alert_count ?? 0);
        }
      } catch (err) {
        console.error('[Tenant Support] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [viewMode, user?.id, tenantId]);

  async function handleCreateTicket() {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await crmTenantCrmService.createTicket({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority as any,
      });
      setShowNewTicket(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      // Reload
      const stats = await crmTenantCrmService.getStats();
      setTickets(stats.open_tickets);
    } catch (err) {
      console.error('[Tenant Support] Create ticket error:', err);
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
    <div className="max-w-5xl mx-auto p-4">
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Support Hub"
      subtitle="Your support tickets, tasks & activity"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support' },
      ]}
      navCounts={{
        tickets: tickets.length,
        inquiries: inquiries.length,
        alerts: unreadAlertCount + unreadActivityCount,
      }}
      actions={isWritable ? (
        <button
          onClick={() => setShowNewTicket(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm hover:shadow-md transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Ticket
        </button>
      ) : undefined}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Alerts</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{unreadAlertCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">{viewMode === 'my-work' ? 'My Tickets' : 'Open Tickets'}</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{tickets.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">{viewMode === 'my-work' ? 'My Tasks' : 'Pending Tasks'}</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{tasks.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10">
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">{viewMode === 'my-work' ? 'My Inquiries' : 'Customer Inquiries'}</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">{inquiries.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Activities</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{unreadActivityCount}</p>
            {activities.length > 0 && <p className="text-xs text-green-600/60">/ {activities.length}</p>}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alerts ({alerts.length})</CardTitle>
            <button
              onClick={async () => { await crmTenantCrmService.markAllAlertsRead(); const s = await crmTenantCrmService.getStats(); setAlerts(s?.recent_alerts ?? []); setUnreadAlertCount(s?.unread_alert_count ?? 0); }}
              className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
            >
              Mark all read
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className={`flex items-start justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 rounded-lg px-2 -mx-2 ${!a.is_read ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {a.icon && <span className="text-base">{a.icon}</span>}
                      <p className={`text-sm font-medium ${!a.is_read ? 'text-purple-800 dark:text-purple-200' : ''}`}>{a.title}</p>
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
                        onClick={async () => { await crmTenantCrmService.markAlertRead(a.id); const s = await crmTenantCrmService.getStats(); setAlerts(s?.recent_alerts ?? []); setUnreadAlertCount(s?.unread_alert_count ?? 0); }}
                        className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
                      >
                        Read
                      </button>
                    )}
                    <button
                      onClick={async () => { await crmTenantCrmService.dismissAlert(a.id); const s = await crmTenantCrmService.getStats(); setAlerts(s?.recent_alerts ?? []); setUnreadAlertCount(s?.unread_alert_count ?? 0); }}
                      className="text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets */}
        <Card>
          <CardHeader><CardTitle>{viewMode === 'my-work' ? 'My Tickets' : 'Open Tickets'} ({tickets.length})</CardTitle></CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No open tickets</p>
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
                    <Link key={t.id} href={`/t/${tenantId}/support/tickets/${t.id}`} className="flex items-start justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
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
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                          {t.status?.replace('_', ' ')}
                        </span>
                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inquiries */}
        <Card>
          <CardHeader><CardTitle>{viewMode === 'my-work' ? 'My Inquiries' : 'Customer Inquiries'} ({inquiries.length})</CardTitle></CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No open inquiries</p>
            ) : (
              <div className="space-y-2">
                {inquiries.map(i => {
                  const assignedName = i.assigned_to
                    ? tenantUsers.find(u => u.id === i.assigned_to)?.name || i.assigned_to
                    : null;
                  const lastActivity = activities
                    .filter(a => a.metadata?.inquiry_id === i.id || a.activity_type === 'inquiry_created')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  return (
                    <Link key={i.id} href={`/t/${tenantId}/support/inquiries/${i.id}`} className="flex items-start justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{i.subject}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {i.sender_name || i.customer_id || i.contact_id || 'Anonymous'}
                          {i.sender_email ? ` · ${i.sender_email}` : ''}
                          {i.sender_phone ? ` · ${i.sender_phone}` : ''}
                          {' · '}{new Date(i.created_at).toLocaleString()}
                          {assignedName ? ` · Assigned: ${assignedName}` : ''}
                        </p>
                        {lastActivity?.content && (
                          <p className="text-xs text-neutral-400 mt-1 truncate max-w-[90%]">
                            {lastActivity.content} · {new Date(lastActivity.created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-800'}`}>
                          {i.status?.replace('_', ' ')}
                        </span>
                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity ({activities.length})</CardTitle>
          {unreadActivityCount > 0 && (
            <button
              onClick={markActivitiesRead}
              className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 font-medium"
            >
              Mark all read
            </button>
          )}
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {activities.map(a => {
                const isUnread = !lastReadActivityAt || new Date(a.created_at).getTime() > new Date(lastReadActivityAt).getTime();
                const detailHref = a.ticket_id
                  ? `/t/${tenantId}/support/tickets/${a.ticket_id}`
                  : null;
                const Wrapper = detailHref ? Link : 'div';
                const wrapperProps = detailHref
                  ? { href: detailHref, className: `flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer ${isUnread ? 'bg-green-50/40 dark:bg-green-900/10' : ''}` }
                  : { className: `flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0 ${isUnread ? 'bg-green-50/40 dark:bg-green-900/10' : ''}` };
                return (
                  <Wrapper key={a.id} {...(wrapperProps as any)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${isUnread ? 'font-medium' : ''}`}>{a.content}</p>
                        {isUnread && <span className="inline-flex w-1.5 h-1.5 rounded-full bg-green-500" />}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {(() => {
                          const actorUser = tenantUsers.find(u => u.id === a.actor_id);
                          const currentUserName = user?.firstName || user?.lastName
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : null;
                          const displayName = actorUser?.name || (a.actor_id === user?.id ? currentUserName : null) || a.actor_name;
                          return `${displayName} · ${a.activity_type} · ${new Date(a.created_at).toLocaleString()}`;
                        })()}
                      </p>
                    </div>
                    {detailHref && (
                      <svg className="w-4 h-4 text-neutral-400 self-center shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    )}
                  </Wrapper>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewTicket(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold">New Support Ticket</h3>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                autoFocus
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe your issue..."
                rows={4}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowNewTicket(false)} className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm">Cancel</button>
                <button
                  onClick={handleCreateTicket}
                  disabled={!newTitle.trim() || submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Creating...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TenantCrmPageShell>
    </div>
  );
}
