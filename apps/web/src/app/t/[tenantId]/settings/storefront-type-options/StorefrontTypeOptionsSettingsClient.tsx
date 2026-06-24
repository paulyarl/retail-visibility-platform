'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Store, Globe, Building2, Wrench, Share2, Save, AlertCircle, ArrowRight, Zap, Settings, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface StorefrontTypeSettings {
  storefront_type_enabled: boolean;
  selected_storefront_type: 'online' | 'retail' | 'service' | 'social' | 'flexible' | null;
}

interface StorefrontTypeOptionsSettingsClientProps {
  tenantId: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Store;
  variant: 'general' | 'storefront';
}

function getQuickActions(settings: StorefrontTypeSettings, tenantId: string, type: string): QuickAction[] {
  const actions: QuickAction[] = [];

  if (!settings.storefront_type_enabled) return actions;

  if (type === 'online' || type === 'flexible') {
    actions.push({
      id: 'storefront',
      label: 'View Storefront',
      description: 'Preview your online storefront',
      href: `/tenant/${tenantId}`,
      icon: Globe,
      variant: 'storefront',
    });
  }

  if (type === 'retail' || type === 'flexible') {
    actions.push({
      id: 'directory',
      label: 'Directory Listing',
      description: 'Manage your retail directory presence',
      href: `/t/${tenantId}/settings/directory`,
      icon: Building2,
      variant: 'storefront',
    });
  }

  if (type === 'social' || type === 'flexible') {
    actions.push({
      id: 'social-commerce',
      label: 'Social Commerce',
      description: 'Manage TikTok/Instagram shopping integration',
      href: `/t/${tenantId}/settings/social-commerce`,
      icon: Share2,
      variant: 'storefront',
    });
  }

  actions.push({
    id: 'storefront-options',
    label: 'Storefront Options',
    description: 'Configure hours, maps, and display options',
    href: `/t/${tenantId}/settings/storefront-options`,
    icon: Settings,
    variant: 'general',
  });

  return actions;
}

export default function StorefrontTypeOptionsSettingsClient({ tenantId }: StorefrontTypeOptionsSettingsClientProps) {
  const storefrontCap = useStorefrontCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const resolvedState = storefrontCap.data;
  // Distinguish tier-gated from merchant-gated:
  // - enabled=true → fully enabled
  // - enabled=false + merchantPrefs.storefront_type_enabled=false → merchant-gated (tier allows, merchant disabled)
  // - enabled=false + merchantPrefs.storefront_type_enabled=true → tier-gated (not in plan)
  const isTierAllowed = resolvedState
    ? resolvedState.enabled || resolvedState.merchantPreferences.storefront_type_enabled === false
    : true;
  const tierType = storefrontCap.data?.type ?? 'none';
  const allowedTypes = storefrontCap.data?.allowedTypes ?? [];

  const [settings, setSettings] = useState<StorefrontTypeSettings>({
    storefront_type_enabled: true,
    selected_storefront_type: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await platformHomeService.getTenantStorefrontTypeSettings(tenantId);
      if (data) {
        setSettings({
          storefront_type_enabled: data.storefront_type_enabled ?? true,
          selected_storefront_type: data.selected_storefront_type ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to load storefront type settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantStorefrontTypeSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save storefront type settings');
      }

      setMessage({ type: 'success', text: 'Storefront type settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof StorefrontTypeSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTypeChange = (type: 'online' | 'retail' | 'service' | 'social') => {
    setSettings(prev => ({ ...prev, selected_storefront_type: type }));
  };

  const typeOptions: { value: 'online' | 'retail' | 'service' | 'social'; label: string; description: string; icon: typeof Globe }[] = [
    { value: 'online', label: 'Online', description: 'E-commerce and digital storefront', icon: Globe },
    { value: 'retail', label: 'Retail', description: 'Physical store and in-person sales', icon: Building2 },
    { value: 'service', label: 'Service', description: 'Service-based business model', icon: Wrench },
    { value: 'social', label: 'Social', description: 'Social commerce (TikTok/Instagram) storefront', icon: Share2 },
  ];

  const effectiveType = settings.storefront_type_enabled && settings.selected_storefront_type && allowedTypes.includes(settings.selected_storefront_type)
    ? settings.selected_storefront_type
    : (allowedTypes.length === 1 ? allowedTypes[0] : tierType);

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
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="storefront_types" tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary-600" />
            Storefront
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable your storefront presence.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Enable Storefront</p>
                <p className="text-sm text-neutral-600">Allow customers to view and interact with your storefront</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isTierAllowed && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              {isTierAllowed && !settings.storefront_type_enabled && (
                <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
              )}
              <Switch
                id="storefront-enabled-toggle"
                checked={isTierAllowed ? settings.storefront_type_enabled : false}
                onCheckedChange={() => handleToggle('storefront_type_enabled')}
                disabled={!isTierAllowed}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storefront Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Storefront Type
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            {allowedTypes.length > 1
              ? 'Your plan supports multiple storefront types. Select the one that best fits your business.'
              : 'Your current plan determines your storefront type. Upgrade to switch between types.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {typeOptions.map(({ value, label, description, icon: IconComp }) => {
              const isAllowed = allowedTypes.includes(value);
              const activeSelection = settings.selected_storefront_type ?? (tierType !== 'flexible' && tierType !== 'none' ? tierType : null);
              const isSelected = activeSelection === value;
              const canSelect = settings.storefront_type_enabled && isAllowed;

              return (
                <div
                  key={value}
                  onClick={() => canSelect && handleTypeChange(value)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${isSelected && canSelect
                      ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-300'
                      : 'bg-gray-50 border-gray-200'
                    } ${canSelect ? 'cursor-pointer hover:border-gray-300' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isSelected && canSelect ? 'bg-primary-100' : 'bg-gray-200'
                    }`}>
                    <IconComp className={`h-5 w-5 ${isSelected && canSelect ? 'text-primary-600' : 'text-neutral-500'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${isSelected && canSelect ? 'text-primary-700' : 'text-neutral-900'}`}>
                        {label}
                      </p>
                      {isAllowed && allowedTypes.length === 1 && allowedTypes[0] === value && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Current</span>
                      )}
                      {!isAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">{description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected && canSelect
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-300'
                    }`}>
                    {isSelected && canSelect && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          {allowedTypes.length <= 1 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                {allowedTypes.length === 1
                  ? <>Your current plan only supports the <strong>{allowedTypes[0]}</strong> storefront type. To enable multiple types, upgrade your plan.</>
                  : <>No storefront types are enabled in your current plan. Upgrade to access storefront types.</>
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Selection Summary */}
      {settings.storefront_type_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-primary-600" />
              Current Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-sm text-neutral-600">
                Your storefront is currently configured as: <strong className="text-neutral-900 capitalize">{effectiveType}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Storefront Type Options'}
        </Button>
      </div>

      {/* Next Steps */}
      {(() => {
        const actions = getQuickActions(settings, tenantId, effectiveType);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue setting up your storefront
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    storefront: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    storefront: 'text-blue-600',
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
