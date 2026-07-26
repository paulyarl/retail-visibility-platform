'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card, Title, Text, Badge, Group, SimpleGrid, Loader, Tabs,
  Button, Textarea, Stack, Modal,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { personalCrmService } from '@/services/crm/PersonalCrmService';
import type {
  CrmProject, CrmTask, CrmTicket, CrmActivity,
  TaskStatus, TaskPriority, TicketPriority,
} from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  pending: 'blue',
  in_progress: 'violet',
  completed: 'green',
  cancelled: 'gray',
  open: 'blue',
  waiting: 'orange',
  resolved: 'green',
  closed: 'gray',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: 'green',
  on_hold: 'orange',
  completed: 'blue',
  archived: 'gray',
};

const EMPTY_TASK = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '' };
const EMPTY_TICKET = { title: '', description: '', priority: 'medium' as TicketPriority, category: 'general' };

type Tab = 'tasks' | 'tickets' | 'activities';

export default function PersonalCrmProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const result = await personalCrmService.getProject(projectId);
      setProject(result);
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Load project error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadTabData = useCallback(async (tab: Tab) => {
    setTabLoading(true);
    try {
      if (tab === 'tasks') {
        const result = await personalCrmService.listProjectTasks(projectId);
        setTasks(result);
      } else if (tab === 'tickets') {
        const result = await personalCrmService.listProjectTickets(projectId);
        setTickets(result);
      } else {
        const result = await personalCrmService.listProjectActivities(projectId, { limit: 50 });
        setActivities(result);
      }
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Tab load error:', { detail: err });
    } finally {
      setTabLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return;
    }
    if (isAuthenticated) {
      loadProject();
    }
  }, [authLoading, isAuthenticated, loadProject]);

  useEffect(() => {
    if (isAuthenticated && project) {
      loadTabData(activeTab);
    }
  }, [activeTab, loadTabData, isAuthenticated, project]);

  async function handleCreateTask() {
    if (!newTask.title.trim()) return;
    setCreatingTask(true);
    try {
      await personalCrmService.createProjectTask(projectId, {
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_date: newTask.due_date || undefined,
      });
      setShowCreateTask(false);
      setNewTask(EMPTY_TASK);
      await loadTabData('tasks');
      await loadProject();
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Create task error:', { detail: err });
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleCreateTicket() {
    if (!newTicket.title.trim()) return;
    setCreatingTicket(true);
    try {
      await personalCrmService.createProjectTicket(projectId, {
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || undefined,
        priority: newTicket.priority,
        category: newTicket.category || undefined,
      });
      setShowCreateTicket(false);
      setNewTicket(EMPTY_TICKET);
      await loadTabData('tickets');
      await loadProject();
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Create ticket error:', { detail: err });
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskId) return;
    setDeletingTask(true);
    try {
      await personalCrmService.deleteProjectTask(projectId, deleteTaskId);
      setDeleteTaskId(null);
      await loadTabData('tasks');
      await loadProject();
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Delete task error:', { detail: err });
    } finally {
      setDeletingTask(false);
    }
  }

  async function handleTaskStatusChange(taskId: string, newStatus: TaskStatus) {
    setUpdatingTaskId(taskId);
    try {
      await personalCrmService.updateProjectTask(projectId, taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      clientLogger.error('[Personal CRM Project Detail] Status change error:', { detail: err });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed" ta="center" py="md">Project not found.</Text>
          </Card>
        </div>
      </div>
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
            <span>/</span>
            <Link href="/settings/crm" className="hover:text-neutral-700 dark:hover:text-neutral-200">CRM Hub</Link>
            <span>/</span>
            <Link href="/settings/crm/projects" className="hover:text-neutral-700 dark:hover:text-neutral-200">Projects</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">{project.name}</span>
          </nav>
          <Group justify="space-between">
            <div>
              <Title order={1}>{project.name}</Title>
              {project.description && <Text c="dimmed" mt="xs">{project.description}</Text>}
            </div>
            <Badge size="lg" variant="light" color={PROJECT_STATUS_COLORS[project.status] || 'gray'}>
              {project.status.replace('_', ' ')}
            </Badge>
          </Group>
        </div>

        {/* Stats cards */}
        {project.stats && (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" className="mb-6">
            <Card withBorder p="md" radius="lg">
              <Text size="xs" c="dimmed" tt="uppercase">Total Tasks</Text>
              <Text size="xl" fw={700}>{project.stats.total_tasks}</Text>
            </Card>
            <Card withBorder p="md" radius="lg">
              <Text size="xs" c="dimmed" tt="uppercase">Pending / In Progress</Text>
              <Text size="xl" fw={700}>{project.stats.pending_tasks + project.stats.in_progress_tasks}</Text>
            </Card>
            <Card withBorder p="md" radius="lg">
              <Text size="xs" c="dimmed" tt="uppercase">Completed Tasks</Text>
              <Text size="xl" fw={700}>{project.stats.completed_tasks}</Text>
            </Card>
            <Card withBorder p="md" radius="lg">
              <Text size="xs" c="dimmed" tt="uppercase">Open Tickets</Text>
              <Text size="xl" fw={700}>{project.stats.open_tickets}</Text>
            </Card>
          </SimpleGrid>
        )}

        {/* Tabs */}
        <Card withBorder radius="lg" p="lg">
          <Tabs value={activeTab} onChange={(v) => setActiveTab((v as Tab) || 'tasks')}>
            <Tabs.List className="mb-4">
              <Tabs.Tab value="tasks" leftSection={<span>📋</span>}>Tasks</Tabs.Tab>
              <Tabs.Tab value="tickets" leftSection={<span>🎫</span>}>Tickets</Tabs.Tab>
              <Tabs.Tab value="activities" leftSection={<span>📊</span>}>Activities</Tabs.Tab>
            </Tabs.List>

            {/* Tasks Tab */}
            <Tabs.Panel value="tasks">
              <Group justify="flex-end" mb="sm">
                <Button size="sm" onClick={() => setShowCreateTask(true)}>+ Add Task</Button>
              </Group>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader /></div>
              ) : tasks.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No tasks in this project.</Text>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {columnOrder
                    .filter(col => taskColumns[col])
                    .map(col => (
                      <div key={col} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Text size="sm" fw={600} className="capitalize">{col.replace('_', ' ')}</Text>
                          <Text size="xs" c="dimmed">{taskColumns[col]?.length || 0}</Text>
                        </div>
                        <Stack gap="xs">
                          {(taskColumns[col] || []).map(t => (
                            <div key={t.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 group">
                              <div className="flex items-start justify-between gap-2">
                                <Link href={`/settings/crm/tasks/${t.id}`} className="text-sm font-medium truncate flex-1 hover:text-blue-600 hover:underline">
                                  {t.title}
                                </Link>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Link href={`/settings/crm/tasks/${t.id}`} className="text-xs text-neutral-400 hover:text-blue-600">
                                    View
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
                                <Badge size="xs" variant="light" color={PRIORITY_COLORS[t.priority] || 'gray'} mt={4}>
                                  {t.priority}
                                </Badge>
                              )}
                              {updatingTaskId === t.id ? (
                                <Loader size="xs" mt={8} />
                              ) : (
                                <select
                                  value={t.status}
                                  onChange={(e) => handleTaskStatusChange(t.id, e.target.value as TaskStatus)}
                                  className="text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer mt-2 bg-neutral-100 dark:bg-neutral-700"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              )}
                              {t.due_date && (
                                <Text size="xs" c="dimmed" mt={4}>Due: {new Date(t.due_date).toLocaleDateString()}</Text>
                              )}
                            </div>
                          ))}
                          {(!taskColumns[col] || taskColumns[col].length === 0) && (
                            <Text size="xs" c="dimmed" ta="center" py="sm">No tasks</Text>
                          )}
                        </Stack>
                      </div>
                    ))}
                </div>
              )}
            </Tabs.Panel>

            {/* Tickets Tab */}
            <Tabs.Panel value="tickets">
              <Group justify="flex-end" mb="sm">
                <Button size="sm" onClick={() => setShowCreateTicket(true)}>+ Add Ticket</Button>
              </Group>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader /></div>
              ) : tickets.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No tickets in this project.</Text>
              ) : (
                <Stack gap="xs">
                  {tickets.map(t => (
                    <div key={t.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/settings/crm/tickets/${t.id}`} className="text-sm font-medium truncate flex-1 hover:text-blue-600 hover:underline">
                          {t.title}
                        </Link>
                        <Badge size="xs" variant="light" color={STATUS_COLORS[t.status] || 'gray'}>
                          {t.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <Group gap="xs" mt={4}>
                        <Badge size="xs" variant="light" color={PRIORITY_COLORS[t.priority] || 'gray'}>
                          {t.priority}
                        </Badge>
                        {t.assigned_to && <Text size="xs" c="dimmed">Assigned</Text>}
                      </Group>
                    </div>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            {/* Activities Tab */}
            <Tabs.Panel value="activities">
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader /></div>
              ) : activities.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No activity yet.</Text>
              ) : (
                <Stack gap="xs">
                  {activities.map(a => (
                    <div key={a.id} className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                      <Group gap="xs">
                        <Text size="xs" fw={500}>{a.actor_name}</Text>
                        <Text size="xs" c="dimmed">{a.activity_type.replace(/_/g, ' ')}</Text>
                        <Text size="xs" c="dimmed" ml="auto">{new Date(a.created_at).toLocaleString()}</Text>
                      </Group>
                      {a.content && <Text size="xs" c="dimmed" mt={4}>{a.content}</Text>}
                    </div>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs>
        </Card>

        {/* Create Task Modal */}
        <Modal opened={showCreateTask} onClose={() => setShowCreateTask(false)} title="Add Task to Project" size="md">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Title</Text>
              <input
                type="text"
                required
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                placeholder="Task title..."
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Description</Text>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" fw={500} mb={4}>Priority</Text>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <Text size="sm" fw={500} mb={4}>Due Date</Text>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                />
              </div>
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setShowCreateTask(false)}>Cancel</Button>
              <Button variant='gradient' style={{ color: 'white' }}
                onClick={handleCreateTask} loading={creatingTask} disabled={!newTask.title.trim()}>
                Add Task
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Create Ticket Modal */}
        <Modal opened={showCreateTicket} onClose={() => setShowCreateTicket(false)} title="Add Ticket to Project" size="md">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Title</Text>
              <input
                type="text"
                required
                value={newTicket.title}
                onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                placeholder="Ticket title..."
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Description</Text>
              <Textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" fw={500} mb={4}>Priority</Text>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <Text size="sm" fw={500} mb={4}>Category</Text>
                <input
                  type="text"
                  value={newTicket.category}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                  placeholder="e.g. general, technical..."
                />
              </div>
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setShowCreateTicket(false)}>Cancel</Button>
              <Button variant='gradient' style={{ color: 'white' }}
                onClick={handleCreateTicket} loading={creatingTicket} disabled={!newTicket.title.trim()}>
                Add Ticket
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Delete Task Confirm */}
        <Modal opened={!!deleteTaskId} onClose={() => setDeleteTaskId(null)} title="Delete Task" size="sm">
          <Stack gap="md">
            <Text size="sm">Are you sure you want to delete this task?</Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setDeleteTaskId(null)}>Cancel</Button>
              <Button color="red" onClick={handleDeleteTask} loading={deletingTask}>Delete</Button>
            </Group>
          </Stack>
        </Modal>
      </div>
    </div>
  );
}
