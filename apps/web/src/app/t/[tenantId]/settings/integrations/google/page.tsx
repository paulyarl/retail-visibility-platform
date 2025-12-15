'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, API_BASE_URL } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { 
  CheckCircle, 
  Circle, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle,
  Store,
  ShoppingBag,
  Link as LinkIcon,
  Unlink,
  Lock,
  Star
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

interface MerchantAccount {
  id: string;
  name: string;
  displayName: string;
}

export default function GoogleIntegrationsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  // Access control - Platform Admin, Platform Support, Tenant Owner, or Tenant Admin
  const { hasAccess, loading: accessLoading, accessReason, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [gbpStatus, setGbpStatus] = useState<GBPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectingGBP, setConnectingGBP] = useState(false);
  const [merchants, setMerchants] = useState<MerchantAccount[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [linkingMerchant, setLinkingMerchant] = useState(false);
  const [showMerchantSelector, setShowMerchantSelector] = useState(false);

  async function fetchSetupStatus() {
    try {
      setLoading(true);
      const res = await api.get(`${API_BASE_URL}/api/feed-jobs/setup-status/${tenantId}`);
      if (!res.ok) throw new Error('Failed to fetch setup status');
      const data = await res.json();
      setSetupStatus(data?.data || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGBPStatus() {
    try {
      const res = await api.get(`${API_BASE_URL}/api/google/business/status?tenantId=${tenantId}`);
      if (!res.ok) return;
      const data = await res.json();
      setGbpStatus(data?.data || null);
    } catch (err) {
      console.error('Failed to fetch GBP status:', err);
    }
  }

  async function fetchMerchants() {
    try {
      setLoadingMerchants(true);
      const res = await api.get(`${API_BASE_URL}/api/google/oauth/merchants?tenantId=${tenantId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch merchants');
      }
      const data = await res.json();
      setMerchants(data?.data?.merchants || []);
      setShowMerchantSelector(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch merchant accounts');
    } finally {
      setLoadingMerchants(false);
    }
  }

  async function handleLinkMerchant(merchant: MerchantAccount) {
    try {
      setLinkingMerchant(true);
      const res = await api.post(`${API_BASE_URL}/api/google/oauth/link-merchant`, {
        tenantId,
        merchantId: merchant.id,
        merchantName: merchant.name
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to link merchant');
      }
      setShowMerchantSelector(false);
      await fetchSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link merchant account');
    } finally {
      setLinkingMerchant(false);
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchSetupStatus();
      fetchGBPStatus();
    }
  }, [tenantId]);

  async function handleConnectGoogle() {
    setConnecting(true);
    try {
      // Redirect to Google OAuth flow
      window.location.href = `${API_BASE_URL}/api/google/oauth/authorize?tenantId=${tenantId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setConnecting(false);
    }
  }

  async function handleConnectGBP() {
    setConnectingGBP(true);
    try {
      // Redirect to Google Business Profile OAuth flow
      window.location.href = `${API_BASE_URL}/api/google/business?tenantId=${tenantId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setConnectingGBP(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Google? This will stop feed syncing.')) {
      return;
    }
    try {
      const res = await api.post(`${API_BASE_URL}/api/google/oauth/disconnect`, { tenantId });
      if (!res.ok) throw new Error('Failed to disconnect');
      await fetchSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleDisconnectGBP() {
    if (!confirm('Are you sure you want to disconnect Google Business Profile?')) {
      return;
    }
    try {
      const res = await api.post(`${API_BASE_URL}/api/google/business/disconnect`, { tenantId });
      if (!res.ok) throw new Error('Failed to disconnect');
      await fetchGBPStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  // Access control loading
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

  // Access denied
  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700">Settings</Link>
            <span>/</span>
            <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700">Integrations</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">Google</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Google Integrations
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Connect Google Merchant Center and Business Profile
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
            {accessReason || 'Only store owners and administrators can manage Google integrations.'}
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

  // Data loading
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700">Settings</Link>
          <span>/</span>
          <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700">Integrations</Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">Google</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Google Integrations
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Connect Google Merchant Center to sync your products to Google Shopping and free listings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/t/${tenantId}/settings/integrations/google/sync-status`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Status
            </Link>
            <Link
              href={`/t/${tenantId}/settings/integrations/google/advanced`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium rounded-lg transition-colors text-sm"
            >
              <Star className="w-4 h-4" />
              Advanced
            </Link>
            <Link
              href={`/t/${tenantId}/settings/integrations/google/guide`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Setup Guide
            </Link>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 mb-6">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                setupStatus?.isReady 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-amber-100 dark:bg-amber-900/30'
              }`}>
                <ShoppingBag className={`w-6 h-6 ${
                  setupStatus?.isReady 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Google Merchant Center
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {setupStatus?.message || 'Sync products to Google Shopping'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {setupStatus?.isReady ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  <Circle className="w-3 h-3" />
                  Setup Required
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Setup Steps */}
          <div className="space-y-4 mb-6">
            {setupStatus?.setupSteps.map((step, index) => (
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {!setupStatus?.hasGoogleAccount ? (
              <button
                onClick={handleConnectGoogle}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
                {connecting ? 'Connecting...' : 'Connect Google Account'}
              </button>
            ) : setupStatus?.isReady ? (
              <>
                <button
                  onClick={fetchSetupStatus}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Status
                </button>
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </>
            ) : (
              <>
                {/* If Google account connected but no merchant link, show Link Merchant button */}
                {setupStatus?.hasGoogleAccount && !setupStatus?.hasMerchantLink ? (
                  <button
                    onClick={fetchMerchants}
                    disabled={loadingMerchants}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingMerchants ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <LinkIcon className="w-4 h-4" />
                    )}
                    {loadingMerchants ? 'Loading...' : 'Link Merchant Center'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <LinkIcon className="w-4 h-4" />
                    )}
                    {connecting ? 'Connecting...' : 'Continue Setup'}
                  </button>
                )}
                <button
                  onClick={fetchSetupStatus}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </>
            )}
          </div>

          {/* Merchant Account Selector */}
          {showMerchantSelector && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Select Merchant Center Account
              </h3>
              {merchants.length === 0 ? (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  <p className="mb-2">No Merchant Center accounts found.</p>
                  <p>Make sure you have created a Google Merchant Center account at{' '}
                    <a 
                      href="https://merchants.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      merchants.google.com
                    </a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {merchants.map((merchant) => (
                    <button
                      key={merchant.id}
                      onClick={() => handleLinkMerchant(merchant)}
                      disabled={linkingMerchant}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-5 h-5 text-neutral-500" />
                        <div className="text-left">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {merchant.displayName}
                          </p>
                          <p className="text-xs text-neutral-500">ID: {merchant.id}</p>
                        </div>
                      </div>
                      {linkingMerchant ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowMerchantSelector(false)}
                className="mt-3 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Google Business Profile Card */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 mb-6">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                gbpStatus?.isConnected 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                <Store className={`w-6 h-6 ${
                  gbpStatus?.isConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-blue-600 dark:text-blue-400'
                }`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Google Business Profile
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {gbpStatus?.message || 'Sync your store hours, location, and business info to Google Maps'}
                </p>
              </div>
            </div>
            {gbpStatus?.isConnected ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 flex items-center gap-1">
                <Circle className="w-3 h-3" />
                Not Connected
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Connect your Google Business Profile to automatically sync your store hours, 
            contact information, and business details to Google Maps and Search.
          </p>
          
          {/* What syncs */}
          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">What syncs to Google:</p>
            <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
              <li>• Business hours (regular and special hours)</li>
              <li>• Store contact information</li>
              <li>• Business description and attributes</li>
              <li>• Holiday closures and temporary hours</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {gbpStatus?.isConnected ? (
              <>
                <button
                  onClick={fetchGBPStatus}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Status
                </button>
                <Link
                  href={`/t/${tenantId}/settings/integrations/google/sync-status`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Sync Status →
                </Link>
                <Link
                  href={`/t/${tenantId}/settings/hours`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Manage Hours →
                </Link>
                <Link
                  href={`/t/${tenantId}/settings/gbp-category`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  GBP Categories →
                </Link>
                <Link
                  href={`/t/${tenantId}/settings/integrations/google/advanced`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Star className="w-4 h-4" />
                  Advanced →
                </Link>
                <button
                  onClick={handleDisconnectGBP}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGBP}
                disabled={connectingGBP}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {connectingGBP ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
                {connectingGBP ? 'Connecting...' : 'Connect Google Business Profile'}
              </button>
            )}
          </div>

          {/* Tip */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> You can also manage your Google Business Profile directly at{' '}
              <a 
                href="https://business.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                business.google.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Need Help?
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Learn more about connecting your Google accounts and syncing products.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://support.google.com/merchants/answer/188493"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Google Merchant Center Help <ExternalLink className="w-3 h-3" />
          </a>
          <Link
            href={`/t/${tenantId}/feed-validation`}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Feed Validation →
          </Link>
          <Link
            href={`/t/${tenantId}/categories`}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Category Mapping →
          </Link>
        </div>
      </div>
    </div>
  );
}
