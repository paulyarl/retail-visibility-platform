'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Zap, ExternalLink, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// Types
interface SquareStatus {
  enabled: boolean;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  lastSyncAt?: string;
  merchantId?: string;
}

interface SyncLog {
  id: string;
  operation: string;
  status: string;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  started_at: string;
  completed_at?: string;
}

export default function SquareIntegrationPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  const { getAccessToken } = useAuth();
  // State
  const [status, setStatus] = useState<SquareStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  // All tiers can access Square (tier gating removed for platform maturity)
  const canViewSquare = true;
  const canManageSquare = true;

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [tenantId, getAccessToken]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStatus();
      setLoading(false);
    };
    if (canViewSquare) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [fetchStatus, canViewSquare]);

  // Connect Square (OAuth - not yet implemented)
  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/oauth/authorize`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.error === 'not_implemented') {
        alert('Square OAuth integration coming soon! This feature is currently in development.');
      } else if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect Square
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Square? This will stop syncing your inventory.')) return;
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.error === 'not_implemented') {
        alert('Square integration is not yet connected.');
      } else {
        await fetchStatus();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger sync
  const handleSync = async () => {
    try {
      setActionLoading(true);
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.error === 'not_implemented') {
        alert('Square sync is not yet available.');
      } else {
        alert('Sync started successfully.');
        await fetchStatus();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href={`/t/${tenantId}/settings/integrations`}
          className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Integrations
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Square POS Integration</h1>
              <p className="text-neutral-600 dark:text-neutral-400">
                {status?.enabled ? 'Connected' : 'Not Connected'}
              </p>
            </div>
          </div>
          {status?.enabled && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
              Connected
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="text-sm text-red-600 hover:underline mt-1">Dismiss</button>
        </div>
      )}

      {/* Not Connected State */}
      {!status?.enabled && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-8">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Connect Your Square Account
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Sync your Square POS inventory automatically. Keep your online storefront in sync with your physical store.
            </p>
            
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">What you'll get:</h3>
              <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Automatic inventory sync from Square</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Real-time stock level updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Price synchronization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>New product auto-import</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              disabled={actionLoading || !canManageSquare}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Connecting...' : 'Connect Square Account'}
            </button>
            
            <p className="text-xs text-neutral-500 mt-4">
              You'll be redirected to Square to authorize access
            </p>
          </div>
        </div>
      )}

      {/* Connected State */}
      {status?.enabled && (
        <>
          {/* Tabs */}
          <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
            <nav className="flex gap-6">
              {(['overview', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Status</div>
                  <div className="text-lg font-bold text-green-600">Connected</div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Items</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{status.stats?.totalItems || 0}</div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Synced</div>
                  <div className="text-2xl font-bold text-green-600">{status.stats?.mappedItems || 0}</div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Last Sync</div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>

              {/* Merchant Info */}
              {status.merchantId && (
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Connected Account</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Merchant ID: <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">{status.merchantId}</code>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={actionLoading || !canManageSquare}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
                <Link
                  href={`/t/${tenantId}/items`}
                  className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 font-medium"
                >
                  View Inventory
                </Link>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading || !canManageSquare}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sync History</h3>
                <button
                  onClick={() => {/* fetch history */}}
                  className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <p>No sync history available yet.</p>
                  <p className="text-sm mt-1">Sync history will appear here after your first sync.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : log.status === 'failed' ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          )}
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {log.operation}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {new Date(log.started_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-neutral-600 dark:text-neutral-400">
                            {log.items_succeeded}/{log.items_processed} succeeded
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Coming Soon Notice */}
      <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">Square Integration Coming Soon</h4>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              Full Square POS integration is currently in development. OAuth connection and inventory sync will be available soon.
              In the meantime, try our <Link href={`/t/${tenantId}/settings/integrations/clover`} className="underline hover:no-underline">Clover integration</Link> with demo mode to see how POS sync works.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
