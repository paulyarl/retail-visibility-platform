'use client';

import { useParams } from 'next/navigation';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import { useCloverIntegration } from '@/hooks/useCloverIntegration';
import { useSquareIntegration } from '@/hooks/useSquareIntegration';
import { CloverConnectionCard } from '@/components/clover';
import { SquareConnectionCard } from '@/components/square';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { AlertTriangle, Lock } from 'lucide-react';

export default function IntegrationsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  
  // Access control - Platform Admin, Platform Support, Tenant Owner, or Tenant Admin
  const { hasAccess, loading: accessLoading, accessReason, tenantRole, isPlatformAdmin } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  
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

  // Access control check - must be Platform Admin/Support or Tenant Owner/Admin
  if (accessLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-8"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
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

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Access Restricted
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-2xl mx-auto">
            {accessReason || 'Only store owners and administrators can manage integrations.'}
          </p>
          {tenantRole && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Your current role: <span className="font-medium">{tenantRole}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

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

      {/* Google Integrations Card */}
      <div className="mt-8 bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Google Integrations
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Connect Google Merchant Center and Business Profile
                </p>
              </div>
            </div>
            <a
              href={`/t/${tenantId}/settings/integrations/google`}
              className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors text-sm"
            >
              Configure →
            </a>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Sync your products to Google Shopping free listings and manage your Google Business Profile.
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Need Help?
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Learn more about connecting your POS system and syncing inventory.
        </p>
        <div className="flex flex-wrap gap-3">
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
          <a
            href={`/t/${tenantId}/settings/integrations/google`}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Google Integration →
          </a>
        </div>
      </div>
    </div>
  );
}
