'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { RequestType } from '@/types/crm';

const TYPE_ICONS: Record<string, string> = {
  ticket: '🎫',
  task: '✅',
  inquiry: '❓',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function CrmRequestsHubPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await crmAdminService.listRequests({
          type: (typeFilter as RequestType) || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          assignedTo: assignedTo || undefined,
          unread: unreadOnly || undefined,
        });
        setRequests(result);
      } catch (err) {
        console.error('[CRM Requests Hub] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter, statusFilter, priorityFilter, unreadOnly, assignedTo]);

  async function handleMarkAllRead() {
    try {
      await crmAdminService.markAllRequestsRead();
      setRequests(prev => prev.map(r => ({ ...r, is_read: true })));
    } catch (err) {
      console.error('[CRM Requests Hub] Mark all read error:', err);
    }
  }

  async function handleMarkRead(requestId: string) {
    try {
      await crmAdminService.markRequestRead(requestId);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, is_read: true } : r));
    } catch (err) {
      console.error('[CRM Requests Hub] Mark read error:', err);
    }
  }

  return (
    <CrmPageShell
      title="Requests Hub"
      subtitle="Unified ticket, task & inquiry queue"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Requests' },
      ]}
      actions={
        <button
          onClick={handleMarkAllRead}
          className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium"
        >
          Mark all read
        </button>
      }
    >
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {['', 'ticket', 'task', 'inquiry'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
              }`}
            >
              {type ? `${TYPE_ICONS[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}s` : 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            unreadOnly
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200'
          }`}
        >
          🔵 Unread
        </button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="text"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="Assigned to..."
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm w-40"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-neutral-500">All caught up!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => !r.is_read && handleMarkRead(r.id)}
              className={`flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer ${
                !r.is_read ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-400' : ''
              }`}
            >
              <span className="text-lg">{TYPE_ICONS[r.type] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium truncate ${!r.is_read ? 'font-semibold' : ''}`}>{r.title || r.subject || 'Untitled'}</p>
                  {!r.is_read && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {r.tenant_name || r.tenant_id} · {r.assigned_to || 'Unassigned'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.priority && (
                  <Badge variant={r.priority === 'urgent' ? 'error' : r.priority === 'high' ? 'warning' : 'default'}>
                    {r.priority}
                  </Badge>
                )}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-800'}`}>
                  {r.status?.replace('_', ' ')}
                </span>
              </div>
              <Link
                href={`/settings/admin/crm/tenants/${r.tenant_id}`}
                className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
                onClick={(e) => e.stopPropagation()}
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </CrmPageShell>
  );
}
