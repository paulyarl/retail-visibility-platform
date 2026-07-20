'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, Lock, Zap, ArrowRight, Globe, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontMapsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';

interface StorefrontMapsSettings {
  maps_enabled: boolean;
  interactive_maps: boolean;
  map_display: boolean;
  location_display: boolean;
}

interface StorefrontMapsSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontMapsSettings = {
  maps_enabled: true,
  interactive_maps: true,
  map_display: true,
  location_display: true,
};

export default function StorefrontMapsSettingsClient({ tenantId }: StorefrontMapsSettingsClientProps) {
  const [settings, setSettings] = useState<StorefrontMapsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: mapsCapability } = useStorefrontMapsCapability(tenantId);
  const { data: allCaps } = useAllCapabilities(tenantId);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantInfoService.getStorefrontMapsSettings(tenantId);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result as StorefrontMapsSettings });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load maps settings');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = (key: keyof StorefrontMapsSettings) => {
    setSettings(s => ({ ...s, [key]: !s[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await tenantInfoService.updateStorefrontMapsSettings(tenantId, settings);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result as StorefrontMapsSettings });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError('Failed to save settings');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse bg-neutral-200 rounded" />
        <div className="h-64 animate-pulse bg-neutral-100 rounded-lg" />
      </div>
    );
  }

  const tierState = mapsCapability;
  const isTierEnabled = tierState?.enabled ?? false;
  const tierCanUseInteractiveMaps = tierState?.canUseInteractiveMaps ?? false;
  const tierCanShowMapDisplay = tierState?.canShowMapDisplay ?? false;
  const tierCanShowLocationDisplay = tierState?.canShowLocationDisplay ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Storefront Maps Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure map and location display features on your storefront</p>
        </div>
      </div>

      {/* Plan Summary Widget */}
      <PlanSummaryWidget capabilities={allCaps ?? null} loading={!allCaps} tenantId={tenantId} />

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Tier disabled banner */}
      {!isTierEnabled && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Storefront Maps Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your current plan does not include storefront maps features. Upgrade to access interactive maps and location display.
                </p>
                <Link href={`/t/${tenantId}/settings/subscription`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-700 hover:text-red-800">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maps Settings Card */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              Map & Location Display
            </CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              Control which map and location features appear on your storefront
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="font-medium">Enable Maps</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Master toggle for all map features</p>
              </div>
              <Switch
                checked={settings.maps_enabled}
                onCheckedChange={() => handleToggle('maps_enabled')}
              />
            </div>

            {/* Interactive Maps */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Interactive Maps</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Embedded interactive map on storefront</p>
                {!tierCanUseInteractiveMaps && (
                  <p className="text-xs text-amber-600 font-medium mt-1">Not included in your plan</p>
                )}
              </div>
              <Switch
                checked={settings.interactive_maps}
                onCheckedChange={() => handleToggle('interactive_maps')}
                disabled={!settings.maps_enabled || !tierCanUseInteractiveMaps}
              />
            </div>

            {/* Map Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Map Display</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show a static map image on storefront</p>
                {!tierCanShowMapDisplay && (
                  <p className="text-xs text-amber-600 font-medium mt-1">Not included in your plan</p>
                )}
              </div>
              <Switch
                checked={settings.map_display}
                onCheckedChange={() => handleToggle('map_display')}
                disabled={!settings.maps_enabled || !tierCanShowMapDisplay}
              />
            </div>

            {/* Location Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Location Display</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show your store address and location info</p>
                {!tierCanShowLocationDisplay && (
                  <p className="text-xs text-amber-600 font-medium mt-1">Not included in your plan</p>
                )}
              </div>
              <Switch
                checked={settings.location_display}
                onCheckedChange={() => handleToggle('location_display')}
                disabled={!settings.maps_enabled || !tierCanShowLocationDisplay}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving || !isTierEnabled}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Next Steps */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              What's Next
            </CardTitle>
            <p className="text-sm text-neutral-600 mt-1">
              Continue setup for the map features you just enabled
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/t/${tenantId}/settings/tenant`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <MapPin className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Tenant Profile</p>
                  <p className="text-xs opacity-80 truncate">Set your store address and location</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/t/${tenantId}/settings/storefront-options`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Globe className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Storefront Options</p>
                  <p className="text-xs opacity-80 truncate">Configure additional storefront display features</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/tenant/${tenantId}`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Globe className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Public Storefront</p>
                  <p className="text-xs opacity-80 truncate">View your store as customers see it</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/directory/${tenantId}`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <MapPin className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Directory Entry</p>
                  <p className="text-xs opacity-80 truncate">View your store's public directory listing</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
