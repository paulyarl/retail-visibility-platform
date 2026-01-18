"use client";

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import TenantSKUPrefix from './TenantSKUPrefix';
import { Button, Badge } from '@/components/ui';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

interface StoreInventoryHeaderProps {
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
  tenantId: string;
}

interface TenantInfo {
  name: string;
  logo?: string;
  subdomain?: string;
}

/**
 * Enhanced header component for items page with store branding
 * Displays store name, logo, and inventory stats
 */
export default function StoreInventoryHeader({
  stats,
  onCreateClick,
  onBulkUploadClick,
  tenantId,
}: StoreInventoryHeaderProps) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check tier AND role access for features
  const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
  const hasStorefront = canAccess('storefront', 'canView');
  const storefrontBadge = getFeatureBadgeWithPermission('storefront', 'canView', 'view storefront');

  // Fetch tenant information for branding
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        // Fetch tenant basic info
        const tenantRes = await apiRequest(`/api/tenants/${tenantId}`);
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          
          // Fetch business profile for logo
          let logoUrl = null;
          try {
            const profileRes = await apiRequest(`/api/tenant/profile?tenant_id=${tenantId}`);
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              logoUrl = profileData.logo_url;
            }
          } catch (profileError) {
            console.error('Failed to fetch business profile:', profileError);
          }
          
          setTenantInfo({
            name: tenantData.name,
            logo: logoUrl, // Use logo from business profile
            subdomain: tenantData.subdomain,
          });
        }
      } catch (error) {
        console.error('Failed to fetch tenant info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      fetchTenantInfo();
    }
  }, [tenantId]);

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
            syncing: data.data?.syncing || false,
            lastResult: data.data?.lastResult,
          });
        }
      } catch (error) {
        console.error('Failed to check GMC status:', error);
      }
    };

    checkGmcStatus();
  }, [tenantId]);

  const handleGoogleSync = async () => {
    if (!tenantId || syncingToGoogle) return;
    
    setSyncingToGoogle(true);
    try {
      const res = await apiRequest(`/api/google/merchant/sync?tenantId=${tenantId}`, {
        method: 'POST',
      });
      
      if (res.ok) {
        const data = await res.json();
        setGmcStatus(prev => prev ? ({
          ...prev,
          syncing: false,
          lastResult: data.success ? 'Sync completed successfully' : 'Sync failed',
        }) : null);
      }
    } catch (error) {
      console.error('Google sync failed:', error);
      setGmcStatus(prev => prev ? ({
        ...prev,
        syncing: false,
        lastResult: 'Sync failed',
      }) : null);
    } finally {
      setSyncingToGoogle(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-neutral-200 rounded w-1/2 mb-6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Store Branding Header */}
      <div className="flex items-center gap-4 mb-6">
        {tenantInfo?.logo ? (
          <img
            src={tenantInfo.logo}
            alt={tenantInfo.name}
            className="h-16 w-16 rounded-lg object-cover border-2 border-neutral-200"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {tenantInfo?.name?.charAt(0)?.toUpperCase() || 'S'}
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
            {tenantInfo?.name || 'Store'} Inventory
            {hasStorefront && storefrontBadge && (
              <Badge variant="default" className="text-xs">
                {typeof storefrontBadge === 'string' ? storefrontBadge : 'Storefront'}
              </Badge>
            )}
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mt-1">
            Manage what's on your shelf and make it visible online
          </p>
          {tenantInfo?.subdomain && (
            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
              Storefront: {tenantInfo.subdomain}.visibleshelf.com
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button
          onClick={onCreateClick}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          Add Product
        </Button>
        
        <Button
          onClick={onBulkUploadClick}
          variant="outline"
          className="border-neutral-300 dark:border-neutral-600"
        >
          Bulk Upload
        </Button>

        {hasStorefront && (
          <Button
            onClick={() => window.open(`/tenant/${tenantId}`, '_blank')}
            variant="outline"
            className="border-success-300 text-success-700 hover:bg-success-50"
          >
            View Storefront
          </Button>
        )}

        {gmcStatus?.isReady && (
          <Button
            onClick={handleGoogleSync}
            disabled={syncingToGoogle || gmcStatus.syncing}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {syncingToGoogle || gmcStatus.syncing ? 'Syncing...' : 'Sync to Google'}
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Products */}
        <div className="bg-white dark:bg-neutral-100 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Products</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
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
              <p className="text-2xl font-bold text-neutral-900">{stats.active}</p>
            </div>
            <div className="h-12 w-12 bg-success rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Inactive */}
        <div className={`p-4 rounded-lg border ${stats.inactive > 0 ? 'bg-neutral-50 border-neutral-300' : 'bg-white dark:bg-neutral-100 border-neutral-200 dark:border-neutral-700'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Inactive</p>
              <p className={`text-2xl font-bold ${stats.inactive > 0 ? 'text-neutral-700' : 'text-neutral-900'}`}>
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
              <p className="text-2xl font-bold text-neutral-900">{stats.public}</p>
            </div>
            <div className="h-12 w-12 bg-info rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant SKU Prefix */}
      <TenantSKUPrefix />
    </div>
  );
}
