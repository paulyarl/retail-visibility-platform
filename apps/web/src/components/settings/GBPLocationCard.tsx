"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, API_BASE_URL } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Skeleton } from '@/components/ui';
import { 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Link as LinkIcon,
  ExternalLink,
  Unlink,
  ChevronRight
} from 'lucide-react';

interface GBPLocationCardProps {
  tenantId: string;
}

interface GBPLocation {
  name: string;
  locationId: string;
  title?: string;
  address?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function GBPLocationCard({ tenantId }: GBPLocationCardProps) {
  const [loading, setLoading] = useState(true);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [linkedLocation, setLinkedLocation] = useState<any>(null);
  const [gbpLocations, setGbpLocations] = useState<GBPLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [linkingLocation, setLinkingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGBPStatus();
  }, [tenantId]);

  async function fetchGBPStatus() {
    try {
      setLoading(true);
      setError(null);

      // Check GBP connection status
      const statusRes = await api.get(`${API_BASE_URL}/api/google/business/status?tenantId=${tenantId}`);
      const statusData = statusRes.ok ? await statusRes.json() : null;
      setGbpConnected(statusData?.data?.isConnected || false);

      // Fetch linked location
      const linkedRes = await api.get(`${API_BASE_URL}/api/google/business/linked-location?tenantId=${tenantId}`);
      const linkedData = linkedRes.ok ? await linkedRes.json() : null;
      setLinkedLocation(linkedData?.data?.location || null);
    } catch (err) {
      console.error('Failed to fetch GBP status:', err);
      setError('Failed to load GBP status');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGBPLocations() {
    try {
      setLoadingLocations(true);
      setError(null);
      const res = await api.get(`${API_BASE_URL}/api/google/business/locations?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setGbpLocations(data.data?.locations || []);
        setShowLocationSelector(true);
      } else {
        // Parse error response for user-friendly message
        try {
          const errorData = await res.json();
          const userMessage = errorData.userMessage || errorData.message || 'Failed to fetch GBP locations';
          setError(userMessage);
        } catch {
          setError('Failed to fetch GBP locations');
        }
      }
    } catch (err) {
      console.error('Failed to fetch GBP locations:', err);
      setError('Failed to fetch GBP locations');
    } finally {
      setLoadingLocations(false);
    }
  }

  async function handleLinkLocation(location: GBPLocation) {
    try {
      setLinkingLocation(true);
      setError(null);
      
      const addressStr = location.address?.addressLines?.join(', ') || '';
      const cityState = [location.address?.locality, location.address?.administrativeArea].filter(Boolean).join(', ');
      const fullAddress = [addressStr, cityState, location.address?.postalCode].filter(Boolean).join(' ');

      const res = await api.post(`${API_BASE_URL}/api/google/business/link-location`, {
        tenantId,
        locationId: location.locationId,
        locationName: location.title || location.name,
        address: fullAddress,
      });
      
      if (res.ok) {
        setLinkedLocation({
          locationId: location.locationId,
          name: location.title || location.name,
          address: fullAddress,
        });
        setShowLocationSelector(false);
      } else {
        setError('Failed to link location');
      }
    } catch (err) {
      console.error('Failed to link location:', err);
      setError('Failed to link location');
    } finally {
      setLinkingLocation(false);
    }
  }

  async function handleUnlinkLocation() {
    try {
      setLinkingLocation(true);
      setError(null);
      
      const res = await api.post(`${API_BASE_URL}/api/google/business/unlink-location`, {
        tenantId,
      });
      
      if (res.ok) {
        setLinkedLocation(null);
      } else {
        setError('Failed to unlink location');
      }
    } catch (err) {
      console.error('Failed to unlink location:', err);
      setError('Failed to unlink location');
    } finally {
      setLinkingLocation(false);
    }
  }

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Google Business Profile Location
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              linkedLocation 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : gbpConnected 
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-neutral-100 dark:bg-neutral-800'
            }`}>
              <MapPin className={`w-5 h-5 ${
                linkedLocation 
                  ? 'text-green-600' 
                  : gbpConnected 
                    ? 'text-amber-600'
                    : 'text-neutral-500'
              }`} />
            </div>
            <div>
              <CardTitle className="text-base">Google Business Profile Location</CardTitle>
              <CardDescription>
                {linkedLocation 
                  ? 'Your store is linked to a GBP location for sync'
                  : gbpConnected
                    ? 'Link a GBP location to enable data sync'
                    : 'Connect Google to link a location'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={linkedLocation ? "success" : gbpConnected ? "warning" : "default"}>
            {linkedLocation ? "Linked" : gbpConnected ? "Not Linked" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {!gbpConnected ? (
          <div className="text-center py-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Connect your Google account first to link a GBP location
            </p>
            <Link
              href={`/t/${tenantId}/settings/integrations/google`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Google Account
            </Link>
          </div>
        ) : linkedLocation ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {linkedLocation.name}
                  </p>
                  {linkedLocation.address && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      {linkedLocation.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/t/${tenantId}/settings/integrations/google/sync-status`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-colors"
              >
                View Sync Status
                <ChevronRight className="w-4 h-4" />
              </Link>
              <button
                onClick={handleUnlinkLocation}
                disabled={linkingLocation}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50"
              >
                {linkingLocation ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Unlink Location
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!showLocationSelector ? (
              <div className="text-center py-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  Link your Google Business Profile location to sync business information
                </p>
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
                  {loadingLocations ? 'Loading Locations...' : 'Link GBP Location'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Select a location to link:
                </p>
                {gbpLocations.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      No GBP locations found. Make sure you have a Google Business Profile set up.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {gbpLocations.map((location) => {
                      const addressStr = location.address?.addressLines?.join(', ') || '';
                      const cityState = [location.address?.locality, location.address?.administrativeArea].filter(Boolean).join(', ');
                      
                      return (
                        <button
                          key={location.locationId || location.name}
                          onClick={() => handleLinkLocation(location)}
                          disabled={linkingLocation}
                          className="w-full p-3 text-left bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {location.title || location.name}
                          </p>
                          {(addressStr || cityState) && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                              {[addressStr, cityState].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={() => setShowLocationSelector(false)}
                  className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick link to full sync status */}
        {gbpConnected && (
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Link
              href={`/t/${tenantId}/settings/integrations/google/sync-status`}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1"
            >
              View full sync status
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
