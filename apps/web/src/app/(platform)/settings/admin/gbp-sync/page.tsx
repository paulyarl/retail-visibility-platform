'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';

interface SyncLog {
  id: string;
  tenantId: string | null;
  strategy: string;
  dryRun: boolean;
  created: number;
  updated: number;
  deleted: number;
  skipped: boolean;
  reason: string | null;
  error: string | null;
  jobId: string;
  startedAt: string;
  completedAt: string | null;
}

interface SyncStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  outOfSyncCount: number;
  recentErrors: Array<{
    id: string;
    tenantId: string | null;
    error: string;
    startedAt: string;
  }>;
}

export default function GBPSyncPage() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadStats = async () => {
    try {
      const res = await api.get('/api/admin/sync-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load sync stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await api.get('/api/admin/sync-logs?limit=20');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadLogs();
  }, []);

  const triggerSync = async () => {
    if (!confirm('Trigger a manual GBP category sync? This will sync all tenants.')) return;
    
    try {
      setTriggering(true);
      const res = await api.post('/api/categories/mirror', {
        strategy: 'platform_to_gbp',
        dryRun: false,
      });
      
      if (res.ok) {
        alert('Sync job queued successfully!');
        // Reload stats and logs after a delay
        setTimeout(() => {
          loadStats();
          loadLogs();
        }, 2000);
      } else {
        const error = await res.json();
        alert(`Failed to trigger sync: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      alert('Failed to trigger sync');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="GBP Category Sync"
        description="Monitor and manage Google Business Profile category synchronization"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Runs (24h)</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.totalRuns}</p>
            </Card>
            
            <Card className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Success Rate</p>
              <p className={`text-3xl font-bold ${stats.successRate >= 95 ? 'text-green-600' : stats.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.successRate}%
              </p>
            </Card>
            
            <Card className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Out of Sync</p>
              <p className={`text-3xl font-bold ${stats.outOfSyncCount === 0 ? 'text-green-600' : stats.outOfSyncCount < 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.outOfSyncCount}
              </p>
            </Card>
            
            <Card className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Failed Runs</p>
              <p className={`text-3xl font-bold ${stats.failedRuns === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.failedRuns}
              </p>
            </Card>
          </div>
        )}

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Trigger manual syncs and manage sync jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={triggerSync} disabled={triggering} loading={triggering}>
              {triggering ? 'Triggering Sync...' : 'Trigger Manual Sync'}
            </Button>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
              This will queue a sync job for all tenants with platform categories.
            </p>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        {stats && stats.recentErrors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Last 5 failed sync attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentErrors.map((error) => (
                  <div key={error.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-300">
                          Tenant: {error.tenantId || 'All'}
                        </p>
                        <p className="text-sm text-red-800 dark:text-red-400 mt-1">{error.error}</p>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-500">
                        {new Date(error.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Logs</CardTitle>
            <CardDescription>Last 20 sync operations</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-neutral-600 dark:text-neutral-400 text-center py-8">No sync logs found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="text-left py-2 px-3">Started</th>
                      <th className="text-left py-2 px-3">Tenant</th>
                      <th className="text-left py-2 px-3">Strategy</th>
                      <th className="text-center py-2 px-3">Created</th>
                      <th className="text-center py-2 px-3">Updated</th>
                      <th className="text-center py-2 px-3">Deleted</th>
                      <th className="text-left py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">
                          {new Date(log.startedAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">{log.tenantId || 'All'}</td>
                        <td className="py-2 px-3">
                          <Badge variant="info" className="text-xs">
                            {log.strategy}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">{log.created}</td>
                        <td className="py-2 px-3 text-center">{log.updated}</td>
                        <td className="py-2 px-3 text-center">{log.deleted}</td>
                        <td className="py-2 px-3">
                          {log.error ? (
                            <Badge variant="error" className="text-xs">Error</Badge>
                          ) : log.skipped ? (
                            <Badge variant="default" className="text-xs">{log.reason || 'Skipped'}</Badge>
                          ) : log.completedAt ? (
                            <Badge variant="success" className="text-xs">Success</Badge>
                          ) : (
                            <Badge variant="warning" className="text-xs">Running</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
