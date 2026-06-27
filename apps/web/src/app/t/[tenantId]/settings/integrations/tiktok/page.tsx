'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import {
  CheckCircle,
  Circle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
  Unlink,
  Music,
} from 'lucide-react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { API_BASE_URL } from '@/lib/api';
import { tiktokIntegrationService } from '@/services/TikTokIntegrationService';
import type { TikTokStatus, TikTokSyncStatus } from '@/services/TikTokIntegrationService';

function TikTokIntegrationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params?.tenantId as string;
  const successParam = searchParams?.get('success');
  const errorParam = searchParams?.get('error');

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [status, setStatus] = useState<TikTokStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<TikTokSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    try {
      setLoading(true);
      const data = await tiktokIntegrationService.getOAuthStatus(tenantId);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncStatus() {
    try {
      const data = await tiktokIntegrationService.getCatalogSyncStatus(tenantId);
      setSyncStatus(data);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    window.location.href = `${API_BASE_URL}/api/tiktok/oauth/authorize?tenantId=${tenantId}`;
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect TikTok Shop? This will stop catalog syncing.')) {
      return;
    }
    try {
      await tiktokIntegrationService.disconnectOAuth(tenantId);
      await fetchStatus();
      await fetchSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      await tiktokIntegrationService.syncCatalog(tenantId);
      setError(null);
      setTimeout(() => fetchSyncStatus(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync');
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
      fetchSyncStatus();
    }
  }, [tenantId]);

  if (accessLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-8"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-neutral-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Music className="w-8 h-8 text-pink-500" />
        <div>
          <h1 className="text-2xl font-bold">TikTok Shop Integration</h1>
          <p className="text-sm text-neutral-500">Sync your product catalog to TikTok Shop and ingest orders</p>
        </div>
      </div>

      {successParam === 'connected' && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">Successfully connected to TikTok Shop!</span>
        </div>
      )}

      {errorParam && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">Connection error: {errorParam}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Connection Status */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {status?.isConnected ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-neutral-400" />
            )}
            Connection Status
          </h2>
          {status?.isConnected ? (
            <button
              onClick={handleDisconnect}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600 disabled:opacity-50 flex items-center gap-2"
            >
              {connecting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</>
              ) : (
                <><ShoppingBag className="w-4 h-4" /> Connect TikTok Shop</>
              )}
            </button>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          </div>
        ) : status ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Account</dt>
              <dd className="font-medium">{status.displayName || status.email || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Shop</dt>
              <dd className="font-medium">{status.shopName || status.shopId || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Token Status</dt>
              <dd className="font-medium">
                {status.isExpired ? (
                  <span className="text-red-600">Expired</span>
                ) : (
                  <span className="text-green-600">Active</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Expires</dt>
              <dd className="font-medium">
                {status.tokenExpiry ? new Date(status.tokenExpiry).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      {/* Catalog Sync */}
      {status?.isConnected && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Catalog Sync</h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {syncing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Sync Now</>
              )}
            </button>
          </div>

          {syncStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
                <div className="text-neutral-500 text-xs">Total Products</div>
                <div className="text-xl font-bold">{syncStatus.total}</div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
                <div className="text-neutral-500 text-xs">Active</div>
                <div className="text-xl font-bold">{syncStatus.active}</div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
                <div className="text-neutral-500 text-xs">Eligible for Sync</div>
                <div className="text-xl font-bold text-green-600">{syncStatus.syncing}</div>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3">
                <div className="text-neutral-500 text-xs">Last Sync</div>
                <div className="text-sm font-medium">
                  {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Loading sync status...</p>
          )}
        </div>
      )}

      <div className="text-xs text-neutral-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        TikTok Shop API requires developer approval. Configure credentials in environment variables.
      </div>
    </div>
  );
}

export default function TikTokIntegrationPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <TikTokIntegrationContent />
    </Suspense>
  );
}
