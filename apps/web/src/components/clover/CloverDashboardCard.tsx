'use client';

import { Package, ExternalLink, RefreshCw, Settings, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloverStatusBadge, CloverStatus } from './CloverStatusBadge';
import { cn } from '@/lib/utils';

interface CloverDashboardCardProps {
  tenantId: string;
  status: CloverStatus;
  mode?: 'demo' | 'production' | null;
  lastSyncAt?: string;
  stats?: {
    totalItems: number;
    syncedItems: number;
  };
  onConnect?: () => void;
  onSync?: () => void;
  onManage?: () => void;
  className?: string;
}

export function CloverDashboardCard({
  tenantId,
  status,
  mode,
  lastSyncAt,
  stats,
  onConnect,
  onSync,
  onManage,
  className,
}: CloverDashboardCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Clover POS
            </h3>
            <CloverStatusBadge status={status} size="sm" />
          </div>
        </div>
      </div>

      {/* Content based on status */}
      {status === 'disconnected' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Connect your Clover POS to automatically sync inventory
          </p>
          {onConnect && (
            <Button
              variant="primary"
              size="sm"
              onClick={onConnect}
              className="bg-green-600 hover:bg-green-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Clover
            </Button>
          )}
        </div>
      )}

      {status === 'demo' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <Package className="h-4 w-4" />
            <span>25 sample products loaded</span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Ready to connect your real account?
          </p>
          <div className="flex gap-2">
            {onConnect && (
              <Button
                variant="primary"
                size="sm"
                onClick={onConnect}
                className="bg-green-600 hover:bg-green-700"
              >
                Connect Real Account
              </Button>
            )}
            {onManage && (
              <Button variant="secondary" size="sm" onClick={onManage}>
                <Settings className="h-4 w-4 mr-2" />
                Manage
              </Button>
            )}
          </div>
        </div>
      )}

      {(status === 'connected' || status === 'syncing') && (
        <div className="space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {stats.totalItems}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Total Items
                </div>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stats.syncedItems}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Synced
                </div>
              </div>
            </div>
          )}

          {/* Last Sync */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <Clock className="h-4 w-4" />
              <span>Last sync:</span>
            </div>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {formatDate(lastSyncAt)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {onSync && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSync}
                disabled={status === 'syncing'}
              >
                <RefreshCw className={cn(
                  "h-4 w-4 mr-2",
                  status === 'syncing' && "animate-spin"
                )} />
                {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
            {onManage && (
              <Button variant="secondary" size="sm" onClick={onManage}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            Connection error. Please check your settings.
          </p>
          {onManage && (
            <Button variant="danger" size="sm" onClick={onManage}>
              <Settings className="h-4 w-4 mr-2" />
              Troubleshoot
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
