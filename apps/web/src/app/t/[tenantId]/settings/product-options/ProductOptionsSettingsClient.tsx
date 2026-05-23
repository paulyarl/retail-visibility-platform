'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, Download, Layers, Wrench, Save, AlertCircle, Settings, Image, Video, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import Link from 'next/link';

interface ProductOptionsSettings {
  product_physical_enabled: boolean;
  product_digital_enabled: boolean;
  product_hybrid_enabled: boolean;
  product_service_enabled: boolean;
  product_variant_enabled: boolean;
  product_gallery_enabled: boolean;
  product_video_enabled: boolean;
}

interface ProductOptionsSettingsClientProps {
  tenantId: string;
}

export default function ProductOptionsSettingsClient({ tenantId }: ProductOptionsSettingsClientProps) {
  // Product options capability-driven content control
  const productOptionsCap = useProductOptionsCapability(tenantId, { forTenant: true });
  const isProductOptionsEnabled = productOptionsCap.data?.enabled ?? true;
  const allowedTypes = productOptionsCap.data?.allowedTypes ?? ['physical', 'digital', 'hybrid', 'service'];
  const showsVariants = productOptionsCap.data?.showsVariants ?? true;
  const showsGallery = productOptionsCap.data?.showsGallery ?? true;
  const showsVideo = productOptionsCap.data?.showsVideo ?? true;
  const isFlexible = productOptionsCap.data?.isFlexible ?? false;

  const [settings, setSettings] = useState<ProductOptionsSettings>({
    product_physical_enabled: true,
    product_digital_enabled: true,
    product_hybrid_enabled: true,
    product_service_enabled: false,
    product_variant_enabled: true,
    product_gallery_enabled: true,
    product_video_enabled: true,
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="physical-toggle"
                  checked={settings.product_physical_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="digital-toggle"
                  checked={settings.product_digital_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="hybrid-toggle"
                  checked={settings.product_hybrid_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="service-toggle"
                  checked={settings.product_service_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="variant-toggle"
                  checked={settings.product_variant_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="gallery-toggle"
                  checked={settings.product_gallery_enabled}
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
                  <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                )}
                <Switch
                  id="video-toggle"
                  checked={settings.product_video_enabled}
                  onCheckedChange={() => handleToggle('product_video_enabled')}
                  disabled={!showsVideo}
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
    </div>
  );
}
