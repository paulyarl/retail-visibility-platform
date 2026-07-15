'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmTask, CrmTaskMessage, CrmActivity, TaskStatus } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export default function TenantTaskDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const taskId = params.taskId as string;

  const [task, setTask] = useState<CrmTask | null>(null);
  const [messages, setMessages] = useState<CrmTaskMessage[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const isClosed = task?.status === 'completed' || task?.status === 'cancelled';

  useEffect(() => {
    async function load() {
      try {
        const [taskData, messageData, users, activityData] = await Promise.all([
          crmTenantCrmService.listTasks(),
          crmTenantCrmService.listTaskMessages(taskId),
          tenantUserService.getTenantUsers(tenantId),
          crmTenantCrmService.listActivities({ taskId, limit: 50 }),
        ]);
        const found = (taskData ?? []).find((t: CrmTask) => t.id === taskId) ?? null;
        setTask(found);
        setMessages(messageData ?? []);
        setTenantUsers(users ?? []);
        setActivities(activityData ?? []);
      } catch (err) {
        console.error('[Tenant Task Detail] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskId, tenantId]);

  async function refreshActivities() {
    try {
      const activityList = await crmTenantCrmService.listActivities({ taskId, limit: 50 });
      setActivities(activityList ?? []);
    } catch (err) {
      console.error('[Tenant Task Detail] Activity refresh error:', err);
    }
  }

  async function handleReply() {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const msg = await crmTenantCrmService.createTaskMessage(taskId, {
        content: reply.trim(),
        is_internal: isInternal,
      });
      setMessages(prev => [...prev, msg]);
      setReply('');
      setIsInternal(false);
    } catch (err) {
      console.error('[Tenant Task Detail] Reply error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: TaskStatus) {
    if (!task) return;
    setUpdating(true);
    setShowStatusDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTask(taskId, { status: newStatus });
      setTask(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Task Detail] Status change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssignChange(userId: string | null) {
    if (!task) return;
    setUpdating(true);
    setShowAssignDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTask(taskId, { assigned_to: userId });
      setTask(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Task Detail] Assign change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!task) {
    return (
      <TenantCrmPageShell
        tenantId={tenantId}
        title="Task Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Support', href: `/t/${tenantId}/support` },
          { label: 'Tasks', href: `/t/${tenantId}/support/tasks` },
          { label: 'Not Found' },
        ]}
      >
        <div className="text-center py-12">
          <p className="text-neutral-500">Task not found</p>
          <Link href={`/t/${tenantId}/support/tasks`} className="text-amber-600 hover:underline text-sm mt-2 inline-block">
            Back to Tasks
          </Link>
        </div>
      </TenantCrmPageShell>
    );
  }

  const assignedName = task.assigned_to
    ? tenantUsers.find(u => u.id === task.assigned_to)?.name || task.assigned_to
    : null;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title={task.title}
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Tasks', href: `/t/${tenantId}/support/tasks` },
        { label: task.id },
      ]}
    >
      {/* Task header with status + assign dropdowns */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{task.title}</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Created {new Date(task.created_at).toLocaleDateString()}
            {task.due_date && (
              <span className={`ml-2 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                · Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          {task.priority && (
            <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low}`}>
              {task.priority}
            </span>
          )}

          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (isClosed) return; setShowStatusDropdown(!showStatusDropdown); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'} hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {task.status?.replace('_', ' ')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${s === task.status ? 'font-semibold' : ''}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assign dropdown */}
          {tenantUsers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { if (isClosed) return; setShowAssignDropdown(!showAssignDropdown); setShowStatusDropdown(false); }}
                disabled={updating || isClosed}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {task.assigned_to ? tenantUsers.find(u => u.id === task.assigned_to)?.name || 'Assigned' : 'Assign'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAssignDropdown && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleAssignChange(null)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${!task.assigned_to ? 'font-semibold' : ''}`}
                  >
                    Unassigned
                  </button>
                  {tenantUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAssignChange(u.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${u.id === task.assigned_to ? 'font-semibold' : ''}`}
                    >
                      {u.name || u.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <Card>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs">Assigned To</p>
              <p className="font-medium">{assignedName || 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Priority</p>
              <p className="font-medium">{task.priority || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Due Date</p>
              <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Created</p>
              <p className="font-medium">{new Date(task.created_at).toLocaleString()}</p>
            </div>
            {task.completed_at && (
              <div>
                <p className="text-neutral-500 text-xs">Completed</p>
                <p className="font-medium">{new Date(task.completed_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Conversation ({messages.length})
        </h3>
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-4">No messages yet. Start the conversation below.</p>
        )}
        {messages.map(m => {
          const isInternalNote = m.is_internal;
          const isPlatform = m.author_type === 'platform';
          const accentColor = isPlatform ? '#8B5CF6' : '#F59E0B';
          const useTintedBubble = !isInternalNote;
          return (
            <div
              key={m.id}
              className={`rounded-lg p-4 ${
                isInternalNote
                  ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border border-dashed border-yellow-200 dark:border-yellow-800'
                  : isPlatform ? 'mr-8 border border-neutral-200 dark:border-neutral-700' : 'ml-8 border border-neutral-200 dark:border-neutral-700'
              }`}
              style={useTintedBubble ? {
                background: accentColor + '1A',
                border: `1px solid ${accentColor}40`,
                color: accentColor,
              } : undefined}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium">
                  {m.author_type === 'tenant' ? (tenantUsers.find(u => u.id === m.author_id)?.name || m.author_name) : m.author_name}
                </span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  m.author_type === 'platform' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {m.author_type}
                </span>
                {isInternalNote && (
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Internal</span>
                )}
                <span className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </div>
          );
        })}
      </div>

      {/* Activity History */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">Activity History</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-neutral-500">No activity recorded for this task.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => {
                const actorUser = tenantUsers.find(u => u.id === a.actor_id);
                const displayName = actorUser?.name || a.actor_name;
                return (
                  <div key={a.id} className="flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{a.content || a.activity_type}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {displayName} · {a.activity_type.replace(/_/g, ' ')} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply composer */}
      {!isClosed && (
        <Card>
          <CardContent className="space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your message..."
              rows={3}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Internal note (platform admin only)
              </label>
              <button
                onClick={handleReply}
                disabled={!reply.trim() || submitting}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {isClosed && (
        <div className="text-center py-6">
          <p className="text-sm text-neutral-400">
            This task is {task.status}. Conversation is read-only.
          </p>
        </div>
      )}
    </TenantCrmPageShell>
  );
}
