'use client';

import { Square, ExternalLink, RefreshCw, Settings, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SquareStatusBadge, SquareStatus } from './SquareStatusBadge';
import { cn } from '@/lib/utils';

interface SquareConnectionCardProps {
  tenantId: string;
  status: SquareStatus;
  isEnabled: boolean;
  lastSyncAt?: string;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: () => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function SquareConnectionCard({
  tenantId,
  status,
  isEnabled,
  lastSyncAt,
  stats,
  onConnect,
  onDisconnect,
  onSync,
  showActions = true,
  compact = false,
  className,
}: SquareConnectionCardProps) {
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
        'bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700',
        className
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
              <Square className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Square POS
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sync inventory from your Square point-of-sale system
              </p>
            </div>
          </div>
          
          <SquareStatusBadge status={status} size="md" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Disconnected State */}
        {!isEnabled && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Connect Your Square Account
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Sync your inventory data automatically with secure OAuth connection.
              </p>
              {onConnect && showActions && (
                <Button
                  variant="primary"
                  onClick={onConnect}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with Square
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Connected State */}
        {isEnabled && (status === 'connected' || status === 'syncing') && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {stats?.totalItems || 0}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Total Items
                </div>
              </div>
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats?.mappedItems || 0}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Synced
                </div>
              </div>
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats?.conflictItems || 0}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Conflicts
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Last sync:</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatDate(lastSyncAt)}
              </span>
            </div>

            {showActions && (
              <div className="flex gap-2">
                {onSync && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onSync}
                    disabled={status === 'syncing'}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      status === 'syncing' && "animate-spin"
                    )} />
                    {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {/* Navigate to settings */}}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                {onDisconnect && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={onDisconnect}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <CheckCircle2 className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Connection error
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Please check your settings and try reconnecting.
                </p>
              </div>
            </div>

            {showActions && onConnect && (
              <Button
                variant="primary"
                onClick={onConnect}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Reconnect Square
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
