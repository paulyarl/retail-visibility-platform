'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmProject, ProjectStatus } from '@/types/crm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

const EMPTY_PROJECT = { name: '', description: '' };

export default function CrmProjectsPage() {
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
      const result = await crmAdminService.listProjects({
        status: statusFilter || undefined,
      });
      setProjects(result);
    } catch (err) {
      clientLogger.error('[CRM Projects] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      await crmAdminService.createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
      });
      setShowCreate(false);
      setNewProject(EMPTY_PROJECT);
      await load();
    } catch (err) {
      clientLogger.error('[CRM Projects] Create error:', { detail: err });
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject) return;
    setEditing(true);
    try {
      await crmAdminService.updateProject(editProject.id, {
        name: editProject.name,
        description: editProject.description || undefined,
        status: editProject.status,
      });
      setShowEdit(false);
      setEditProject(null);
      await load();
    } catch (err) {
      clientLogger.error('[CRM Projects] Edit error:', { detail: err });
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleteProjectId) return;
    setDeleting(true);
    try {
      await crmAdminService.deleteProject(deleteProjectId);
      setDeleteProjectId(null);
      await load();
    } catch (err) {
      clientLogger.error('[CRM Projects] Delete error:', { detail: err });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrmPageShell
      title="Projects"
      subtitle="Internal cross-functional initiatives"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Projects' },
      ]}
      actions={
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant='gradient' style={{ color: 'white' }}
            size="sm" onClick={() => setShowCreate(true)}>+ Create Project</Button>
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
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-500 text-sm">No projects yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div
              key={p.id}
              className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/settings/admin/crm/projects/${p.id}`} className="text-sm font-medium truncate flex-1 hover:text-amber-600 hover:underline">
                  {p.name}
                </Link>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditProject(p); setShowEdit(true); }}
                    className="text-xs text-neutral-400 hover:text-amber-600"
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteProjectId(p.id)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                    title="Delete"
                  >
                    Del
                  </button>
                </div>
              </div>
              {p.description && (
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-800'}`}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
                {p.stats && (
                  <span className="text-xs text-neutral-400">
                    {p.stats.pending_tasks + p.stats.in_progress_tasks} tasks · {p.stats.open_tickets} tickets
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                Created {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Project" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Project name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant='gradient' style={{ color: 'white' }}
                type="submit" disabled={creating || !newProject.name.trim()}>
                {creating ? <Spinner size="sm" /> : 'Create Project'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {showEdit && editProject && (
        <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setEditProject(null); }} title="Edit Project" size="md">
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={editProject.name}
                onChange={(e) => setEditProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <Textarea
                value={editProject.description || ''}
                onChange={(e) => setEditProject(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select
                value={editProject.status}
                onChange={(e) => setEditProject(prev => prev ? { ...prev, status: e.target.value as ProjectStatus } : null)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowEdit(false); setEditProject(null); }}>Cancel</Button>
              <Button type="submit" disabled={editing || !editProject.name.trim()}>
                {editing ? <Spinner size="sm" /> : 'Save Changes'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteProjectId}
        onClose={() => setDeleteProjectId(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message="Are you sure you want to delete this project? Tasks and tickets will remain but lose their project association."
        confirmText="Delete"
        variant="danger"
      />
    </CrmPageShell>
  );
}
