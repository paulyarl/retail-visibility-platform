'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import {
  CheckCircle,
  Circle,
  RefreshCw,
  AlertTriangle,
  Store,
  ShoppingBag,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';

interface SetupStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action: string;
  requires?: string;
}

interface SetupStatus {
  isReady: boolean;
  hasGoogleAccount: boolean;
  hasMerchantLink: boolean;
  hasOAuthTokens: boolean;
  setupSteps: SetupStep[];
  message: string;
}

interface GBPStatus {
  isConnected: boolean;
  isExpired: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiry: string | null;
  message: string;
}

interface GMCStatus {
  hasGMCConnection: boolean;
  hasMerchantLink: boolean;
  hasSubdomain: boolean;
  subdomain: string | null;
  merchantName: string | null;
  totalProducts: number;
  syncedProducts: number;
  pendingProducts: number;
  errorProducts: number;
  lastSyncAt: string | null;
  storefrontReady: boolean;
  syncableProducts: number;
}

interface OverviewTabProps {
  tenantId: string;
  setupStatus: SetupStatus | null;
  gbpStatus: GBPStatus | null;
  gmcStatus: GMCStatus | null;
  validationIssuesCount: number;
  onConnectGoogle: () => void;
  onConnectGBP: () => void;
  onDisconnect: () => void;
  onDisconnectGBP: () => void;
  onRefresh: () => void;
  connecting: boolean;
  connectingGBP: boolean;
}

export default function OverviewTab({
  tenantId,
  setupStatus,
  gbpStatus,
  gmcStatus,
  validationIssuesCount,
  onConnectGoogle,
  onConnectGBP,
  onDisconnect,
  onDisconnectGBP,
  onRefresh,
  connecting,
  connectingGBP,
}: OverviewTabProps) {
  const productCoverage = gmcStatus && gmcStatus.totalProducts > 0
    ? Math.round((gmcStatus.syncedProducts / gmcStatus.totalProducts) * 100)
    : 0;

  const syncHealthScore = gmcStatus
    ? Math.round((gmcStatus.syncedProducts / Math.max(gmcStatus.totalProducts, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GMC Connection */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100 dark:bg-orange-900/30">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
            </div>
            {setupStatus?.isReady ? (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 flex items-center gap-1">
                <Circle className="w-3 h-3" /> Setup Required
              </span>
            )}
          </div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Merchant Center</h3>
          <p className="text-sm text-neutral-500 mb-3">{setupStatus?.message || 'Not configured'}</p>
          {gmcStatus && gmcStatus.hasGMCConnection && (
            <div className="text-xs text-neutral-500 space-y-1">
              <div className="flex justify-between">
                <span>Products synced:</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{gmcStatus.syncedProducts}/{gmcStatus.totalProducts}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-medium text-amber-600">{gmcStatus.pendingProducts}</span>
              </div>
              <div className="flex justify-between">
                <span>Errors:</span>
                <span className="font-medium text-red-600">{gmcStatus.errorProducts}</span>
              </div>
            </div>
          )}
        </div>

        {/* GBP Connection */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            {gbpStatus?.isConnected ? (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 flex items-center gap-1">
                <Circle className="w-3 h-3" /> Not Connected
              </span>
            )}
          </div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Business Profile</h3>
          <p className="text-sm text-neutral-500 mb-3">{gbpStatus?.message || 'Not connected'}</p>
          {gbpStatus?.isConnected && (
            <Link
              href={`/t/${tenantId}/settings/integrations/google/advanced`}
              className="text-xs text-blue-600 hover:underline"
            >
              Manage photos, posts & reviews →
            </Link>
          )}
        </div>

        {/* Sync Health */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              syncHealthScore >= 80
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : syncHealthScore >= 50
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              {syncHealthScore}% healthy
            </span>
          </div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Sync Health</h3>
          <p className="text-sm text-neutral-500 mb-3">
            {gmcStatus?.lastSyncAt
              ? `Last sync: ${new Date(gmcStatus.lastSyncAt).toLocaleDateString()}`
              : 'No syncs yet'}
          </p>
          <div className="text-xs text-neutral-500 space-y-1">
            <div className="flex justify-between">
              <span>Product coverage:</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{productCoverage}%</span>
            </div>
            <div className="flex justify-between">
              <span>Validation issues:</span>
              <span className={`font-medium ${validationIssuesCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {validationIssuesCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Steps */}
      {setupStatus && !setupStatus.isReady && Array.isArray(setupStatus.setupSteps) && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Setup Progress
          </h3>
          <div className="space-y-3">
            {setupStatus.setupSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  step.completed
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  step.completed
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span className="text-sm font-semibold text-neutral-500">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.completed
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-neutral-900 dark:text-neutral-100'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-sm ${
                    step.completed
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {step.description}
                  </p>
                </div>
                {step.completed && (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Status
          </Button>
          {!setupStatus?.hasGoogleAccount && (
            <Button
              onClick={onConnectGoogle}
              loading={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Google Account
            </Button>
          )}
          {setupStatus?.isReady && (
            <Button
              onClick={onDisconnect}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <Unlink className="w-4 h-4" />
              Disconnect GMC
            </Button>
          )}
          {!gbpStatus?.isConnected && (
            <Button
              onClick={onConnectGBP}
              loading={connectingGBP}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Business Profile
            </Button>
          )}
          {gbpStatus?.isConnected && (
            <Button
              onClick={onDisconnectGBP}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              <Unlink className="w-4 h-4" />
              Disconnect GBP
            </Button>
          )}
          <Link
            href={`/t/${tenantId}/settings/integrations/google/sync-status`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-medium rounded-lg transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Detailed Sync Status
          </Link>
          <Link
            href={`/t/${tenantId}/settings/integrations/google/advanced`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-200 font-medium rounded-lg transition-colors text-sm"
          >
            Advanced Features
          </Link>
        </div>
      </div>

      {/* Validation Issues Alert */}
      {validationIssuesCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 dark:text-amber-200 font-medium">
              {validationIssuesCount} product{validationIssuesCount !== 1 ? 's' : ''} with validation issues
            </p>
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              These products may be rejected by Google Shopping. Check the Products tab for details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
