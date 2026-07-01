'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Store,
  Link as LinkIcon,
  Clock,
  MapPin,
  Building2,
  Tag,
  Info,
} from 'lucide-react';

interface BusinessProfileTabProps {
  tenantId: string;
  gbpConnected: boolean;
  onConnectGBP: () => void;
  connectingGBP: boolean;
}

export default function BusinessProfileTab({
  tenantId,
  gbpConnected,
  onConnectGBP,
  connectingGBP,
}: BusinessProfileTabProps) {
  const [linkedLocation, setLinkedLocation] = useState<any>(null);
  const [syncSummary, setSyncSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!tenantId || !gbpConnected) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [locData, summaryData] = await Promise.all([
          platformHomeService.getGoogleBusinessLinkedLocation(tenantId),
          platformHomeService.getGoogleBusinessSyncTracking(tenantId).catch(() => null),
        ]);
        setLinkedLocation(locData?.data?.location || null);
        setSyncSummary(summaryData?.data || null);
      } catch (err) {
        console.error('Failed to fetch GBP data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tenantId, gbpConnected]);

  async function handleSyncBusinessInfo() {
    try {
      setSyncing(true);
      const result = await platformHomeService.syncGoogleBusiness(tenantId);
      setSyncResult(result);
      // Refresh data
      const [locData, summaryData] = await Promise.all([
        platformHomeService.getGoogleBusinessLinkedLocation(tenantId),
        platformHomeService.getGoogleBusinessSyncTracking(tenantId).catch(() => null),
      ]);
      setLinkedLocation(locData?.data?.location || null);
      setSyncSummary(summaryData?.data || null);
    } catch (err) {
      console.error('Failed to sync business info:', err);
      setSyncResult({ success: false, message: 'Failed to sync business info' });
    } finally {
      setSyncing(false);
    }
  }

  if (!gbpConnected) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
        <Store className="w-12 h-12 text-blue-400 mx-auto mb-3" />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Google Business Profile Not Connected
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Connect your Google Business Profile to sync store hours, location, and business info to Google Maps and Search.
        </p>
        <button
          onClick={onConnectGBP}
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
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const syncCategories = syncSummary?.categories || [];
  const syncedCount = syncCategories.filter((c: any) => c.syncStatus === 'success').length;
  const pendingCount = syncCategories.filter((c: any) => c.syncStatus === 'pending').length;
  const failedCount = syncCategories.filter((c: any) => c.syncStatus === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Sync Result */}
      {syncResult && (
        <div className={`p-3 rounded-lg text-sm ${
          syncResult.success
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          {syncResult.message || (syncResult.success ? 'Sync completed.' : 'Sync failed.')}
        </div>
      )}

      {/* Linked Location */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Linked Location</h3>
              <p className="text-sm text-neutral-500">
                {linkedLocation ? 'GBP location connected' : 'No location linked yet'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncBusinessInfo}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync Business Info'}
          </button>
        </div>

        {linkedLocation ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Business Name</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {linkedLocation.title || linkedLocation.name || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Address</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {linkedLocation.address?.formattedAddress || linkedLocation.storefrontAddress?.addressLines?.join(', ') || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Categories</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {linkedLocation.categories?.primaryCategory?.displayName || linkedLocation.primaryCategory?.displayName || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-500">Hours</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {linkedLocation.regularHours ? 'Configured' : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              No GBP location is linked. Link a location from the Sync Status page to enable business info sync.
            </p>
            <Link
              href={`/t/${tenantId}/settings/integrations/google/sync-status`}
              className="text-sm text-blue-600 hover:underline"
            >
              Go to Sync Status →
            </Link>
          </div>
        )}
      </div>

      {/* Sync Tracking Summary */}
      {syncCategories.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Sync Tracking by Category
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{syncedCount}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Synced</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingCount}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{failedCount}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
            </div>
          </div>
          <div className="space-y-2">
            {syncCategories.map((cat: any) => (
              <div key={cat.fieldCategory} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {cat.syncStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : cat.syncStatus === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 capitalize">
                    {cat.fieldCategory}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${
                    cat.syncStatus === 'success' ? 'text-green-600' :
                    cat.syncStatus === 'failed' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {cat.syncStatus}
                  </span>
                  {cat.lastSyncAt && (
                    <p className="text-xs text-neutral-400">
                      {new Date(cat.lastSyncAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/t/${tenantId}/settings/hours`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          <Clock className="w-4 h-4" />
          Manage Hours →
        </Link>
        <Link
          href={`/t/${tenantId}/settings/gbp-category`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          <Tag className="w-4 h-4" />
          GBP Categories →
        </Link>
        <Link
          href={`/t/${tenantId}/settings/integrations/google/advanced`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Advanced Features →
        </Link>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">What syncs to Google:</p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Business hours (regular and special hours)</li>
              <li>• Store contact information</li>
              <li>• Business description and attributes</li>
              <li>• Holiday closures and temporary hours</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
