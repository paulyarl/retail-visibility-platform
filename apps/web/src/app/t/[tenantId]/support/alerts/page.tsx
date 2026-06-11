'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmAlert, AlertType } from '@/types/crm';

const TYPE_COLORS: Record<string, string> = {
  milestone: 'bg-emerald-100 text-emerald-800',
  subscription: 'bg-blue-100 text-blue-800',
  welcome: 'bg-purple-100 text-purple-800',
  info: 'bg-sky-100 text-sky-800',
  warning: 'bg-amber-100 text-amber-800',
  congratulations: 'bg-pink-100 text-pink-800',
  order: 'bg-orange-100 text-orange-800',
};

const TYPE_ICONS: Record<string, string> = {
  milestone: '🏆',
  subscription: '💳',
  welcome: '👋',
  info: 'ℹ️',
  warning: '⚠️',
  congratulations: '🎉',
  order: '🛒',
};

export default function TenantAlertsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [alerts, setAlerts] = useState<CrmAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await crmTenantCrmService.listAlerts(
          typeFilter !== 'all' ? { type: typeFilter } : undefined
        );
        setAlerts(data ?? []);
      } catch (err) {
        console.error('[Tenant Alerts] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter]);

  async function handleMarkRead(alertId: string) {
    try {
      await crmTenantCrmService.markAlertRead(alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error('[Tenant Alerts] Mark read error:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await crmTenantCrmService.markAllAlertsRead();
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('[Tenant Alerts] Mark all read error:', err);
    }
  }

  async function handleDismiss(alertId: string) {
    try {
      await crmTenantCrmService.dismissAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('[Tenant Alerts] Dismiss error:', err);
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Alerts"
      subtitle="Platform notifications and milestones"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Alerts' },
      ]}
      navCounts={{ alerts: unreadCount }}
      actions={
        unreadCount > 0 ? (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 dark:text-purple-300 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 transition-colors"
          >
            Mark all read
          </button>
        ) : undefined
      }
    >
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'milestone', 'subscription', 'welcome', 'info', 'warning', 'congratulations', 'order'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              typeFilter === t
                ? 'bg-purple-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            {t === 'all' ? 'All' : `${TYPE_ICONS[t] || ''} ${t.replace('_', ' ')}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🔔</p>
          <p className="text-neutral-500">No alerts yet</p>
          <p className="text-xs text-neutral-400 mt-1">Platform milestones and notifications will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 transition-colors ${
                !a.is_read
                  ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'
                  : 'border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="text-xl mt-0.5 shrink-0">{a.icon || TYPE_ICONS[a.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${!a.is_read ? 'text-purple-800 dark:text-purple-200' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {a.title}
                      </p>
                      {!a.is_read && (
                        <span className="inline-flex w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                      )}
                    </div>
                    {a.body && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{a.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[a.type] || 'bg-gray-100 text-gray-800'}`}>
                        {a.type?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-neutral-400">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {!a.is_read && (
                    <button
                      onClick={() => handleMarkRead(a.id)}
                      className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
                    >
                      Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(a.id)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </TenantCrmPageShell>
  );
}
