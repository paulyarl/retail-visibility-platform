'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import type { CrmTicket, CrmTask, CrmActivity } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
};

const ACTIVITY_ICONS: Record<string, string> = {
  status_change: '🔄',
  note: '📝',
  call: '📞',
  email: '📧',
  task_created: '✅',
  assignment: '👤',
};

interface CrmTenantWidgetProps {
  tenantId?: string;
}

export default function CrmTenantWidget({ tenantId }: CrmTenantWidgetProps) {
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const stats = await crmTenantCrmService.getStats();
      setTickets((stats?.open_tickets ?? []).slice(0, 3));
      setTasks((stats?.pending_tasks ?? []).slice(0, 2));
      setActivities((stats?.recent_activities ?? []).filter(a => !a.is_internal).slice(0, 5));
    } catch (err) {
      console.error('[CRM Tenant Widget] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

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
      await loadData();
    } catch (err) {
      console.error('[CRM Tenant Widget] Create ticket error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="sm" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Support</h3>
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

      {/* Open Tickets */}
      {tickets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Open Tickets</p>
          {tickets.map(t => (
            <Link
              key={t.id}
              href={tenantId ? `/t/${tenantId}/support/tickets/${t.id}` : `/support/tickets/${t.id}`}
              className="flex items-center justify-between py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors"
            >
              <p className="text-sm truncate flex-1">{t.title}</p>
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-2 ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                {t.status?.replace('_', ' ')}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Pending Tasks */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending Tasks</p>
          {tasks.map(t => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date();
            return (
              <Link
                key={t.id}
                href={tenantId ? `/t/${tenantId}/support?tab=tasks` : `/support?tab=tasks`}
                className="flex items-center justify-between py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors"
              >
                <p className="text-sm truncate flex-1">{t.title}</p>
                {t.due_date && (
                  <span className={`text-[10px] ml-2 ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                    {new Date(t.due_date).toLocaleDateString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Recent Activity</p>
          {activities.map(a => (
            <Link
              key={a.id}
              href={tenantId ? `/t/${tenantId}/support` : `/support`}
              className="flex gap-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors"
            >
              <span className="text-xs">{ACTIVITY_ICONS[a.activity_type] || '📋'}</span>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate flex-1">{a.content}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {tickets.length === 0 && tasks.length === 0 && activities.length === 0 && (
        <p className="text-xs text-neutral-400 text-center py-4">No open items</p>
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
