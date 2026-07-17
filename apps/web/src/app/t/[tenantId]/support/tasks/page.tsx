'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import Link from 'next/link';
import type { CrmTask, TaskStatus, TaskPriority } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const COLUMN_ORDER: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export default function TenantTasksPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, users] = await Promise.all([
        crmTenantCrmService.listTasks(
          statusFilter !== 'all' ? { status: statusFilter } : undefined
        ),
        tenantUserService.getTenantUsers(tenantId),
      ]);
      setTasks(data ?? []);
      setTenantUsers(users ?? []);
    } catch (err) {
      clientLogger.error('[Tenant Tasks] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = statusFilter !== 'all'
    ? { [statusFilter]: tasks }
    : tasks.reduce<Record<string, CrmTask[]>>((acc, t) => {
        const col = t.status || 'pending';
        if (!acc[col]) acc[col] = [];
        acc[col].push(t);
        return acc;
      }, {});

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setUpdatingId(taskId);
    try {
      await crmTenantCrmService.updateTaskStatus(taskId, newStatus);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      clientLogger.error('[Tenant Tasks] Status change error:', { detail: err });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Tasks"
      subtitle="Your pending and in-progress tasks"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Tasks' },
      ]}
      navCounts={{ tasks: tasks.length }}
    >
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...COLUMN_ORDER].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">No tasks found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMN_ORDER
            .filter(col => columns[col])
            .map(col => (
              <div key={col} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold capitalize">{col.replace('_', ' ')}</h3>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[col] || 'bg-gray-100 text-gray-800'}`}>
                    {columns[col]?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(columns[col] || []).map(t => {
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
                    const assignedName = t.assigned_to
                      ? tenantUsers.find(u => u.id === t.assigned_to)?.name || t.assigned_to
                      : null;
                    return (
                      <div
                        key={t.id}
                        className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                      >
                        <Link href={`/t/${tenantId}/support/tasks/${t.id}`} className="text-sm font-medium truncate block hover:text-amber-600 hover:underline">
                          {t.title}
                        </Link>
                        {t.description && (
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{t.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {t.priority && (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.low}`}>
                              {t.priority}
                            </span>
                          )}
                          {updatingId === t.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <select
                              value={t.status}
                              onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                              className={`text-xs rounded-full px-2 py-0.5 border-0 font-medium cursor-pointer ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          )}
                        </div>
                        {t.due_date && (
                          <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                            Due: {new Date(t.due_date).toLocaleDateString()}
                          </p>
                        )}
                        {assignedName && (
                          <p className="text-xs text-neutral-400 mt-1">@{assignedName}</p>
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
    </TenantCrmPageShell>
  );
}
