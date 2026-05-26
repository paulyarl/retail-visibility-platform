'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Link2, ShoppingCart, Search, Save, AlertCircle } from 'lucide-react';
import { useIntegrationOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';
import type { IntegrationType, IntegrationGroup } from '@/services/CapabilityResolutionService';

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

export default function IntegrationOptionsSettingsClient({ tenantId }: IntegrationOptionsSettingsClientProps) {
  const integrationCap = useIntegrationOptionsCapability(tenantId, { forTenant: true });
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });
  const isIntegrationEnabled = integrationCap.data?.enabled ?? true;
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
      console.error('Failed to load integration options settings:', err);
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

  return (
    <div className="space-y-6">
      {/* Plan Summary */}
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="integration_options" tenantId={tenantId} />

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
              {!isIntegrationEnabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="integration-enabled-toggle"
                checked={settings.integration_enabled}
                onCheckedChange={() => handleToggle('integration_enabled')}
                disabled={!isIntegrationEnabled}
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
    </div>
  );
}
