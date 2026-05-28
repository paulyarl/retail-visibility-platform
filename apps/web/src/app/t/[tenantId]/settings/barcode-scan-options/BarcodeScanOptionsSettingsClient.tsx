'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ScanLine, Keyboard, Usb, Camera, Save, AlertCircle, ArrowRight, Zap, Barcode, Package, Settings } from 'lucide-react';
import Link from 'next/link';
import { useBarcodeScanCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface BarcodeScanSettings {
  barcode_enabled: boolean;
  barcode_scan_enabled: boolean;
  barcode_manual_enabled: boolean;
  barcode_usb_enabled: boolean;
  barcode_camera_enabled: boolean;
  default_scan_mode: 'scan' | 'manual' | 'usb' | 'camera';
}

interface BarcodeScanOptionsSettingsClientProps {
  tenantId: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Barcode;
  variant: 'general' | 'scan';
}

function getQuickActions(settings: BarcodeScanSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];

  if (!settings.barcode_enabled) return actions;

  if (settings.barcode_scan_enabled || settings.barcode_manual_enabled || settings.barcode_usb_enabled || settings.barcode_camera_enabled) {
    actions.push({
      id: 'scan',
      label: 'Open Scanner',
      description: 'Launch the barcode scanner to scan products',
      href: `/t/${tenantId}/scan`,
      icon: ScanLine,
      variant: 'scan',
    });
    actions.push({
      id: 'items',
      label: 'Browse Items',
      description: 'View and manage items with barcode scanning support',
      href: `/t/${tenantId}/items`,
      icon: Package,
      variant: 'scan',
    });
    actions.push({
      id: 'quickstart',
      label: 'Quick Start',
      description: 'Get started quickly with guided setup',
      href: `/t/${tenantId}/quick-start`,
      icon: Zap,
      variant: 'scan',
    });
  }

  return actions;
}

export default function BarcodeScanOptionsSettingsClient({ tenantId }: BarcodeScanOptionsSettingsClientProps) {
  // Barcode scan capability-driven content control
  const barcodeCap = useBarcodeScanCapability(tenantId, { forTenant: true });
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });
  const isBarcodeEnabled = barcodeCap.data?.enabled ?? true;
  const allowedModes = barcodeCap.data?.allowedModes ?? ['scan', 'manual', 'usb', 'camera'];
  const isFlexible = barcodeCap.data?.isFlexible ?? false;

  const [settings, setSettings] = useState<BarcodeScanSettings>({
    barcode_enabled: true,
    barcode_scan_enabled: true,
    barcode_manual_enabled: true,
    barcode_usb_enabled: false,
    barcode_camera_enabled: false,
    default_scan_mode: 'scan',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings from backend
  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await platformHomeService.getTenantBarcodeScanSettings(tenantId);
      if (settings) {
        setSettings({
          barcode_enabled: settings.barcode_enabled ?? true,
          barcode_scan_enabled: settings.barcode_scan_enabled ?? true,
          barcode_manual_enabled: settings.barcode_manual_enabled ?? true,
          barcode_usb_enabled: settings.barcode_usb_enabled ?? false,
          barcode_camera_enabled: settings.barcode_camera_enabled ?? false,
          default_scan_mode: settings.default_scan_mode ?? 'scan',
        });
      }
    } catch (err) {
      console.error('Failed to load barcode scan settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantBarcodeScanSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save barcode scan settings');
      }

      setMessage({ type: 'success', text: 'Barcode scan settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof BarcodeScanSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDefaultModeChange = (mode: BarcodeScanSettings['default_scan_mode']) => {
    setSettings(prev => ({ ...prev, default_scan_mode: mode }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-neutral-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="barcode_scan_options" tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-primary-600" />
            Barcode Scanning
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable barcode scanning features for your store.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <ScanLine className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Enable Barcode Scanning</p>
                <p className="text-sm text-neutral-600">Allow barcode scanning throughout the platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isBarcodeEnabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="barcode-enabled-toggle"
                checked={isBarcodeEnabled && settings.barcode_enabled}
                onCheckedChange={() => handleToggle('barcode_enabled')}
                disabled={!isBarcodeEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scan Modes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Scan Modes
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Choose which barcode scanning methods are available to your team.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Standard Scan */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <ScanLine className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-neutral-900">Standard Scan</p>
                  <p className="text-sm text-neutral-600">Built-in barcode scanner input</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedModes.includes('scan') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="scan-toggle"
                  checked={allowedModes.includes('scan') && settings.barcode_scan_enabled}
                  onCheckedChange={() => handleToggle('barcode_scan_enabled')}
                  disabled={!allowedModes.includes('scan') || !settings.barcode_enabled}
                />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Keyboard className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-neutral-900">Manual Entry</p>
                  <p className="text-sm text-neutral-600">Type barcode numbers by hand</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedModes.includes('manual') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="manual-toggle"
                  checked={allowedModes.includes('manual') && settings.barcode_manual_enabled}
                  onCheckedChange={() => handleToggle('barcode_manual_enabled')}
                  disabled={!allowedModes.includes('manual') || !settings.barcode_enabled}
                />
              </div>
            </div>

            {/* USB Scanner */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Usb className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-neutral-900">USB Scanner</p>
                  <p className="text-sm text-neutral-600">External USB barcode scanner support</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedModes.includes('usb') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="usb-toggle"
                  checked={allowedModes.includes('usb') && settings.barcode_usb_enabled}
                  onCheckedChange={() => handleToggle('barcode_usb_enabled')}
                  disabled={!allowedModes.includes('usb') || !settings.barcode_enabled}
                />
              </div>
            </div>

            {/* Camera Scan */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-neutral-900">Camera Scan</p>
                  <p className="text-sm text-neutral-600">Use device camera to scan barcodes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedModes.includes('camera') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="camera-toggle"
                  checked={allowedModes.includes('camera') && settings.barcode_camera_enabled}
                  onCheckedChange={() => handleToggle('barcode_camera_enabled')}
                  disabled={!allowedModes.includes('camera') || !settings.barcode_enabled}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Default Scan Mode
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Choose the default scanning method when multiple are enabled.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { mode: 'scan' as const, label: 'Standard Scan', icon: ScanLine },
              { mode: 'manual' as const, label: 'Manual Entry', icon: Keyboard },
              { mode: 'usb' as const, label: 'USB Scanner', icon: Usb },
              { mode: 'camera' as const, label: 'Camera Scan', icon: Camera },
            ]).map(({ mode, label, icon: IconComp }) => {
              const isEnabled = settings.barcode_enabled && (() => {
                if (mode === 'scan') return settings.barcode_scan_enabled;
                if (mode === 'manual') return settings.barcode_manual_enabled;
                if (mode === 'usb') return settings.barcode_usb_enabled;
                if (mode === 'camera') return settings.barcode_camera_enabled;
                return false;
              })();
              return (
                <button
                  key={mode}
                  onClick={() => handleDefaultModeChange(mode)}
                  disabled={!isEnabled}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                    settings.default_scan_mode === mode
                      ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-300'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <IconComp className={`h-5 w-5 ${settings.default_scan_mode === mode ? 'text-primary-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${settings.default_scan_mode === mode ? 'text-primary-700' : 'text-neutral-700'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Barcode Scan Options'}
        </Button>
      </div>

      {/* Next Steps — contextual destinations based on saved preferences */}
      {(() => {
        const actions = getQuickActions(settings, tenantId);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue working with the barcode scanning options you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    scan: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    scan: 'text-blue-600',
                    general: 'text-neutral-600',
                  };
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${variantStyles[action.variant]}`}
                    >
                      <IconComp className={`h-5 w-5 shrink-0 ${iconStyles[action.variant]}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{action.label}</p>
                        <p className="text-xs opacity-80 truncate">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
