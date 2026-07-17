'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Select, Textarea, Modal, ModalFooter, ConfirmDialog } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import { adminOperationsService, type AdminTenant, type AdminUser } from '@/services/AdminOperationsService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTask, CrmTaskMessage, TaskStatus, TaskPriority } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-800',
};

export default function CrmTaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const [task, setTask] = useState<CrmTask | null>(null);
  const [messages, setMessages] = useState<CrmTaskMessage[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isCompleted = task?.status === 'completed' || task?.status === 'cancelled';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, messagesRes, tenantsRes, adminUsersRes, platformAdminRes, platformSupportRes] = await Promise.allSettled([
        crmAdminService.listTasks({}).then(tasks => tasks.find(t => t.id === taskId) || null),
        crmAdminService.listTaskMessages(taskId),
        adminOperationsService.getTenants(1, 200),
        adminOperationsService.getUsers(1, 200, { role: 'ADMIN' }),
        adminOperationsService.getUsers(1, 200, { role: 'PLATFORM_ADMIN' }),
        adminOperationsService.getUsers(1, 200, { role: 'PLATFORM_SUPPORT' }),
      ]);
      if (taskRes.status === 'fulfilled' && taskRes.value) setTask(taskRes.value);
      if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value);
      if (tenantsRes.status === 'fulfilled') setTenants(tenantsRes.value.tenants || []);
      if (adminUsersRes.status === 'fulfilled' || platformAdminRes.status === 'fulfilled' || platformSupportRes.status === 'fulfilled') {
        const allStaff = [
          ...(adminUsersRes.status === 'fulfilled' ? adminUsersRes.value.users || [] : []),
          ...(platformAdminRes.status === 'fulfilled' ? platformAdminRes.value.users || [] : []),
          ...(platformSupportRes.status === 'fulfilled' ? platformSupportRes.value.users || [] : []),
        ];
        const seen = new Set<string>();
        setStaffUsers(allStaff.filter(u => {
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        }));
      }
    } catch (err) {
      clientLogger.error('[CRM Task Detail] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const tenantNameMap = new Map<string, string>();
  tenants.forEach(t => tenantNameMap.set(t.id, t.name));

  const assigneeOptions = staffUsers.map(u => ({ value: u.id, label: `${u.name || u.email} (${u.email})` }));

  async function handleUpdateTask(data: Partial<{ status: TaskStatus; priority: TaskPriority; assigned_to: string; due_date: string; title: string; description: string }>) {
    if (!task) return;
    setUpdating(true);
    try {
      const updated = await crmAdminService.updateTask(taskId, data);
      setTask(updated);
    } catch (err) {
      clientLogger.error('[Task Detail] Update error:', { detail: err });
    } finally {
      setUpdating(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditing(true);
    try {
      await crmAdminService.updateTask(editTask.id, {
        title: editTask.title,
        description: editTask.description || undefined,
        priority: editTask.priority,
        due_date: editTask.due_date || undefined,
        assigned_to: editTask.assigned_to || undefined,
        status: editTask.status,
      });
      setShowEdit(false);
      setEditTask(null);
      await load();
    } catch (err) {
      clientLogger.error('[Task Detail] Edit error:', { detail: err });
    } finally {
      setEditing(false);
    }
  }

  async function handleSendReply() {
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      const message = await crmAdminService.createTaskMessage(taskId, { content: replyContent.trim(), is_internal: false });
      setMessages(prev => [...prev, message]);
      setReplyContent('');
    } catch (err) {
      clientLogger.error('[Task Detail] Reply error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSending(true);
    try {
      const message = await crmAdminService.createTaskMessage(taskId, { content: noteContent.trim(), is_internal: true });
      setMessages(prev => [...prev, message]);
      setNoteContent('');
    } catch (err) {
      clientLogger.error('[Task Detail] Note error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await crmAdminService.deleteTask(taskId);
      window.location.href = '/settings/admin/crm/tasks';
    } catch (err) {
      clientLogger.error('[Task Detail] Delete error:', { detail: err });
    } finally {
      setDeleting(false);
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
      <CrmPageShell title="Task Not Found" breadcrumbs={[{ label: 'CRM', href: '/settings/admin/crm' }, { label: 'Tasks', href: '/settings/admin/crm/tasks' }, { label: 'Not Found' }]}>
        <Card><CardContent><p className="text-neutral-500 py-8 text-center">The task you are looking for does not exist.</p></CardContent></Card>
      </CrmPageShell>
    );
  }

  return (
    <CrmPageShell
      title={task.title}
      subtitle={
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-800'}`}>
            {task.priority}
          </span>
          {task.due_date && (
            <span className={`text-xs ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
              Due: {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </span>
      }
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tasks', href: '/settings/admin/crm/tasks' },
        { label: task.title },
      ]}
      actions={
        <div className="flex gap-3 items-center">
          <Button size="sm" variant="outline" onClick={() => { setEditTask(task); setShowEdit(true); }}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(true)} className="text-red-600 hover:text-red-700">Delete</Button>
          <Link href="/settings/admin/crm/tasks" className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400">
            Back to Tasks
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Task metadata + quick actions */}
        <Card>
          <CardHeader><CardTitle>Task Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
                <Select
                  value={task.status}
                  onChange={(e) => handleUpdateTask({ status: e.target.value as TaskStatus })}
                  disabled={updating}
                  options={STATUS_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Priority</label>
                <Select
                  value={task.priority}
                  onChange={(e) => handleUpdateTask({ priority: e.target.value as TaskPriority })}
                  disabled={updating}
                  options={PRIORITY_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Assigned To</label>
                <Select
                  value={task.assigned_to || ''}
                  onChange={(e) => handleUpdateTask({ assigned_to: e.target.value || undefined })}
                  disabled={updating}
                  options={[{ value: '', label: '— Unassigned —' }, ...assigneeOptions]}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleUpdateTask({ due_date: e.target.value || undefined })}
                  disabled={updating}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            {task.description && (
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-xs font-medium text-neutral-500 mb-1">Description</label>
                <p className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{task.description}</p>
              </div>
            )}
            <div className="mt-4 text-sm text-neutral-500 space-y-1">
              <p><span className="font-medium">Tenant:</span> <Link href={`/settings/admin/crm/tenants/${task.tenant_id}`} className="text-amber-600 hover:underline">{tenantNameMap.get(task.tenant_id) || task.tenant_id}</Link></p>
              <p><span className="font-medium">Created:</span> {new Date(task.created_at).toLocaleString()}</p>
              {task.completed_at && <p><span className="font-medium">Completed:</span> {new Date(task.completed_at).toLocaleString()}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card>
          <CardHeader><CardTitle>Conversation ({messages.length})</CardTitle></CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-neutral-500 text-center py-6">No messages yet. Start the conversation below.</p>
            ) : (
              <div className="space-y-4">
                {messages.map(m => {
                  const isInternal = m.is_internal;
                  const isPlatform = m.author_type === 'platform';
                  const isTenant = m.author_type === 'tenant';
                  const accentColor = isTenant ? '#F59E0B' : isPlatform ? '#8B5CF6' : '#3B82F6';
                  const useTintedBubble = !isInternal;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg p-4 ${
                        isInternal
                          ? 'bg-amber-50 dark:bg-amber-900/10 border border-dashed border-amber-200 dark:border-amber-800'
                          : isTenant ? 'mr-8' : 'ml-8'
                      }`}
                      style={useTintedBubble ? {
                        background: accentColor + '1A',
                        border: `1px solid ${accentColor}40`,
                        color: accentColor,
                      } : undefined}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.author_name}</span>
                          <Badge variant={isInternal ? 'warning' : isPlatform ? 'info' : 'default'}>
                            {m.author_type}
                          </Badge>
                          {isInternal && <Badge variant="warning">Internal</Badge>}
                        </div>
                        <span className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply form */}
            {!isCompleted && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <div className="space-y-3">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Type a message visible to all task participants..."
                    className="min-h-[100px]"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendReply} disabled={sending || !replyContent.trim()}>
                      {sending ? <Spinner size="sm" /> : 'Send Message'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Internal note form */}
            {!isCompleted && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <div className="space-y-3">
                  <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add an internal note (admin-only)..."
                    className="min-h-[80px] bg-amber-50/30 dark:bg-amber-900/5 border-amber-200 dark:border-amber-800"
                  />
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={handleAddNote} disabled={sending || !noteContent.trim()}>
                      {sending ? <Spinner size="sm" /> : 'Add Internal Note'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center">
                <p className="text-sm text-neutral-400">
                  This task is {task.status}. Conversation is read-only.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Task Modal */}
      {showEdit && editTask && (
        <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setEditTask(null); }} title="Edit Task" size="md">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={editTask.title}
                onChange={(e) => setEditTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <Textarea
                value={editTask.description || ''}
                onChange={(e) => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select
                  value={editTask.status}
                  onChange={(e) => setEditTask(prev => prev ? { ...prev, status: e.target.value as TaskStatus } : null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
                <select
                  value={editTask.priority}
                  onChange={(e) => setEditTask(prev => prev ? { ...prev, priority: e.target.value as TaskPriority } : null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={editTask.due_date ? new Date(editTask.due_date).toISOString().split('T')[0] : ''}
                  onChange={(e) => setEditTask(prev => prev ? { ...prev, due_date: e.target.value || null } : null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Assigned To</label>
                <Select
                  value={editTask.assigned_to || ''}
                  onChange={(e) => setEditTask(prev => prev ? { ...prev, assigned_to: e.target.value || null } : null)}
                  options={[{ value: '', label: '— Unassigned —' }, ...assigneeOptions]}
                />
              </div>
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowEdit(false); setEditTask(null); }}>Cancel</Button>
              <Button type="submit" disabled={editing || !editTask.title.trim()}>
                {editing ? <Spinner size="sm" /> : 'Save Changes'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? All messages will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </CrmPageShell>
  );
}
