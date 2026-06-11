'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea, Select } from '@/components/ui';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTenantDetail, TicketPriority, TaskPriority, TaskStatus } from '@/types/crm';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'transactions', label: 'Transactions' },
];

export default function CrmTenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tenant, setTenant] = useState<CrmTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function load() {
      try {
        const detail = await crmAdminService.getTenantDetail(tenantId);
        setTenant(detail);
      } catch (err) {
        console.error('[CRM Tenant Detail] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">Tenant not found</p>
        <Link href="/settings/admin/crm/tenants" className="text-amber-600 hover:underline text-sm mt-2 inline-block">
          Back to Tenants
        </Link>
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    discovery: 'bg-cyan-100 text-cyan-800',
    commitment: 'bg-teal-100 text-teal-800',
    storefront: 'bg-lime-100 text-lime-800',
    starter: 'bg-blue-100 text-blue-800',
    professional: 'bg-purple-100 text-purple-800',
    enterprise: 'bg-indigo-100 text-indigo-800',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trial: 'bg-amber-100 text-amber-800',
    past_due: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <CrmPageShell
      title={tenant.name}
      subtitle={
        <span className="flex items-center gap-2 mt-1">
          {tenant.subscription_tier && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[tenant.subscription_tier] || 'bg-gray-100 text-gray-800'}`}>
              {tenant.subscription_tier}
            </span>
          )}
          {tenant.subscription_status && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[tenant.subscription_status] || 'bg-gray-100 text-gray-800'}`}>
              {tenant.subscription_status}
            </span>
          )}
        </span>
      }
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tenants', href: '/settings/admin/crm/tenants' },
        { label: tenant.name },
      ]}
    >
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="flex gap-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab tenant={tenant} />}
      {activeTab === 'activity' && <ActivityTab tenantId={tenantId} />}
      {activeTab === 'tickets' && <TicketsTab tenantId={tenantId} />}
      {activeTab === 'tasks' && <TasksTab tenantId={tenantId} />}
      {activeTab === 'contacts' && <ContactsTab tenantId={tenantId} />}
      {activeTab === 'transactions' && <TransactionsTab tenantId={tenantId} />}
    </div>
    </CrmPageShell>
  );
}

function OverviewTab({ tenant }: { tenant: CrmTenantDetail }) {
  const [showAlert, setShowAlert] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertForm, setAlertForm] = useState({ type: 'info', title: '', body: '', icon: '📢' });

  async function handleSendAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!alertForm.title.trim()) return;
    setSendingAlert(true);
    try {
      await crmAdminService.createAlert({
        tenant_id: tenant.id,
        type: alertForm.type,
        title: alertForm.title.trim(),
        body: alertForm.body.trim() || undefined,
        icon: alertForm.icon,
      });
      setShowAlert(false);
      setAlertForm({ type: 'info', title: '', body: '', icon: '📢' });
    } catch (err) {
      console.error('[OverviewTab] Send alert error:', err);
    } finally {
      setSendingAlert(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowAlert(true)}>Send Alert</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Open Tickets" value={tenant.open_tickets ?? 0} />
        <MiniStat label="Pending Tasks" value={tenant.pending_tasks ?? 0} />
        <MiniStat label="Contacts" value={tenant.contact_count ?? 0} />
        <MiniStat label="Service Level" value={tenant.service_level || '—'} />
      </div>
      <Card>
        <CardHeader><CardTitle>Tenant Info</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-neutral-500">ID</dt><dd className="font-mono text-xs">{tenant.id}</dd></div>
            <div><dt className="text-neutral-500">Location Status</dt><dd>{tenant.location_status || '—'}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd>{tenant.email || '—'}</dd></div>
            <div><dt className="text-neutral-500">Phone</dt><dd>{tenant.phone || '—'}</dd></div>
            <div><dt className="text-neutral-500">Created</dt><dd>{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {showAlert && (
        <Modal isOpen={showAlert} onClose={() => setShowAlert(false)} title="Send Alert to Tenant" size="md">
          <form onSubmit={handleSendAlert} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
              <select
                value={alertForm.type}
                onChange={(e) => setAlertForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="milestone">Milestone</option>
                <option value="subscription">Subscription</option>
                <option value="congratulations">Congratulations</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={alertForm.title}
                onChange={(e) => setAlertForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Alert title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Body</label>
              <Textarea
                value={alertForm.body}
                onChange={(e) => setAlertForm(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Optional body text..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Icon (emoji)</label>
              <input
                type="text"
                value={alertForm.icon}
                onChange={(e) => setAlertForm(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="📢"
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAlert(false)}>Cancel</Button>
              <Button type="submit" disabled={sendingAlert || !alertForm.title.trim()}>
                {sendingAlert ? <Spinner size="sm" /> : 'Send Alert'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ActivityTab({ tenantId }: { tenantId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await crmAdminService.listActivities(tenantId, { limit: 20 });
      setActivities(result);
    } catch (err) {
      console.error('[Activity Tab] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      await crmAdminService.createActivity(tenantId, {
        activity_type: 'note',
        content: noteContent.trim(),
        is_internal: true,
      });
      setNoteContent('');
      await load();
    } catch (err) {
      console.error('[Activity Tab] Add note error:', err);
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Add an internal note..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <Button type="submit" disabled={addingNote || !noteContent.trim()} size="sm">
          {addingNote ? <Spinner size="sm" /> : 'Add Note'}
        </Button>
      </form>
      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-center text-neutral-500 py-8">No activity yet</p>
        ) : activities.map(a => (
          <div key={a.id} className="flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm">{a.content}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {a.actor_name} · {a.activity_type} · {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            {a.is_internal && <Badge variant="warning">Internal</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketsTab({ tenantId }: { tenantId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' as TicketPriority });

  async function load() {
    setLoading(true);
    try {
      const result = await crmAdminService.listTickets(tenantId);
      setTickets(result);
    } catch (err) {
      console.error('[Tickets Tab] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTicket.title.trim()) return;
    setCreating(true);
    try {
      await crmAdminService.createTicket(tenantId, {
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || undefined,
        priority: newTicket.priority,
      });
      setShowCreate(false);
      setNewTicket({ title: '', description: '', priority: 'medium' });
      await load();
    } catch (err) {
      console.error('[Tickets Tab] Create error:', err);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    waiting: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>+ Create Ticket</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Assigned</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {tickets.map(t => (
              <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3">
                  <Link href={`/settings/admin/crm/tickets/${t.id}`} className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[t.status] || 'bg-gray-100 text-gray-800'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3">{t.priority}</td>
                <td className="px-4 py-3 text-neutral-500">{t.assigned_to || '—'}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && <p className="text-center text-neutral-500 py-6">No tickets</p>}
      </div>

      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Ticket" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
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
                placeholder="Describe the issue..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
              <Select
                value={newTicket.priority}
                onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newTicket.title.trim()}>
                {creating ? <Spinner size="sm" /> : 'Create Ticket'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TasksTab({ tenantId }: { tenantId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as TaskPriority, due_date: '', assigned_to: '' });

  async function load() {
    setLoading(true);
    try {
      const result = await crmAdminService.listTasks({ tenantId });
      setTasks(result);
    } catch (err) {
      console.error('[Tasks Tab] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setCreating(true);
    try {
      await crmAdminService.createTask({
        tenant_id: tenantId,
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_date: newTask.due_date || undefined,
        assigned_to: newTask.assigned_to || undefined,
      });
      setShowCreate(false);
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
      await load();
    } catch (err) {
      console.error('[Tasks Tab] Create error:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setUpdatingId(taskId);
    try {
      await crmAdminService.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('[Tasks Tab] Status change error:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTaskId) return;
    try {
      await crmAdminService.deleteTask(deleteTaskId);
      setDeleteTaskId(null);
      await load();
    } catch (err) {
      console.error('[Tasks Tab] Delete error:', err);
    }
  }

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>+ Create Task</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Due Date</th>
              <th className="text-left px-4 py-3 font-medium">Assigned</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {tasks.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
              return (
                <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3">
                    {updatingId === t.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                        className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${statusColor[t.status] || 'bg-gray-100 text-gray-800'}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">{t.priority}</td>
                  <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-500'}`}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{t.assigned_to || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTaskId(t.id)}
                      className="text-xs text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && <p className="text-center text-neutral-500 py-6">No tasks</p>}
      </div>

      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
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
                <Select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as TaskPriority }))}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                />
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
              <Button type="submit" disabled={creating || !newTask.title.trim()}>
                {creating ? <Spinner size="sm" /> : 'Create Task'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function ContactsTab({ tenantId }: { tenantId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<any>(null);
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '', role: '', is_primary: false });

  async function load() {
    setLoading(true);
    try {
      const result = await crmAdminService.listContacts(tenantId);
      setContacts(result);
    } catch (err) {
      console.error('[Contacts Tab] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact.first_name.trim() || !newContact.email.trim()) return;
    setCreating(true);
    try {
      await crmAdminService.createContact(tenantId, {
        first_name: newContact.first_name.trim(),
        last_name: newContact.last_name.trim() || undefined,
        email: newContact.email.trim(),
        phone: newContact.phone.trim() || undefined,
        role: newContact.role.trim() || undefined,
        is_primary: newContact.is_primary,
      });
      setShowCreate(false);
      setNewContact({ first_name: '', last_name: '', email: '', phone: '', role: '', is_primary: false });
      await load();
    } catch (err) {
      console.error('[Contacts Tab] Create error:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editContact || !editContact.first_name.trim() || !editContact.email.trim()) return;
    setEditing(true);
    try {
      await crmAdminService.updateContact(editContact.id, {
        first_name: editContact.first_name.trim(),
        last_name: editContact.last_name?.trim() || undefined,
        email: editContact.email.trim(),
        phone: editContact.phone?.trim() || undefined,
        role: editContact.role?.trim() || undefined,
        is_primary: editContact.is_primary,
      });
      setShowEdit(false);
      setEditContact(null);
      await load();
    } catch (err) {
      console.error('[Contacts Tab] Edit error:', err);
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!deleteContactId) return;
    try {
      await crmAdminService.deleteContact(deleteContactId);
      setDeleteContactId(null);
      await load();
    } catch (err) {
      console.error('[Contacts Tab] Delete error:', err);
    }
  }

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>+ Add Contact</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Primary</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group">
                <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name || ''}</td>
                <td className="px-4 py-3 text-neutral-500">{c.role || '—'}</td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3 text-neutral-500">{c.phone || '—'}</td>
                <td className="px-4 py-3">{c.is_primary && <Badge variant="success">Primary</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setEditContact(c); setShowEdit(true); }}
                      className="text-xs text-neutral-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteContactId(c.id)}
                      className="text-xs text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && <p className="text-center text-neutral-500 py-6">No contacts</p>}
      </div>

      {/* Create Contact Modal */}
      {showCreate && (
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Contact" size="md">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">First Name</label>
                <input type="text" required value={newContact.first_name} onChange={e => setNewContact(p => ({ ...p, first_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Last Name</label>
                <input type="text" value={newContact.last_name} onChange={e => setNewContact(p => ({ ...p, last_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input type="email" required value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                <input type="text" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
                <input type="text" value={newContact.role} onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Owner" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newContact.is_primary} onChange={e => setNewContact(p => ({ ...p, is_primary: e.target.checked }))} className="rounded" />
              Primary Contact
            </label>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newContact.first_name.trim() || !newContact.email.trim()}>
                {creating ? <Spinner size="sm" /> : 'Add Contact'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Edit Contact Modal */}
      {showEdit && editContact && (
        <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setEditContact(null); }} title="Edit Contact" size="md">
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">First Name</label>
                <input type="text" required value={editContact.first_name} onChange={e => setEditContact((p: any) => ({ ...p, first_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Last Name</label>
                <input type="text" value={editContact.last_name || ''} onChange={e => setEditContact((p: any) => ({ ...p, last_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input type="email" required value={editContact.email} onChange={e => setEditContact((p: any) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                <input type="text" value={editContact.phone || ''} onChange={e => setEditContact((p: any) => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
                <input type="text" value={editContact.role || ''} onChange={e => setEditContact((p: any) => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editContact.is_primary} onChange={e => setEditContact((p: any) => ({ ...p, is_primary: e.target.checked }))} className="rounded" />
              Primary Contact
            </label>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowEdit(false); setEditContact(null); }}>Cancel</Button>
              <Button type="submit" disabled={editing || !editContact.first_name.trim() || !editContact.email.trim()}>
                {editing ? <Spinner size="sm" /> : 'Save Changes'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteContactId}
        onClose={() => setDeleteContactId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message="Are you sure you want to delete this contact?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

function TransactionsTab({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    crmAdminService.getTenantTransactions(tenantId, page)
      .then(res => setOrders(res.data))
      .catch(err => console.error('[Transactions Tab] Error:', err))
      .finally(() => setLoading(false));
  }, [tenantId, page]);

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Order #</th>
              <th className="text-left px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3 font-mono text-xs">{o.order_number || o.id}</td>
                <td className="px-4 py-3">${((o.total_cents || 0) / 100).toFixed(2)}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="text-center text-neutral-500 py-6">No orders</p>}
      </div>
    </div>
  );
}
