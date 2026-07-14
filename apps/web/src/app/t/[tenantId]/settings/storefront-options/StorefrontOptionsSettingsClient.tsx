'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Save, AlertCircle, CheckCircle2, Clock, LayoutGrid, Star, Eye, Info, QrCode, Image, Zap, ArrowRight, Building, Paintbrush, MapPin, CalendarDays, Tag, FolderOpen, Globe } from 'lucide-react';
import Link from 'next/link';
import { useStorefrontOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { STOREFRONT_OPT_GROUPS, getStorefrontOptMeta, StorefrontOptGroup } from '@/utils/storefrontOptions';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface StorefrontOptionsSettings {
  storefront_opt_enabled: boolean;
  hours_animated: boolean;
  hours_status: boolean;
  category_store: boolean;
  category_product: boolean;
  recommend_store: boolean;
  recommend_products: boolean;
  recently_viewed: boolean;
  storefront_social_media: boolean;
  storefront_contact: boolean;
  interactive_maps: boolean;
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
  image_gallery_5: boolean;
  image_gallery_10: boolean;
  image_gallery_15: boolean;
  gallery_display_mode: 'carousel' | 'magazine';
  enhanced_seo: boolean;
  storefront_actions: boolean;
  storefront_layout: 'classic' | 'editorial' | 'immersive';
  default_qr_resolution: string;
  default_gallery_limit: number;
}

interface StorefrontOptionsSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: StorefrontOptionsSettings = {
  storefront_opt_enabled: true,
  hours_animated: true,
  hours_status: true,
  category_store: true,
  category_product: true,
  recommend_store: true,
  recommend_products: true,
  recently_viewed: true,
  storefront_social_media: true,
  storefront_contact: true,
  interactive_maps: true,
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
  image_gallery_5: true,
  image_gallery_10: false,
  image_gallery_15: false,
  gallery_display_mode: 'carousel',
  enhanced_seo: false,
  storefront_actions: false,
  storefront_layout: 'classic',
  default_qr_resolution: '1024',
  default_gallery_limit: 5,
};

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Building;
  variant: 'general' | 'hours' | 'branding' | 'directory';
}

function getQuickActions(settings: StorefrontOptionsSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];
  if (!settings.storefront_opt_enabled) return actions;

  if (settings.hours_animated || settings.hours_status) {
    actions.push({
      id: 'hours',
      label: 'Store Hours',
      description: 'Configure open hours and status display',
      href: `/t/${tenantId}/settings/hours`,
      icon: CalendarDays,
      variant: 'hours',
    });
  }

  if (settings.storefront_social_media || settings.storefront_contact || settings.interactive_maps) {
    actions.push({
      id: 'tenant',
      label: 'Tenant Profile',
      description: 'Manage contact info, social links, and address',
      href: `/t/${tenantId}/settings/tenant`,
      icon: Building,
      variant: 'branding',
    });
  }

  if (settings.category_store || settings.category_product) {
    actions.push({
      id: 'gbp-category',
      label: 'Business Categories',
      description: 'Set up categories for your storefront and products',
      href: `/t/${tenantId}/settings/gbp-category`,
      icon: Tag,
      variant: 'directory',
    });
  }

  actions.push({
    id: 'directory',
    label: 'Directory Settings',
    description: 'Configure how your store appears in the directory',
    href: `/t/${tenantId}/settings/directory`,
    icon: FolderOpen,
    variant: 'directory',
  });

  actions.push({
    id: 'public-storefront',
    label: 'Public Storefront',
    description: "View your store as customers see it",
    href: `/tenant/${tenantId}`,
    icon: Globe,
    variant: 'general',
  });

  actions.push({
    id: 'directory-entry',
    label: 'Directory Entry',
    description: "View your store's public directory listing",
    href: `/directory/${tenantId}`,
    icon: MapPin,
    variant: 'directory',
  });

  return actions;
}

const GROUP_ICONS: Record<StorefrontOptGroup, React.ReactNode> = {
  hours: <Clock className="w-5 h-5 text-blue-600" />,
  category: <LayoutGrid className="w-5 h-5 text-purple-600" />,
  recommend: <Star className="w-5 h-5 text-amber-600" />,
  behavior: <Eye className="w-5 h-5 text-teal-600" />,
  info: <Info className="w-5 h-5 text-cyan-600" />,
  qr: <QrCode className="w-5 h-5 text-indigo-600" />,
  gallery: <Image className="w-5 h-5 text-orange-600" />,
  gallery_mode: <Image className="w-5 h-5 text-rose-600" />,
  advanced: <Zap className="w-5 h-5 text-lime-600" />,
  layout: <LayoutGrid className="w-5 h-5 text-violet-600" />,
};

export default function StorefrontOptionsSettingsClient({ tenantId }: StorefrontOptionsSettingsClientProps) {
  const storefrontCap = useStorefrontOptionsCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);

  const [settings, setSettings] = useState<StorefrontOptionsSettings>(DEFAULT_SETTINGS);
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
      const data = await tenantInfoService.getStorefrontOptionsSettings(tenantId);
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch (err) {
      console.error('Failed to load storefront options settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof StorefrontOptionsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGalleryRadio = (selected: 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15') => {
    setSettings(prev => ({
      ...prev,
      image_gallery_5: selected === 'image_gallery_5',
      image_gallery_10: selected === 'image_gallery_10',
      image_gallery_15: selected === 'image_gallery_15',
      default_gallery_limit: selected === 'image_gallery_5' ? 5 : selected === 'image_gallery_10' ? 10 : 15,
    }));
  };

  const handleGalleryModeRadio = (mode: 'carousel' | 'magazine') => {
    setSettings(prev => ({ ...prev, gallery_display_mode: mode }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await tenantInfoService.updateStorefrontOptionsSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save storefront options settings');
      }

      setMessage({ type: 'success', text: 'Storefront options saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // Check tier-level gates for each group
  const cap = storefrontCap.data;
  const tierAllowsCategory = cap?.allowedCategoryTypes.length ?? 0 > 0;
  const tierAllowsRecommend = cap?.allowedRecommendTypes.length ?? 0 > 0;
  const tierAllowsRecentlyViewed = cap?.recentlyViewedEnabled ?? false;
  const tierAllowsInfo = cap?.allowedInfoTypes.length ?? 0 > 0;
  const tierAllowsAdvanced = cap?.allowedAdvancedTypes.length ?? 0 > 0;
  const tierAllowsLayout = (cap?.allowedLayouts.length ?? 0) > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Capability not enabled at all
  if (cap && !cap.enabled) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <PlanSummaryPanel
          capabilities={allCaps.data}
          loading={allCaps.loading}
          highlightCapability="storefront_options"
          tenantId={tenantId}
        />
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Storefront options not available on your plan</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Upgrade your plan to unlock storefront customization options including animated hours, QR codes, gallery limits, and more.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Plan Summary */}
      <PlanSummaryPanel
        capabilities={allCaps.data}
        loading={allCaps.loading}
        highlightCapability="storefront_options"
        tenantId={tenantId}
      />

      {/* Master Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Storefront Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium">Enable Storefront Options</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Master switch for all storefront display and behavior features
              </p>
            </div>
            <Switch
              checked={settings.storefront_opt_enabled}
              onCheckedChange={() => handleToggle('storefront_opt_enabled')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Display Group */}
      {tierAllowsCategory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {GROUP_ICONS.category}
              Category Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cap?.allowedCategoryTypes.includes('category_store') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Store Categories</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Category navigation on storefront page</p>
                </div>
                <Switch
                  checked={settings.category_store}
                  onCheckedChange={() => handleToggle('category_store')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
            {cap?.allowedCategoryTypes.includes('category_product') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Product Categories</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Category badges on product cards</p>
                </div>
                <Switch
                  checked={settings.category_product}
                  onCheckedChange={() => handleToggle('category_product')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendation Display Group */}
      {tierAllowsRecommend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {GROUP_ICONS.recommend}
              Recommendation Display
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cap?.allowedRecommendTypes.includes('recommend_store') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Store Recommendations</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recommended stores section</p>
                </div>
                <Switch
                  checked={settings.recommend_store}
                  onCheckedChange={() => handleToggle('recommend_store')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
            {cap?.allowedRecommendTypes.includes('recommend_products') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Product Recommendations</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recommended products section</p>
                </div>
                <Switch
                  checked={settings.recommend_products}
                  onCheckedChange={() => handleToggle('recommend_products')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Behavior */}
      {tierAllowsRecentlyViewed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {GROUP_ICONS.behavior}
              User Behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Recently Viewed</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track and display recently viewed products</p>
              </div>
              <Switch
                checked={settings.recently_viewed}
                onCheckedChange={() => handleToggle('recently_viewed')}
                disabled={!settings.storefront_opt_enabled}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Information Group */}
      {tierAllowsInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {GROUP_ICONS.info}
              Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cap?.allowedInfoTypes.includes('storefront_social_media') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Social Media Links</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Social media links on storefront</p>
                </div>
                <Switch
                  checked={settings.storefront_social_media}
                  onCheckedChange={() => handleToggle('storefront_social_media')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
            {cap?.allowedInfoTypes.includes('storefront_contact') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Contact Info</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact information on storefront</p>
                </div>
                <Switch
                  checked={settings.storefront_contact}
                  onCheckedChange={() => handleToggle('storefront_contact')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
            {cap?.allowedInfoTypes.includes('interactive_maps') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Interactive Maps</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Embedded interactive map on storefront</p>
                </div>
                <Switch
                  checked={settings.interactive_maps}
                  onCheckedChange={() => handleToggle('interactive_maps')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advanced Group */}
      {tierAllowsAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {GROUP_ICONS.advanced}
              Advanced
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cap?.allowedAdvancedTypes.includes('enhanced_seo') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enhanced SEO</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Advanced SEO controls and metadata</p>
                </div>
                <Switch
                  checked={settings.enhanced_seo}
                  onCheckedChange={() => handleToggle('enhanced_seo')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
            {cap?.allowedAdvancedTypes.includes('storefront_actions') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Storefront Actions</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Custom call-to-action buttons</p>
                </div>
                <Switch
                  checked={settings.storefront_actions}
                  onCheckedChange={() => handleToggle('storefront_actions')}
                  disabled={!settings.storefront_opt_enabled}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Storefront Layout Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-violet-600" />
            Storefront Layout
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose how your storefront and product pages look to customers
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Classic */}
            <button
              type="button"
              onClick={() => {
                if (cap?.canUseLayoutClassic) {
                  setSettings(s => ({ ...s, storefront_layout: 'classic' }));
                }
              }}
              disabled={!cap?.canUseLayoutClassic}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.storefront_layout === 'classic'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!cap?.canUseLayoutClassic ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.storefront_layout === 'classic' && cap?.canUseLayoutClassic && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Classic</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Traditional single-column layout.
                {!cap?.canUseLayoutClassic && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
            {/* Editorial */}
            <button
              type="button"
              onClick={() => {
                if (cap?.canUseLayoutEditorial) {
                  setSettings(s => ({ ...s, storefront_layout: 'editorial' }));
                }
              }}
              disabled={!cap?.canUseLayoutEditorial}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.storefront_layout === 'editorial'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!cap?.canUseLayoutEditorial ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.storefront_layout === 'editorial' && cap?.canUseLayoutEditorial && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Modern Editorial</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Storytelling emphasis, hero banner, split-panel product pages.
                {!cap?.canUseLayoutEditorial && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
            {/* Immersive */}
            <button
              type="button"
              onClick={() => {
                if (cap?.canUseLayoutImmersive) {
                  setSettings(s => ({ ...s, storefront_layout: 'immersive' }));
                }
              }}
              disabled={!cap?.canUseLayoutImmersive}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.storefront_layout === 'immersive'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!cap?.canUseLayoutImmersive ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.storefront_layout === 'immersive' && cap?.canUseLayoutImmersive && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Immersive Commerce</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Conversion-optimized, compact purchase flow, sticky cart.
                {!cap?.canUseLayoutImmersive && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
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
                Continue setup for the storefront features you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    hours: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    branding: 'bg-pink-50 border-pink-200 hover:border-pink-300 text-pink-900',
                    directory: 'bg-green-50 border-green-200 hover:border-green-300 text-green-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    hours: 'text-blue-600',
                    branding: 'text-pink-600',
                    directory: 'text-green-600',
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
