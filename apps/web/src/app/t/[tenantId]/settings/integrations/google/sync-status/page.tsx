'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, API_BASE_URL } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { 
  ArrowLeft,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronRight,
  Database,
  Cloud,
  ArrowRight,
  Info,
  Calendar,
  Tag,
  MapPin,
  Building2,
  Store,
  LinkIcon,
  ShoppingBag
} from 'lucide-react';

interface SyncField {
  name: string;
  localValue: string | null;
  googleValue: string | null;
  status: 'synced' | 'local_only' | 'google_only' | 'conflict' | 'not_configured' | 'pending';
  lastSynced: string | null;
  canSync: boolean;
}

interface SyncCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: SyncField[];
  syncEnabled: boolean;
  lastSyncAttempt: string | null;
  syncStatus: 'success' | 'failed' | 'pending' | 'not_configured';
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function GBPSyncStatusPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [loading, setLoading] = useState(true);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [syncCategories, setSyncCategories] = useState<SyncCategory[]>([]);
  const [tenantData, setTenantData] = useState<any>(null);
  const [linkedLocation, setLinkedLocation] = useState<any>(null);
  const [gbpLocations, setGbpLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [linkingLocation, setLinkingLocation] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [gmcStatus, setGmcStatus] = useState<any>(null);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [gmcSyncResult, setGmcSyncResult] = useState<any>(null);
  const [gmcFulfillmentMode, setGmcFulfillmentMode] = useState<'standard' | 'shipping_and_pickup' | 'pickup_only'>('standard');
  const [gmcPickupMethod, setGmcPickupMethod] = useState<'buy' | 'reserve' | 'ship to store' | 'not supported'>('buy');
  const [gmcPickupSla, setGmcPickupSla] = useState<'same day' | 'next day' | '2-day' | '3-day' | '4-day' | '5-day' | '6-day' | '7-day' | 'multi-week'>('same day');
  const [savingGmcSettings, setSavingGmcSettings] = useState(false);
  const [gmcSettingsResult, setGmcSettingsResult] = useState<any>(null);

  useEffect(() => {
    async function fetchSyncStatus() {
      try {
        setLoading(true);

        // Fetch GBP connection status
        const gbpRes = await api.get(`${API_BASE_URL}/api/google/business/status?tenantId=${tenantId}`);
        const gbpData = gbpRes.ok ? await gbpRes.json() : null;
        setGbpConnected(gbpData?.data?.isConnected || false);

        // Fetch tenant profile for local data
        const profileRes = await api.get(`/api/tenant/profile?tenant_id=${tenantId}`);
        const profile = profileRes.ok ? await profileRes.json() : null;
        setTenantData(profile);

        // Fetch business hours
        const hoursRes = await api.get(`/api/business-hours/${tenantId}`);
        const hours = hoursRes.ok ? await hoursRes.json() : null;

        // Fetch linked GBP location
        const linkedLocRes = await api.get(`${API_BASE_URL}/api/google/business/linked-location?tenantId=${tenantId}`);
        const linkedLocData = linkedLocRes.ok ? await linkedLocRes.json() : null;
        setLinkedLocation(linkedLocData?.data?.location || null);

        // Fetch tenant for location status
        const tenantRes = await api.get(`${API_BASE_URL}/api/tenants/${tenantId}`);
        const tenant = tenantRes.ok ? await tenantRes.json() : null;

        // Determine if we have local business info data (check all possible field names)
        const hasBusinessInfo = !!(
          profile?.business_name || profile?.businessName || profile?.name ||
          profile?.phone_number || profile?.phoneNumber || profile?.phone ||
          profile?.website || 
          profile?.address_line1 || profile?.addressLine1 || profile?.address
        );
        const hasLocationLinked = !!linkedLocData?.data?.location;
        
        // Determine business info sync status
        // - 'pending' if we have local data (ready to sync)
        // - 'not_configured' if no local data
        const businessInfoStatus: 'success' | 'failed' | 'pending' | 'not_configured' = hasBusinessInfo 
          ? 'pending'
          : 'not_configured';

        // Build sync categories using correct field names from /api/tenant/profile
        const categories: SyncCategory[] = [
          {
            id: 'business_info',
            label: 'Business Information',
            icon: <Building2 className="w-5 h-5" />,
            syncEnabled: hasLocationLinked,
            lastSyncAttempt: null,
            syncStatus: businessInfoStatus,
            fields: [
              {
                name: 'Business Name',
                localValue: profile?.business_name || null,
                googleValue: null, // Would come from GBP API
                status: profile?.business_name ? 'pending' : 'not_configured',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
              {
                name: 'Phone Number',
                localValue: profile?.phone_number || null,
                googleValue: null,
                status: profile?.phone_number ? 'pending' : 'not_configured',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
              {
                name: 'Website',
                localValue: profile?.website || null,
                googleValue: null,
                status: profile?.website ? 'pending' : 'not_configured',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
              {
                name: 'Address',
                localValue: profile?.address_line1 
                  ? `${profile.address_line1}${profile.address_line2 ? ', ' + profile.address_line2 : ''}, ${profile.city || ''}, ${profile.state || ''} ${profile.postal_code || ''}`.trim()
                  : null,
                googleValue: null,
                status: profile?.address_line1 ? 'pending' : 'not_configured',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
              {
                name: 'Description',
                localValue: profile?.business_description 
                  ? (profile.business_description.length > 50 ? profile.business_description.substring(0, 50) + '...' : profile.business_description)
                  : null,
                googleValue: null,
                status: profile?.business_description ? 'pending' : 'not_configured',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
            ],
          },
          {
            id: 'categories',
            label: 'Business Categories',
            icon: <Tag className="w-5 h-5" />,
            syncEnabled: false,
            lastSyncAttempt: profile?.gbpCategoryLastMirrored || null,
            syncStatus: profile?.gbpCategorySyncStatus === 'synced' ? 'success' : 'not_configured',
            fields: [
              {
                name: 'Primary Category',
                localValue: profile?.gbpCategoryName || null,
                googleValue: null, // Would come from GBP API
                status: profile?.gbpCategoryName ? 'local_only' : 'not_configured',
                lastSynced: profile?.gbpCategoryLastMirrored || null,
                canSync: false,
              },
              {
                name: 'Secondary Categories',
                localValue: profile?.gbpSecondaryCategories?.length 
                  ? `${profile.gbpSecondaryCategories.length} categories` 
                  : null,
                googleValue: null,
                status: profile?.gbpSecondaryCategories?.length ? 'local_only' : 'not_configured',
                lastSynced: null,
                canSync: false,
              },
            ],
          },
          {
            id: 'hours',
            label: 'Business Hours',
            icon: <Clock className="w-5 h-5" />,
            syncEnabled: true, // Hours sync is implemented
            lastSyncAttempt: hours?.data?.last_synced_at || null,
            syncStatus: hours?.data?.last_synced_at ? 'success' : 'pending',
            fields: [
              {
                name: 'Regular Hours',
                localValue: hours?.data?.periods?.length ? `${hours.data.periods.length} periods configured` : 'Not set',
                googleValue: null,
                status: hours?.data?.last_synced_at ? 'synced' : 'local_only',
                lastSynced: hours?.data?.last_synced_at || null,
                canSync: true,
              },
              {
                name: 'Special Hours',
                localValue: hours?.specialHours?.length ? `${hours.specialHours.length} special dates` : 'None',
                googleValue: null,
                status: hours?.data?.last_synced_at ? 'synced' : 'local_only',
                lastSynced: hours?.data?.last_synced_at || null,
                canSync: true,
              },
              {
                name: 'Timezone',
                localValue: hours?.data?.timezone || 'Not set',
                googleValue: null,
                status: hours?.data?.last_synced_at ? 'synced' : 'local_only',
                lastSynced: null,
                canSync: true,
              },
            ],
          },
          {
            id: 'location',
            label: 'Location & Map',
            icon: <MapPin className="w-5 h-5" />,
            syncEnabled: !!linkedLocData?.data?.location,
            lastSyncAttempt: null,
            syncStatus: (profile?.latitude && profile?.longitude) ? 'success' : 'not_configured',
            fields: [
              {
                name: 'Coordinates',
                localValue: profile?.latitude && profile?.longitude 
                  ? `${profile.latitude}, ${profile.longitude}` 
                  : null,
                googleValue: null,
                status: (profile?.latitude && profile?.longitude) ? 'local_only' : 'not_configured',
                lastSynced: null,
                canSync: !!linkedLocData?.data?.location,
              },
              {
                name: 'Display Map',
                localValue: profile?.display_map ? 'Enabled' : 'Disabled',
                googleValue: null,
                status: 'local_only',
                lastSynced: null,
                canSync: false,
              },
              {
                name: 'Map Privacy',
                localValue: profile?.map_privacy_mode || 'precise',
                googleValue: null,
                status: 'local_only',
                lastSynced: null,
                canSync: false,
              },
            ],
          },
          {
            id: 'store_status',
            label: 'Store Status (Open/Closed)',
            icon: <Store className="w-5 h-5" />,
            syncEnabled: hasLocationLinked,
            lastSyncAttempt: null,
            // Store status is always available locally, show pending if location linked
            syncStatus: hasLocationLinked ? 'pending' : 'pending',
            fields: [
              {
                name: 'Location Status',
                localValue: tenant?.locationStatus || tenant?.location_status || 'active',
                googleValue: hasLocationLinked ? 'Linked' : null,
                status: hasLocationLinked ? 'pending' : 'pending',
                lastSynced: null,
                canSync: hasLocationLinked,
              },
              {
                name: 'GBP Location',
                localValue: linkedLocData?.data?.location?.name || 'Not linked',
                googleValue: linkedLocData?.data?.location?.locationId || null,
                status: hasLocationLinked ? 'synced' : 'not_configured',
                lastSynced: linkedLocData?.data?.location?.lastFetched || null,
                canSync: true,
              },
            ],
          },
        ];

        setSyncCategories(categories);
      } catch (error) {
        console.error('Failed to fetch sync status:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      fetchSyncStatus();
    }
  }, [tenantId]);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'synced':
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'local_only':
      case 'pending':
        return <Database className="w-4 h-4 text-amber-600" />;
      case 'google_only':
        return <Cloud className="w-4 h-4 text-blue-600" />;
      case 'conflict':
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <XCircle className="w-4 h-4 text-neutral-400" />;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'success':
        return 'Last sync successful';
      case 'local_only':
        return 'Local only';
      case 'pending':
        return 'Pending sync';
      case 'google_only':
        return 'Google only';
      case 'conflict':
        return 'Conflict';
      case 'failed':
        return 'Sync failed';
      default:
        return 'Not configured';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'synced':
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'local_only':
      case 'pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
      case 'google_only':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'conflict':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      default:
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';
    }
  }

  // Fetch GBP locations for linking
  async function fetchGBPLocations() {
    try {
      setLoadingLocations(true);
      const res = await api.get(`${API_BASE_URL}/api/google/business/locations?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setGbpLocations(data.data?.locations || []);
        setShowLocationSelector(true);
      }
    } catch (error) {
      console.error('Failed to fetch GBP locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  }

  // Link a GBP location
  async function handleLinkLocation(location: any) {
    try {
      setLinkingLocation(true);
      const res = await api.post(`${API_BASE_URL}/api/google/business/link-location`, {
        tenantId,
        locationId: location.locationId,
        locationName: location.name,
        address: location.address,
      });
      
      if (res.ok) {
        setLinkedLocation({
          locationId: location.locationId,
          name: location.name,
          address: location.address,
        });
        setShowLocationSelector(false);
        // Refresh the page data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to link location:', error);
    } finally {
      setLinkingLocation(false);
    }
  }

  // Sync all business info to Google
  async function handleSyncAllToGoogle() {
    try {
      setSyncing(true);
      setSyncResult(null);
      
      const res = await api.post(`${API_BASE_URL}/api/google/business/sync`, {
        tenantId,
      });
      
      const data = await res.json();
      setSyncResult(data);
      
      if (data.success) {
        // Refresh comparison after sync
        setTimeout(() => fetchComparison(), 1500);
      }
    } catch (error) {
      console.error('Failed to sync to Google:', error);
      setSyncResult({
        success: false,
        message: 'Failed to sync to Google. Please try again.',
      });
    } finally {
      setSyncing(false);
    }
  }

  // Fetch comparison between local and Google data
  async function fetchComparison() {
    try {
      setLoadingComparison(true);
      const res = await api.get(`${API_BASE_URL}/api/google/business/compare?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setComparison(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
    } finally {
      setLoadingComparison(false);
    }
  }

  // Auto-fetch comparison when location is linked
  useEffect(() => {
    if (linkedLocation && gbpConnected && !loading) {
      fetchComparison();
    }
  }, [linkedLocation, gbpConnected, loading]);

  // Fetch GMC status
  useEffect(() => {
    async function fetchGMCStatus() {
      try {
        const res = await api.get(`${API_BASE_URL}/api/google/merchant/sync-status?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setGmcStatus(data.data);

          // Initialize pickup settings
          setGmcFulfillmentMode((data.data?.fulfillmentMode as any) || (data.data?.pickupOnly ? 'pickup_only' : 'standard'));
          setGmcPickupMethod((data.data?.pickupMethod as any) || 'buy');
          setGmcPickupSla((data.data?.pickupSla as any) || 'same day');
        }
      } catch (error) {
        console.error('Failed to fetch GMC status:', error);
      }
    }
    if (tenantId && !loading) {
      fetchGMCStatus();
    }
  }, [tenantId, loading]);

  async function saveGMCSettings(next: { fulfillmentMode: string; pickupMethod: string; pickupSla: string }) {
    try {
      if (!tenantId) return;
      setSavingGmcSettings(true);
      setGmcSettingsResult(null);

      const res = await api.patch(`${API_BASE_URL}/api/google/merchant/settings`, {
        tenantId,
        fulfillmentMode: next.fulfillmentMode,
        pickupMethod: next.pickupMethod,
        pickupSla: next.pickupSla,
      });

      const data = await res.json();
      setGmcSettingsResult(data);
      if (res.ok && data?.success) {
        setGmcStatus(data.data);
        setGmcFulfillmentMode((data.data?.fulfillmentMode as any) || (data.data?.pickupOnly ? 'pickup_only' : 'standard'));
        setGmcPickupMethod((data.data?.pickupMethod as any) || 'buy');
        setGmcPickupSla((data.data?.pickupSla as any) || 'same day');
      }
    } catch (error) {
      console.error('Failed to save GMC settings:', error);
      setGmcSettingsResult({ success: false, message: 'Failed to save settings. Please try again.' });
    } finally {
      setSavingGmcSettings(false);
    }
  }

  // Sync products to GMC
  async function handleSyncProductsToGMC() {
    try {
      setSyncingProducts(true);
      setGmcSyncResult(null);
      
      const res = await api.post(`${API_BASE_URL}/api/google/merchant/sync`, {
        tenantId,
      });
      
      const data = await res.json();
      setGmcSyncResult(data);
      
      // Refresh GMC status after sync
      if (data.success) {
        const statusRes = await api.get(`${API_BASE_URL}/api/google/merchant/sync-status?tenantId=${tenantId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setGmcStatus(statusData.data);
        }
      }
    } catch (error) {
      console.error('Failed to sync products to GMC:', error);
      setGmcSyncResult({
        success: false,
        message: 'Failed to sync products. Please try again.',
      });
    } finally {
      setSyncingProducts(false);
    }
  }

  if (accessLoading || loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Settings
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Integrations
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations/google`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Google
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-neutral-900 dark:text-neutral-100">Sync Status</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <Link 
          href={`/t/${tenantId}/settings/integrations/google`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Integrations
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Google Business Profile Sync Status
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          View the sync status between your local data and Google Business Profile
        </p>
      </div>

      {/* Connection Status */}
      <div className={`mb-6 p-4 rounded-lg border ${
        gbpConnected 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}>
        <div className="flex items-center gap-3">
          {gbpConnected ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
          <div>
            <p className={`font-medium ${gbpConnected ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
              {gbpConnected ? 'Google Business Profile Connected' : 'Google Business Profile Not Connected'}
            </p>
            <p className={`text-sm ${gbpConnected ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {gbpConnected 
                ? 'Your account is connected. Some sync features require additional setup.' 
                : 'Connect your Google Business Profile to enable syncing.'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Update Your Business Information
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Edit your business profile to ensure accurate data syncs to Google
            </p>
          </div>
          <Link
            href={`/t/${tenantId}/settings/tenant`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Edit Business Profile
          </Link>
        </div>
      </div>

      {/* Sync Direction Legend */}
      <div className="mb-6 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
        <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Sync Status Legend
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-neutral-600 dark:text-neutral-400">Synced to Google</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-600" />
            <span className="text-neutral-600 dark:text-neutral-400">Local only (not synced)</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-600" />
            <span className="text-neutral-600 dark:text-neutral-400">Google only</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600 dark:text-neutral-400">Not configured</span>
          </div>
        </div>
      </div>

      {/* GBP Location Linking */}
      {gbpConnected && (
        <div className="mb-6 bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  GBP Location Link
                </h3>
                <p className="text-sm text-neutral-500">
                  {linkedLocation 
                    ? `Linked to: ${linkedLocation.name}` 
                    : 'Link a GBP location to enable status sync'}
                </p>
              </div>
            </div>
            {linkedLocation ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Linked
              </span>
            ) : (
              <button
                onClick={fetchGBPLocations}
                disabled={loadingLocations}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingLocations ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
                {loadingLocations ? 'Loading...' : 'Link Location'}
              </button>
            )}
          </div>

          {/* Location Selector */}
          {showLocationSelector && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Select GBP Location to Link
              </h4>
              {gbpLocations.length === 0 ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  No GBP locations found. Make sure you have locations set up in your Google Business Profile.
                </p>
              ) : (
                <div className="space-y-2">
                  {gbpLocations.map((loc) => (
                    <button
                      key={loc.locationId}
                      onClick={() => handleLinkLocation(loc)}
                      disabled={linkingLocation}
                      className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-neutral-500" />
                        <div className="text-left">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {loc.name}
                          </p>
                          <p className="text-xs text-neutral-500">{loc.address || loc.locationId}</p>
                        </div>
                      </div>
                      {linkingLocation ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-purple-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLocationSelector(false)}
                className="mt-3 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Cancel
              </button>
            </div>
          )}

          {linkedLocation && (
            <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <p>✅ Store status changes will automatically sync to Google</p>
              <p className="text-xs mt-1">Location ID: {linkedLocation.locationId}</p>
            </div>
          )}
        </div>
      )}

      {/* Sync All Business Info Button */}
      {gbpConnected && linkedLocation && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Sync All Business Info to Google
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Push your business name, phone, website, address, description, and categories to Google Business Profile
              </p>
            </div>
            <button
              onClick={handleSyncAllToGoogle}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg"
            >
              {syncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5" />
              )}
              {syncing ? 'Syncing...' : 'Sync to Google'}
            </button>
          </div>
          {syncResult && (
            <div className={`mt-3 p-3 rounded-lg ${
              syncResult.success 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              <p className="font-medium">{syncResult.message}</p>
              {syncResult.data?.syncedFields?.length > 0 && (
                <p className="text-sm mt-1">Synced: {syncResult.data.syncedFields.join(', ')}</p>
              )}
              {syncResult.data?.failedFields?.length > 0 && (
                <p className="text-sm mt-1">Failed: {syncResult.data.failedFields.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live Comparison: Local vs Google */}
      {gbpConnected && linkedLocation && (
        <div className="mb-6 bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <RefreshCw className={`w-5 h-5 text-indigo-600 ${loadingComparison ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Live Comparison: Local vs Google
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {comparison ? `Last fetched: ${new Date(comparison.googleData?.lastFetchedAt).toLocaleString()}` : 'Fetching from Google...'}
                  </p>
                </div>
              </div>
              <button
                onClick={fetchComparison}
                disabled={loadingComparison}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingComparison ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Summary badges */}
            {comparison && (
              <div className="flex items-center gap-3 mt-3">
                {comparison.summary.synced > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    ✓ {comparison.summary.synced} Synced
                  </span>
                )}
                {comparison.summary.conflicts > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                    ⚠ {comparison.summary.conflicts} Conflicts
                  </span>
                )}
                {comparison.summary.localOnly > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                    📤 {comparison.summary.localOnly} Local Only
                  </span>
                )}
                {comparison.summary.googleOnly > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                    📥 {comparison.summary.googleOnly} Google Only
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Comparison table */}
          {comparison && (
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider">
                    <th className="pb-3">Field</th>
                    <th className="pb-3">
                      <div className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        Platform (Local)
                      </div>
                    </th>
                    <th className="pb-3">
                      <div className="flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        Google
                      </div>
                    </th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {comparison.fields.map((field: any) => (
                    <tr key={field.field}>
                      <td className="py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {field.label}
                      </td>
                      <td className="py-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {field.localValue || <span className="text-neutral-400 italic">Not set</span>}
                      </td>
                      <td className="py-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {field.googleValue || <span className="text-neutral-400 italic">Not set</span>}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          field.status === 'synced' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                          field.status === 'conflict' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                          field.status === 'local_only' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
                          field.status === 'google_only' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                          'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {field.status === 'synced' && <CheckCircle className="w-3 h-3" />}
                          {field.status === 'conflict' && <AlertTriangle className="w-3 h-3" />}
                          {field.status === 'local_only' && <Database className="w-3 h-3" />}
                          {field.status === 'google_only' && <Cloud className="w-3 h-3" />}
                          {field.status === 'not_set' && <XCircle className="w-3 h-3" />}
                          <span className="ml-1">
                            {field.status === 'synced' ? 'Synced' :
                             field.status === 'conflict' ? 'Conflict' :
                             field.status === 'local_only' ? 'Local Only' :
                             field.status === 'google_only' ? 'Google Only' :
                             'Not Set'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loadingComparison && !comparison && (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
              <p className="text-neutral-500">Fetching data from Google...</p>
            </div>
          )}
        </div>
      )}

      {/* Google Merchant Center Product Sync */}
      <div className="mb-6 bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Google Merchant Center - Product Feed
                </h3>
                <p className="text-sm text-neutral-500">
                  Sync your products to Google Shopping & Free Listings
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncProductsToGMC}
              disabled={syncingProducts}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {syncingProducts ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingBag className="w-4 h-4" />
              )}
              {syncingProducts ? 'Syncing...' : 'Sync Products'}
            </button>
          </div>
        </div>

        <div className="p-4">
          {gmcStatus ? (
            <div className="space-y-4">
              {/* GMC Connection Status */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {gmcStatus.hasGMCConnection ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={gmcStatus.hasGMCConnection ? 'text-green-700 dark:text-green-300' : 'text-red-600'}>
                    {gmcStatus.hasGMCConnection ? 'GMC Connected' : 'GMC Not Connected'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {gmcStatus.hasMerchantLink ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className={gmcStatus.hasMerchantLink ? 'text-green-700 dark:text-green-300' : 'text-amber-600'}>
                    {gmcStatus.hasMerchantLink ? `Merchant: ${gmcStatus.merchantName}` : 'No Merchant Linked'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {gmcStatus.hasSubdomain ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className={gmcStatus.hasSubdomain ? 'text-green-700 dark:text-green-300' : 'text-amber-600'}>
                    {gmcStatus.hasSubdomain ? `Subdomain: ${gmcStatus.subdomain}` : 'No Subdomain Set'}
                  </span>
                </div>
              </div>

              {/* GMC Settings */}
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">Fulfillment mode</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Choose how you fulfill orders. This controls what attributes we send to Google for each product.
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Google Merchant Center settings may still be required.
                      <a
                        href="https://developers.google.com/shopping-content/reference/rest/v2.1/products"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-600 hover:underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className={`p-3 rounded-lg border cursor-pointer ${
                    gmcFulfillmentMode === 'standard'
                      ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                      : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="gmc_fulfillment_mode"
                        checked={gmcFulfillmentMode === 'standard'}
                        disabled={!gmcStatus.hasGMCConnection || !gmcStatus.hasMerchantLink || savingGmcSettings}
                        onChange={() => {
                          setGmcFulfillmentMode('standard');
                          saveGMCSettings({
                            fulfillmentMode: 'standard',
                            pickupMethod: gmcPickupMethod,
                            pickupSla: gmcPickupSla,
                          });
                        }}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Standard (default)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          We do not send <span className="font-mono">pickupMethod</span>/<span className="font-mono">pickupSla</span>. Shipping/pickup is handled by your Merchant Center configuration.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-lg border cursor-pointer ${
                    gmcFulfillmentMode === 'shipping_and_pickup'
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="gmc_fulfillment_mode"
                        checked={gmcFulfillmentMode === 'shipping_and_pickup'}
                        disabled={!gmcStatus.hasGMCConnection || !gmcStatus.hasMerchantLink || savingGmcSettings}
                        onChange={() => {
                          setGmcFulfillmentMode('shipping_and_pickup');
                          saveGMCSettings({
                            fulfillmentMode: 'shipping_and_pickup',
                            pickupMethod: gmcPickupMethod,
                            pickupSla: gmcPickupSla,
                          });
                        }}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Shipping + Pickup</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          You offer both shipping and in-store pickup. We send <span className="font-mono">pickupMethod</span>/<span className="font-mono">pickupSla</span>.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-lg border cursor-pointer ${
                    gmcFulfillmentMode === 'pickup_only'
                      ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                      : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="gmc_fulfillment_mode"
                        checked={gmcFulfillmentMode === 'pickup_only'}
                        disabled={!gmcStatus.hasGMCConnection || !gmcStatus.hasMerchantLink || savingGmcSettings}
                        onChange={() => {
                          setGmcFulfillmentMode('pickup_only');
                          saveGMCSettings({
                            fulfillmentMode: 'pickup_only',
                            pickupMethod: gmcPickupMethod,
                            pickupSla: gmcPickupSla,
                          });
                        }}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Pickup-only (in-store)</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          You only offer in-store pickup. We send <span className="font-mono">pickupMethod</span>/<span className="font-mono">pickupSla</span>.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Pickup Method
                    </label>
                    <select
                      value={gmcPickupMethod}
                      disabled={gmcFulfillmentMode === 'standard' || savingGmcSettings}
                      onChange={(e) => {
                        const next = e.target.value as any;
                        setGmcPickupMethod(next);
                        saveGMCSettings({
                          fulfillmentMode: gmcFulfillmentMode,
                          pickupMethod: next,
                          pickupSla: gmcPickupSla,
                        });
                      }}
                      className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
                    >
                      <option value="buy">buy</option>
                      <option value="reserve">reserve</option>
                      <option value="ship to store">ship to store</option>
                      <option value="not supported">not supported</option>
                    </select>
                    {gmcFulfillmentMode === 'standard' && (
                      <p className="text-xs text-neutral-500 mt-1">Select Shipping + Pickup or Pickup-only to apply these fields to products.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Pickup SLA
                    </label>
                    <select
                      value={gmcPickupSla}
                      disabled={gmcFulfillmentMode === 'standard' || savingGmcSettings}
                      onChange={(e) => {
                        const next = e.target.value as any;
                        setGmcPickupSla(next);
                        saveGMCSettings({
                          fulfillmentMode: gmcFulfillmentMode,
                          pickupMethod: gmcPickupMethod,
                          pickupSla: next,
                        });
                      }}
                      className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
                    >
                      <option value="same day">same day</option>
                      <option value="next day">next day</option>
                      <option value="2-day">2-day</option>
                      <option value="3-day">3-day</option>
                      <option value="4-day">4-day</option>
                      <option value="5-day">5-day</option>
                      <option value="6-day">6-day</option>
                      <option value="7-day">7-day</option>
                      <option value="multi-week">multi-week</option>
                    </select>
                    {gmcFulfillmentMode === 'standard' && (
                      <p className="text-xs text-neutral-500 mt-1">Select Shipping + Pickup or Pickup-only to apply these fields to products.</p>
                    )}
                  </div>
                </div>

                {gmcSettingsResult && (
                  <div className={`mt-3 p-2 rounded text-sm ${
                    gmcSettingsResult.success
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  }`}>
                  {savingGmcSettings ? 'Saving...' : (gmcSettingsResult.message || (gmcSettingsResult.success ? 'Saved.' : 'Failed to save.'))}
                  </div>
                )}
              </div>

              {/* Product Sync Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{gmcStatus.totalProducts}</p>
                  <p className="text-xs text-neutral-500">Total Products</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{gmcStatus.syncedProducts}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Synced to GMC</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{gmcStatus.pendingProducts}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pending</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{gmcStatus.errorProducts}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Errors</p>
                </div>
              </div>

              {gmcStatus.lastSyncAt && (
                <p className="text-xs text-neutral-500">
                  Last sync: {new Date(gmcStatus.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">Loading GMC status...</p>
            </div>
          )}

          {/* Sync Result */}
          {gmcSyncResult && (
            <div className={`mt-4 p-3 rounded-lg ${
              gmcSyncResult.success 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              <p className="font-medium">{gmcSyncResult.message}</p>
              {gmcSyncResult.data && (
                <p className="text-sm mt-1">
                  Synced: {gmcSyncResult.data.synced} | Failed: {gmcSyncResult.data.failed}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Important Notice */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Current Sync Capabilities
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <strong>Store Status:</strong> {linkedLocation ? '✅ Auto-syncs on change (OPEN/CLOSED)' : '⚠️ Link a GBP location to enable'}</li>
          <li>• <strong>Business Info:</strong> {linkedLocation ? '✅ Click "Sync to Google" above' : '⚠️ Link a GBP location to enable'}</li>
          <li>• <strong>Categories:</strong> {linkedLocation ? '✅ Click "Sync to Google" above' : '⚠️ Link a GBP location to enable'}</li>
          <li>• <strong>Business Hours:</strong> ✅ Auto-syncs when hours are updated</li>
          <li>• <strong>Products:</strong> {gmcStatus?.hasMerchantLink ? '✅ Click "Sync Products" above' : '⚠️ Link a Merchant Center account to enable'}</li>
        </ul>
      </div>

      {/* Sync Categories */}
      <div className="space-y-6">
        {syncCategories.map((category) => (
          <div 
            key={category.id}
            className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700"
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-700 rounded-lg flex items-center justify-center">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {category.label}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      {category.syncEnabled ? 'Sync enabled' : 'Sync not available'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(category.syncStatus)}`}>
                    {getStatusIcon(category.syncStatus)}
                    <span className="ml-1">{getStatusLabel(category.syncStatus)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider">
                    <th className="pb-2">Field</th>
                    <th className="pb-2">
                      <div className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        Local
                      </div>
                    </th>
                    <th className="pb-2 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="pb-2">
                      <div className="flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        Google
                      </div>
                    </th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {category.fields.map((field, idx) => (
                    <tr key={idx}>
                      <td className="py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {field.name}
                      </td>
                      <td className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {field.localValue || <span className="text-neutral-400 italic">Not set</span>}
                      </td>
                      <td className="py-2 hidden md:table-cell">
                        {field.canSync ? (
                          <ArrowRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-neutral-300" />
                        )}
                      </td>
                      <td className="py-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {field.googleValue || <span className="text-neutral-400 italic">—</span>}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getStatusColor(field.status)}`}>
                          {getStatusIcon(field.status)}
                          <span className="hidden sm:inline">{getStatusLabel(field.status)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {category.lastSyncAttempt && (
                <p className="mt-3 text-xs text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Last sync: {new Date(category.lastSyncAttempt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Future Enhancement Notice */}
      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
        <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
          Coming Soon: Full Two-Way Sync
        </h3>
        <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-4">
          We're working on enabling full two-way sync for all fields. This will allow you to:
        </p>
        <ul className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1">
          <li>• Push business categories to Google Business Profile</li>
          <li>• Sync business information bidirectionally</li>
          <li>• Detect and resolve conflicts automatically</li>
          <li>• View detailed sync history and audit logs</li>
        </ul>
      </div>
    </div>
  );
}
