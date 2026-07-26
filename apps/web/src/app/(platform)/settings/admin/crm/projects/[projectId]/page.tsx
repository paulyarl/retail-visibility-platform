'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea, Select, SearchableSelect } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import { adminOperationsService, type AdminTenant, type AdminUser } from '@/services/AdminOperationsService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmProject, CrmTask, CrmTicket, CrmActivity, TaskStatus, TaskPriority, ProjectStatus, TicketPriority } from '@/types/crm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const EMPTY_TASK = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', assigned_to: '' };
const EMPTY_TICKET = { title: '', description: '', priority: 'medium' as TicketPriority, category: 'technical', assigned_to: '' };

type Tab = 'tasks' | 'tickets' | 'activities';

export default function CrmProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<CrmProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY_TASK);

  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState(EMPTY_TICKET);

  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setOptionsLoading(true);
        const [adminUsersRes, platformAdminRes, platformSupportRes] = await Promise.all([
          adminOperationsService.getUsers(1, 200, { role: 'ADMIN' }),
          adminOperationsService.getUsers(1, 200, { role: 'PLATFORM_ADMIN' }),
          adminOperationsService.getUsers(1, 200, { role: 'PLATFORM_SUPPORT' }),
        ]);
        const allStaff = [
          ...(adminUsersRes.users || []),
          ...(platformAdminRes.users || []),
          ...(platformSupportRes.users || []),
        ];
        const seen = new Set<string>();
        setStaffUsers(allStaff.filter(u => {
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        }));
      } catch (err) {
        clientLogger.error('[CRM Project Detail] Options load error:', { detail: err });
      } finally {
        setOptionsLoading(false);
      }
    })();
  }, []);

  const assigneeOptions = staffUsers.map(u => ({ value: u.id, label: `${u.name || u.email} (${u.email})` }));
  const userMap = new Map<string, string>();
  staffUsers.forEach(u => userMap.set(u.id, u.name || u.email));

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const result = await crmAdminService.getProject(projectId);
      setProject(result);
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Load project error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadTabData = useCallback(async (tab: Tab) => {
    setTabLoading(true);
    try {
      if (tab === 'tasks') {
        const result = await crmAdminService.listProjectTasks(projectId);
        setTasks(result);
      } else if (tab === 'tickets') {
        const result = await crmAdminService.listProjectTickets(projectId);
        setTickets(result);
      } else {
        const result = await crmAdminService.listProjectActivities(projectId, { limit: 50 });
        setActivities(result);
      }
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Tab load error:', { detail: err });
    } finally {
      setTabLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setCreatingTask(true);
    try {
      await crmAdminService.createTask({
        project_id: projectId,
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_date: newTask.due_date || undefined,
        assigned_to: newTask.assigned_to || undefined,
      });
      setShowCreateTask(false);
      setNewTask(EMPTY_TASK);
      await loadTabData('tasks');
      await loadProject();
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Create task error:', { detail: err });
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicket.title.trim()) return;
    setCreatingTicket(true);
    try {
      await crmAdminService.createProjectTicket(projectId, {
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || undefined,
        priority: newTicket.priority,
        category: newTicket.category || undefined,
        assigned_to: newTicket.assigned_to || undefined,
      });
      setShowCreateTicket(false);
      setNewTicket(EMPTY_TICKET);
      await loadTabData('tickets');
      await loadProject();
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Create ticket error:', { detail: err });
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskId) return;
    setDeletingTask(true);
    try {
      await crmAdminService.deleteTask(deleteTaskId);
      setDeleteTaskId(null);
      await loadTabData('tasks');
      await loadProject();
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Delete task error:', { detail: err });
    } finally {
      setDeletingTask(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, newStatus: TaskStatus) {
    setUpdatingTaskId(taskId);
    try {
      await crmAdminService.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      clientLogger.error('[CRM Project Detail] Status change error:', { detail: err });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (loading) {
    return (
      <CrmPageShell title="Project" breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Admin' }, { label: 'CRM', href: '/settings/admin/crm' }, { label: 'Projects', href: '/settings/admin/crm/projects' }, { label: 'Loading...' }]}>
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      </CrmPageShell>
    );
  }

  if (!project) {
    return (
      <CrmPageShell title="Project Not Found" breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Admin' }, { label: 'CRM', href: '/settings/admin/crm' }, { label: 'Projects', href: '/settings/admin/crm/projects' }]}>
        <Card><CardContent className="py-12 text-center"><p className="text-neutral-500 text-sm">Project not found.</p></CardContent></Card>
      </CrmPageShell>
    );
  }

  const taskColumns = tasks.reduce<Record<string, CrmTask[]>>((acc, t) => {
    const col = t.status || 'pending';
    if (!acc[col]) acc[col] = [];
    acc[col].push(t);
    return acc;
  }, {});
  const columnOrder: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

  return (
    <CrmPageShell
      title={project.name}
      subtitle={project.description || undefined}
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Projects', href: '/settings/admin/crm/projects' },
        { label: project.name },
      ]}
      actions={
        <div className="flex items-center gap-3">
          <span className={`text-xs rounded-full px-3 py-1 font-medium ${PROJECT_STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-800'}`}>
            {project.status.replace('_', ' ')}
          </span>
        </div>
      }
    >
      {/* Stats cards */}
      {project.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-neutral-500">Total Tasks</p>
            <p className="text-lg font-semibold">{project.stats.total_tasks}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-neutral-500">Pending / In Progress</p>
            <p className="text-lg font-semibold">{project.stats.pending_tasks + project.stats.in_progress_tasks}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-neutral-500">Completed Tasks</p>
            <p className="text-lg font-semibold">{project.stats.completed_tasks}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4">
            <p className="text-xs text-neutral-500">Open Tickets</p>
            <p className="text-lg font-semibold">{project.stats.open_tickets}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {(['tasks', 'tickets', 'activities'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab
              ? 'text-amber-600 border-b-2 border-amber-500'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
      ) : activeTab === 'tasks' ? (
        <div>
          <div className="flex justify-end mb-3">
            <Button variant='gradient' style={{ color: 'white' }}
              size="sm" onClick={() => setShowCreateTask(true)}>+ Add Task</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columnOrder
              .filter(col => taskColumns[col])
              .map(col => (
                <div key={col} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold capitalize">{col.replace('_', ' ')}</h3>
                    <span className="text-xs text-neutral-500">{taskColumns[col]?.length || 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(taskColumns[col] || []).map(t => (
                      <div key={t.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/settings/admin/crm/tasks/${t.id}`} className="text-sm font-medium truncate flex-1 hover:text-amber-600 hover:underline">
                            {t.title}
                          </Link>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/settings/admin/crm/tasks/${t.id}`} className="text-xs text-neutral-400 hover:text-amber-600">
                              Edit
                            </Link>
                            <button
                              onClick={() => setDeleteTaskId(t.id)}
                              className="text-xs text-neutral-400 hover:text-red-600"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                        {t.priority && (
                          <Badge variant={t.priority === 'high' ? 'warning' : 'default'} className="mt-1">{t.priority}</Badge>
                        )}
                        {updatingTaskId === t.id ? (
                          <Spinner size="sm" className="mt-2" />
                        ) : (
                          <select
                            value={t.status}
                            onChange={(e) => handleTaskStatusChange(t.id, e.target.value as TaskStatus)}
                            className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer mt-2 ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                        {t.due_date && (
                          <p className="text-xs text-neutral-400 mt-1">Due: {new Date(t.due_date).toLocaleDateString()}</p>
                        )}
                        {t.assigned_to && (
                          <p className="text-xs text-neutral-400 mt-1">@{userMap.get(t.assigned_to) || t.assigned_to}</p>
                        )}
                      </div>
                    ))}
                    {(!taskColumns[col] || taskColumns[col].length === 0) && (
                      <p className="text-xs text-neutral-400 text-center py-4">No tasks</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : activeTab === 'tickets' ? (
        <div>
          <div className="flex justify-end mb-3">
            <Button  variant='gradient' style={{ color: 'white' }}
            size="sm" onClick={() => setShowCreateTicket(true)}>+ Add Ticket</Button>
          </div>
          <div className="space-y-2">
            {tickets.length === 0 ? (
              <Card><CardContent className="py-8 text-center"><p className="text-sm text-neutral-500">No tickets in this project.</p></CardContent></Card>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/settings/admin/crm/tickets/${t.id}`} className="text-sm font-medium truncate flex-1 hover:text-amber-600 hover:underline">
                      {t.title}
                    </Link>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={t.priority === 'urgent' ? 'warning' : 'default'}>{t.priority}</Badge>
                    {t.assigned_to && <span className="text-xs text-neutral-400">@{userMap.get(t.assigned_to) || t.assigned_to}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.length === 0 ? (
            <Card><CardContent className="py-8 text-center"><p className="text-sm text-neutral-500">No activity yet.</p></CardContent></Card>
          ) : (
            activities.map(a => (
              <div key={a.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{a.actor_name}</span>
                  <span className="text-xs text-neutral-400">{a.activity_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-neutral-400 ml-auto">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                {a.content && <p className="text-xs text-neutral-500 mt-1">{a.content}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <Modal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} title="Add Task to Project" size="md">
          <form onSubmit={handleCreateTask} className="space-y-4">
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
              <label className="block text-sm font-medium text-neutral-700 mb-1">Assigned To</label>
              <Select
                value={newTask.assigned_to}
                onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                options={[{ value: '', label: '— Unassigned —' }, ...assigneeOptions]}
                disabled={optionsLoading}
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateTask(false)}>Cancel</Button>
              <Button variant='gradient' style={{ color: 'white' }}
                type="submit" disabled={creatingTask || !newTask.title.trim()}>
                {creatingTask ? <Spinner size="sm" /> : 'Add Task'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <Modal isOpen={showCreateTicket} onClose={() => setShowCreateTicket(false)} title="Add Ticket to Project" size="md">
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={newTicket.title}
                onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Ticket title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <Textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newTicket.category}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g. technical, design..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Assigned To</label>
              <Select
                value={newTicket.assigned_to}
                onChange={(e) => setNewTicket(prev => ({ ...prev, assigned_to: e.target.value }))}
                options={[{ value: '', label: '— Unassigned —' }, ...assigneeOptions]}
                disabled={optionsLoading}
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
              <Button  variant='gradient' style={{ color: 'white' }}
              type="submit" disabled={creatingTicket || !newTicket.title.trim()}>
                {creatingTicket ? <Spinner size="sm" /> : 'Add Ticket'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmText="Delete"
        variant="danger"
      />
    </CrmPageShell>
  );
}
