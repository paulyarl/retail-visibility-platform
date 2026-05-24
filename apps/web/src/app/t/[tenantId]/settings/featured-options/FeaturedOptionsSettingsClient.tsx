'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Star, ShoppingBag, TrendingUp, Save, AlertCircle } from 'lucide-react';
import { useFeaturedOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';
import {
  FeaturedType,
  TENANT_FEATURED_TYPES,
  PLATFORM_FEATURED_TYPES,
  getFeaturedTypeMeta,
} from '@/utils/featuredOptions';

interface FeaturedOptionsSettings {
  featured_enabled: boolean;
  featured_store_selection: boolean;
  featured_new_arrival: boolean;
  featured_seasonal: boolean;
  featured_sale: boolean;
  featured_staff_pick: boolean;
  featured_clearance: boolean;
  featured_featured: boolean;
  featured_bestseller: boolean;
  featured_trending: boolean;
  featured_recommended: boolean;
  featured_random_featured: boolean;
}

interface FeaturedOptionsSettingsClientProps {
  tenantId: string;
}

const FEATURED_TYPE_TO_SETTING_KEY: Record<FeaturedType, keyof Omit<FeaturedOptionsSettings, 'featured_enabled'>> = {
  store_selection: 'featured_store_selection',
  new_arrival: 'featured_new_arrival',
  seasonal: 'featured_seasonal',
  sale: 'featured_sale',
  staff_pick: 'featured_staff_pick',
  clearance: 'featured_clearance',
  featured: 'featured_featured',
  bestseller: 'featured_bestseller',
  trending: 'featured_trending',
  recommended: 'featured_recommended',
  random_featured: 'featured_random_featured',
};

export default function FeaturedOptionsSettingsClient({ tenantId }: FeaturedOptionsSettingsClientProps) {
  // Capability-driven content control
  const featuredCap = useFeaturedOptionsCapability(tenantId, { forTenant: true });
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });
  const isFeaturedEnabled = featuredCap.data?.enabled ?? true;
  const allowedTenantTypes = featuredCap.data?.allowedTenantTypes ?? TENANT_FEATURED_TYPES;
  const allowedPlatformTypes = featuredCap.data?.allowedPlatformTypes ?? [];
  const isFlexible = featuredCap.data?.isFlexible ?? false;

  const [settings, setSettings] = useState<FeaturedOptionsSettings>({
    featured_enabled: true,
    featured_store_selection: true,
    featured_new_arrival: true,
    featured_seasonal: true,
    featured_sale: true,
    featured_staff_pick: true,
    featured_clearance: true,
    featured_featured: true,
    featured_bestseller: true,
    featured_trending: true,
    featured_recommended: true,
    featured_random_featured: true,
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
      const settings = await platformHomeService.getTenantFeaturedOptionsSettings(tenantId);
      if (settings) {
        setSettings({
          featured_enabled: settings.featured_enabled ?? true,
          featured_store_selection: settings.featured_store_selection ?? true,
          featured_new_arrival: settings.featured_new_arrival ?? true,
          featured_seasonal: settings.featured_seasonal ?? true,
          featured_sale: settings.featured_sale ?? true,
          featured_staff_pick: settings.featured_staff_pick ?? true,
          featured_clearance: settings.featured_clearance ?? true,
          featured_featured: settings.featured_featured ?? true,
          featured_bestseller: settings.featured_bestseller ?? true,
          featured_trending: settings.featured_trending ?? true,
          featured_recommended: settings.featured_recommended ?? true,
          featured_random_featured: settings.featured_random_featured ?? true,
        });
      }
    } catch (err) {
      console.error('Failed to load featured options settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantFeaturedOptionsSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save featured options settings');
      }

      setMessage({ type: 'success', text: 'Featured options settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof FeaturedOptionsSettings) => {
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
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="featured_options" />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Global Featured Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary-600" />
            Featured Products
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable the featured products system for your storefront. When disabled, no featured sections will appear.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-neutral-900">Featured Products Enabled</p>
                <p className="text-sm text-neutral-600">Show featured product sections on your storefront and directory listing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isFeaturedEnabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="featured-enabled-toggle"
                checked={settings.featured_enabled}
                onCheckedChange={() => handleToggle('featured_enabled')}
                disabled={!isFeaturedEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant-Controlled Featured Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary-600" />
            Tenant-Controlled Featured Types
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Choose which featured types are active on your storefront. You control which products appear in these sections.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TENANT_FEATURED_TYPES.map(type => {
              const meta = getFeaturedTypeMeta(type);
              const settingKey = FEATURED_TYPE_TO_SETTING_KEY[type];
              const isAllowed = isFlexible || allowedTenantTypes.includes(type);
              const isChecked = isAllowed && settings[settingKey];
              return (
                <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
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
                      disabled={!isAllowed || !settings.featured_enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Platform-Controlled Featured Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" />
            Platform-Controlled Featured Types
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            These featured types are determined by the platform algorithm. Enable them to allow your products to appear in these sections based on sales, popularity, and other signals.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PLATFORM_FEATURED_TYPES.map(type => {
              const meta = getFeaturedTypeMeta(type);
              const settingKey = FEATURED_TYPE_TO_SETTING_KEY[type];
              const isAllowed = isFlexible || allowedPlatformTypes.includes(type);
              const isChecked = isAllowed && settings[settingKey];
              return (
                <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
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
                      disabled={!isAllowed || !settings.featured_enabled}
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
          {saving ? 'Saving...' : 'Save Featured Options'}
        </Button>
      </div>
    </div>
  );
}
