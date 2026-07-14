'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, Image, Lock, LayoutGrid, GalleryHorizontalEnd, Zap, ArrowRight, Globe, MapPin, Images } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontGalleryCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface StorefrontGallerySettings {
  gallery_enabled: boolean;
  gallery_display_mode: string;
  image_gallery_5: boolean;
  image_gallery_10: boolean;
  image_gallery_15: boolean;
  default_gallery_limit: number;
}

interface StorefrontGallerySettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontGallerySettings = {
  gallery_enabled: true,
  gallery_display_mode: 'carousel',
  image_gallery_5: true,
  image_gallery_10: false,
  image_gallery_15: false,
  default_gallery_limit: 5,
};

const IMAGE_LIMITS = [
  { value: 5, key: 'image_gallery_5' as const, label: '5 images' },
  { value: 10, key: 'image_gallery_10' as const, label: '10 images' },
  { value: 15, key: 'image_gallery_15' as const, label: '15 images' },
];

const DISPLAY_MODES = [
  { value: 'carousel', label: 'Carousel', description: 'Horizontal scrolling image carousel', icon: GalleryHorizontalEnd },
  { value: 'magazine', label: 'Magazine', description: 'Mosaic grid layout with varied sizes', icon: LayoutGrid },
];

export default function StorefrontGallerySettingsClient({ tenantId }: StorefrontGallerySettingsClientProps) {
  const [settings, setSettings] = useState<StorefrontGallerySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: galleryCapability } = useStorefrontGalleryCapability(tenantId);
  const { data: allCaps } = useAllCapabilities(tenantId);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantInfoService.getStorefrontGallerySettings(tenantId);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load gallery settings');
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
      const result = await tenantInfoService.updateStorefrontGallerySettings(tenantId, settings);
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

  const updateSetting = (key: keyof StorefrontGallerySettings, value: boolean | string | number) => {
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

  const tierState = galleryCapability;
  const isTierEnabled = tierState?.enabled ?? false;
  const isTierFlexible = tierState?.isFlexible ?? false;
  const tierGalleryTypes = tierState?.allowedGalleryTypes ?? [];
  const tierMagazineEnabled = tierState?.galleryMagazineEnabled ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Image Gallery Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure image gallery display and layout for your storefront</p>
        </div>
      </div>

      {/* Plan Summary */}
      <PlanSummaryPanel capabilities={allCaps ?? null} loading={!allCaps} highlightCapability="storefront_gallery" tenantId={tenantId} />

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
                <h3 className="font-semibold text-red-900">Image Gallery Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your current plan does not include image gallery features. Upgrade to access gallery display modes and image limits.
                </p>
                <Link href={`/t/${tenantId}/settings/subscription`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-700 hover:text-red-800">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Display Card */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-blue-600" />
              Gallery Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gallery Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div>
                <p className="font-medium text-sm text-neutral-900">Enable Image Gallery</p>
                <p className="text-xs text-neutral-500">Master toggle for all gallery features</p>
              </div>
              <Switch
                checked={settings.gallery_enabled}
                onCheckedChange={(v) => updateSetting('gallery_enabled', v)}
              />
            </div>

            {/* Image Limit */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Image Limit</p>
              <p className="text-xs text-neutral-500">Maximum number of images displayed per product</p>
              <div className="grid grid-cols-3 gap-3">
                {IMAGE_LIMITS.map(item => {
                  const tierAllowed = isTierFlexible || tierGalleryTypes.includes(item.key);
                  return (
                    <label
                      key={item.value}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        tierAllowed
                          ? settings.default_gallery_limit === item.value
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                          : 'border-neutral-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="gallery_limit"
                          value={item.value}
                          checked={settings.default_gallery_limit === item.value}
                          disabled={!tierAllowed}
                          onChange={(e) => {
                            updateSetting('default_gallery_limit', Number(e.target.value));
                            updateSetting(item.key, true);
                          }}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-neutral-700">{item.label}</span>
                      </div>
                      {!tierAllowed && <Lock className="h-3 w-3 text-neutral-400" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Display Mode */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Display Mode</p>
              <p className="text-xs text-neutral-500">How images are arranged on the storefront</p>
              <div className="grid grid-cols-2 gap-3">
                {DISPLAY_MODES.map(mode => {
                  const Icon = mode.icon;
                  const tierAllowed = mode.value === 'carousel' || isTierFlexible || tierMagazineEnabled;
                  return (
                    <label
                      key={mode.value}
                      className={`flex flex-col gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                        tierAllowed
                          ? settings.gallery_display_mode === mode.value
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                          : 'border-neutral-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="gallery_display_mode"
                            value={mode.value}
                            checked={settings.gallery_display_mode === mode.value}
                            disabled={!tierAllowed}
                            onChange={(e) => updateSetting('gallery_display_mode', e.target.value)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Icon className="h-4 w-4 text-neutral-600" />
                          <span className="text-sm font-medium text-neutral-900">{mode.label}</span>
                        </div>
                        {!tierAllowed && <Lock className="h-3 w-3 text-neutral-400" />}
                      </div>
                      <p className="text-xs text-neutral-500 pl-6">{mode.description}</p>
                    </label>
                  );
                })}
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
      {isTierEnabled && settings.gallery_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              What's Next
            </CardTitle>
            <p className="text-sm text-neutral-600 mt-1">
              Continue setup for the gallery features you just enabled
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/t/${tenantId}/settings/storefront-options`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Images className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Storefront Options</p>
                  <p className="text-xs opacity-80 truncate">Configure additional storefront display features</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/t/${tenantId}/settings/storefront-qr`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Image className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">QR Code Settings</p>
                  <p className="text-xs opacity-80 truncate">Customize QR codes for your store and products</p>
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
