'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, QrCode, Palette, Sparkles, Lock, Zap, ArrowRight, Globe, MapPin, Image, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontQrCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';
import QrPreviewPane from './QrPreviewPane';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

interface StorefrontQrSettings {
  qr_enabled: boolean;
  qr_classic_enabled: boolean;
  qr_styled_enabled: boolean;
  qr_analytics_enabled: boolean;
  qr_codes_512: boolean;
  qr_codes_1024: boolean;
  qr_codes_2048: boolean;
  qr_product: boolean;
  qr_store: boolean;
  qr_logo: boolean;
  qr_directory: boolean;
  qr_dot_type: string;
  qr_corner_type: string;
  qr_corner_dot_type: string;
  qr_corner_dot_color: string;
  qr_logo_shape: string;
  qr_dot_color: string;
  qr_corner_color: string;
  qr_bg_color: string;
  qr_custom_colors_enabled: boolean;
  qr_gradient_enabled: boolean;
  qr_gradient_start: string;
  qr_gradient_end: string;
  qr_gradient_on_dots: boolean;
  qr_gradient_on_corners: boolean;
  qr_gradient_on_corner_dots: boolean;
  default_qr_resolution: string;
}

interface StorefrontQrSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontQrSettings = {
  qr_enabled: true,
  qr_classic_enabled: true,
  qr_styled_enabled: false,
  qr_analytics_enabled: false,
  qr_codes_512: false,
  qr_codes_1024: true,
  qr_codes_2048: false,
  qr_product: true,
  qr_store: true,
  qr_logo: false,
  qr_directory: false,
  qr_dot_type: 'rounded',
  qr_corner_type: 'extra-rounded',
  qr_corner_dot_type: 'dot',
  qr_corner_dot_color: '#ffffff',
  qr_logo_shape: 'square',
  qr_dot_color: '#1a56db',
  qr_corner_color: '#1a56db',
  qr_bg_color: '#ffffff',
  qr_custom_colors_enabled: false,
  qr_gradient_enabled: false,
  qr_gradient_start: '#1a56db',
  qr_gradient_end: '#7c3aed',
  qr_gradient_on_dots: true,
  qr_gradient_on_corners: true,
  qr_gradient_on_corner_dots: true,
  default_qr_resolution: '1024',
};

const DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
];

const CORNER_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded Square' },
  { value: 'extra-rounded', label: 'Round Square' },
  { value: 'dot', label: 'Round' },
];

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Round' },
];

const RESOLUTIONS = [
  { value: '512', label: '512px' },
  { value: '1024', label: '1024px' },
  { value: '2048', label: '2048px' },
];

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
      {children}
    </span>
  );
}

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
  const canUseQrAnalytics = tierState?.canUseQrAnalytics ?? false;
  const tierQrCustomColors = tierState?.qrCustomColors ?? false;
  const tierQrGradients = tierState?.qrGradients ?? false;
  const tierDotStyles = tierState?.allowedQRDotStyles ?? [];
  const tierCornerStyles = tierState?.allowedQRCornerStyles ?? [];
  const tierCornerDotStyles = tierState?.allowedQRCornerDotStyles ?? [];

  const previewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tenant/${tenantId}`
    : `/tenant/${tenantId}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">QR Code Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure QR code display and styling for your storefront</p>
        </div>
        <Link
          href={`/t/${tenantId}/settings/storefront-qr/analytics`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <BarChart3 className="w-4 h-4" />
          View Analytics
        </Link>
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

      {/* Two-column layout: settings + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: settings cards */}
        <div className="lg:col-span-2 space-y-6">

      {/* Gate Switch — standalone master toggle */}
      {isTierEnabled && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900">QR Code Display</h3>
                <p className="text-sm text-neutral-500 mt-0.5">Master toggle for all QR code features</p>
              </div>
              <Switch
                checked={settings.qr_enabled}
                onCheckedChange={(v) => updateSetting('qr_enabled', v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accordion Settings — progressive disclosure */}
      {isTierEnabled && settings.qr_enabled && (
        <Card>
          <CardContent className="p-0">
            <Accordion type="multiple" defaultValue={["style"]} className="w-full">

              {/* Section: Style */}
              <AccordionItem value="style" className="border-b">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-neutral-900">Style</span>
                    <SectionBadge>{!settings.qr_styled_enabled ? 'Classic' : 'Styled'}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <div className="space-y-3 pt-2">
                    {/* Classic Option */}
                    <div
                      onClick={() => {
                        updateSetting('qr_classic_enabled', true);
                        updateSetting('qr_styled_enabled', false);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                        !settings.qr_styled_enabled
                          ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        !settings.qr_styled_enabled ? 'bg-blue-100' : 'bg-gray-200'
                      }`}>
                        <QrCode className={`h-5 w-5 ${!settings.qr_styled_enabled ? 'text-blue-600' : 'text-neutral-500'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${!settings.qr_styled_enabled ? 'text-blue-700' : 'text-neutral-900'}`}>Classic</p>
                          {!settings.qr_styled_enabled && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600">Standard black-and-white QR codes with default styling</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        !settings.qr_styled_enabled ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {!settings.qr_styled_enabled && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Styled Option */}
                    <div
                      onClick={() => {
                        if (!tierStyledEnabled) return;
                        updateSetting('qr_classic_enabled', false);
                        updateSetting('qr_styled_enabled', true);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        settings.qr_styled_enabled && tierStyledEnabled
                          ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-300 cursor-pointer'
                          : tierStyledEnabled
                            ? 'bg-gray-50 border-gray-200 hover:border-gray-300 cursor-pointer'
                            : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        settings.qr_styled_enabled && tierStyledEnabled ? 'bg-purple-100' : 'bg-gray-200'
                      }`}>
                        <Sparkles className={`h-5 w-5 ${settings.qr_styled_enabled && tierStyledEnabled ? 'text-purple-600' : 'text-neutral-500'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${settings.qr_styled_enabled && tierStyledEnabled ? 'text-purple-700' : 'text-neutral-900'}`}>Styled</p>
                          {settings.qr_styled_enabled && tierStyledEnabled && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          )}
                          {!tierStyledEnabled && (
                            <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-600">Custom dot styles, corner styles, colors, and gradient effects</p>
                      </div>
                      {!tierStyledEnabled && <Lock className="h-4 w-4 text-neutral-400" />}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        settings.qr_styled_enabled && tierStyledEnabled ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                      }`}>
                        {settings.qr_styled_enabled && tierStyledEnabled && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {!tierStyledEnabled && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800">
                          Styled QR codes are not available on your current plan. Upgrade to access custom dot patterns, colors, and gradients.
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Styling Options */}
              {(tierStyledEnabled && settings.qr_styled_enabled) && (
                <AccordionItem value="styling" className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Palette className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-neutral-900">Styling Options</span>
                      <SectionBadge>{settings.qr_dot_type}</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <div className="space-y-4 pt-2">
                      {/* Dot Style */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-700">Dot Style</p>
                        <div className="grid grid-cols-3 gap-2">
                          {DOT_STYLES.map(style => {
                            const tierAllowed = isTierFlexible || tierDotStyles.includes(style.value as any);
                            const isSelected = settings.qr_dot_type === style.value;
                            return (
                              <div
                                key={style.value}
                                onClick={() => {
                                  if (!tierAllowed) return;
                                  updateSetting('qr_dot_type', style.value);
                                }}
                                className={`flex items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                                  tierAllowed
                                    ? isSelected
                                      ? 'border-purple-300 bg-purple-50 text-purple-700 cursor-pointer'
                                      : 'border-neutral-200 hover:border-neutral-300 cursor-pointer'
                                    : 'border-neutral-200 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                {style.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Corner Style */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-700">Corner Style</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {CORNER_STYLES.map(style => {
                            const tierAllowed = isTierFlexible || tierCornerStyles.includes(style.value as any);
                            const isSelected = settings.qr_corner_type === style.value;
                            return (
                              <div
                                key={style.value}
                                onClick={() => {
                                  if (!tierAllowed) return;
                                  updateSetting('qr_corner_type', style.value);
                                }}
                                className={`flex items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                                  tierAllowed
                                    ? isSelected
                                      ? 'border-purple-300 bg-purple-50 text-purple-700 cursor-pointer'
                                      : 'border-neutral-200 hover:border-neutral-300 cursor-pointer'
                                    : 'border-neutral-200 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                {style.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Corner Dot Style */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-neutral-700">Corner Dot Style</p>
                        <p className="text-xs text-neutral-500">Inner shape inside the 3 corner squares</p>
                        <div className="grid grid-cols-2 gap-2">
                          {CORNER_DOT_STYLES.map(style => {
                            const tierAllowed = isTierFlexible || tierCornerDotStyles.includes(style.value as any);
                            const isSelected = settings.qr_corner_dot_type === style.value;
                            return (
                              <div
                                key={style.value}
                                onClick={() => {
                                  if (!tierAllowed) return;
                                  updateSetting('qr_corner_dot_type', style.value);
                                }}
                                className={`flex items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                                  tierAllowed
                                    ? isSelected
                                      ? 'border-purple-300 bg-purple-50 text-purple-700 cursor-pointer'
                                      : 'border-neutral-200 hover:border-neutral-300 cursor-pointer'
                                    : 'border-neutral-200 opacity-50 cursor-not-allowed'
                                }`}
                              >
                                {style.label}
                              </div>
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
                              checked={settings.qr_custom_colors_enabled}
                              onCheckedChange={(v) => {
                                updateSetting('qr_custom_colors_enabled', v);
                                if (!v) {
                                  updateSetting('qr_dot_color', '#1a56db');
                                  updateSetting('qr_corner_color', '#1a56db');
                                  updateSetting('qr_corner_dot_color', '#ffffff');
                                  updateSetting('qr_bg_color', '#ffffff');
                                }
                              }}
                            />
                          </div>
                          {settings.qr_custom_colors_enabled && (
                            <div className="grid grid-cols-4 gap-3">
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
                                <label className="text-xs text-neutral-500">Corner Dot</label>
                                <input
                                  type="color"
                                  value={settings.qr_corner_dot_color}
                                  onChange={(e) => updateSetting('qr_corner_dot_color', e.target.value)}
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
                          )}
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
                            <>
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
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                                  <input
                                    type="checkbox"
                                    checked={settings.qr_gradient_on_dots}
                                    onChange={(e) => updateSetting('qr_gradient_on_dots', e.target.checked)}
                                    className="rounded border-neutral-300"
                                  />
                                  Dots
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                                  <input
                                    type="checkbox"
                                    checked={settings.qr_gradient_on_corners}
                                    onChange={(e) => updateSetting('qr_gradient_on_corners', e.target.checked)}
                                    className="rounded border-neutral-300"
                                  />
                                  Corners
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                                  <input
                                    type="checkbox"
                                    checked={settings.qr_gradient_on_corner_dots}
                                    onChange={(e) => updateSetting('qr_gradient_on_corner_dots', e.target.checked)}
                                    className="rounded border-neutral-300"
                                  />
                                  Corner Dots
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Section: Logo */}
              <AccordionItem value="logo" className="border-b">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Image className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-neutral-900">Logo</span>
                    <SectionBadge>{settings.qr_logo ? 'On' : 'Off'}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-neutral-500">Choose whether your merchant logo appears embedded in QR codes</p>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings.qr_logo}
                          onCheckedChange={(v) => updateSetting('qr_logo', v)}
                          disabled={!(isTierFlexible || tierQrContentTypes.includes('qr_logo'))}
                        />
                        <span className="text-sm text-neutral-700">Embed Logo in QR</span>
                      </div>
                      {!(isTierFlexible || tierQrContentTypes.includes('qr_logo')) && <Lock className="h-3 w-3 text-neutral-400" />}
                    </div>
                    {settings.qr_logo && (
                      <div className="space-y-2 mt-3">
                        <p className="text-sm font-medium text-neutral-700">Logo Shape</p>
                        <p className="text-xs text-neutral-500">Cutout shape for the embedded logo</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'square', label: 'Square' },
                            { value: 'circle', label: 'Round' },
                          ].map(shape => {
                            const isSelected = settings.qr_logo_shape === shape.value;
                            return (
                              <div
                                key={shape.value}
                                onClick={() => updateSetting('qr_logo_shape', shape.value)}
                                className={`flex items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                                  isSelected
                                    ? 'border-purple-300 bg-purple-50 text-purple-700 cursor-pointer'
                                    : 'border-neutral-200 hover:border-neutral-300 cursor-pointer'
                                }`}
                              >
                                {shape.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Resolution */}
              <AccordionItem value="resolution" className="border-b">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-neutral-900">Resolution</span>
                    <SectionBadge>{settings.default_qr_resolution}px</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-neutral-500">Select the output resolution for generated QR codes</p>
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
                </AccordionContent>
              </AccordionItem>

              {/* Section: Display Surfaces */}
              <AccordionItem value="surfaces" className="border-b">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-neutral-900">Display Surfaces</span>
                    <SectionBadge>
                      {[
                        settings.qr_product,
                        settings.qr_store,
                        settings.qr_directory,
                      ].filter(Boolean).length} of 3
                    </SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-neutral-500">Choose which public surfaces display QR codes</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'qr_product' as const, label: 'Product QR' },
                        { key: 'qr_store' as const, label: 'Store QR' },
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
                </AccordionContent>
              </AccordionItem>

              {/* Section: Analytics */}
              <AccordionItem value="analytics" className="border-b-0">
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-neutral-900">Analytics</span>
                    <SectionBadge>{settings.qr_analytics_enabled ? 'On' : 'Off'}</SectionBadge>
                    {!canUseQrAnalytics && <Lock className="h-3 w-3 text-neutral-400" />}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6">
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-neutral-500">Track QR code scan performance and conversion metrics</p>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings.qr_analytics_enabled}
                          onCheckedChange={(v) => updateSetting('qr_analytics_enabled', v)}
                          disabled={!canUseQrAnalytics}
                        />
                        <span className="text-sm text-neutral-700">Enable QR Scan Tracking</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!canUseQrAnalytics && <Lock className="h-3 w-3 text-neutral-400" />}
                        {canUseQrAnalytics && settings.qr_analytics_enabled && (
                          <Link
                            href={`/t/${tenantId}/settings/storefront-qr/analytics`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            <BarChart3 className="h-3 w-3" />
                            View Dashboard
                          </Link>
                        )}
                      </div>
                    </div>
                    {!canUseQrAnalytics && (
                      <p className="text-xs text-neutral-500">
                        QR Analytics is a premium feature. <Link href={`/t/${tenantId}/settings/subscription`} className="text-indigo-600 hover:text-indigo-700">Upgrade your plan</Link> to access scan tracking and conversion analytics.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>
      )}

        </div>

        {/* Right column: live preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <QrPreviewPane
              tenantId={tenantId}
              settings={settings}
              previewUrl={previewUrl}
            />

            {/* Save Button */}
            <div className="flex flex-col gap-3">
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm text-green-600 justify-center">
                  <CheckCircle2 className="h-4 w-4" /> Saved successfully
                </span>
              )}
              {error && (
                <span className="inline-flex items-center gap-1 text-sm text-red-600 justify-center">
                  <AlertCircle className="h-4 w-4" /> {error}
                </span>
              )}
              <Button onClick={handleSave} disabled={saving || !isTierEnabled} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {isTierEnabled && settings.qr_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" />
              What's Next
            </CardTitle>
            <p className="text-sm text-neutral-600 mt-1">
              Continue setup for the QR code features you just enabled
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/t/${tenantId}/settings/storefront-options`}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:border-gray-300 text-neutral-900 transition-colors"
              >
                <QrCode className="h-5 w-5 shrink-0 text-neutral-600" />
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
                  <p className="font-medium text-sm">Image Gallery Settings</p>
                  <p className="text-xs opacity-80 truncate">Configure gallery display and layout options</p>
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
