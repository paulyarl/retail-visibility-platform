'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { googleIntegrationService } from '@/services/GoogleIntegrationService';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import {
  CheckCircle,
  Circle,
  RefreshCw,
  AlertTriangle,
  Store,
  ShoppingBag,
  Link as LinkIcon,
  Unlink,
  Lock,
  LayoutGrid,
  Package,
  Settings as SettingsIcon,
  ExternalLink,
} from 'lucide-react';
import OverviewTab from './tabs/OverviewTab';
import ProductsTab from './tabs/ProductsTab';
import BusinessProfileTab from './tabs/BusinessProfileTab';
import SettingsTab from './tabs/SettingsTab';

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

type TabId = 'overview' | 'products' | 'business-profile' | 'settings';

export default function GoogleIntegrationsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading, accessReason, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [gbpStatus, setGbpStatus] = useState<GBPStatus | null>(null);
  const [gmcStatus, setGmcStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectingGBP, setConnectingGBP] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [gmcSyncResult, setGmcSyncResult] = useState<any>(null);
  const [savingGmcSettings, setSavingGmcSettings] = useState(false);
  const [gmcSettingsResult, setGmcSettingsResult] = useState<any>(null);
  const [validationIssuesCount, setValidationIssuesCount] = useState(0);

  async function fetchSetupStatus() {
    try {
      setLoading(true);
      const data = await platformHomeService.getGoogleFeedJobsSetupStatus(tenantId);
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
      const data = await platformHomeService.getGoogleGBPStatus(tenantId);
      setGbpStatus(data);
    } catch (err) {
      console.error('Failed to fetch GBP status:', err);
    }
  }

  async function fetchGMCStatus() {
    try {
      const data = await platformHomeService.getGoogleMerchantSyncStatus(tenantId);
      setGmcStatus(data.data);
    } catch (err) {
      console.error('Failed to fetch GMC status:', err);
    }
  }

  async function fetchValidationIssuesCount() {
    try {
      const { gmcValidationService } = await import('@/services/GMCValidationService');
      const report = await gmcValidationService.getValidationReport(tenantId);
      setValidationIssuesCount(report ? report.itemsWithErrors + report.itemsWithWarnings : 0);
    } catch {
      setValidationIssuesCount(0);
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchSetupStatus();
      fetchGBPStatus();
      fetchGMCStatus();
      fetchValidationIssuesCount();
    }
  }, [tenantId]);

  async function handleConnectGoogle() {
    setConnecting(true);
    try {
      const url = await googleIntegrationService.getOAuthAuthorizeUrl(tenantId);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setConnecting(false);
    }
  }

  async function handleConnectGBP() {
    setConnectingGBP(true);
    try {
      const url = await googleIntegrationService.getGBPAuthorizeUrl(tenantId);
      window.location.href = url;
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
      await platformHomeService.disconnectGoogleOAuth(tenantId);
      await fetchSetupStatus();
      await fetchGMCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleDisconnectGBP() {
    if (!confirm('Are you sure you want to disconnect Google Business Profile?')) {
      return;
    }
    try {
      await platformHomeService.disconnectGoogleGBP(tenantId);
      await fetchGBPStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleSyncAllProducts() {
    try {
      setSyncingProducts(true);
      const data = await platformHomeService.syncGoogleMerchant(tenantId);
      setGmcSyncResult(data);
      if (data.success) {
        await fetchGMCStatus();
      }
    } catch (err) {
      console.error('Failed to sync products to GMC:', err);
      setGmcSyncResult({ success: false, message: 'Failed to sync products' });
    } finally {
      setSyncingProducts(false);
    }
  }

  async function handleSaveGMCSettings(settings: { fulfillmentMode: string; pickupMethod: string; pickupSla: string }) {
    try {
      setSavingGmcSettings(true);
      const data = await platformHomeService.updateGoogleMerchantSettings(tenantId, settings);
      setGmcSettingsResult(data);
      if (data?.success) {
        setGmcStatus(data.data);
      }
    } catch (err) {
      setGmcSettingsResult({ success: false, message: 'Failed to save settings' });
    } finally {
      setSavingGmcSettings(false);
    }
  }

  if (accessLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-8"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
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

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
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

  const tabs: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'business-profile', label: 'Business Profile', icon: Store },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto dark:bg-neutral-800">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
          <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Settings</Link>
          <span>/</span>
          <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Integrations</Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">Google</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              Google Integrations
            </h1>
            <p className="text-neutral-600 dark:text-gray-300">
              Connect Google Merchant Center and Business Profile to sync products and business info
            </p>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          tenantId={tenantId}
          setupStatus={setupStatus}
          gbpStatus={gbpStatus}
          gmcStatus={gmcStatus}
          validationIssuesCount={validationIssuesCount}
          onConnectGoogle={handleConnectGoogle}
          onConnectGBP={handleConnectGBP}
          onDisconnect={handleDisconnect}
          onDisconnectGBP={handleDisconnectGBP}
          onRefresh={() => {
            fetchSetupStatus();
            fetchGBPStatus();
            fetchGMCStatus();
            fetchValidationIssuesCount();
          }}
          connecting={connecting}
          connectingGBP={connectingGBP}
        />
      )}

      {activeTab === 'products' && (
        <ProductsTab
          tenantId={tenantId}
          gmcConnected={setupStatus?.isReady || false}
          hasMerchantLink={gmcStatus?.hasMerchantLink || false}
          onSyncAll={handleSyncAllProducts}
          syncing={syncingProducts}
          syncResult={gmcSyncResult}
        />
      )}

      {activeTab === 'business-profile' && (
        <BusinessProfileTab
          tenantId={tenantId}
          gbpConnected={gbpStatus?.isConnected || false}
          onConnectGBP={handleConnectGBP}
          connectingGBP={connectingGBP}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          tenantId={tenantId}
          gmcStatus={gmcStatus}
          onSaveSettings={handleSaveGMCSettings}
          saving={savingGmcSettings}
          saveResult={gmcSettingsResult}
        />
      )}
    </div>
  );
}
