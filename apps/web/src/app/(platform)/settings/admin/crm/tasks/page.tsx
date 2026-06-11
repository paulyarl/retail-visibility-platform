'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTask, TaskStatus, TaskPriority } from '@/types/crm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const EMPTY_TASK = { tenant_id: '', title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', assigned_to: '' };

export default function CrmGlobalTasksPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY_TASK);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);

  // Delete confirmation
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await crmAdminService.listTasks({
        status: statusFilter || undefined,
      });
      setTasks(result);
    } catch (err) {
      console.error('[CRM Global Tasks] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.tenant_id.trim()) return;
    setCreating(true);
    try {
      await crmAdminService.createTask({
        tenant_id: newTask.tenant_id.trim(),
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_date: newTask.due_date || undefined,
        assigned_to: newTask.assigned_to || undefined,
      });
      setShowCreate(false);
      setNewTask(EMPTY_TASK);
      await load();
    } catch (err) {
      console.error('[CRM Global Tasks] Create error:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
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
      console.error('[CRM Global Tasks] Edit error:', err);
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleteTaskId) return;
    setDeleting(true);
    try {
      await crmAdminService.deleteTask(deleteTaskId);
      setDeleteTaskId(null);
      await load();
    } catch (err) {
      console.error('[CRM Global Tasks] Delete error:', err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setUpdatingId(taskId);
    try {
      await crmAdminService.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('[CRM Global Tasks] Status change error:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  // Group by status for Kanban-style columns
  const columns = statusFilter
    ? { [statusFilter]: tasks }
    : tasks.reduce<Record<string, CrmTask[]>>((acc, t) => {
        const col = t.status || 'pending';
        if (!acc[col]) acc[col] = [];
        acc[col].push(t);
        return acc;
      }, {});

  const columnOrder: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

  return (
    <CrmPageShell
      title="Global Tasks"
      subtitle="Platform task management"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tasks' },
      ]}
      actions={
        <div className="flex flex-wrap gap-3 items-center">
          <Button size="sm" onClick={() => setShowCreate(true)}>+ Create Task</Button>
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
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columnOrder
            .filter(col => columns[col])
            .map(col => (
              <div key={col} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold capitalize">{col.replace('_', ' ')}</h3>
                  <span className="text-xs text-neutral-500">{columns[col]?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {(columns[col] || []).map(t => {
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
                    return (
                      <div
                        key={t.id}
                        className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1">{t.title}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditTask(t); setShowEdit(true); }}
                              className="text-xs text-neutral-400 hover:text-amber-600"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTaskId(t.id)}
                              className="text-xs text-neutral-400 hover:text-red-600"
                              title="Delete"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Link href={`/settings/admin/crm/tenants/${t.tenant_id}`} className="text-xs text-neutral-500 hover:underline">
                            {t.tenant_id}
                          </Link>
                          {t.priority && (
                            <Badge variant={t.priority === 'high' ? 'warning' : 'default'}>
                              {t.priority}
                            </Badge>
                          )}
                        </div>
                        {updatingId === t.id ? (
                          <Spinner size="sm" className="mt-2" />
                        ) : (
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                            className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer mt-2 ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                        {t.due_date && (
                          <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                            Due: {new Date(t.due_date).toLocaleDateString()}
                          </p>
                        )}
                        {t.assigned_to && (
                          <p className="text-xs text-neutral-400 mt-1">@{t.assigned_to}</p>
                        )}
                      </div>
                    );
                  })}
                  {(!columns[col] || columns[col].length === 0) && (
                    <p className="text-xs text-neutral-400 text-center py-4">No tasks</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tenant ID</label>
              <input
                type="text"
                required
                value={newTask.tenant_id}
                onChange={(e) => setNewTask(prev => ({ ...prev, tenant_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="tenant-id"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Task title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Assigned To (User ID)</label>
              <input
                type="text"
                value={newTask.assigned_to}
                onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="User ID or email"
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newTask.title.trim() || !newTask.tenant_id.trim()}>
                {creating ? <Spinner size="sm" /> : 'Create Task'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {showEdit && editTask && (
        <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setEditTask(null); }} title="Edit Task" size="md">
          <form onSubmit={handleEdit} className="space-y-4">
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
                <input
                  type="text"
                  value={editTask.assigned_to || ''}
                  onChange={(e) => setEditTask(prev => prev ? { ...prev, assigned_to: e.target.value || null } : null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="User ID or email"
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
        isOpen={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </CrmPageShell>
  );
}
