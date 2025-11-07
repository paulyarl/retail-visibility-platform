'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CloverStatus {
  enabled: boolean;
  mode: 'demo' | 'production' | null;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  demoEnabledAt?: string;
  demoLastActiveAt?: string;
  lastSyncAt?: string;
}

export default function IntegrationsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  
  const [cloverStatus, setCloverStatus] = useState<CloverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScopeDisclosure, setShowScopeDisclosure] = useState(false);
  const [oauthScopes, setOauthScopes] = useState<Array<{ scope: string; description: string }>>([]);

  // Fetch Clover integration status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/integrations/${tenantId}/clover/status`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch integration status');
      }
      
      const data = await res.json();
      setCloverStatus(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch Clover status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchStatus();
    }
    
    // Check for OAuth callback status
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const errorParam = urlParams.get('error');
    const message = urlParams.get('message');
    
    if (success === 'connected') {
      alert('Successfully connected to Clover! Your inventory will sync shortly.');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      fetchStatus();
    } else if (errorParam) {
      const errorMessage = message || errorParam;
      setError(`Connection failed: ${errorMessage}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [tenantId]);

  // Enable demo mode
  const handleEnableDemo = async () => {
    try {
      setActionLoading(true);
      setError(null);
      
      const res = await fetch(`/api/integrations/${tenantId}/clover/demo/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to enable demo mode');
      }
      
      const data = await res.json();
      alert(`Demo mode enabled! ${data.itemsImported} items imported.`);
      
      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      console.error('Failed to enable demo:', err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Connect Clover account (OAuth)
  const handleConnectClover = async () => {
    try {
      setActionLoading(true);
      setError(null);
      
      // Fetch authorization URL and scopes
      const res = await fetch(`/api/integrations/${tenantId}/clover/oauth/authorize`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to initiate OAuth flow');
      }
      
      const data = await res.json();
      
      // Show scope disclosure
      setOauthScopes(data.scopes);
      setShowScopeDisclosure(true);
      
      // Store auth URL for later
      (window as any).cloverAuthUrl = data.authorizationUrl;
      
    } catch (err: any) {
      console.error('Failed to connect Clover:', err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Proceed with OAuth after user reviews scopes
  const handleProceedWithOAuth = () => {
    const authUrl = (window as any).cloverAuthUrl;
    if (authUrl) {
      // Redirect to Clover authorization page
      window.location.href = authUrl;
    }
  };

  // Disable demo mode
  const handleDisableDemo = async () => {
    const confirmed = confirm(
      'Are you sure you want to disable demo mode? This will remove all demo items from your inventory.'
    );
    
    if (!confirmed) return;
    
    try {
      setActionLoading(true);
      setError(null);
      
      const res = await fetch(`/api/integrations/${tenantId}/clover/demo/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepItems: false })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to disable demo mode');
      }
      
      const data = await res.json();
      alert(`Demo mode disabled. ${data.itemsDeleted} items removed.`);
      
      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      console.error('Failed to disable demo:', err);
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-8"></div>
          <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Integrations
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Connect your POS system to automatically sync inventory
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Clover POS Integration */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
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
            
            {/* Status Badge */}
            {cloverStatus?.enabled && (
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  cloverStatus.mode === 'demo' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                }`}>
                  {cloverStatus.mode === 'demo' ? 'Demo Mode' : 'Production'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {!cloverStatus?.enabled ? (
            /* Not Connected */
            <div>
              <div className="mb-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Try Demo Mode
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Test the integration with 25 sample products before connecting your real Clover account.
                  Perfect for evaluating the feature without any setup.
                </p>
                <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>25 realistic sample products across 5 categories</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Instantly added to your inventory</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No Clover account required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Easy to remove when done testing</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEnableDemo}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {actionLoading ? 'Enabling...' : 'Enable Demo Mode'}
                </button>
                <button
                  onClick={handleConnectClover}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {actionLoading ? 'Connecting...' : 'Connect Clover Account'}
                </button>
              </div>

              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                      Production Ready
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Connect your real Clover account to sync live inventory automatically. 
                      Your data is encrypted and secure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Connected - Show Stats */
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Items</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {cloverStatus.stats?.totalItems || 0}
                  </div>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Mapped</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {cloverStatus.stats?.mappedItems || 0}
                  </div>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Conflicts</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {cloverStatus.stats?.conflictItems || 0}
                  </div>
                </div>
              </div>

              {cloverStatus.mode === 'demo' && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Demo Mode Active
                      </h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        You're using sample data. When ready, connect your real Clover account to sync live inventory.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {cloverStatus.mode === 'demo' && (
                  <>
                    <button
                      onClick={handleDisableDemo}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      {actionLoading ? 'Disabling...' : 'Disable Demo Mode'}
                    </button>
                    <button
                      disabled
                      className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 rounded-lg cursor-not-allowed font-medium"
                      title="Coming soon in Phase 3"
                    >
                      Migrate to Production
                    </button>
                  </>
                )}
                <Link
                  href={`/t/${tenantId}/inventory`}
                  className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 font-medium transition-colors"
                >
                  View Inventory
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          More Integrations Coming Soon
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          We're working on integrations with other popular POS systems:
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full text-sm">
            Square
          </span>
          <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full text-sm">
            Shopify
          </span>
          <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full text-sm">
            Toast
          </span>
          <span className="px-3 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full text-sm">
            Lightspeed
          </span>
        </div>
      </div>

      {/* Scope Disclosure Modal */}
      {showScopeDisclosure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Authorize Clover Access
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                To sync your inventory, we need the following permissions from your Clover account:
              </p>
              
              <div className="space-y-3 mb-6">
                {oauthScopes.map((scope, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                        {scope.scope}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">
                        {scope.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Your data is secure:</strong> All tokens are encrypted and we only access the data necessary for inventory sync.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowScopeDisclosure(false)}
                  className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedWithOAuth}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  Continue to Clover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
