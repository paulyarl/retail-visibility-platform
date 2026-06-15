'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, Download, Layers, Wrench, Save, AlertCircle, Settings, Image, Video, Copy, ArrowRight, Zap, Plus, List, LayoutGrid, Eye, QrCode, ThumbsUp, MapPin, Map, Clock, Search, MessageSquare, Truck, Tag, Store } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/ui/Switch';
import { useProductOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface ProductOptionsSettings {
  product_physical_enabled: boolean;
  product_digital_enabled: boolean;
  product_hybrid_enabled: boolean;
  product_service_enabled: boolean;
  product_variant_enabled: boolean;
  product_gallery_enabled: boolean;
  product_video_enabled: boolean;
  product_layout: 'classic' | 'editorial' | 'immersive';
  product_opt_recently_viewed: boolean;
  product_opt_qr_codes: boolean;
  product_opt_recommended: boolean;
  product_opt_map_display: boolean;
  product_opt_location_display: boolean;
  product_opt_hours_display: boolean;
  product_opt_enhanced_seo: boolean;
  product_opt_reviews: boolean;
  product_opt_fulfillment: boolean;
  product_opt_categories: boolean;
  product_opt_location_availability: boolean;
}

interface ProductOptionsSettingsClientProps {
  tenantId: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Package;
  variant: 'general' | 'product';
}

function getQuickActions(settings: ProductOptionsSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];
  const anyTypeEnabled = settings.product_physical_enabled || settings.product_digital_enabled || settings.product_hybrid_enabled || settings.product_service_enabled;

  if (anyTypeEnabled) {
    actions.push({
      id: 'items',
      label: 'Browse Items',
      description: 'View and manage your product catalog',
      href: `/t/${tenantId}/items`,
      icon: List,
      variant: 'product',
    });
    actions.push({
      id: 'create-item',
      label: 'Create New Item',
      description: 'Add a new product to your catalog',
      href: `/t/${tenantId}/items/create`,
      icon: Plus,
      variant: 'product',
    });
  }

  return actions;
}

export default function ProductOptionsSettingsClient({ tenantId }: ProductOptionsSettingsClientProps) {
  // Product options capability-driven content control
  const productOptionsCap = useProductOptionsCapability(tenantId, { forTenant: true });
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });
  const isProductOptionsEnabled = productOptionsCap.data?.enabled ?? true;
  const allowedTypes = productOptionsCap.data?.allowedTypes ?? ['physical', 'digital', 'hybrid', 'service'];
  const showsVariants = productOptionsCap.data?.showsVariants ?? true;
  const showsGallery = productOptionsCap.data?.showsGallery ?? true;
  const showsVideo = productOptionsCap.data?.showsVideo ?? true;
  const isFlexible = productOptionsCap.data?.isFlexible ?? false;
  const canUseLayoutClassic = productOptionsCap.data?.canUseLayoutClassic ?? true;
  const canUseLayoutEditorial = productOptionsCap.data?.canUseLayoutEditorial ?? false;
  const canUseLayoutImmersive = productOptionsCap.data?.canUseLayoutImmersive ?? false;
  const showsRecentlyViewed = productOptionsCap.data?.showsRecentlyViewed ?? true;
  const showsQRCodes = productOptionsCap.data?.showsQRCodes ?? true;
  const showsRecommended = productOptionsCap.data?.showsRecommended ?? true;
  const showsMapDisplay = productOptionsCap.data?.showsMapDisplay ?? true;
  const showsLocationDisplay = productOptionsCap.data?.showsLocationDisplay ?? true;
  const showsHoursDisplay = productOptionsCap.data?.showsHoursDisplay ?? true;
  const showsEnhancedSEO = productOptionsCap.data?.showsEnhancedSEO ?? true;
  const showsReviews = productOptionsCap.data?.showsReviews ?? true;
  const showsFulfillment = productOptionsCap.data?.showsFulfillment ?? true;
  const showsCategories = productOptionsCap.data?.showsCategories ?? true;
  const showsLocationAvailability = productOptionsCap.data?.showsLocationAvailability ?? true;

  const [settings, setSettings] = useState<ProductOptionsSettings>({
    product_physical_enabled: true,
    product_digital_enabled: true,
    product_hybrid_enabled: true,
    product_service_enabled: false,
    product_variant_enabled: true,
    product_gallery_enabled: true,
    product_video_enabled: true,
    product_layout: 'classic',
    product_opt_recently_viewed: true,
    product_opt_qr_codes: true,
    product_opt_recommended: true,
    product_opt_map_display: true,
    product_opt_location_display: true,
    product_opt_hours_display: true,
    product_opt_enhanced_seo: true,
    product_opt_reviews: true,
    product_opt_fulfillment: true,
    product_opt_categories: true,
    product_opt_location_availability: true,
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
      const settings = await platformHomeService.getTenantProductOptionsSettings(tenantId);
      if (settings) {
        setSettings({
          product_physical_enabled: settings.product_physical_enabled ?? true,
          product_digital_enabled: settings.product_digital_enabled ?? true,
          product_hybrid_enabled: settings.product_hybrid_enabled ?? true,
          product_service_enabled: settings.product_service_enabled ?? false,
          product_variant_enabled: settings.product_variant_enabled ?? true,
          product_gallery_enabled: settings.product_gallery_enabled ?? true,
          product_video_enabled: settings.product_video_enabled ?? true,
          product_layout: settings.product_layout ?? 'classic',
          product_opt_recently_viewed: settings.product_opt_recently_viewed ?? true,
          product_opt_qr_codes: settings.product_opt_qr_codes ?? true,
          product_opt_recommended: settings.product_opt_recommended ?? true,
          product_opt_map_display: settings.product_opt_map_display ?? true,
          product_opt_location_display: settings.product_opt_location_display ?? true,
          product_opt_hours_display: settings.product_opt_hours_display ?? true,
          product_opt_enhanced_seo: settings.product_opt_enhanced_seo ?? true,
          product_opt_reviews: settings.product_opt_reviews ?? true,
          product_opt_fulfillment: settings.product_opt_fulfillment ?? true,
          product_opt_categories: settings.product_opt_categories ?? true,
          product_opt_location_availability: settings.product_opt_location_availability ?? true,
        });
      }
    } catch (err) {
      console.error('Failed to load product options settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantProductOptionsSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save product options settings');
      }

      setMessage({ type: 'success', text: 'Product options settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof ProductOptionsSettings) => {
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
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="product_options" tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Product Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary-600" />
            Product Types
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Choose which product types are available when creating new items. Customers will only see the types you enable.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Physical */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-neutral-900">Physical Products</p>
                  <p className="text-sm text-neutral-600">Tangible items that require shipping or pickup</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedTypes.includes('physical') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="physical-toggle"
                  checked={allowedTypes.includes('physical') && settings.product_physical_enabled}
                  onCheckedChange={() => handleToggle('product_physical_enabled')}
                  disabled={!allowedTypes.includes('physical')}
                />
              </div>
            </div>

            {/* Digital */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-neutral-900">Digital Products</p>
                  <p className="text-sm text-neutral-600">Downloadable files, licenses, and online content</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedTypes.includes('digital') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="digital-toggle"
                  checked={allowedTypes.includes('digital') && settings.product_digital_enabled}
                  onCheckedChange={() => handleToggle('product_digital_enabled')}
                  disabled={!allowedTypes.includes('digital')}
                />
              </div>
            </div>

            {/* Hybrid */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-neutral-900">Hybrid Products</p>
                  <p className="text-sm text-neutral-600">Products with both physical and digital components</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedTypes.includes('hybrid') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="hybrid-toggle"
                  checked={allowedTypes.includes('hybrid') && settings.product_hybrid_enabled}
                  onCheckedChange={() => handleToggle('product_hybrid_enabled')}
                  disabled={!allowedTypes.includes('hybrid')}
                />
              </div>
            </div>

            {/* Service */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-neutral-900">Service Products</p>
                  <p className="text-sm text-neutral-600">Bookable services, appointments, and consultations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!allowedTypes.includes('service') && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="service-toggle"
                  checked={allowedTypes.includes('service') && settings.product_service_enabled}
                  onCheckedChange={() => handleToggle('product_service_enabled')}
                  disabled={!allowedTypes.includes('service')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creation Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Creation Features
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Control which features are available during product creation.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Variants */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Copy className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-neutral-900">Product Variants</p>
                  <p className="text-sm text-neutral-600">Allow creating product variants (sizes, colors, etc.)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsVariants && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="variant-toggle"
                  checked={showsVariants && settings.product_variant_enabled}
                  onCheckedChange={() => handleToggle('product_variant_enabled')}
                  disabled={!showsVariants}
                />
              </div>
            </div>

            {/* Gallery */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-teal-600" />
                <div>
                  <p className="font-medium text-neutral-900">Image Gallery</p>
                  <p className="text-sm text-neutral-600">Allow multiple product images beyond the primary photo</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsGallery && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="gallery-toggle"
                  checked={showsGallery && settings.product_gallery_enabled}
                  onCheckedChange={() => handleToggle('product_gallery_enabled')}
                  disabled={!showsGallery}
                />
              </div>
            </div>

            {/* Video */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-rose-600" />
                <div>
                  <p className="font-medium text-neutral-900">Video Attachment</p>
                  <p className="text-sm text-neutral-600">Allow attaching video URLs to product listings</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsVideo && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="video-toggle"
                  checked={showsVideo && settings.product_video_enabled}
                  onCheckedChange={() => handleToggle('product_video_enabled')}
                  disabled={!showsVideo}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Page Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-violet-600" />
            Product Page Layout
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Choose how individual product pages look to customers
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Classic */}
            <button
              type="button"
              onClick={() => {
                if (canUseLayoutClassic) {
                  setSettings(s => ({ ...s, product_layout: 'classic' }));
                }
              }}
              disabled={!canUseLayoutClassic}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.product_layout === 'classic'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!canUseLayoutClassic ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.product_layout === 'classic' && canUseLayoutClassic && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Classic</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Standard product page with image, description, and buy button.
                {!canUseLayoutClassic && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
            {/* Editorial */}
            <button
              type="button"
              onClick={() => {
                if (canUseLayoutEditorial) {
                  setSettings(s => ({ ...s, product_layout: 'editorial' }));
                }
              }}
              disabled={!canUseLayoutEditorial}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.product_layout === 'editorial'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!canUseLayoutEditorial ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.product_layout === 'editorial' && canUseLayoutEditorial && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Modern Editorial</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Storytelling emphasis with hero banner and split-panel layout.
                {!canUseLayoutEditorial && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
            {/* Immersive */}
            <button
              type="button"
              onClick={() => {
                if (canUseLayoutImmersive) {
                  setSettings(s => ({ ...s, product_layout: 'immersive' }));
                }
              }}
              disabled={!canUseLayoutImmersive}
              className={`relative flex flex-col items-start p-4 rounded-lg border-2 transition-colors text-left ${
                settings.product_layout === 'immersive'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${!canUseLayoutImmersive ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {settings.product_layout === 'immersive' && canUseLayoutImmersive && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">✓</span>
              )}
              <span className="font-semibold text-sm">Immersive Commerce</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Conversion-optimized with compact purchase flow and sticky cart.
                {!canUseLayoutImmersive && (
                  <span className="block text-amber-600 font-medium mt-1">Not included in your plan</span>
                )}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Product Page Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-sky-600" />
            Product Page Sections
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Control which sections appear on individual product pages, independently of storefront settings.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Recently Viewed */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-sky-600" />
                <div>
                  <p className="font-medium text-neutral-900">Recently Viewed</p>
                  <p className="text-sm text-neutral-600">Show customers products they recently browsed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsRecentlyViewed && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="recently-viewed-toggle"
                  checked={showsRecentlyViewed && settings.product_opt_recently_viewed}
                  onCheckedChange={() => handleToggle('product_opt_recently_viewed')}
                  disabled={!showsRecentlyViewed}
                />
              </div>
            </div>

            {/* QR Codes */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-neutral-900">QR Code Sharing</p>
                  <p className="text-sm text-neutral-600">Display scannable QR codes on product pages</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsQRCodes && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="qr-codes-toggle"
                  checked={showsQRCodes && settings.product_opt_qr_codes}
                  onCheckedChange={() => handleToggle('product_opt_qr_codes')}
                  disabled={!showsQRCodes}
                />
              </div>
            </div>

            {/* Recommended Products */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <ThumbsUp className="h-5 w-5 text-teal-600" />
                <div>
                  <p className="font-medium text-neutral-900">Recommended Products</p>
                  <p className="text-sm text-neutral-600">Show &quot;You might also like&quot; recommendations</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsRecommended && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="recommended-toggle"
                  checked={showsRecommended && settings.product_opt_recommended}
                  onCheckedChange={() => handleToggle('product_opt_recommended')}
                  disabled={!showsRecommended}
                />
              </div>
            </div>

            {/* Map Display */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Map className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-neutral-900">Map Display</p>
                  <p className="text-sm text-neutral-600">Show store map in product actions</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsMapDisplay && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="map-display-toggle"
                  checked={showsMapDisplay && settings.product_opt_map_display}
                  onCheckedChange={() => handleToggle('product_opt_map_display')}
                  disabled={!showsMapDisplay}
                />
              </div>
            </div>

            {/* Location Display */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-rose-600" />
                <div>
                  <p className="font-medium text-neutral-900">Location Display</p>
                  <p className="text-sm text-neutral-600">Show store address and location info</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsLocationDisplay && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="location-display-toggle"
                  checked={showsLocationDisplay && settings.product_opt_location_display}
                  onCheckedChange={() => handleToggle('product_opt_location_display')}
                  disabled={!showsLocationDisplay}
                />
              </div>
            </div>

            {/* Hours Display */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-neutral-900">Hours Display</p>
                  <p className="text-sm text-neutral-600">Show store hours and open/closed status</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsHoursDisplay && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="hours-display-toggle"
                  checked={showsHoursDisplay && settings.product_opt_hours_display}
                  onCheckedChange={() => handleToggle('product_opt_hours_display')}
                  disabled={!showsHoursDisplay}
                />
              </div>
            </div>

            {/* Enhanced SEO */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="font-medium text-neutral-900">Enhanced SEO</p>
                  <p className="text-sm text-neutral-600">Structured data and meta tags for product pages</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsEnhancedSEO && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="enhanced-seo-toggle"
                  checked={showsEnhancedSEO && settings.product_opt_enhanced_seo}
                  onCheckedChange={() => handleToggle('product_opt_enhanced_seo')}
                  disabled={!showsEnhancedSEO}
                />
              </div>
            </div>

            {/* Reviews */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-cyan-600" />
                <div>
                  <p className="font-medium text-neutral-900">Product Reviews</p>
                  <p className="text-sm text-neutral-600">Display customer reviews on product pages</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsReviews && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="reviews-toggle"
                  checked={showsReviews && settings.product_opt_reviews}
                  onCheckedChange={() => handleToggle('product_opt_reviews')}
                  disabled={!showsReviews}
                />
              </div>
            </div>

            {/* Fulfillment */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-neutral-900">Fulfillment Options</p>
                  <p className="text-sm text-neutral-600">Show pickup, delivery, and shipping options</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsFulfillment && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="fulfillment-toggle"
                  checked={showsFulfillment && settings.product_opt_fulfillment}
                  onCheckedChange={() => handleToggle('product_opt_fulfillment')}
                  disabled={!showsFulfillment}
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-lime-600" />
                <div>
                  <p className="font-medium text-neutral-900">Category Display</p>
                  <p className="text-sm text-neutral-600">Show product categories and navigation</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsCategories && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="categories-toggle"
                  checked={showsCategories && settings.product_opt_categories}
                  onCheckedChange={() => handleToggle('product_opt_categories')}
                  disabled={!showsCategories}
                />
              </div>
            </div>

            {/* Location Availability */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-pink-600" />
                <div>
                  <p className="font-medium text-neutral-900">Location Availability</p>
                  <p className="text-sm text-neutral-600">Show nearby store availability for products</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!showsLocationAvailability && (
                  <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                )}
                <Switch
                  id="location-availability-toggle"
                  checked={showsLocationAvailability && settings.product_opt_location_availability}
                  onCheckedChange={() => handleToggle('product_opt_location_availability')}
                  disabled={!showsLocationAvailability}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Product Options'}
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
                Continue managing the product types you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    product: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
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
