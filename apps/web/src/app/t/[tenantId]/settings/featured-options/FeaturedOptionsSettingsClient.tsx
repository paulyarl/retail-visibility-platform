'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Star, ShoppingBag, TrendingUp, Save, AlertCircle, ArrowRight, Zap, Tag, Plus, Sparkles, BarChart3 } from 'lucide-react';
import Link from 'next/link';
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
  featured_expiry_monitor: boolean;
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

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Star;
  variant: 'general' | 'featured' | 'product';
}

function getQuickActions(settings: FeaturedOptionsSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];
  if (!settings.featured_enabled) return actions;

  const anyTenantTypeEnabled = TENANT_FEATURED_TYPES.some(type => settings[FEATURED_TYPE_TO_SETTING_KEY[type]]);
  const anyPlatformTypeEnabled = PLATFORM_FEATURED_TYPES.some(type => settings[FEATURED_TYPE_TO_SETTING_KEY[type]]);

  if (anyTenantTypeEnabled || anyPlatformTypeEnabled) {
    actions.push({
      id: 'featured-products',
      label: 'Manage Featured Products',
      description: 'Curate products for your featured sections',
      href: `/t/${tenantId}/settings/featured-products`,
      icon: Tag,
      variant: 'featured',
    });
    actions.push({
      id: 'items',
      label: 'Browse Items',
      description: 'Review and tag items for featuring',
      href: `/t/${tenantId}/items`,
      icon: ShoppingBag,
      variant: 'product',
    });
    actions.push({
      id: 'create-item',
      label: 'Create New Item',
      description: 'Add a new product to feature on your storefront',
      href: `/t/${tenantId}/items/create`,
      icon: Plus,
      variant: 'product',
    });
    actions.push({
      id: 'custom-badges',
      label: 'Create Custom Badges',
      description: 'Design custom badges to highlight products in your storefront',
      href: `/t/${tenantId}/settings/products/badges`,
      icon: Sparkles,
      variant: 'featured',
    });
    actions.push({
      id: 'badge-analytics',
      label: 'Badge Analytics',
      description: 'Track badge performance, CTR, and revenue impact',
      href: `/t/${tenantId}/settings/products/badges/analytics`,
      icon: BarChart3,
      variant: 'featured',
    });
  }

  return actions;
}

export default function FeaturedOptionsSettingsClient({ tenantId }: FeaturedOptionsSettingsClientProps) {
  // Capability-driven content control
  const featuredCap = useFeaturedOptionsCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
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
    featured_expiry_monitor: false,
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
          featured_expiry_monitor: settings.featured_expiry_monitor ?? false,
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
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="featured_options" tenantId={tenantId} />

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

      {/* Featured Expiry Monitor — Tier-Gated Capability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            Expiry Monitor
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Proactive CRM task alerts when your featured products are about to expire or have expired. Auto-unfeature expired products and get notified before they disappear.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-neutral-900">Featured Expiry Monitor</p>
                <p className="text-sm text-neutral-600">Get CRM task alerts 3 days before featured products expire, and when they auto-unfeature</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!featuredCap.data?.expiryMonitorEnabled && (
                <span className="text-xs text-amber-600 font-medium">Professional plan and above</span>
              )}
              <Switch
                id="featured-expiry-monitor-toggle"
                checked={settings.featured_expiry_monitor}
                onCheckedChange={() => handleToggle('featured_expiry_monitor')}
                disabled={!featuredCap.data?.expiryMonitorEnabled || !settings.featured_enabled}
              />
            </div>
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
                Continue setup for the featured sections you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    featured: 'bg-amber-50 border-amber-200 hover:border-amber-300 text-amber-900',
                    product: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    featured: 'text-amber-600',
                    product: 'text-blue-600',
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
