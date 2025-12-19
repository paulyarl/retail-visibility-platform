import { Button, Badge } from '@/components/ui';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface ItemsHeaderProps {
  stats: {
    total: number;
    active: number;
    inactive: number;
    syncing: number;
    public: number;
    private: number;
    lowStock: number;
  };
  onCreateClick: () => void;
  onBulkUploadClick: () => void;
  tenantId?: string;
}

/**
 * Header component for items page
 * Displays quick stats and action buttons
 */
export default function ItemsHeader({
  stats,
  onCreateClick,
  onBulkUploadClick,
  tenantId,
}: ItemsHeaderProps) {
  // Check tier AND role access for features
  const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId || '');
  const hasStorefront = canAccess('storefront', 'canView');
  const storefrontBadge = getFeatureBadgeWithPermission('storefront', 'canView', 'view storefront');
  
  // GMC sync state
  const [gmcStatus, setGmcStatus] = useState<{ isReady: boolean; syncing: boolean; lastResult?: string } | null>(null);
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);

  // Check GMC connection status on mount
  useEffect(() => {
    if (!tenantId) return;
    const checkGmcStatus = async () => {
      try {
        const res = await apiRequest(`/api/google/merchant/sync-status?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setGmcStatus({
            isReady: data.data?.hasGMCConnection && data.data?.hasMerchantLink,
            syncing: false,
          });
        }
      } catch (err) {
        console.error('[ItemsHeader] Failed to check GMC status:', err);
      }
    };
    checkGmcStatus();
  }, [tenantId]);

  // Handle sync to Google
  const handleSyncToGoogle = async () => {
    if (!tenantId || syncingToGoogle) return;
    setSyncingToGoogle(true);
    setGmcStatus(prev => prev ? { ...prev, syncing: true, lastResult: undefined } : null);
    try {
      const res = await apiRequest(`/api/google/merchant/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGmcStatus(prev => prev ? { 
          ...prev, 
          syncing: false, 
          lastResult: `✓ ${data.data?.synced || 0} products synced` 
        } : null);
      } else {
        setGmcStatus(prev => prev ? { 
          ...prev, 
          syncing: false, 
          lastResult: `✗ ${data.message || 'Sync failed'}` 
        } : null);
      }
    } catch (err) {
      setGmcStatus(prev => prev ? { ...prev, syncing: false, lastResult: '✗ Sync error' } : null);
    } finally {
      setSyncingToGoogle(false);
    }
  };
  
  return (
    <div className="mb-6" suppressHydrationWarning>
      {/* Quick Stats Dashboard with Icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Products */}
        <div className="bg-white dark:bg-neutral-100 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Products</p>
              <p className="text-2xl font-bold text-neutral-900 ">{stats.total}</p>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active */}
        <div className="bg-white dark:bg-neutral-100 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active</p>
              <p className="text-2xl font-bold text-neutral-900 ">{stats.active}</p>
            </div>
            <div className="h-12 w-12 bg-info rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Inactive */}
        <div className={`p-4 rounded-lg border ${stats.inactive > 0 ? 'bg-neutral-50 border-neutral-300' : 'bg-white dark:bg-neutral-100 border-neutral-200 dark:border-neutral-700 '}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Inactive</p>
              <p className={`text-2xl font-bold ${stats.inactive > 0 ? 'text-neutral-700' : 'text-neutral-900 '}`}>
                {stats.inactive}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stats.inactive > 0 ? 'bg-neutral-400' : 'bg-neutral-200'}`}>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Public */}
        <div className="bg-white dark:bg-neutral-100 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Public</p>
              <p className="text-2xl font-bold text-neutral-900 ">{stats.public}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div className={`p-4 rounded-lg border ${stats.lowStock > 0 ? 'bg-warning-50 border-warning-200' : 'bg-white dark:bg-neutral-100 border-neutral-200 dark:border-neutral-700'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Low Stock</p>
              <p className={`text-2xl font-bold ${stats.lowStock > 0 ? 'text-warning' : 'text-neutral-900 '}`}>
                {stats.lowStock}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stats.lowStock > 0 ? 'bg-warning' : 'bg-neutral-200'}`}>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Organized by priority: Core → Secondary → Preview */}
      <div className="flex flex-wrap gap-3">
        {/* CORE ACTIONS - Creating products */}
        <Button 
          onClick={onCreateClick} 
          variant="primary"
          title="Add a new product manually"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </Button>

        {tenantId && (
          <Button 
            onClick={() => window.location.href = `/t/${tenantId}/scan`}
            variant="secondary"
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0"
            title="Scan or enter barcodes to quickly add products with auto-filled details"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan Products
          </Button>
        )}

        {/* SECONDARY ACTIONS - Batch operations and onboarding */}
        <Button 
          onClick={onBulkUploadClick} 
          variant="secondary"
          title="Upload multiple products at once via CSV or spreadsheet"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Bulk Upload
        </Button>

        {tenantId && (
          <Button 
            onClick={() => window.location.href = `/t/${tenantId}/quick-start`}
            variant="secondary"
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
            title="Get started with guided setup and tips"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Start
          </Button>
        )}

        {/* INTEGRATIONS - Sync with POS systems */}
        {tenantId && (
          <Button 
            onClick={() => window.location.href = `/t/${tenantId}/settings/integrations/clover`}
            variant="secondary"
            className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white border-0"
            title="Sync inventory with Clover POS - import products or keep them in sync"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Clover Sync
          </Button>
        )}

        {/* CATEGORIES - Manage product categories */}
        {tenantId && (
          <Button 
            onClick={() => window.location.href = `/t/${tenantId}/categories`}
            variant="secondary"
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0"
            title="Organize products into categories for better navigation and Google Business Profile sync"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Categories
          </Button>
        )}

        {/* GOOGLE SYNC - Only show when GMC is connected */}
        {tenantId && gmcStatus?.isReady && (
          <Button 
            onClick={handleSyncToGoogle}
            variant="secondary"
            disabled={syncingToGoogle}
            className="bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600 text-white border-0"
            title="Sync public products to Google Merchant Center for Google Shopping listings"
          >
            {syncingToGoogle ? (
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {syncingToGoogle ? 'Syncing...' : 'Sync to Google'}
            {gmcStatus?.lastResult && (
              <span className={`ml-2 text-xs ${gmcStatus.lastResult.startsWith('✓') ? 'text-green-200' : 'text-red-200'}`}>
                {gmcStatus.lastResult}
              </span>
            )}
          </Button>
        )}

        {/* PREVIEW - View storefront (last) */}
        {tenantId && (
          <Button 
            onClick={() => hasStorefront ? window.open(`/tenant/${tenantId}`, '_blank') : undefined} 
            variant="secondary"
            className={storefrontBadge ? 'opacity-60 cursor-not-allowed' : ''}
            title={storefrontBadge?.tooltip || "Preview how your products look on your public storefront"}
            disabled={!!storefrontBadge}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Storefront
            {storefrontBadge && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${storefrontBadge.colorClass} text-white font-semibold`}>
                {storefrontBadge.text}
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
