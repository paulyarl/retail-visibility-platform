'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService } from '@/services/TenantUserService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { CrmTicket, CrmTask, CrmActivity, CrmInquiry, CrmAlert } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-amber-500',
  low: 'text-neutral-400',
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

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  status_change: { icon: '🔄', color: 'text-blue-600', bg: 'bg-blue-50' },
  note: { icon: '📝', color: 'text-neutral-600', bg: 'bg-neutral-50' },
  call: { icon: '📞', color: 'text-green-600', bg: 'bg-green-50' },
  email: { icon: '📧', color: 'text-purple-600', bg: 'bg-purple-50' },
  task_created: { icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  assignment: { icon: '👤', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  order_notification: { icon: '🛒', color: 'text-orange-600', bg: 'bg-orange-50' },
  order_placed: { icon: '📦', color: 'text-blue-600', bg: 'bg-blue-50' },
  order_cancelled: { icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
  order_fulfilled: { icon: '✅', color: 'text-green-600', bg: 'bg-green-50' },
  payment_event: { icon: '💳', color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface CrmTenantWidgetProps {
  tenantId?: string;
}

export default function CrmTenantWidget({ tenantId }: CrmTenantWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [crmDisabled, setCrmDisabled] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const prevUnreadRef = useRef<number>(0);
  const prevTicketIdsRef = useRef<Set<string>>(new Set());
  const prevTaskIdsRef = useRef<Set<string>>(new Set());
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const migratedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // One-time migration: push legacy localStorage activity read state to backend
  useEffect(() => {
    if (typeof window === 'undefined' || !tenantId || !user?.id || migratedRef.current) return;
    migratedRef.current = true;
    const legacyKey = `crm-widget-activity-last-read-${tenantId || 'global'}-${user.id}`;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue) {
      try {
        const parsedDate = new Date(legacyValue);
        if (!isNaN(parsedDate.getTime())) {
          crmTenantCrmService.setReadState('activity_feed', legacyValue);
        }
        localStorage.removeItem(legacyKey);
      } catch (err) {
        console.error('[CRM Tenant Widget] Legacy read state migration failed:', err);
      }
    }
    const legacyPrefix = 'crm-widget-activity-last-read-';
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(legacyPrefix) && key !== legacyKey) {
        localStorage.removeItem(key);
      }
    }
  }, [tenantId, user?.id]);

  const { data: stats, isLoading: loading, error: statsError } = useQuery({
    queryKey: ['crm', 'stats', tenantId],
    queryFn: async () => {
      const data = await crmTenantCrmService.getStats();
      if (!data) throw new Error('No stats');
      return data;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    retry: 0,
    throwOnError: false,
  });

  useEffect(() => {
    if (statsError) {
      const msg = (statsError as any)?.message || '';
      if (msg.includes('merchant_gate_disabled') || msg.includes('CRM is disabled')) {
        setCrmDisabled(true);
      }
    }
  }, [statsError]);

  const { data: tenantUsers } = useQuery({
    queryKey: ['tenant', 'users', tenantId],
    queryFn: () => tenantUserService.getTenantUsers(tenantId!),
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    retry: 0,
  });

  // Derive display data from query result
  const tickets = (stats?.open_tickets ?? []).slice(0, 3) as CrmTicket[];
  const tasks = (stats?.pending_tasks ?? []).slice(0, 2) as CrmTask[];
  const activities = (stats?.recent_activities ?? []).filter((a: any) => !a.is_internal).slice(0, 5) as CrmActivity[];
  const inquiries = (stats?.open_inquiries ?? []).slice(0, 3) as CrmInquiry[];
  const alerts = (stats?.recent_alerts ?? []).slice(0, 3) as CrmAlert[];
  const unreadCount = stats?.unread_count ?? 0;
  const openTicketCount = stats?.open_ticket_count ?? 0;
  const pendingTaskCount = stats?.pending_task_count ?? 0;
  const openInquiryCount = stats?.open_inquiry_count ?? 0;
  const unreadAlertCount = stats?.unread_alert_count ?? 0;
  const lastReadActivityAt = stats?.last_read_activity_at ?? null;
  const lastReadAlertAt = stats?.last_read_alert_at ?? null;
  const users = tenantUsers ?? [];

  // Toast notifications on new items (skip first load)
  useEffect(() => {
    if (!stats || !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }

    const newUnread = stats.unread_count ?? 0;
    const newTickets = (stats.open_tickets ?? []).slice(0, 3) as CrmTicket[];
    const newTasks = (stats.pending_tasks ?? []).slice(0, 2) as CrmTask[];
    const newAlerts = (stats.recent_alerts ?? []).slice(0, 3) as CrmAlert[];

    const prevTicketIds = prevTicketIdsRef.current;
    const prevTaskIds = prevTaskIdsRef.current;
    const prevAlertIds = prevAlertIdsRef.current;
    const prevUnread = prevUnreadRef.current;

    const newTicketItems = newTickets.filter(t => !prevTicketIds.has(t.id));
    const newTaskItems = newTasks.filter(t => !prevTaskIds.has(t.id));
    const newAlertItems = newAlerts.filter(a => !prevAlertIds.has(a.id));

    if (newUnread > prevUnread) {
      const delta = newUnread - prevUnread;
      // Alert toasts are now handled globally by CrmAlertToastWatcher in the tenant layout
      if (newAlertItems.length > 0) {
        // skip — watcher fires the toast
      } else if (newTicketItems.length > 0) {
        toast({
          title: 'New Support Ticket',
          description: newTicketItems[0].title,
          variant: 'info',
        });
      }
      if (newTaskItems.length > 0) {
        toast({
          title: 'New Task Assigned',
          description: newTaskItems[0].title,
          variant: 'warning',
        });
      }
      if (newAlertItems.length === 0 && newTicketItems.length === 0 && newTaskItems.length === 0 && delta > 0) {
        toast({
          title: `${delta} New CRM Item${delta > 1 ? 's' : ''}`,
          description: 'Check your support inbox for updates',
          variant: 'info',
        });
      }
    }

    prevUnreadRef.current = newUnread;
    prevTicketIdsRef.current = new Set(newTickets.map(t => t.id));
    prevTaskIdsRef.current = new Set(newTasks.map(t => t.id));
    prevAlertIdsRef.current = new Set(newAlerts.map(a => a.id));
  }, [stats]);

  async function markActivitiesRead() {
    try {
      await crmTenantCrmService.setReadState('activity_feed');
      await queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
    } catch (err) {
      console.error('[CRM Tenant Widget] Mark activities read error:', err);
    }
  }

  async function markAlertsRead() {
    try {
      await crmTenantCrmService.setReadState('alert_feed');
      await queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
    } catch (err) {
      console.error('[CRM Tenant Widget] Mark alerts read error:', err);
    }
  }

  async function handleCreateTicket() {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await crmTenantCrmService.createTicket({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setShowNewTicket(false);
      setNewTitle('');
      setNewDescription('');
      await queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
      toast({ title: 'Ticket Created', description: 'Your support ticket has been submitted', variant: 'success' });
    } catch (err) {
      console.error('[CRM Tenant Widget] Create ticket error:', err);
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (crmDisabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Support</h3>
        </div>
        <p className="text-xs text-neutral-400 text-center py-4">CRM is not enabled for this account. Contact support or enable it in CRM Options settings.</p>
      </div>
    );
  }

  const hasItems = tickets.length > 0 || tasks.length > 0 || activities.length > 0 || inquiries.length > 0 || alerts.length > 0;

  return (
    <div className="space-y-4">
      {/* Header with alert badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Support</h3>
            {unreadCount > 0 && (
              <p className="text-[10px] text-red-500 font-medium">
                {unreadCount} item{unreadCount !== 1 ? 's' : ''} needing attention
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm hover:shadow-md transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Ticket
        </button>
      </div>

      {/* Quick count pills */}
      {(openTicketCount > 0 || pendingTaskCount > 0 || openInquiryCount > 0 || unreadAlertCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {user?.id && (() => {
            const myCount = tickets.filter(t => t.assigned_to === user.id).length
              + tasks.filter(t => t.assigned_to === user.id).length
              + inquiries.filter(i => i.assigned_to === user.id).length;
            return myCount > 0 ? (
              <Link
                href={tenantId ? `/t/${tenantId}/support` : `/support`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium hover:bg-indigo-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {myCount} assigned to me
              </Link>
            ) : null;
          })()}
          {unreadAlertCount > 0 && (
            <Link
              href={tenantId ? `/t/${tenantId}/support` : `/support`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-medium hover:bg-orange-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {unreadAlertCount} alert{unreadAlertCount !== 1 ? 's' : ''}
            </Link>
          )}
          {openTicketCount > 0 && (
            <Link
              href={tenantId ? `/t/${tenantId}/support/tickets` : `/support/tickets`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium hover:bg-blue-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {openTicketCount} ticket{openTicketCount !== 1 ? 's' : ''}
            </Link>
          )}
          {pendingTaskCount > 0 && (
            <Link
              href={tenantId ? `/t/${tenantId}/support` : `/support`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {pendingTaskCount} task{pendingTaskCount !== 1 ? 's' : ''}
            </Link>
          )}
          {openInquiryCount > 0 && (
            <Link
              href={tenantId ? `/t/${tenantId}/support/inquiries` : `/support/inquiries`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium hover:bg-purple-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {openInquiryCount} inquir{openInquiryCount !== 1 ? 'ies' : 'y'}
            </Link>
          )}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Alerts</p>
            {(() => {
              const unreadAlertCountHeader = alerts.filter(
                (a) => !lastReadAlertAt || new Date(a.created_at).getTime() > new Date(lastReadAlertAt).getTime()
              ).length;
              return unreadAlertCountHeader > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); markAlertsRead(); }}
                  className="text-[10px] text-green-600 hover:text-green-800 dark:text-green-400 font-medium"
                >
                  Mark read
                </button>
              ) : null;
            })()}
          </div>
          {alerts.map(alert => {
            const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.info;
            const isUnreadAlert = !lastReadAlertAt || new Date(alert.created_at).getTime() > new Date(lastReadAlertAt).getTime();
            return (
              <Link
                key={alert.id}
                href={tenantId ? `/t/${tenantId}/support` : `/support`}
                className={`flex items-start gap-2.5 py-2 px-2.5 -mx-2 rounded-lg border ${config.border} ${config.bg} hover:opacity-90 transition-opacity ${isUnreadAlert ? 'ring-1 ring-orange-200' : ''}`}
              >
                <span className="text-sm flex-shrink-0 mt-0.5">{alert.icon || config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${config.color}`}>{alert.title}</p>
                  {alert.body && (
                    <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">{alert.body}</p>
                  )}
                  <p className="text-[10px] text-neutral-400 mt-1">{relativeTime(alert.created_at)}</p>
                </div>
                {isUnreadAlert && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0 mt-1.5 animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Open Tickets */}
      {tickets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Open Tickets</p>
          {tickets.map(t => {
            const assignedName = t.assigned_to
              ? users.find(u => u.id === t.assigned_to)?.name || t.assigned_to
              : null;
            const lastActivity = activities
              .filter(a => a.ticket_id === t.id)
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            return (
              <Link
                key={t.id}
                href={tenantId ? `/t/${tenantId}/support/tickets/${t.id}` : `/support/tickets/${t.id}`}
                className="flex items-start justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.priority === 'urgent' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                    <p className="text-sm truncate">{t.title}</p>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                    {assignedName ? `Assigned: ${assignedName}` : 'Unassigned'}
                    {lastActivity?.content ? ` · ${lastActivity.content} · ${new Date(lastActivity.created_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-2 flex-shrink-0 self-center ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                  {t.status?.replace('_', ' ')}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pending Tasks */}
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending Tasks</p>
          {tasks.map(t => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date();
            return (
              <Link
                key={t.id}
                href={tenantId ? `/t/${tenantId}/support` : `/support`}
                className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                  <p className="text-sm truncate">{t.title}</p>
                </div>
                {t.due_date && (
                  <span className={`text-[10px] ml-2 flex-shrink-0 ${isOverdue ? 'text-red-600 font-semibold' : 'text-neutral-400'}`}>
                    {isOverdue ? 'Overdue' : relativeTime(t.due_date)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Recent Activity</p>
            {(() => {
              const unreadCountAct = activities.filter(
                (a) => !lastReadActivityAt || new Date(a.created_at).getTime() > new Date(lastReadActivityAt).getTime()
              ).length;
              return unreadCountAct > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); markActivitiesRead(); }}
                  className="text-[10px] text-green-600 hover:text-green-800 dark:text-green-400 font-medium"
                >
                  Mark read
                </button>
              ) : null;
            })()}
          </div>
          {activities.map(a => {
            const isUnread = !lastReadActivityAt || new Date(a.created_at).getTime() > new Date(lastReadActivityAt).getTime();
            const config = ACTIVITY_CONFIG[a.activity_type] || { icon: '📋', color: 'text-neutral-600', bg: 'bg-neutral-50' };
            const actorUser = users.find(u => u.id === a.actor_id);
            const currentUserName = user?.firstName || user?.lastName
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
              : null;
            const displayName = actorUser?.name || (a.actor_id === user?.id ? currentUserName : null) || a.actor_name;
            return (
              <Link
                key={a.id}
                href={tenantId ? `/t/${tenantId}/support` : `/support`}
                className={`flex items-start gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${isUnread ? 'bg-green-50/40 dark:bg-green-900/10' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] flex-shrink-0 ${config.bg}`}>
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs truncate ${isUnread ? 'font-medium' : ''} ${config.color}`}>{a.content || a.activity_type}</p>
                    {isUnread && <span className="inline-flex w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{displayName} · {relativeTime(a.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!hasItems && (
        <div className="text-center py-6">
          <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-neutral-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-neutral-400">All caught up — no open items</p>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewTicket(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">New Support Ticket</h3>
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
                rows={3}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowNewTicket(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTicket}
                  disabled={!newTitle.trim() || submitting}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
