'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Card, Title, Text, Badge, Group, SimpleGrid, Loader, Button,
  Modal, Textarea, Stack,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { personalCrmService } from '@/services/crm/PersonalCrmService';
import type { CrmProject, ProjectStatus } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  on_hold: 'orange',
  completed: 'blue',
  archived: 'gray',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

const EMPTY_PROJECT = { name: '', description: '' };

export default function PersonalCrmProjectsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<CrmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState(EMPTY_PROJECT);

  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editProject, setEditProject] = useState<CrmProject | null>(null);

  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await personalCrmService.listProjects({
        status: statusFilter || undefined,
      });
      setProjects(result);
    } catch (err) {
      clientLogger.error('[Personal CRM Projects] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return;
    }
    if (isAuthenticated) {
      load();
    }
  }, [authLoading, isAuthenticated, load]);

  async function handleCreate() {
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      await personalCrmService.createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
      });
      setShowCreate(false);
      setNewProject(EMPTY_PROJECT);
      await load();
    } catch (err) {
      clientLogger.error('[Personal CRM Projects] Create error:', { detail: err });
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editProject) return;
    setEditing(true);
    try {
      await personalCrmService.updateProject(editProject.id, {
        name: editProject.name,
        description: editProject.description || undefined,
        status: editProject.status,
      });
      setShowEdit(false);
      setEditProject(null);
      await load();
    } catch (err) {
      clientLogger.error('[Personal CRM Projects] Edit error:', { detail: err });
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleteProjectId) return;
    setDeleting(true);
    try {
      await personalCrmService.deleteProject(deleteProjectId);
      setDeleteProjectId(null);
      await load();
    } catch (err) {
      clientLogger.error('[Personal CRM Projects] Delete error:', { detail: err });
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
            <span>/</span>
            <Link href="/settings/crm" className="hover:text-neutral-700 dark:hover:text-neutral-200">CRM Hub</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">Projects</span>
          </nav>
          <Group justify="space-between">
            <div>
              <Title order={1}>My Projects</Title>
              <Text c="dimmed" mt="xs">Personal cross-functional initiatives</Text>
            </div>
            <Group gap="sm">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                {Object.keys(STATUS_COLORS).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <Button variant='gradient' style={{ color: 'white' }}
                onClick={() => setShowCreate(true)}>+ Create Project</Button>
            </Group>
          </Group>
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <Card withBorder radius="lg" p="xl">
            <Text c="dimmed" ta="center" py="md">No projects yet. Create one to get started.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {projects.map(p => (
              <div
                key={p.id}
                className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/settings/crm/projects/${p.id}`} className="text-sm font-medium truncate flex-1 hover:text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditProject(p); setShowEdit(true); }}
                      className="text-xs text-neutral-400 hover:text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteProjectId(p.id)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      Del
                    </button>
                  </div>
                </div>
                {p.description && (
                  <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{p.description}</Text>
                )}
                <Group gap="xs" mt="sm">
                  <Badge size="sm" variant="light" color={STATUS_COLORS[p.status] || 'gray'}>
                    {STATUS_LABELS[p.status] || p.status}
                  </Badge>
                  {p.stats && (
                    <Text size="xs" c="dimmed">
                      {p.stats.pending_tasks + p.stats.in_progress_tasks} tasks · {p.stats.open_tickets} tickets
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </Text>
              </div>
            ))}
          </SimpleGrid>
        )}

        {/* Create Modal */}
        <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="Create Project" size="md">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Name</Text>
              <input
                type="text"
                required
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                placeholder="Project name..."
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Description</Text>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant='gradient' style={{ color: 'white' }}
                onClick={handleCreate} loading={creating} disabled={!newProject.name.trim()}>
                Create Project
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Edit Modal */}
        <Modal opened={showEdit && !!editProject} onClose={() => { setShowEdit(false); setEditProject(null); }} title="Edit Project" size="md">
          {editProject && (
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb={4}>Name</Text>
                <input
                  type="text"
                  required
                  value={editProject.name}
                  onChange={(e) => setEditProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb={4}>Description</Text>
                <Textarea
                  value={editProject.description || ''}
                  onChange={(e) => setEditProject(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb={4}>Status</Text>
                <select
                  value={editProject.status}
                  onChange={(e) => setEditProject(prev => prev ? { ...prev, status: e.target.value as ProjectStatus } : null)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <Group justify="flex-end">
                <Button variant="subtle" onClick={() => { setShowEdit(false); setEditProject(null); }}>Cancel</Button>
                <Button variant='gradient' style={{ color: 'white' }}
                onClick={handleEdit} loading={editing} disabled={!editProject.name.trim()}>
                  Save Changes
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Delete Confirm */}
        <Modal opened={!!deleteProjectId} onClose={() => setDeleteProjectId(null)} title="Delete Project" size="sm">
          <Stack gap="md">
            <Text size="sm">Are you sure you want to delete this project? Tasks and tickets will remain but lose their project association.</Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setDeleteProjectId(null)}>Cancel</Button>
              <Button color="red" onClick={handleDelete} loading={deleting}>Delete</Button>
            </Group>
          </Stack>
        </Modal>
      </div>
    </div>
  );
}
