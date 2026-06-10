'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, Badge, Spinner } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function CrmGlobalTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [statusFilter]);

  // Group by status for Kanban-style columns
  const columns = statusFilter
    ? { [statusFilter]: tasks }
    : tasks.reduce<Record<string, any[]>>((acc, t) => {
        const col = t.status || 'pending';
        if (!acc[col]) acc[col] = [];
        acc[col].push(t);
        return acc;
      }, {});

  const columnOrder = ['pending', 'in_progress', 'completed', 'cancelled'];

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
                      <Link
                        key={t.id}
                        href={`/settings/admin/crm/tenants/${t.tenant_id}`}
                        className="block rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                      >
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-neutral-500">{t.tenant_id}</span>
                          {t.priority && (
                            <Badge variant={t.priority === 'urgent' ? 'error' : t.priority === 'high' ? 'warning' : 'default'}>
                              {t.priority}
                            </Badge>
                          )}
                        </div>
                        {t.due_date && (
                          <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                            Due: {new Date(t.due_date).toLocaleDateString()}
                          </p>
                        )}
                        {t.assigned_to && (
                          <p className="text-xs text-neutral-400 mt-1">@{t.assigned_to}</p>
                        )}
                      </Link>
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
    </CrmPageShell>
  );
}
