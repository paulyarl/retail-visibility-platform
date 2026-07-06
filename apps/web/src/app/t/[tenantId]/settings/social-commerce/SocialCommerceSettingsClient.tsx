'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  Share2,
  Camera,
  Video,
  ShoppingCart,
  BarChart3,
  Eye,
  RefreshCw,
  Save,
  AlertCircle,
  ArrowLeft,
  Lock,
  Crown,
  Tag,
  Store,
  Sparkles,
  ArrowRight,
  Zap,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { useSocialCommerceOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { socialCommerceOptionsService } from '@/services/SocialCommerceOptionsService';

interface SocialCommerceSettings {
  social_commerce_enabled: boolean;
  social_commerce_meta_enabled: boolean;
  social_commerce_meta_catalog: boolean;
  social_commerce_meta_shop: boolean;
  social_commerce_meta_pixel: boolean;
  social_commerce_tiktok_enabled: boolean;
  social_commerce_tiktok_catalog: boolean;
  social_commerce_tiktok_shop: boolean;
  social_commerce_tiktok_pixel: boolean;
  social_commerce_share_buttons: boolean;
  social_commerce_social_proof: boolean;
  social_commerce_abandoned_cart: boolean;
}

interface SocialCommerceSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: SocialCommerceSettings = {
  social_commerce_enabled: true,
  social_commerce_meta_enabled: false,
  social_commerce_meta_catalog: false,
  social_commerce_meta_shop: false,
  social_commerce_meta_pixel: false,
  social_commerce_tiktok_enabled: false,
  social_commerce_tiktok_catalog: false,
  social_commerce_tiktok_shop: false,
  social_commerce_tiktok_pixel: false,
  social_commerce_share_buttons: false,
  social_commerce_social_proof: false,
  social_commerce_abandoned_cart: false,
};

type FeatureGroup = {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: { key: keyof SocialCommerceSettings; label: string; description: string; icon: React.ReactNode }[];
};

const META_GROUP: FeatureGroup = {
  title: 'Meta Commerce',
  description: 'Instagram Shopping and Facebook Shop integrations',
  icon: <Camera className="h-5 w-5 text-pink-600" />,
  features: [
    { key: 'social_commerce_meta_catalog', label: 'Meta Catalog Sync', description: 'Sync product catalog to Meta Commerce Manager', icon: <RefreshCw className="h-5 w-5 text-pink-600" /> },
    { key: 'social_commerce_meta_shop', label: 'Meta Shop Setup', description: 'Configure Facebook Shop and Instagram Shopping storefront', icon: <Store className="h-5 w-5 text-pink-600" /> },
    { key: 'social_commerce_meta_pixel', label: 'Meta Pixel Tracking', description: 'Track conversions with Meta Pixel', icon: <BarChart3 className="h-5 w-5 text-pink-600" /> },
  ],
};

const TIKTOK_GROUP: FeatureGroup = {
  title: 'TikTok Commerce',
  description: 'TikTok Shop integration and tracking',
  icon: <Video className="h-5 w-5 text-neutral-900" />,
  features: [
    { key: 'social_commerce_tiktok_catalog', label: 'TikTok Catalog Sync', description: 'Sync product catalog to TikTok Shop', icon: <RefreshCw className="h-5 w-5 text-neutral-900" /> },
    { key: 'social_commerce_tiktok_shop', label: 'TikTok Shop Setup', description: 'Configure TikTok Shop storefront', icon: <Store className="h-5 w-5 text-neutral-900" /> },
    { key: 'social_commerce_tiktok_pixel', label: 'TikTok Pixel Tracking', description: 'Track conversions with TikTok Pixel', icon: <BarChart3 className="h-5 w-5 text-neutral-900" /> },
  ],
};

const EXPERIENCE_GROUP: FeatureGroup = {
  title: 'Social Experience',
  description: 'Enhance storefront with social commerce features',
  icon: <Sparkles className="h-5 w-5 text-purple-600" />,
  features: [
    { key: 'social_commerce_share_buttons', label: 'Social Share Buttons', description: 'Display share buttons on product and storefront pages', icon: <Share2 className="h-5 w-5 text-purple-600" /> },
    { key: 'social_commerce_social_proof', label: 'Social Proof / UGC', description: 'Show user-generated content and social proof on storefront', icon: <Eye className="h-5 w-5 text-purple-600" /> },
    { key: 'social_commerce_abandoned_cart', label: 'Abandoned Cart Recovery', description: 'Send recovery messages via social platforms for abandoned carts', icon: <ShoppingCart className="h-5 w-5 text-purple-600" /> },
  ],
};

export default function SocialCommerceSettingsClient({ tenantId }: SocialCommerceSettingsClientProps) {
  const { data: socialCap } = useSocialCommerceOptionsCapability(tenantId);
  const tierState = socialCap;

  const [settings, setSettings] = useState<SocialCommerceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    socialCommerceOptionsService.getOptions(tenantId)
      .then(({ settings: s }) => setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleToggle = (key: keyof SocialCommerceSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await socialCommerceOptionsService.updateOptions(tenantId, settings as unknown as Record<string, boolean>);
      setMessage({ type: 'success', text: 'Social commerce options saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const isTierAllowed = (key: string): boolean => {
    if (!tierState) return true;
    if (!tierState.enabled) return false;
    if (tierState.isFlexible) return true;

    if (key === 'social_commerce_meta_enabled') return tierState.allowedMetaTypes.length > 0;
    if (key === 'social_commerce_tiktok_enabled') return tierState.allowedTikTokTypes.length > 0;

    if (key.startsWith('social_commerce_meta_')) return tierState.allowedMetaTypes.includes(key as any);
    if (key.startsWith('social_commerce_tiktok_')) return tierState.allowedTikTokTypes.includes(key as any);
    if (key === 'social_commerce_share_buttons') return tierState.allowedExperienceTypes.includes('social_commerce_share_buttons');
    if (key === 'social_commerce_social_proof') return tierState.allowedExperienceTypes.includes('social_commerce_social_proof');
    if (key === 'social_commerce_abandoned_cart') return tierState.allowedExperienceTypes.includes('social_commerce_abandoned_cart');

    return true;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-neutral-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/t/${tenantId}/settings/storefront-type-options`} className="p-2 rounded-md hover:bg-neutral-100 text-neutral-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary-600" />
            Social Commerce
          </h1>
          <p className="text-neutral-500 mt-1">
            Manage Meta (Instagram/Facebook) and TikTok Shop integrations
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Not Available in Plan */}
      {!tierState?.enabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-800 mb-1">Social Commerce Not Available</h3>
            <p className="text-amber-700 text-sm max-w-md mx-auto">
              Your current plan does not include social commerce capabilities. Upgrade your subscription to unlock Meta catalog sync, TikTok Shop integration, social pixels, and more.
            </p>
            <Link
              href={`/t/${tenantId}/settings/billing`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Crown className="w-4 h-4" />
              Upgrade Plan
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Global Social Commerce Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary-600" />
            Social Commerce System
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable social commerce for your storefront. When disabled, all social commerce features are hidden.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Social Commerce Enabled</p>
                <p className="text-sm text-neutral-600">Show social commerce integration features</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!tierState?.enabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="social-commerce-enabled-toggle"
                checked={settings.social_commerce_enabled}
                onCheckedChange={() => handleToggle('social_commerce_enabled')}
                disabled={!tierState?.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Commerce Group Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-pink-600" />
            Meta Commerce
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable Meta (Instagram Shopping + Facebook Shop) integration for your storefront.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-pink-600" />
              <div>
                <p className="font-medium text-neutral-900">Meta Commerce Enabled</p>
                <p className="text-sm text-neutral-600">Allow Meta platform integrations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isTierAllowed('social_commerce_meta_enabled') && (
                <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
              )}
              <Switch
                id="social-commerce-meta-enabled-toggle"
                checked={settings.social_commerce_meta_enabled}
                onCheckedChange={() => handleToggle('social_commerce_meta_enabled')}
                disabled={!isTierAllowed('social_commerce_meta_enabled') || !settings.social_commerce_enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Feature Toggles */}
      {settings.social_commerce_meta_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-pink-600" />
              Meta Commerce Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {META_GROUP.features.map(feature => {
                const isAllowed = isTierAllowed(feature.key);
                const isChecked = isAllowed && settings[feature.key];
                const hasConfigLink = feature.key === 'social_commerce_meta_pixel' && isChecked;
                return (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {feature.icon}
                      <div>
                        <p className="font-medium text-neutral-900">{feature.label}</p>
                        <p className="text-sm text-neutral-600">{feature.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasConfigLink && (
                        <Link
                          href={`/t/${tenantId}/settings/integrations/pixels`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          Configure
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {!isAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                      )}
                      <Switch
                        id={`${feature.key}-toggle`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(feature.key)}
                        disabled={!isAllowed || !settings.social_commerce_enabled || !settings.social_commerce_meta_enabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TikTok Commerce Group Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-neutral-900" />
            TikTok Commerce
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable TikTok Shop integration for your storefront.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-neutral-900" />
              <div>
                <p className="font-medium text-neutral-900">TikTok Commerce Enabled</p>
                <p className="text-sm text-neutral-600">Allow TikTok platform integrations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isTierAllowed('social_commerce_tiktok_enabled') && (
                <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
              )}
              <Switch
                id="social-commerce-tiktok-enabled-toggle"
                checked={settings.social_commerce_tiktok_enabled}
                onCheckedChange={() => handleToggle('social_commerce_tiktok_enabled')}
                disabled={!isTierAllowed('social_commerce_tiktok_enabled') || !settings.social_commerce_enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TikTok Feature Toggles */}
      {settings.social_commerce_tiktok_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-neutral-900" />
              TikTok Commerce Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {TIKTOK_GROUP.features.map(feature => {
                const isAllowed = isTierAllowed(feature.key);
                const isChecked = isAllowed && settings[feature.key];
                const hasConfigLink = feature.key === 'social_commerce_tiktok_pixel' && isChecked;
                return (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {feature.icon}
                      <div>
                        <p className="font-medium text-neutral-900">{feature.label}</p>
                        <p className="text-sm text-neutral-600">{feature.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasConfigLink && (
                        <Link
                          href={`/t/${tenantId}/settings/integrations/pixels`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          Configure
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {!isAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                      )}
                      <Switch
                        id={`${feature.key}-toggle`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(feature.key)}
                        disabled={!isAllowed || !settings.social_commerce_enabled || !settings.social_commerce_tiktok_enabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Experience Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Social Experience
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enhance your storefront with social commerce experience features.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {EXPERIENCE_GROUP.features.map(feature => {
              const isAllowed = isTierAllowed(feature.key);
              const isChecked = isAllowed && settings[feature.key];
              return (
                <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {feature.icon}
                    <div>
                      <p className="font-medium text-neutral-900">{feature.label}</p>
                      <p className="text-sm text-neutral-600">{feature.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isAllowed && (
                      <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                    )}
                    <Switch
                      id={`${feature.key}-toggle`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(feature.key)}
                      disabled={!isAllowed || !settings.social_commerce_enabled}
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
          {saving ? 'Saving...' : 'Save Social Commerce Options'}
        </Button>
      </div>

      {/* What's Next */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            What's Next
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Continue setup for the social commerce features you just enabled
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(settings.social_commerce_meta_pixel || settings.social_commerce_tiktok_pixel) && (
              <Link
                href={`/t/${tenantId}/settings/integrations/pixels`}
                className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:border-blue-300 text-blue-900 transition-colors"
              >
                <BarChart3 className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Configure Pixels</p>
                  <p className="text-xs opacity-80 truncate">Enter your Meta and TikTok Pixel IDs and access tokens</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {(settings.social_commerce_meta_catalog || settings.social_commerce_tiktok_catalog) && (
              <Link
                href={`/t/${tenantId}/settings/integrations`}
                className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50 hover:border-green-300 text-green-900 transition-colors"
              >
                <Globe className="h-5 w-5 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Catalog Sync</p>
                  <p className="text-xs opacity-80 truncate">Set up Meta and TikTok product catalog feeds</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {settings.social_commerce_share_buttons && (
              <Link
                href={`/t/${tenantId}/settings/tenant`}
                className="flex items-center gap-3 p-4 rounded-lg border border-purple-200 bg-purple-50 hover:border-purple-300 text-purple-900 transition-colors"
              >
                <Share2 className="h-5 w-5 shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Social Links</p>
                  <p className="text-xs opacity-80 truncate">Add your social media profiles to your store profile</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {settings.social_commerce_abandoned_cart && (
              <Link
                href={`/t/${tenantId}/settings/integrations`}
                className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 hover:border-amber-300 text-amber-900 transition-colors"
              >
                <ShoppingCart className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Abandoned Cart</p>
                  <p className="text-xs opacity-80 truncate">Configure recovery messages for abandoned carts</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
