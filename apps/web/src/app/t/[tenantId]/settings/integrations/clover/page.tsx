'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ArrowLeft, Play, CheckCircle, XCircle, AlertTriangle, RefreshCw, Zap, Package, DollarSign, Trash2, AlertOctagon, Layers, FolderPlus, FolderEdit, FolderSync, FolderX } from 'lucide-react';

// Types
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

interface SimulationScenario {
  scenario: string;
  name: string;
  description: string;
  type: 'item' | 'category';
}

interface SimulationEvent {
  id: string;
  scenario: string;
  timestamp: string;
  status: 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
  affectedItems: string[];
  changes: { field: string; oldValue: any; newValue: any }[];
  message: string;
  resolution?: string;
}

interface SimulationResult {
  itemId: string;
  itemName: string;
  sku: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'updated' | 'created' | 'archived' | 'conflict' | 'failed';
  formattedOld?: string;
  formattedNew?: string;
}

interface ItemMapping {
  id: string;
  clover_item_id: string;
  clover_item_name: string;
  clover_sku: string;
  rvp_item_id: string;
  rvp_sku: string;
  mapping_status: 'mapped' | 'conflict' | 'unmapped';
  last_synced_at: string;
  rvpItem?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
  };
}

interface CategoryMapping {
  id: string;
  clover_category_id: string;
  clover_category_name: string;
  clover_parent_id: string | null;
  rvp_category_id: string | null;
  rvp_category_name: string | null;
  sync_direction: 'bidirectional' | 'clover_to_rvp' | 'rvp_to_clover';
  mapping_status: 'mapped' | 'conflict' | 'pending';
  last_synced_at: string | null;
  rvpCategory?: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
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
  error_details?: {
    scenario?: string;
    message?: string;
    resolution?: string;
    auditTrail?: SimulationResult[];
  };
}

// Scenario icons
const scenarioIcons: Record<string, React.ReactNode> = {
  // Item scenarios
  stock_update: <Package className="w-5 h-5" />,
  price_update: <DollarSign className="w-5 h-5" />,
  new_item: <Zap className="w-5 h-5" />,
  item_deleted: <Trash2 className="w-5 h-5" />,
  conflict: <AlertTriangle className="w-5 h-5" />,
  sync_failure: <AlertOctagon className="w-5 h-5" />,
  bulk_update: <Layers className="w-5 h-5" />,
  // Category scenarios
  new_category: <FolderPlus className="w-5 h-5" />,
  category_renamed: <FolderEdit className="w-5 h-5" />,
  category_items_moved: <FolderSync className="w-5 h-5" />,
  category_conflict: <FolderX className="w-5 h-5" />,
};

export default function CloverIntegrationPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId as string;
  const { getAccessToken } = useAuth();

  // State
  const [status, setStatus] = useState<CloverStatus | null>(null);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<SimulationEvent | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [mappings, setMappings] = useState<ItemMapping[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulate' | 'mappings' | 'history'>('overview');

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/api/integrations/${tenantId}/clover/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [tenantId]);

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      const res = await api.get(`/api/integrations/${tenantId}/clover/demo/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  }, [tenantId]);

  // Fetch mappings (works for both demo and production)
  const fetchMappings = useCallback(async () => {
    try {
      // Use demo endpoint for demo mode, regular endpoint for production
      const endpoint = status?.mode === 'demo' 
        ? `/api/integrations/${tenantId}/clover/demo/mappings`
        : `/api/integrations/${tenantId}/clover/mappings`;
      const res = await api.get(endpoint);
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  }, [tenantId, status?.mode]);

  // Fetch sync history (works for both demo and production)
  const fetchSyncHistory = useCallback(async () => {
    try {
      // Use demo endpoint for demo mode, regular endpoint for production
      const endpoint = status?.mode === 'demo'
        ? `/api/integrations/${tenantId}/clover/demo/sync-history`
        : `/api/integrations/${tenantId}/clover/sync-history`;
      const res = await api.get(endpoint);
      if (res.ok) {
        const data = await res.json();
        setSyncLogs(data.syncLogs || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    }
  }, [tenantId, status?.mode]);

  // Fetch category mappings
  const fetchCategoryMappings = useCallback(async () => {
    try {
      const res = await api.get(`/api/integrations/${tenantId}/clover/category-mappings`);
      if (res.ok) {
        const data = await res.json();
        setCategoryMappings(data.categoryMappings || []);
      }
    } catch (err) {
      console.error('Failed to fetch category mappings:', err);
    }
  }, [tenantId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStatus();
      setLoading(false);
    };
    loadData();
  }, [fetchStatus]);

  // Load tab-specific data
  useEffect(() => {
    if (status?.enabled) {
      // Simulate tab only available in demo mode
      if (activeTab === 'simulate' && status.mode === 'demo') fetchScenarios();
      // Mappings and history work for both demo and production
      if (activeTab === 'mappings') {
        fetchMappings();
        fetchCategoryMappings();
      }
      if (activeTab === 'history') fetchSyncHistory();
    }
  }, [activeTab, status?.enabled, status?.mode, fetchScenarios, fetchMappings, fetchCategoryMappings, fetchSyncHistory]);

  // Enable demo mode
  const handleEnableDemo = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.post(`/api/integrations/${tenantId}/clover/demo/enable`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to enable demo mode');
      }
      const data = await res.json();
      alert(`Demo mode enabled! ${data.itemsImported} items imported.`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Disable demo mode
  const handleDisableDemo = async () => {
    if (!confirm('Are you sure? This will remove all demo items.')) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/api/integrations/${tenantId}/clover/demo/disable`, { keepItems: false });
      if (!res.ok) throw new Error('Failed to disable demo mode');
      alert('Demo mode disabled.');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Connect real Clover account (OAuth)
  const handleConnectReal = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.get(`/api/integrations/${tenantId}/clover/oauth/authorize`);
      const data = await res.json();
      
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error(data.message || 'Failed to get authorization URL');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Sync now (production mode)
  const handleSync = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/api/integrations/${tenantId}/clover/sync`);
      if (!res.ok) throw new Error('Failed to start sync');
      const data = await res.json();
      alert(`Sync started! ${data.message || ''}`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect (production mode)
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Clover? This will stop syncing your inventory.')) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/api/integrations/${tenantId}/clover/disconnect`);
      if (!res.ok) throw new Error('Failed to disconnect');
      alert('Clover disconnected.');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger simulation
  const handleTriggerSimulation = async (scenario: string) => {
    try {
      setActionLoading(true);
      setSimulationResults([]); // Clear previous results
      const res = await api.post(`/api/integrations/${tenantId}/clover/demo/simulate`, { scenario });
      if (!res.ok) throw new Error('Failed to start simulation');
      const data = await res.json();
      setActiveSimulation(data.event);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Execute simulation
  const handleExecuteSimulation = async () => {
    if (!activeSimulation) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/api/integrations/${tenantId}/clover/demo/simulate/${activeSimulation.id}/execute`);
      if (!res.ok) throw new Error('Failed to execute simulation');
      const data = await res.json();
      setActiveSimulation(data.event);
      setSimulationResults(data.results || []); // Capture detailed results
      await fetchStatus();
      await fetchMappings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel simulation
  const handleCancelSimulation = async () => {
    if (!activeSimulation) return;
    try {
      await api.post(`/api/integrations/${tenantId}/clover/demo/simulate/${activeSimulation.id}/cancel`);
      setActiveSimulation(null);
      setSimulationResults([]); // Clear results on cancel
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Resolve conflict (works for both demo and production)
  const handleResolveConflict = async (mappingId: string, resolution: 'use_clover' | 'use_rvp') => {
    try {
      setActionLoading(true);
      // Use demo endpoint for demo mode, regular endpoint for production
      const endpoint = status?.mode === 'demo'
        ? `/api/integrations/${tenantId}/clover/demo/mappings/${mappingId}/resolve`
        : `/api/integrations/${tenantId}/clover/mappings/${mappingId}/resolve`;
      const res = await api.post(endpoint, { resolution });
      if (!res.ok) throw new Error('Failed to resolve conflict');
      await fetchMappings();
      await fetchStatus();
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
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Clover POS Integration</h1>
              <p className="text-neutral-600 dark:text-neutral-400">
                {status?.mode === 'demo' ? 'Demo Mode Active' : status?.mode === 'production' ? 'Connected' : 'Not Connected'}
              </p>
            </div>
          </div>
          {status?.mode === 'demo' && (
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
              Demo Mode
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
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Try Clover Integration
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Experience how Clover POS sync works with 25 sample products. 
              Test sync scenarios, conflict resolution, and mapping management before connecting your real account.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleEnableDemo}
                disabled={actionLoading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {actionLoading ? 'Enabling...' : 'Enable Demo Mode'}
              </button>
              <button
                disabled
                className="px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-400 rounded-lg cursor-not-allowed font-medium"
                title="Coming soon"
              >
                Connect Real Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected State (Demo or Production) */}
      {status?.enabled && (
        <>
          {/* Tabs - Simulate tab only in demo mode */}
          <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
            <nav className="flex gap-6">
              {(status.mode === 'demo' 
                ? ['overview', 'simulate', 'mappings', 'history'] as const
                : ['overview', 'mappings', 'history'] as const
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-green-600 text-green-600 dark:text-green-400'
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
                  <div className="text-lg font-bold text-green-600">
                    {status.mode === 'demo' ? 'Demo Active' : 'Connected'}
                  </div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Items</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{status.stats?.totalItems || 0}</div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Mapped</div>
                  <div className="text-2xl font-bold text-green-600">{status.stats?.mappedItems || 0}</div>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">Conflicts</div>
                  <div className="text-2xl font-bold text-amber-600">{status.stats?.conflictItems || 0}</div>
                </div>
              </div>

              {/* Demo Mode Info */}
              {status.mode === 'demo' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Demo Mode Features</h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• 25 sample products across 5 categories</li>
                    <li>• Simulate sync scenarios (stock changes, price updates, conflicts)</li>
                    <li>• Practice conflict resolution</li>
                    <li>• View item mappings between Clover and RVP</li>
                  </ul>
                </div>
              )}

              {/* Production Mode Info */}
              {status.mode === 'production' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Connected to Clover</h3>
                  <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                    <p>Your Clover POS is connected and syncing automatically.</p>
                    {status.lastSyncAt && (
                      <p>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {/* Production: Sync Now button */}
                {status.mode === 'production' && (
                  <button
                    onClick={handleSync}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                    Sync Now
                  </button>
                )}
                
                <Link
                  href={`/t/${tenantId}/items`}
                  className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 font-medium"
                >
                  View Inventory
                </Link>
                
                {/* Demo: Disable or Upgrade */}
                {status.mode === 'demo' && (
                  <>
                    <button
                      onClick={handleConnectReal}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      Connect Real Account
                    </button>
                    <button
                      onClick={handleDisableDemo}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                    >
                      Disable Demo
                    </button>
                  </>
                )}
                
                {/* Production: Disconnect */}
                {status.mode === 'production' && (
                  <button
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Simulate Tab */}
          {activeTab === 'simulate' && (
            <div className="space-y-6">
              {/* Active Simulation */}
              {activeSimulation && (
                <div className={`p-4 rounded-lg border ${
                  activeSimulation.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                  activeSimulation.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                  activeSimulation.status === 'conflict' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        Active Simulation: {activeSimulation.scenario.replace('_', ' ')}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{activeSimulation.message}</p>
                      {activeSimulation.resolution && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1 italic">{activeSimulation.resolution}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          activeSimulation.status === 'success' ? 'bg-green-200 text-green-800' :
                          activeSimulation.status === 'failed' ? 'bg-red-200 text-red-800' :
                          activeSimulation.status === 'conflict' ? 'bg-amber-200 text-amber-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {activeSimulation.status}
                        </span>
                        <span className="text-xs text-neutral-500">{activeSimulation.affectedItems.length} items affected</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {activeSimulation.status === 'pending' && (
                        <>
                          <button
                            onClick={handleExecuteSimulation}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            Execute
                          </button>
                          <button
                            onClick={handleCancelSimulation}
                            className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded text-sm hover:bg-neutral-300"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {(activeSimulation.status === 'success' || activeSimulation.status === 'failed' || activeSimulation.status === 'conflict') && (
                        <button
                          onClick={() => { setActiveSimulation(null); setSimulationResults([]); }}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded text-sm"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detailed Results - Before/After View */}
                  {simulationResults.length > 0 && (
                    <div className="mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                        📋 Audit Trail - {simulationResults.length} Change{simulationResults.length !== 1 ? 's' : ''}
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {simulationResults.map((result, idx) => (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-lg border ${
                              result.action === 'updated' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' :
                              result.action === 'created' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                              result.action === 'archived' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' :
                              result.action === 'conflict' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' :
                              'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium uppercase ${
                                    result.action === 'updated' ? 'bg-blue-200 text-blue-800' :
                                    result.action === 'created' ? 'bg-green-200 text-green-800' :
                                    result.action === 'archived' ? 'bg-orange-200 text-orange-800' :
                                    result.action === 'conflict' ? 'bg-amber-200 text-amber-800' :
                                    'bg-red-200 text-red-800'
                                  }`}>
                                    {result.action}
                                  </span>
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                                    {result.field}
                                  </span>
                                </div>
                                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {result.itemName}
                                </p>
                                {result.sku && (
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                                    SKU: {result.sku}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm shrink-0">
                                <div className="text-right">
                                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Before</div>
                                  <div className="font-mono text-red-600 dark:text-red-400 line-through">
                                    {result.formattedOld || String(result.oldValue ?? '—')}
                                  </div>
                                </div>
                                <span className="text-neutral-400">→</span>
                                <div className="text-left">
                                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">After</div>
                                  <div className="font-mono text-green-600 dark:text-green-400 font-semibold">
                                    {result.formattedNew || String(result.newValue ?? '—')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Changes Preview */}
                  {activeSimulation.status === 'pending' && activeSimulation.changes.length > 0 && (
                    <div className="mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                        🔍 Pending Changes Preview
                      </h4>
                      <div className="space-y-2">
                        {activeSimulation.changes.map((change, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase">
                              {change.field}
                            </span>
                            <span className="text-sm text-red-600 dark:text-red-400 line-through">
                              {typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : String(change.oldValue ?? '(none)')}
                            </span>
                            <span className="text-neutral-400">→</span>
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              {typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : String(change.newValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Item Scenarios */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  📦 Item Scenarios
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.filter(s => s.type === 'item').map((scenario) => (
                    <div
                      key={scenario.scenario}
                      className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400">
                          {scenarioIcons[scenario.scenario] || <Play className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-neutral-900 dark:text-neutral-100">{scenario.name}</h4>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{scenario.description}</p>
                          <button
                            onClick={() => handleTriggerSimulation(scenario.scenario)}
                            disabled={actionLoading || !!activeSimulation}
                            className="mt-3 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Run Simulation
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Scenarios */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  📁 Category Scenarios
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.filter(s => s.type === 'category').map((scenario) => (
                    <div
                      key={scenario.scenario}
                      className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                          {scenarioIcons[scenario.scenario] || <Play className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-neutral-900 dark:text-neutral-100">{scenario.name}</h4>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{scenario.description}</p>
                          <button
                            onClick={() => handleTriggerSimulation(scenario.scenario)}
                            disabled={actionLoading || !!activeSimulation}
                            className="mt-3 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Run Simulation
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mappings Tab */}
          {activeTab === 'mappings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Item Mappings</h3>
                <button
                  onClick={fetchMappings}
                  className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {mappings.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">No mappings found</div>
              ) : (
                <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-neutral-50 dark:bg-neutral-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Clover Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">RVP Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                      {mappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{mapping.clover_item_name}</div>
                            <div className="text-xs text-neutral-500">{mapping.clover_sku}</div>
                          </td>
                          <td className="px-4 py-3">
                            {mapping.rvpItem ? (
                              <>
                                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{mapping.rvpItem.name}</div>
                                <div className="text-xs text-neutral-500">{mapping.rvpItem.sku}</div>
                              </>
                            ) : (
                              <span className="text-neutral-400">Not mapped</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              mapping.mapping_status === 'mapped' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              mapping.mapping_status === 'conflict' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                              'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                            }`}>
                              {mapping.mapping_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {mapping.mapping_status === 'conflict' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleResolveConflict(mapping.id, 'use_clover')}
                                  disabled={actionLoading}
                                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  Use Clover
                                </button>
                                <button
                                  onClick={() => handleResolveConflict(mapping.id, 'use_rvp')}
                                  disabled={actionLoading}
                                  className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                >
                                  Use RVP
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Category Mappings Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Category Mappings</h3>
                  <button
                    onClick={fetchCategoryMappings}
                    className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {categoryMappings.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    No category mappings found. Run a sync to create category mappings.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-neutral-50 dark:bg-neutral-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Clover Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">RVP Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Sync Direction</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {categoryMappings.map((catMapping) => (
                          <tr key={catMapping.id}>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {catMapping.clover_category_name}
                              </div>
                              <div className="text-xs text-neutral-500">{catMapping.clover_category_id}</div>
                            </td>
                            <td className="px-4 py-3">
                              {catMapping.rvpCategory ? (
                                <>
                                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {catMapping.rvpCategory.name}
                                  </div>
                                  <div className="text-xs text-neutral-500">/{catMapping.rvpCategory.slug}</div>
                                </>
                              ) : (
                                <span className="text-neutral-400">Not mapped</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                catMapping.sync_direction === 'bidirectional' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                                  : catMapping.sync_direction === 'clover_to_rvp'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              }`}>
                                {catMapping.sync_direction === 'bidirectional' ? '↔ Both Ways' :
                                 catMapping.sync_direction === 'clover_to_rvp' ? '→ Clover to RVP' :
                                 '← RVP to Clover'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                catMapping.mapping_status === 'mapped' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                  : catMapping.mapping_status === 'conflict'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                              }`}>
                                {catMapping.mapping_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sync History</h3>
                <button
                  onClick={fetchSyncHistory}
                  className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">No sync history</div>
              ) : (
                <div className="space-y-3">
                  {syncLogs.map((log) => (
                    <details
                      key={log.id}
                      className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 group"
                    >
                      <summary className="p-4 cursor-pointer list-none">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : log.status === 'failed' ? (
                              <XCircle className="w-5 h-5 text-red-600" />
                            ) : log.status === 'conflict' ? (
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                            ) : (
                              <RefreshCw className="w-5 h-5 text-blue-600" />
                            )}
                            <div>
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">
                                {log.operation.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {new Date(log.started_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm">
                              <div className="text-neutral-600 dark:text-neutral-400">
                                {log.items_succeeded}/{log.items_processed} succeeded
                              </div>
                              {log.items_failed > 0 && (
                                <div className="text-red-600">{log.items_failed} failed</div>
                              )}
                            </div>
                            {log.error_details?.auditTrail && log.error_details.auditTrail.length > 0 && (
                              <span className="text-xs text-neutral-400 group-open:rotate-90 transition-transform">▶</span>
                            )}
                          </div>
                        </div>
                      </summary>
                      
                      {/* Detailed Audit Trail */}
                      {log.error_details?.auditTrail && log.error_details.auditTrail.length > 0 && (
                        <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-700 pt-3">
                          {log.error_details.message && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                              {log.error_details.message}
                            </p>
                          )}
                          <div className="space-y-2">
                            {log.error_details.auditTrail.map((result, idx) => (
                              <div 
                                key={idx} 
                                className={`p-2 rounded border text-sm ${
                                  result.action === 'updated' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' :
                                  result.action === 'created' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                                  result.action === 'archived' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' :
                                  result.action === 'conflict' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' :
                                  'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium uppercase shrink-0 ${
                                      result.action === 'updated' ? 'bg-blue-200 text-blue-800' :
                                      result.action === 'created' ? 'bg-green-200 text-green-800' :
                                      result.action === 'archived' ? 'bg-orange-200 text-orange-800' :
                                      result.action === 'conflict' ? 'bg-amber-200 text-amber-800' :
                                      'bg-red-200 text-red-800'
                                    }`}>
                                      {result.action}
                                    </span>
                                    <span className="font-medium truncate">{result.itemName}</span>
                                    {result.sku && (
                                      <span className="text-xs text-neutral-500 font-mono shrink-0">({result.sku})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs shrink-0">
                                    <span className="text-red-600 dark:text-red-400 line-through">
                                      {result.formattedOld || String(result.oldValue ?? '—')}
                                    </span>
                                    <span className="text-neutral-400">→</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                      {result.formattedNew || String(result.newValue ?? '—')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
