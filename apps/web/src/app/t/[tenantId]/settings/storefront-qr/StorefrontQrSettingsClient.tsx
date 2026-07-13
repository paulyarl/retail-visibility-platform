'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, QrCode, Palette, Sparkles, Lock } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontQrCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface StorefrontQrSettings {
  qr_enabled: boolean;
  qr_classic_enabled: boolean;
  qr_styled_enabled: boolean;
  qr_codes_512: boolean;
  qr_codes_1024: boolean;
  qr_codes_2048: boolean;
  qr_product: boolean;
  qr_store: boolean;
  qr_logo: boolean;
  qr_directory: boolean;
  qr_dot_type: string;
  qr_corner_type: string;
  qr_dot_color: string;
  qr_corner_color: string;
  qr_bg_color: string;
  qr_gradient_enabled: boolean;
  qr_gradient_start: string;
  qr_gradient_end: string;
  default_qr_resolution: string;
}

interface StorefrontQrSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontQrSettings = {
  qr_enabled: true,
  qr_classic_enabled: true,
  qr_styled_enabled: false,
  qr_codes_512: false,
  qr_codes_1024: true,
  qr_codes_2048: false,
  qr_product: true,
  qr_store: true,
  qr_logo: false,
  qr_directory: false,
  qr_dot_type: 'rounded',
  qr_corner_type: 'extra-rounded',
  qr_dot_color: '#1a56db',
  qr_corner_color: '#1a56db',
  qr_bg_color: '#ffffff',
  qr_gradient_enabled: false,
  qr_gradient_start: '#1a56db',
  qr_gradient_end: '#7c3aed',
  default_qr_resolution: '1024',
};

const DOT_STYLES = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
];

const CORNER_STYLES = [
  { value: 'dot', label: 'Dot' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
  { value: 'rounded', label: 'Rounded' },
];

const RESOLUTIONS = [
  { value: '512', label: '512px' },
  { value: '1024', label: '1024px' },
  { value: '2048', label: '2048px' },
];

export default function StorefrontQrSettingsClient({ tenantId }: StorefrontQrSettingsClientProps) {
  const [settings, setSettings] = useState<StorefrontQrSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: qrCapability } = useStorefrontQrCapability(tenantId);
  const { data: allCaps } = useAllCapabilities(tenantId);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantInfoService.getStorefrontQrSettings(tenantId);
      if (result) {
        setSettings({ ...DEFAULT_SETTINGS, ...result });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load QR settings');
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
      const result = await tenantInfoService.updateStorefrontQrSettings(tenantId, settings);
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

  const updateSetting = (key: keyof StorefrontQrSettings, value: boolean | string) => {
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

  const tierState = qrCapability;
  const isTierEnabled = tierState?.enabled ?? false;
  const isTierFlexible = tierState?.isFlexible ?? false;
  const tierQrResolutions = tierState?.allowedQRResolutions ?? [];
  const tierQrContentTypes = tierState?.allowedQRContentTypes ?? [];
  const tierStyledEnabled = tierState?.qrStyledEnabled ?? false;
  const tierQrCustomColors = tierState?.qrCustomColors ?? false;
  const tierQrGradients = tierState?.qrGradients ?? false;
  const tierDotStyles = tierState?.allowedQRDotStyles ?? [];
  const tierCornerStyles = tierState?.allowedQRCornerStyles ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">QR Code Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure QR code display and styling for your storefront</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || !isTierEnabled}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Plan Summary */}
      <PlanSummaryPanel capabilities={allCaps ?? null} loading={!allCaps} highlightCapability="storefront_qr" tenantId={tenantId} />

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
                <h3 className="font-semibold text-red-900">QR Codes Not Available</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your current plan does not include QR code features. Upgrade to access QR code generation and styling.
                </p>
                <Link href={`/t/${tenantId}/settings/subscription`} className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-700 hover:text-red-800">
                  Upgrade plan →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Display Card */}
      {isTierEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              QR Code Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div>
                <p className="font-medium text-sm text-neutral-900">Enable QR Codes</p>
                <p className="text-xs text-neutral-500">Master toggle for all QR code features</p>
              </div>
              <Switch
                checked={settings.qr_enabled}
                onCheckedChange={(v) => updateSetting('qr_enabled', v)}
              />
            </div>

            {/* QR Resolutions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">QR Resolution</p>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map(res => {
                  const tierKey = `qr_codes_${res.value}` as 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
                  const tierAllowed = isTierFlexible || tierQrResolutions.includes(tierKey);
                  const settingsKey = `qr_codes_${res.value}` as keyof StorefrontQrSettings;
                  return (
                    <label
                      key={res.value}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        tierAllowed
                          ? settings.default_qr_resolution === res.value
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                          : 'border-neutral-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="qr_resolution"
                          value={res.value}
                          checked={settings.default_qr_resolution === res.value}
                          disabled={!tierAllowed}
                          onChange={(e) => {
                            updateSetting('default_qr_resolution', e.target.value);
                            updateSetting(settingsKey, true);
                          }}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-neutral-700">{res.label}</span>
                      </div>
                      {!tierAllowed && <Lock className="h-3 w-3 text-neutral-400" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* QR Content Types */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">QR Content Types</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'qr_product' as const, label: 'Product QR' },
                  { key: 'qr_store' as const, label: 'Store QR' },
                  { key: 'qr_logo' as const, label: 'Logo QR' },
                  { key: 'qr_directory' as const, label: 'Directory QR' },
                ].map(item => {
                  const tierAllowed = isTierFlexible || tierQrContentTypes.includes(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        tierAllowed ? 'border-neutral-200' : 'border-neutral-200 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings[item.key] as boolean}
                          onCheckedChange={(v) => updateSetting(item.key, v)}
                          disabled={!tierAllowed}
                        />
                        <span className="text-sm text-neutral-700">{item.label}</span>
                      </div>
                      {!tierAllowed && <Lock className="h-3 w-3 text-neutral-400" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Styling Card */}
      {isTierEnabled && tierStyledEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-600" />
              QR Code Styling
              {!tierStyledEnabled && (
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 ml-2">
                  <Lock className="h-3 w-3" /> Not available on your plan
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Styled QR Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div>
                <p className="font-medium text-sm text-neutral-900">Enable Styled QR</p>
                <p className="text-xs text-neutral-500">Use custom dot styles, colors, and gradients</p>
              </div>
              <Switch
                checked={settings.qr_styled_enabled}
                onCheckedChange={(v) => updateSetting('qr_styled_enabled', v)}
              />
            </div>

            {settings.qr_styled_enabled && (
              <>
                {/* Dot Style */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-700">Dot Style</p>
                  <div className="grid grid-cols-5 gap-2">
                    {DOT_STYLES.map(style => {
                      const tierAllowed = isTierFlexible || tierDotStyles.includes(style.value as any);
                      return (
                        <label
                          key={style.value}
                          className={`flex items-center justify-center p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            tierAllowed
                              ? settings.qr_dot_type === style.value
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : 'border-neutral-200 hover:border-neutral-300'
                              : 'border-neutral-200 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="radio"
                            name="qr_dot_type"
                            value={style.value}
                            checked={settings.qr_dot_type === style.value}
                            disabled={!tierAllowed}
                            onChange={(e) => updateSetting('qr_dot_type', e.target.value)}
                            className="sr-only"
                          />
                          {style.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Corner Style */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-700">Corner Style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CORNER_STYLES.map(style => {
                      const tierAllowed = isTierFlexible || tierCornerStyles.includes(style.value as any);
                      return (
                        <label
                          key={style.value}
                          className={`flex items-center justify-center p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            tierAllowed
                              ? settings.qr_corner_type === style.value
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : 'border-neutral-200 hover:border-neutral-300'
                              : 'border-neutral-200 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="radio"
                            name="qr_corner_type"
                            value={style.value}
                            checked={settings.qr_corner_type === style.value}
                            disabled={!tierAllowed}
                            onChange={(e) => updateSetting('qr_corner_type', e.target.value)}
                            className="sr-only"
                          />
                          {style.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Colors */}
                {tierQrCustomColors && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                      <div>
                        <p className="font-medium text-sm text-neutral-900">Custom Colors</p>
                        <p className="text-xs text-neutral-500">Override default QR code colors</p>
                      </div>
                      <Switch
                        checked={settings.qr_dot_color !== '#1a56db' || settings.qr_corner_color !== '#1a56db' || settings.qr_bg_color !== '#ffffff'}
                        onCheckedChange={(v) => {
                          if (!v) {
                            updateSetting('qr_dot_color', '#1a56db');
                            updateSetting('qr_corner_color', '#1a56db');
                            updateSetting('qr_bg_color', '#ffffff');
                          }
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-neutral-500">Dot Color</label>
                        <input
                          type="color"
                          value={settings.qr_dot_color}
                          onChange={(e) => updateSetting('qr_dot_color', e.target.value)}
                          className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500">Corner Color</label>
                        <input
                          type="color"
                          value={settings.qr_corner_color}
                          onChange={(e) => updateSetting('qr_corner_color', e.target.value)}
                          className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500">Background</label>
                        <input
                          type="color"
                          value={settings.qr_bg_color}
                          onChange={(e) => updateSetting('qr_bg_color', e.target.value)}
                          className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Gradients */}
                {tierQrGradients && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="font-medium text-sm text-neutral-900">Gradient Effect</p>
                          <p className="text-xs text-neutral-500">Apply a color gradient to QR dots</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.qr_gradient_enabled}
                        onCheckedChange={(v) => updateSetting('qr_gradient_enabled', v)}
                      />
                    </div>
                    {settings.qr_gradient_enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-neutral-500">Gradient Start</label>
                          <input
                            type="color"
                            value={settings.qr_gradient_start}
                            onChange={(e) => updateSetting('qr_gradient_start', e.target.value)}
                            className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-500">Gradient End</label>
                          <input
                            type="color"
                            value={settings.qr_gradient_end}
                            onChange={(e) => updateSetting('qr_gradient_end', e.target.value)}
                            className="w-full h-10 rounded-lg border border-neutral-200 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
