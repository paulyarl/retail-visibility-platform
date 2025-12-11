'use client';

import { useParams } from 'next/navigation';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import { useCloverIntegration } from '@/hooks/useCloverIntegration';
import { useSquareIntegration } from '@/hooks/useSquareIntegration';
import { CloverConnectionCard } from '@/components/clover';
import { SquareConnectionCard } from '@/components/square';

export default function IntegrationsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  
  // Tier and permission checks
  const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
  
  // Clover integration
  const {
    cloverStatus,
    isConnected: cloverConnected,
    data: cloverData,
    loading: cloverLoading,
    error: cloverError,
    enableDemo,
    disableDemo,
    connect: connectClover,
    disconnect: disconnectClover,
    sync: syncClover,
  } = useCloverIntegration(tenantId);

  // Square integration
  const {
    squareStatus,
    isConnected: squareConnected,
    data: squareData,
    loading: squareLoading,
    error: squareError,
    connect: connectSquare,
    disconnect: disconnectSquare,
    sync: syncSquare,
  } = useSquareIntegration(tenantId);

  const loading = cloverLoading || squareLoading;
  const error = cloverError || squareError;

  // Check tier access for viewing
  const canViewClover = canAccess('clover_pos', 'canView');
  const canViewSquare = canAccess('square_pos', 'canView');
  const canManageClover = canAccess('clover_pos', 'canManage');
  const canManageSquare = canAccess('square_pos', 'canManage');

  // Clover should be available to all (Starter+), Square is Pro+ only
  // If user can't view Clover (Google-Only tier), show upgrade prompt
  if (!canViewClover) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            POS Integrations
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Connect your point-of-sale system to automatically sync inventory
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full mb-4">
            <span className="text-3xl">🔌</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            POS Integrations Available on Starter Plan
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-2xl mx-auto">
            Connect Clover POS with demo mode to try it out, or Square POS on Pro+. 
            Automatically sync inventory across all channels - no more double-entry!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/t/${tenantId}/settings/subscription`}
              className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              Upgrade to Starter →
            </a>
            <a
              href="/docs/pos-integrations"
              className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          POS Integrations
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Connect your point-of-sale system to automatically sync inventory across all channels
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clover Card - Available to all (Starter+) */}
        {canViewClover && (
          <CloverConnectionCard
            tenantId={tenantId}
            status={cloverStatus}
            isEnabled={cloverConnected}
            mode={cloverData?.mode}
            lastSyncAt={cloverData?.lastSyncAt}
            stats={cloverData?.stats}
            onConnect={canManageClover ? connectClover : undefined}
            onEnableDemo={canManageClover ? enableDemo : undefined}
            onDisableDemo={canManageClover ? disableDemo : undefined}
            onSync={canManageClover ? syncClover : undefined}
            onDisconnect={canManageClover ? disconnectClover : undefined}
            showActions={canManageClover}
          />
        )}

        {/* Square Card - Pro+ only, or upgrade prompt */}
        {canViewSquare ? (
          <SquareConnectionCard
            tenantId={tenantId}
            status={squareStatus}
            isEnabled={squareConnected}
            lastSyncAt={squareData?.lastSyncAt}
            stats={squareData?.stats}
            onConnect={canManageSquare ? connectSquare : undefined}
            onSync={canManageSquare ? syncSquare : undefined}
            onDisconnect={canManageSquare ? disconnectSquare : undefined}
            showActions={canManageSquare}
          />
        ) : (
          // Upgrade prompt for Square (non-Pro users)
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0 opacity-50">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      Square POS
                    </h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Premium integration for Pro+ users
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                  PRO+
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-3">
                  <span className="text-2xl">⭐</span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  Upgrade to Pro for Square
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Connect Square POS and sync inventory automatically. Perfect for growing businesses!
                </p>
                <a
                  href={`/t/${tenantId}/settings/subscription`}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Upgrade to Pro →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role-based message for viewers */}
      {(!canManageClover || !canManageSquare) && (canViewClover || canViewSquare) && (
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>View-only access:</strong> You can see integration status but cannot connect or manage POS systems. 
            Contact your account owner or manager to make changes.
          </p>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Need Help?
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Learn more about connecting your POS system and syncing inventory.
        </p>
        <div className="flex gap-3">
          <a
            href={`/t/${tenantId}/settings/integrations/clover`}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clover Integration →
          </a>
          <a
            href={`/t/${tenantId}/settings/integrations/square`}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Square Integration →
          </a>
        </div>
      </div>
    </div>
  );
}
