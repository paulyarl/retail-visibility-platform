'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Circle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
  Link as LinkIcon,
  Unlink,
  Lock,
  Camera,
  Share2,
} from 'lucide-react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { metaIntegrationService } from '@/services/MetaIntegrationService';
import type { MetaStatus, MetaSyncStatus, MetaBusiness } from '@/services/MetaIntegrationService';
import { clientLogger } from '@/lib/client-logger';


function MetaIntegrationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params?.tenantId as string;
  const successParam = searchParams?.get('success');
  const errorParam = searchParams?.get('error');

  const { hasAccess, loading: accessLoading, accessReason, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<MetaSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [businesses, setBusinesses] = useState<MetaBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<MetaBusiness | null>(null);
  const [catalogIdInput, setCatalogIdInput] = useState('');
  const [linkingCatalog, setLinkingCatalog] = useState(false);

  async function fetchStatus() {
    try {
      setLoading(true);
      const data = await metaIntegrationService.getOAuthStatus(tenantId);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncStatus() {
    try {
      const data = await metaIntegrationService.getCatalogSyncStatus(tenantId);
      setSyncStatus(data);
    } catch (err) {
      clientLogger.error('Failed to fetch sync status:', { detail: err });
    }
  }

  async function fetchBusinesses() {
    try {
      setLoadingBusinesses(true);
      const data = await metaIntegrationService.getBusinesses(tenantId);
      setBusinesses(data);
    } catch (err) {
      clientLogger.error('Failed to fetch businesses:', { detail: err });
    } finally {
      setLoadingBusinesses(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await metaIntegrationService.getOAuthAuthorizeUrl(tenantId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Meta Commerce? This will stop catalog syncing to Instagram Shopping and Facebook Shop.')) {
      return;
    }
    try {
      await metaIntegrationService.disconnectOAuth(tenantId);
      await fetchStatus();
      await fetchSyncStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleLinkCatalog() {
    if (!catalogIdInput) {
      setError('Please enter a Catalog ID');
      return;
    }
    try {
      setLinkingCatalog(true);
      await metaIntegrationService.linkCatalog(tenantId, {
        businessId: selectedBusiness?.id || null,
        catalogId: catalogIdInput,
        instagramAccountId: selectedBusiness?.instagram_business_account?.id || null,
      });
      await fetchStatus();
      await fetchSyncStatus();
      setCatalogIdInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link catalog');
    } finally {
      setLinkingCatalog(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      await metaIntegrationService.syncCatalog(tenantId);
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

  useEffect(() => {
    if (status?.isConnected && !status.catalogId) {
      fetchBusinesses();
    }
  }, [status?.isConnected, status?.catalogId]);

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
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700">Settings</Link>
            <span>/</span>
            <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700">Integrations</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">Meta Commerce</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Meta Commerce
          </h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Access Restricted</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-2xl mx-auto">
            {accessReason || 'Only store owners and administrators can manage Meta Commerce integrations.'}
          </p>
          {tenantRole && (
            <p className="text-sm text-neutral-500">Your current role: <span className="font-medium">{tenantRole}</span></p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto dark:bg-neutral-800">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
          <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Settings</Link>
          <span>/</span>
          <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Integrations</Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">Meta Commerce</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-3">
              <Camera className="w-8 h-8 text-pink-500" />
              <Share2 className="w-8 h-8 text-blue-600" />
              Meta Commerce
            </h1>
            <p className="text-neutral-600 dark:text-gray-300">
              Sync your product catalog to Meta Commerce Manager for Instagram Shopping and Facebook Shop
            </p>
          </div>
        </div>
      </div>

      {/* Success/Error banners */}
      {successParam === 'connected' && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-200">Successfully connected to Meta Commerce!</p>
        </div>
      )}
      {errorParam && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">Connection error: {errorParam}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Connection Status
          </h2>
          {status?.isConnected && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
              <CheckCircle className="w-4 h-4" />
              Connected
            </span>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          </div>
        ) : status?.isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Account</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{status.displayName || status.email || 'Connected'}</span>
            </div>
            {status.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Email</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{status.email}</span>
              </div>
            )}
            {status.businessId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Business ID</span>
                <span className="text-sm font-mono text-neutral-900 dark:text-neutral-100">{status.businessId}</span>
              </div>
            )}
            {status.catalogId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Catalog ID</span>
                <span className="text-sm font-mono text-neutral-900 dark:text-neutral-100">{status.catalogId}</span>
              </div>
            )}
            {status.instagramAccountId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Instagram Account</span>
                <span className="text-sm font-mono text-neutral-900 dark:text-neutral-100">{status.instagramAccountId}</span>
              </div>
            )}
            {status.tokenExpiry && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Token Expires</span>
                <span className={`text-sm font-medium ${status.isExpired ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                  {new Date(status.tokenExpiry).toLocaleDateString()}
                  {status.isExpired && ' (Expired)'}
                </span>
              </div>
            )}
            <button
              onClick={handleDisconnect}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium rounded-lg transition-colors text-sm"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-600 dark:text-neutral-400">
              Connect your Meta account to sync products to Instagram Shopping and Facebook Shop.
              You&apos;ll need a Meta Business Manager account with a Commerce catalog.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <LinkIcon className="w-5 h-5" />
                  Connect Meta Account
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Catalog Linking Card — shown when connected but no catalog linked */}
      {status?.isConnected && !status.catalogId && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5" />
            Link Commerce Catalog
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Select a business account and enter your Commerce Catalog ID to start syncing products.
          </p>

          {loadingBusinesses ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading business accounts...
            </div>
          ) : businesses.length > 0 ? (
            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Business Account</label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                onChange={(e) => {
                  const biz = businesses.find(b => b.id === e.target.value);
                  setSelectedBusiness(biz || null);
                }}
                defaultValue=""
              >
                <option value="">Select a business...</option>
                {businesses.map(biz => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name} {biz.instagram_business_account?.username ? `(@${biz.instagram_business_account.username})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                No business accounts found. Make sure your Meta account has access to a Business Manager.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Commerce Catalog ID</label>
            <input
              type="text"
              value={catalogIdInput}
              onChange={(e) => setCatalogIdInput(e.target.value)}
              placeholder="e.g. 123456789012345"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
            <p className="text-xs text-neutral-500">
              Find your Catalog ID in Meta Commerce Manager &gt; Catalog &gt; Settings.
            </p>
          </div>

          <button
            onClick={handleLinkCatalog}
            disabled={linkingCatalog || !catalogIdInput}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            {linkingCatalog ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                Link Catalog
              </>
            )}
          </button>
        </div>
      )}

      {/* Catalog Sync Card — shown when catalog is linked */}
      {status?.isConnected && status.catalogId && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Catalog Sync
            </h2>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync Now
                </>
              )}
            </button>
          </div>

          {syncStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Total Products</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{syncStatus.total}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Active</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{syncStatus.active}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Eligible for Sync</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{syncStatus.syncing}</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Last Sync</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Only active and public products are synced to Meta Commerce. Products are identified by their SKU.
              Make sure your SKUs are unique and stable.
            </p>
          </div>
        </div>
      )}

      {/* Instagram Shopping Eligibility */}
      {status?.isConnected && status.catalogId && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-pink-500" />
            Instagram Shopping Eligibility
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {status.instagramAccountId ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-400" />
              )}
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Instagram Business Account {status.instagramAccountId ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {status.businessId ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-400" />
              )}
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Meta Business Manager {status.businessId ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Product Catalog Linked
              </span>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              To enable Instagram Shopping, go to Meta Commerce Manager and submit your catalog for review.
              Approval typically takes 1-2 business days.
            </p>
            <a
              href="https://www.facebook.com/commerce_manager"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open Commerce Manager <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          href={`/t/${tenantId}/settings/integrations`}
          className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          ← Back to Integrations
        </Link>
      </div>
    </div>
  );
}

export default function MetaIntegrationPage() {
  return (
    <Suspense fallback={
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
        </div>
      </div>
    }>
      <MetaIntegrationContent />
    </Suspense>
  );
}
