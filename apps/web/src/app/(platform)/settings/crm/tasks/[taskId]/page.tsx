'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card, Title, Text, Badge, Group, Select as MantineSelect, Loader, Button,
  Textarea, Stack, Modal,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { personalCrmService } from '@/services/crm/PersonalCrmService';
import { RichContentEditor } from '@/components/products/RichContentEditor';
import { RichContentRenderer } from '@/components/products/RichContentRenderer';
import { DEFAULT_CONTENT_BLOCKS, type ContentBlocks } from '@/components/products/content-blocks';
import type { CrmTask, CrmTaskMessage, TaskStatus, TaskPriority } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

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
  pending: 'blue',
  in_progress: 'violet',
  completed: 'green',
  cancelled: 'gray',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
};

export default function PersonalCrmTaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [task, setTask] = useState<CrmTask | null>(null);
  const [messages, setMessages] = useState<CrmTaskMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState<ContentBlocks>(DEFAULT_CONTENT_BLOCKS);
  const [replyKey, setReplyKey] = useState(0);
  const [noteContent, setNoteContent] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isCompleted = task?.status === 'completed' || task?.status === 'cancelled';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, messagesRes] = await Promise.allSettled([
        personalCrmService.getTask(taskId),
        personalCrmService.listTaskMessages(taskId),
      ]);
      if (taskRes.status === 'fulfilled') setTask(taskRes.value);
      if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value);
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') window.location.href = '/auth/login';
      return;
    }
    if (isAuthenticated) load();
  }, [authLoading, isAuthenticated, load]);

  async function handleUpdateTask(data: Partial<{ status: TaskStatus; priority: TaskPriority; due_date: string; title: string; description: string }>) {
    if (!task) return;
    setUpdating(true);
    try {
      const updated = await personalCrmService.updateTask(taskId, data);
      setTask(updated);
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Update error:', { detail: err });
    } finally {
      setUpdating(false);
    }
  }

  async function handleEditSubmit() {
    if (!editTask) return;
    setEditing(true);
    try {
      await personalCrmService.updateTask(editTask.id, {
        title: editTask.title,
        description: editTask.description ?? undefined,
        priority: editTask.priority,
        due_date: editTask.due_date || undefined,
        status: editTask.status,
      });
      setShowEdit(false);
      setEditTask(null);
      await load();
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Edit error:', { detail: err });
    } finally {
      setEditing(false);
    }
  }

  async function handleSendReply() {
    if (replyContent.blocks.length === 0) return;
    setSending(true);
    try {
      const message = await personalCrmService.createTaskMessage(taskId, { content_blocks: replyContent, is_internal: false });
      setMessages(prev => [...prev, message]);
      setReplyContent(DEFAULT_CONTENT_BLOCKS);
      setReplyKey(prev => prev + 1);
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Reply error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSending(true);
    try {
      const message = await personalCrmService.createTaskMessage(taskId, { content: noteContent.trim(), is_internal: true });
      setMessages(prev => [...prev, message]);
      setNoteContent('');
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Note error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateMessageContent(messageId: string, newContent: ContentBlocks) {
    const previousMessages = messages;
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content_blocks: newContent } : m));
    setSavingMessageId(messageId);
    try {
      const updated = await personalCrmService.updateTaskMessage(taskId, messageId, { content_blocks: newContent });
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
    } catch (err) {
      setMessages(previousMessages);
      clientLogger.error('[Personal CRM Task Detail] Update message error:', { detail: err });
    } finally {
      setSavingMessageId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await personalCrmService.deleteTask(taskId);
      const backUrl = task?.project_id ? `/settings/crm/projects/${task.project_id}` : '/settings/crm';
      window.location.href = backUrl;
    } catch (err) {
      clientLogger.error('[Personal CRM Task Detail] Delete error:', { detail: err });
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card withBorder p="xl"><Text c="dimmed" ta="center" py="md">Task not found.</Text></Card>
        </div>
      </div>
    );
  }

  const backUrl = task.project_id ? `/settings/crm/projects/${task.project_id}` : '/settings/crm';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4 flex-wrap">
          <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
          <span>/</span>
          <Link href="/settings/crm" className="hover:text-neutral-700 dark:hover:text-neutral-200">CRM Hub</Link>
          {task.project_id && (
            <>
              <span>/</span>
              <Link href="/settings/crm/projects" className="hover:text-neutral-700 dark:hover:text-neutral-200">Projects</Link>
              <span>/</span>
              <Link href={`/settings/crm/projects/${task.project_id}`} className="hover:text-neutral-700 dark:hover:text-neutral-200">Project</Link>
            </>
          )}
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">{task.title}</span>
        </nav>

        {/* Header */}
        <Group justify="space-between" mb="md">
          <div>
            <Title order={1}>{task.title}</Title>
            <Group gap="xs" mt="xs">
              <Badge variant="light" color={STATUS_COLORS[task.status] || 'gray'}>{task.status.replace('_', ' ')}</Badge>
              <Badge variant="light" color={PRIORITY_COLORS[task.priority] || 'gray'}>{task.priority}</Badge>
              {task.due_date && (
                <Text size="xs" c={new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'red' : 'dimmed'}>
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </Text>
              )}
            </Group>
          </div>
          <Group gap="sm">
            <Button variant="subtle" size="sm" onClick={() => { setEditTask(task); setShowEdit(true); }}>Edit</Button>
            <Button variant="subtle" size="sm" color="red" onClick={() => setDeleteConfirm(true)}>Delete</Button>
            <Link href={backUrl} className="text-sm text-blue-600 hover:underline">Back</Link>
          </Group>
        </Group>

        {/* Task Details Card */}
        <Card withBorder p="lg" mb="md">
          <Title order={3} mb="md">Task Details</Title>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Text size="xs" c="dimmed" mb={4}>Status</Text>
              <MantineSelect
                value={task.status}
                onChange={(v) => v && handleUpdateTask({ status: v as TaskStatus })}
                disabled={updating}
                data={STATUS_OPTIONS}
                size="sm"
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>Priority</Text>
              <MantineSelect
                value={task.priority}
                onChange={(v) => v && handleUpdateTask({ priority: v as TaskPriority })}
                disabled={updating}
                data={PRIORITY_OPTIONS}
                size="sm"
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>Due Date</Text>
              <input
                type="date"
                value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                onChange={(e) => handleUpdateTask({ due_date: e.target.value || undefined })}
                disabled={updating}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>Created</Text>
              <Text size="sm">{new Date(task.created_at).toLocaleDateString()}</Text>
            </div>
          </div>
          {task.description && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <Text size="xs" c="dimmed" mb={4}>Description</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{task.description}</Text>
            </div>
          )}
        </Card>

        {/* Conversation Card */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Conversation ({messages.length})</Title>

          {messages.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">No messages yet. Start the conversation below.</Text>
          ) : (
            <Stack gap="md">
              {messages.map(m => {
                const isInternal = m.is_internal;
                const isPlatform = m.author_type === 'platform';
                const accentColor = isPlatform ? '#8B5CF6' : '#3B82F6';
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg p-4 ${
                      isInternal
                        ? 'bg-amber-50 dark:bg-amber-900/10 border border-dashed border-amber-200 dark:border-amber-800'
                        : ''
                    }`}
                    style={!isInternal ? {
                      background: accentColor + '1A',
                      border: `1px solid ${accentColor}40`,
                    } : undefined}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Text size="sm" fw={500}>{m.author_name}</Text>
                        <Badge size="xs" variant="light" color={isPlatform ? 'violet' : 'blue'}>{m.author_type}</Badge>
                        {isInternal && <Badge size="xs" variant="light" color="orange">Internal</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{new Date(m.created_at).toLocaleString()}</Text>
                    </Group>
                    {m.content_blocks?.blocks?.length ? (
                      <RichContentRenderer
                        content={m.content_blocks}
                        onChange={!isCompleted && savingMessageId !== m.id ? (newContent) => handleUpdateMessageContent(m.id, newContent) : undefined}
                      />
                    ) : (
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</Text>
                    )}
                  </div>
                );
              })}
            </Stack>
          )}

          {/* Reply form */}
          {!isCompleted && (
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <Stack gap="sm">
                <RichContentEditor
                  key={replyKey}
                  value={replyContent}
                  onChange={setReplyContent}
                  tenantId={task?.tenant_id || undefined}
                  className="min-h-[160px]"
                />
                <Group justify="flex-end">
                  <Button variant='gradient' style={{ color: 'white' }}
                  onClick={handleSendReply} loading={sending} disabled={replyContent.blocks.length === 0}>
                    Send Message
                  </Button>
                </Group>
              </Stack>
            </div>
          )}

          {/* Internal note form */}
          {!isCompleted && (
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <Stack gap="sm">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add an internal note..."
                  minRows={3}
                  className="bg-amber-50/30 dark:bg-amber-900/5"
                />
                <Group justify="flex-end">
                  <Button variant="outline" onClick={handleAddNote} loading={sending} disabled={!noteContent.trim()}>
                    Add Internal Note
                  </Button>
                </Group>
              </Stack>
            </div>
          )}

          {isCompleted && (
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center">
              <Text size="sm" c="dimmed">This task is {task.status}. Conversation is read-only.</Text>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal opened={showEdit && !!editTask} onClose={() => { setShowEdit(false); setEditTask(null); }} title="Edit Task" size="md">
        {editTask && (
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Title</Text>
              <input
                type="text"
                required
                value={editTask.title}
                onChange={(e) => setEditTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Description</Text>
              <Textarea
                value={editTask.description || ''}
                onChange={(e) => setEditTask(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text size="sm" fw={500} mb={4}>Status</Text>
                <MantineSelect
                  value={editTask.status}
                  onChange={(v) => v && setEditTask(prev => prev ? { ...prev, status: v as TaskStatus } : null)}
                  data={STATUS_OPTIONS}
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb={4}>Priority</Text>
                <MantineSelect
                  value={editTask.priority}
                  onChange={(v) => v && setEditTask(prev => prev ? { ...prev, priority: v as TaskPriority } : null)}
                  data={PRIORITY_OPTIONS}
                />
              </div>
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Due Date</Text>
              <input
                type="date"
                value={editTask.due_date ? new Date(editTask.due_date).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditTask(prev => prev ? { ...prev, due_date: e.target.value || null } : null)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              />
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => { setShowEdit(false); setEditTask(null); }}>Cancel</Button>
              <Button onClick={handleEditSubmit} loading={editing} disabled={!editTask.title.trim()}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal opened={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete Task" size="sm">
        <Stack gap="md">
          <Text size="sm">Are you sure you want to delete this task? All messages will be permanently deleted. This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button color="red" onClick={handleDelete} loading={deleting}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
