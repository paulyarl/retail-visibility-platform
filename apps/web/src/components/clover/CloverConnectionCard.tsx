'use client';

import { useState } from 'react';
import { Package, ExternalLink, Settings, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloverStatusBadge, CloverStatus } from './CloverStatusBadge';
import { CloverDemoModeToggle } from './CloverDemoModeToggle';
import { cn } from '@/lib/utils';

interface CloverConnectionCardProps {
  tenantId: string;
  status: CloverStatus;
  isEnabled: boolean;
  mode?: 'demo' | 'production' | null;
  lastSyncAt?: string;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onEnableDemo?: () => Promise<void>;
  onDisableDemo?: () => Promise<void>;
  onSync?: () => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function CloverConnectionCard({
  tenantId,
  status,
  isEnabled,
  mode,
  lastSyncAt,
  stats,
  onConnect,
  onDisconnect,
  onEnableDemo,
  onDisableDemo,
  onSync,
  showActions = true,
  compact = false,
  className,
}: CloverConnectionCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoToggle = async (enabled: boolean) => {
    if (enabled && onEnableDemo) {
      await onEnableDemo();
    } else if (!enabled && onDisableDemo) {
      await onDisableDemo();
    }
  };

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
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Clover POS
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sync inventory from your Clover point-of-sale system
              </p>
            </div>
          </div>
          
          <CloverStatusBadge status={status} size="md" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Demo Mode Section */}
        {!isEnabled && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Try Demo Mode First
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Test the integration with 25 sample products before connecting your real Clover account.
              </p>
              {onEnableDemo && (
                <CloverDemoModeToggle
                  tenantId={tenantId}
                  isEnabled={mode === 'demo'}
                  onToggle={handleDemoToggle}
                />
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-neutral-800 text-neutral-500">or</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Connect Your Clover Account
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Sync your real inventory data automatically.
              </p>
              {onConnect && showActions && (
                <Button
                  variant="primary"
                  onClick={onConnect}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with Clover
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Connected State */}
        {isEnabled && mode === 'production' && (
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
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
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
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
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
                    disabled={isLoading}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Demo Mode Active State */}
        {isEnabled && mode === 'demo' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Demo mode is active
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  25 sample products loaded. Ready to connect your real account?
                </p>
              </div>
            </div>

            {showActions && (
              <div className="flex gap-2">
                {onConnect && (
                  <Button
                    variant="primary"
                    onClick={onConnect}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Real Account
                  </Button>
                )}
                {onDisableDemo && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDemoToggle(false)}
                    disabled={isLoading}
                  >
                    Disable Demo
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
