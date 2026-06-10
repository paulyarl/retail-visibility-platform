'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTenantDetail } from '@/types/crm';

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
  return (
    <div className="space-y-6">
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

  useEffect(() => {
    crmAdminService.listActivities(tenantId, { limit: 20 })
      .then(setActivities)
      .catch(err => console.error('[Activity Tab] Error:', err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  return (
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
  );
}

function TicketsTab({ tenantId }: { tenantId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmAdminService.listTickets(tenantId)
      .then(setTickets)
      .catch(err => console.error('[Tickets Tab] Error:', err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-amber-100 text-amber-800',
    waiting: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  return (
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
              <td className="px-4 py-3 font-medium">{t.title}</td>
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
  );
}

function TasksTab({ tenantId }: { tenantId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmAdminService.listTasks({ tenantId })
      .then(setTasks)
      .catch(err => console.error('[Tasks Tab] Error:', err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Title</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Priority</th>
            <th className="text-left px-4 py-3 font-medium">Due Date</th>
            <th className="text-left px-4 py-3 font-medium">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {tasks.map(t => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
            return (
              <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[t.status] || 'bg-gray-100 text-gray-800'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3">{t.priority}</td>
                <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-500'}`}>
                  {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-neutral-500">{t.assigned_to || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && <p className="text-center text-neutral-500 py-6">No tasks</p>}
    </div>
  );
}

function ContactsTab({ tenantId }: { tenantId: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmAdminService.listContacts(tenantId)
      .then(setContacts)
      .catch(err => console.error('[Contacts Tab] Error:', err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <div className="py-8 text-center"><Spinner /></div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium">Role</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Phone</th>
            <th className="text-left px-4 py-3 font-medium">Primary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {contacts.map(c => (
            <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
              <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name || ''}</td>
              <td className="px-4 py-3 text-neutral-500">{c.role || '—'}</td>
              <td className="px-4 py-3">{c.email}</td>
              <td className="px-4 py-3 text-neutral-500">{c.phone || '—'}</td>
              <td className="px-4 py-3">{c.is_primary && <Badge variant="success">Primary</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {contacts.length === 0 && <p className="text-center text-neutral-500 py-6">No contacts</p>}
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
