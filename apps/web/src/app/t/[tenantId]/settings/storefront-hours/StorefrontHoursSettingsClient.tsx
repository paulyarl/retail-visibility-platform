'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, Clock, Lock, Zap, ArrowRight, Globe, MapPin, Image } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontHoursCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';

interface StorefrontHoursSettings {
  hours_enabled: boolean;
  hours_display: boolean;
  hours_animated: boolean;
  hours_status: boolean;
}

interface StorefrontHoursSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontHoursSettings = {
  hours_enabled: true,
  hours_display: true,
  hours_animated: true,
  hours_status: true,
};

export default function StorefrontHoursSettingsClient({ tenantId }: StorefrontHoursSettingsClientProps) {
  const [settings, setSettings] = useState<StorefrontHoursSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: hoursCapability } = useStorefrontHoursCapability(tenantId);
  const { data: allCaps } = useAllCapabilities(tenantId);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantInfoService.getStorefrontHoursSettings(tenantId);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load hours settings');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await tenantInfoService.updateStorefrontHoursSettings(tenantId, settings);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result });
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

  const updateSetting = (key: keyof StorefrontHoursSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse bg-neutral-200 rounded" />
        <div className="h-64 animate-pulse bg-neutral-100 rounded-lg" />
      </div>
    );
  }

  const tierState = hoursCapability;
  const isTierEnabled = tierState?.enabled ?? false;
  const isTierFlexible = tierState?.isFlexible ?? false;
  const tierCanShowHoursDisplay = tierState?.canShowHoursDisplay ?? false;
  const tierCanUseAnimatedHours = tierState?.canUseAnimatedHours ?? false;
  const tierCanShowHoursStatus = tierState?.canShowHoursStatus ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Business Hours Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure how business hours are displayed on your storefront</p>
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
                <h3 className="font-semibold text-red-900">Business Hours Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your current plan does not include business hours features. Upgrade to access animated hours and status display.
                </p>
                <Link href={`/t/${tenantId}/settings/subscription`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-700 hover:text-red-800">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours Display Card */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Hours Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hours Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div>
                <p className="font-medium text-sm text-neutral-900">Enable Business Hours</p>
                <p className="text-xs text-neutral-500">Master toggle for all hours features</p>
              </div>
              <Switch
                checked={settings.hours_enabled}
                onCheckedChange={(v) => updateSetting('hours_enabled', v)}
              />
            </div>

            {/* Hours Display Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div>
                <p className="font-medium text-sm text-neutral-900">Show Hours Section</p>
                <p className="text-xs text-neutral-500">Display the business hours section on your storefront</p>
              </div>
              <Switch
                checked={settings.hours_display}
                onCheckedChange={(v) => updateSetting('hours_display', v)}
              />
            </div>

            {/* Animated Hours Toggle */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${isTierFlexible || tierCanUseAnimatedHours ? 'bg-neutral-50' : 'bg-neutral-50 opacity-50'}`}>
              <div>
                <p className="font-medium text-sm text-neutral-900">Animated Hours</p>
                <p className="text-xs text-neutral-500">Show animated open/closed indicator</p>
              </div>
              <div className="flex items-center gap-2">
                {!(isTierFlexible || tierCanUseAnimatedHours) && <Lock className="h-3 w-3 text-neutral-400" />}
                <Switch
                  checked={settings.hours_animated}
                  onCheckedChange={(v) => updateSetting('hours_animated', v)}
                  disabled={!(isTierFlexible || tierCanUseAnimatedHours)}
                />
              </div>
            </div>

            {/* Hours Status Toggle */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${isTierFlexible || tierCanShowHoursStatus ? 'bg-neutral-50' : 'bg-neutral-50 opacity-50'}`}>
              <div>
                <p className="font-medium text-sm text-neutral-900">Hours Status</p>
                <p className="text-xs text-neutral-500">Show open/closed status badge</p>
              </div>
              <div className="flex items-center gap-2">
                {!(isTierFlexible || tierCanShowHoursStatus) && <Lock className="h-3 w-3 text-neutral-400" />}
                <Switch
                  checked={settings.hours_status}
                  onCheckedChange={(v) => updateSetting('hours_status', v)}
                  disabled={!(isTierFlexible || tierCanShowHoursStatus)}
                />
              </div>
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
      {isTierEnabled && settings.hours_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              What's Next
            </CardTitle>
            <p className="text-sm text-neutral-600 mt-1">
              Continue setup for the hours features you just enabled
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/t/${tenantId}/settings/storefront-options`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Clock className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Storefront Options</p>
                  <p className="text-xs opacity-80 truncate">Configure additional storefront display features</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/t/${tenantId}/settings/storefront-gallery`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Image className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Image Gallery</p>
                  <p className="text-xs opacity-80 truncate">Customize your store's image gallery</p>
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
