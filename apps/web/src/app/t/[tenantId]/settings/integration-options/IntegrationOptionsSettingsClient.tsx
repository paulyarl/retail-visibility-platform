'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Link2, ShoppingCart, Search, Save, AlertCircle, ArrowRight, Plug, Package, CreditCard, Settings, Zap } from 'lucide-react';
import Link from 'next/link';
import { useIntegrationOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';
import type { IntegrationType, IntegrationGroup } from '@/services/CapabilityResolutionService';
import { clientLogger } from '@/lib/client-logger';

interface IntegrationOptionsSettings {
  integration_enabled: boolean;
  integration_clover: boolean;
  integration_square: boolean;
  integration_gbp: boolean;
  integration_google_shopping: boolean;
  integration_google_merchant_center: boolean;
  integration_gmc_sync: boolean;
  integration_propagation_gbp: boolean;
  integration_pos_enabled: boolean;
  integration_google_enabled: boolean;
  integration_flexible: boolean;
}

interface IntegrationOptionsSettingsClientProps {
  tenantId: string;
}

const INTEGRATION_TYPE_META: Record<IntegrationType, { label: string; description: string; group: IntegrationGroup; icon: typeof Link2 }> = {
  clover: { label: 'Clover POS', description: 'Real-time inventory sync with Clover POS', group: 'pos', icon: ShoppingCart },
  square: { label: 'Square POS', description: 'Real-time inventory sync with Square POS', group: 'pos', icon: ShoppingCart },
  gbp: { label: 'Google Business Profile', description: 'Sync inventory to Google Business Profile', group: 'google', icon: Search },
  google_shopping: { label: 'Google Shopping Feed', description: 'List products on Google Shopping', group: 'google', icon: Search },
  google_merchant_center: { label: 'Google Merchant Center', description: 'Sync inventory to Google Merchant Center', group: 'google', icon: Search },
  gmc_sync: { label: 'Advanced GMC Sync', description: 'Advanced sync with variant and propagation support', group: 'google', icon: Search },
  propagation_gbp: { label: 'GBP Propagation', description: 'Propagate GBP data across organization locations', group: 'google', icon: Search },
};

const INTEGRATION_TYPE_TO_SETTING_KEY: Record<IntegrationType, keyof Omit<IntegrationOptionsSettings, 'integration_enabled' | 'integration_flexible' | 'integration_pos_enabled' | 'integration_google_enabled'>> = {
  clover: 'integration_clover',
  square: 'integration_square',
  gbp: 'integration_gbp',
  google_shopping: 'integration_google_shopping',
  google_merchant_center: 'integration_google_merchant_center',
  gmc_sync: 'integration_gmc_sync',
  propagation_gbp: 'integration_propagation_gbp',
};

const POS_TYPES: IntegrationType[] = ['clover', 'square'];
const GOOGLE_TYPES: IntegrationType[] = ['gbp', 'google_shopping', 'google_merchant_center', 'gmc_sync', 'propagation_gbp'];

const DEFAULT_SETTINGS: IntegrationOptionsSettings = {
  integration_enabled: true,
  integration_clover: true,
  integration_square: true,
  integration_gbp: true,
  integration_google_shopping: true,
  integration_google_merchant_center: true,
  integration_gmc_sync: true,
  integration_propagation_gbp: true,
  integration_pos_enabled: true,
  integration_google_enabled: true,
  integration_flexible: false,
};

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Link2;
  variant: 'pos' | 'google' | 'general' | 'commerce';
}

function getQuickActions(settings: IntegrationOptionsSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];

  if (!settings.integration_enabled) {
    return actions;
  }

  // POS-specific actions
  if (settings.integration_pos_enabled) {
    if (settings.integration_clover) {
      actions.push({
        id: 'clover-setup',
        label: 'Connect Clover POS',
        description: 'Authorize and sync your Clover inventory',
        href: `/t/${tenantId}/settings/integrations/clover`,
        icon: Plug,
        variant: 'pos',
      });
    }
    if (settings.integration_square) {
      actions.push({
        id: 'square-setup',
        label: 'Connect Square POS',
        description: 'Authorize and sync your Square inventory',
        href: `/t/${tenantId}/settings/integrations/square`,
        icon: Plug,
        variant: 'pos',
      });
    }
    if (!settings.integration_clover && !settings.integration_square) {
      actions.push({
        id: 'pos-dashboard',
        label: 'View POS Integrations',
        description: 'Explore available POS connection options',
        href: `/t/${tenantId}/settings/integrations`,
        icon: ShoppingCart,
        variant: 'pos',
      });
    }
  }

  // Google-specific actions
  if (settings.integration_google_enabled) {
    const hasGoogleSpecific = settings.integration_gbp ||
      settings.integration_google_shopping ||
      settings.integration_google_merchant_center ||
      settings.integration_gmc_sync ||
      settings.integration_propagation_gbp;

    if (hasGoogleSpecific) {
      actions.push({
        id: 'google-setup',
        label: 'Configure Google Integrations',
        description: 'Connect Google Merchant Center, Business Profile, and Shopping',
        href: `/t/${tenantId}/settings/integrations/google`,
        icon: Search,
        variant: 'google',
      });
    } else {
      actions.push({
        id: 'google-dashboard',
        label: 'View Google Integrations',
        description: 'Explore Google visibility and sync options',
        href: `/t/${tenantId}/settings/integrations/google`,
        icon: Search,
        variant: 'google',
      });
    }
  }

  // General complementary actions
  if (actions.length > 0) {
    actions.push({
      id: 'manage-products',
      label: 'Manage Products',
      description: 'Review and organize your product catalog for sync',
      href: `/t/${tenantId}/items`,
      icon: Package,
      variant: 'general',
    });
    actions.push({
      id: 'payment-gateways',
      label: 'Configure Payment Gateways',
      description: 'Set up how customers pay for orders',
      href: `/t/${tenantId}/settings/payment-gateways`,
      icon: CreditCard,
      variant: 'commerce',
    });
  }

  return actions;
}

export default function IntegrationOptionsSettingsClient({ tenantId }: IntegrationOptionsSettingsClientProps) {
  const integrationCap = useIntegrationOptionsCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const isIntegrationExplicitlyDisabled = !!integrationCap.data?.features?.integration_disabled;
  const allowedTypes = integrationCap.data?.allowedTypes ?? Object.keys(INTEGRATION_TYPE_META) as IntegrationType[];
  const isFlexible = integrationCap.data?.isFlexible ?? false;
  const isPosGroupEnabled = integrationCap.data?.posEnabled ?? true;
  const isGoogleGroupEnabled = integrationCap.data?.googleEnabled ?? true;

  const [settings, setSettings] = useState<IntegrationOptionsSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await platformHomeService.getTenantIntegrationOptionsSettings(tenantId);
      if (result) {
        setSettings({
          integration_enabled: result.integration_enabled ?? true,
          integration_clover: result.integration_clover ?? true,
          integration_square: result.integration_square ?? true,
          integration_gbp: result.integration_gbp ?? true,
          integration_google_shopping: result.integration_google_shopping ?? true,
          integration_google_merchant_center: result.integration_google_merchant_center ?? true,
          integration_gmc_sync: result.integration_gmc_sync ?? true,
          integration_propagation_gbp: result.integration_propagation_gbp ?? true,
          integration_pos_enabled: result.integration_pos_enabled ?? true,
          integration_google_enabled: result.integration_google_enabled ?? true,
          integration_flexible: result.integration_flexible ?? false,
        });
      }
    } catch (err) {
      clientLogger.error('Failed to load integration options settings:', { detail: err });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantIntegrationOptionsSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save integration options settings');
      }

      setMessage({ type: 'success', text: 'Integration options settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof IntegrationOptionsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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

  // Only block the entire page when integration_disabled is explicitly true at the tier level
  if (isIntegrationExplicitlyDisabled) {
    return (
      <div className="space-y-6">
        <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />
        <div className="p-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Integrations Not Available
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-2xl mx-auto">
            Integrations are not included in your current plan. Upgrade to access POS connections, Google Merchant Center, and more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Summary Widget */}
      <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Global Integration Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary-600" />
            Integrations
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable the integrations system for your store. When disabled, no integrations will be available.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-neutral-900">Integrations Enabled</p>
                <p className="text-sm text-neutral-600">Allow third-party integrations to connect to your store</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isIntegrationExplicitlyDisabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="integration-enabled-toggle"
                checked={settings.integration_enabled}
                onCheckedChange={() => handleToggle('integration_enabled')}
                disabled={isIntegrationExplicitlyDisabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* POS Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            POS Integrations
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Connect with POS systems to sync inventory and orders in real time.
          </p>
        </CardHeader>
        <CardContent>
          {/* POS Group Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-neutral-900">POS Integrations Group</p>
                <p className="text-sm text-neutral-600">Enable all POS-type integrations at once</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isPosGroupEnabled && !isFlexible && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="pos-group-toggle"
                checked={settings.integration_pos_enabled}
                onCheckedChange={() => handleToggle('integration_pos_enabled')}
                disabled={(!isPosGroupEnabled && !isFlexible) || !settings.integration_enabled}
              />
            </div>
          </div>

          <div className="space-y-4">
            {POS_TYPES.map(type => {
              const meta = INTEGRATION_TYPE_META[type];
              const settingKey = INTEGRATION_TYPE_TO_SETTING_KEY[type];
              const isAllowed = isFlexible || allowedTypes.includes(type);
              const isChecked = isAllowed && settings[settingKey];
              const IconComp = meta.icon;
              return (
                <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <IconComp className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-neutral-900">{meta.label}</p>
                      <p className="text-sm text-neutral-600">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isAllowed && (
                      <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                    )}
                    <Switch
                      id={`${type}-toggle`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(settingKey)}
                      disabled={!isAllowed || !settings.integration_enabled || !settings.integration_pos_enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Google Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary-600" />
            Google Integrations
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Connect with Google services to boost your product visibility and sync data.
          </p>
        </CardHeader>
        <CardContent>
          {/* Google Group Toggle */}
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 mb-4">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-neutral-900">Google Integrations Group</p>
                <p className="text-sm text-neutral-600">Enable all Google-type integrations at once</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isGoogleGroupEnabled && !isFlexible && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="google-group-toggle"
                checked={settings.integration_google_enabled}
                onCheckedChange={() => handleToggle('integration_google_enabled')}
                disabled={(!isGoogleGroupEnabled && !isFlexible) || !settings.integration_enabled}
              />
            </div>
          </div>

          <div className="space-y-4">
            {GOOGLE_TYPES.map(type => {
              const meta = INTEGRATION_TYPE_META[type];
              const settingKey = INTEGRATION_TYPE_TO_SETTING_KEY[type];
              const isAllowed = isFlexible || allowedTypes.includes(type);
              const isChecked = isAllowed && settings[settingKey];
              const IconComp = meta.icon;
              return (
                <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <IconComp className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-neutral-900">{meta.label}</p>
                      <p className="text-sm text-neutral-600">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isAllowed && (
                      <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                    )}
                    <Switch
                      id={`${type}-toggle`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(settingKey)}
                      disabled={!isAllowed || !settings.integration_enabled || !settings.integration_google_enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Integration Options'}
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
                Continue setup for the integrations you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    pos: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    google: 'bg-green-50 border-green-200 hover:border-green-300 text-green-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                    commerce: 'bg-purple-50 border-purple-200 hover:border-purple-300 text-purple-900',
                  };
                  const iconStyles = {
                    pos: 'text-blue-600',
                    google: 'text-green-600',
                    general: 'text-neutral-600',
                    commerce: 'text-purple-600',
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
