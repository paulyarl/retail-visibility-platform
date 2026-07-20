'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Save, AlertCircle, CheckCircle2, Lock, Zap, ArrowRight, Globe, MapPin, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontLayoutsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';

interface StorefrontLayoutsSettings {
  layouts_enabled: boolean;
  storefront_layout: 'classic' | 'editorial' | 'immersive';
}

interface StorefrontLayoutsSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontLayoutsSettings = {
  layouts_enabled: true,
  storefront_layout: 'classic',
};

export default function StorefrontLayoutsSettingsClient({ tenantId }: StorefrontLayoutsSettingsClientProps) {
  const [settings, setSettings] = useState<StorefrontLayoutsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: layoutsCapability } = useStorefrontLayoutsCapability(tenantId);
  const { data: allCaps } = useAllCapabilities(tenantId);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantInfoService.getStorefrontLayoutsSettings(tenantId);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result as StorefrontLayoutsSettings });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load layout settings');
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
      const result = await tenantInfoService.updateStorefrontLayoutsSettings(tenantId, settings);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result as StorefrontLayoutsSettings });
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

  const tierState = layoutsCapability;
  const isTierEnabled = tierState?.enabled ?? false;
  const isTierFlexible = tierState?.isFlexible ?? false;
  const tierCanUseClassic = tierState?.canUseLayoutClassic ?? false;
  const tierCanUseEditorial = tierState?.canUseLayoutEditorial ?? false;
  const tierCanUseImmersive = tierState?.canUseLayoutImmersive ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Storefront Layout Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Choose how your storefront and product pages look to customers</p>
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
                <h3 className="font-semibold text-red-900">Storefront Layout Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your current plan does not include storefront layout features. Upgrade to access editorial and immersive layouts.
                </p>
                <Link href={`/t/${tenantId}/settings/subscription`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-700 hover:text-red-800">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layout Selection Card */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-violet-600" />
              Storefront Layout
            </CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              Choose how your storefront and product pages look to customers
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Classic */}
              <button
                type="button"
                onClick={() => {
                  if (isTierFlexible || tierCanUseClassic) {
                    setSettings(s => ({ ...s, storefront_layout: 'classic' }));
                  }
                }}
                disabled={!(isTierFlexible || tierCanUseClassic)}
                className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                  settings.storefront_layout === 'classic'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${!(isTierFlexible || tierCanUseClassic) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {settings.storefront_layout === 'classic' && (isTierFlexible || tierCanUseClassic) && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
                )}
                <span className="font-semibold text-sm">Classic</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Traditional single-column layout.
                  {!(isTierFlexible || tierCanUseClassic) && (
                    <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                  )}
                </span>
              </button>
              {/* Editorial */}
              <button
                type="button"
                onClick={() => {
                  if (isTierFlexible || tierCanUseEditorial) {
                    setSettings(s => ({ ...s, storefront_layout: 'editorial' }));
                  }
                }}
                disabled={!(isTierFlexible || tierCanUseEditorial)}
                className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                  settings.storefront_layout === 'editorial'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${!(isTierFlexible || tierCanUseEditorial) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {settings.storefront_layout === 'editorial' && (isTierFlexible || tierCanUseEditorial) && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
                )}
                <span className="font-semibold text-sm">Modern Editorial</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Storytelling emphasis, hero banner, split-panel product pages.
                  {!(isTierFlexible || tierCanUseEditorial) && (
                    <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                  )}
                </span>
              </button>
              {/* Immersive */}
              <button
                type="button"
                onClick={() => {
                  if (isTierFlexible || tierCanUseImmersive) {
                    setSettings(s => ({ ...s, storefront_layout: 'immersive' }));
                  }
                }}
                disabled={!(isTierFlexible || tierCanUseImmersive)}
                className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                  settings.storefront_layout === 'immersive'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${!(isTierFlexible || tierCanUseImmersive) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {settings.storefront_layout === 'immersive' && (isTierFlexible || tierCanUseImmersive) && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
                )}
                <span className="font-semibold text-sm">Immersive Commerce</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Conversion-optimized, compact purchase flow, sticky cart.
                  {!(isTierFlexible || tierCanUseImmersive) && (
                    <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                  )}
                </span>
              </button>
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
              Continue setup for the layout features you just enabled
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/t/${tenantId}/settings/storefront-options`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <LayoutGrid className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Storefront Options</p>
                  <p className="text-xs opacity-80 truncate">Configure additional storefront display features</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
              <Link
                href={`/t/${tenantId}/settings/storefront-hours`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <Globe className="h-5 w-5 shrink-0 text-neutral-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Business Hours</p>
                  <p className="text-xs opacity-80 truncate">Configure your store's business hours display</p>
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
