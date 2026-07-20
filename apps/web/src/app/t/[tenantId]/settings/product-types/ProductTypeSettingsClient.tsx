'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Package, Download, Layers, Wrench, Save, AlertCircle, Settings, ExternalLink, Zap, ArrowRight, List, Plus } from 'lucide-react';
import Link from 'next/link';
import { useProductTypeCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';
import { clientLogger } from '@/lib/client-logger';

interface ProductTypeSettings {
  product_types_enabled: boolean;
  selected_product_type: 'physical' | 'digital' | 'hybrid' | 'service' | 'none' | null;
  selected_product_types: ('physical' | 'digital' | 'hybrid' | 'service')[];
}

interface ProductTypeSettingsClientProps {
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

function getQuickActions(settings: ProductTypeSettings, tenantId: string, effectiveTypes: string[]): QuickAction[] {
  const actions: QuickAction[] = [];

  if (!settings.product_types_enabled) return actions;

  if (effectiveTypes.length > 0) {
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

  actions.push({
    id: 'product-options',
    label: 'Product Options',
    description: 'Configure creation features, layouts, and page sections',
    href: `/t/${tenantId}/settings/product-options`,
    icon: Settings,
    variant: 'general',
  });

  return actions;
}

export default function ProductTypeSettingsClient({ tenantId }: ProductTypeSettingsClientProps) {
  const productTypeCap = useProductTypeCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const resolvedState = productTypeCap.data;
  const isTierAllowed = resolvedState
    ? resolvedState.enabled || resolvedState.merchantPreferences.product_types_enabled === false
    : true;
  const tierType = productTypeCap.data?.type ?? 'none';
  const allowedTypes = productTypeCap.data?.allowedTypes ?? [];

  const [settings, setSettings] = useState<ProductTypeSettings>({
    product_types_enabled: true,
    selected_product_type: null,
    selected_product_types: [],
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
      const data = await platformHomeService.getTenantProductTypeSettings(tenantId);
      if (data) {
        const types = data.selected_product_types ?? (data.selected_product_type && data.selected_product_type !== 'none' ? [data.selected_product_type] : []);
        setSettings({
          product_types_enabled: data.product_types_enabled ?? true,
          selected_product_type: data.selected_product_type ?? null,
          selected_product_types: types,
        });
      }
    } catch (err) {
      clientLogger.error('Failed to load product type settings:', { detail: err });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await platformHomeService.updateTenantProductTypeSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save product type settings');
      }

      setMessage({ type: 'success', text: 'Product type settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof ProductTypeSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTypeToggle = (type: 'physical' | 'digital' | 'hybrid' | 'service') => {
    setSettings(prev => {
      const isSelected = prev.selected_product_types.includes(type);
      if (isSelected) {
        const newTypes = prev.selected_product_types.filter(t => t !== type);
        return {
          ...prev,
          selected_product_types: newTypes,
          selected_product_type: newTypes.length === 1 ? newTypes[0] : (newTypes.length === 0 ? null : prev.selected_product_type),
        };
      } else {
        const newTypes = [...prev.selected_product_types, type];
        return {
          ...prev,
          selected_product_types: newTypes,
          selected_product_type: newTypes.length === 1 ? newTypes[0] : prev.selected_product_type,
        };
      }
    });
  };

  const typeOptions: { value: 'physical' | 'digital' | 'hybrid' | 'service'; label: string; description: string; icon: typeof Package }[] = [
    { value: 'physical', label: 'Physical', description: 'Tangible items that require shipping or pickup', icon: Package },
    { value: 'digital', label: 'Digital', description: 'Downloadable files, licenses, and online content', icon: Download },
    { value: 'hybrid', label: 'Hybrid', description: 'Products with both physical and digital components', icon: Layers },
    { value: 'service', label: 'Service', description: 'Bookable services, appointments, and consultations', icon: Wrench },
  ];

  const effectiveTypes = settings.product_types_enabled
    ? settings.selected_product_types.filter(t => allowedTypes.includes(t))
    : [];
  const effectiveType = effectiveTypes.length === 1
    ? effectiveTypes[0]
    : (effectiveTypes.length > 1 ? 'multiple' : (allowedTypes.length === 1 ? allowedTypes[0] : tierType));

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
      {/* Plan Summary Widget */}
      <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary-600" />
            Product Types
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable product type selection for your catalog.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Enable Product Types</p>
                <p className="text-sm text-neutral-600">Allow customers to browse and filter by product type</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isTierAllowed && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              {isTierAllowed && !settings.product_types_enabled && (
                <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
              )}
              <Switch
                id="product-types-enabled-toggle"
                checked={isTierAllowed ? settings.product_types_enabled : false}
                onCheckedChange={() => handleToggle('product_types_enabled')}
                disabled={!isTierAllowed}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Product Types
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            {allowedTypes.length > 1
              ? 'Your plan supports multiple product types. Select all the types you want to offer in your catalog.'
              : 'Your current plan determines your product type. Upgrade to access more types.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {typeOptions.map(({ value, label, description, icon: IconComp }) => {
              const isAllowed = allowedTypes.includes(value);
              const isSelected = settings.selected_product_types.includes(value);
              const canSelect = settings.product_types_enabled && isAllowed;

              return (
                <div
                  key={value}
                  onClick={() => canSelect && handleTypeToggle(value)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${isSelected && canSelect
                    ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-300'
                    : 'bg-gray-50 border-gray-200'
                  } ${canSelect ? 'cursor-pointer hover:border-gray-300' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isSelected && canSelect ? 'bg-primary-100' : 'bg-gray-200'}`}>
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
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected && canSelect
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300'
                  }`}>
                    {isSelected && canSelect && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
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
                  ? <>Your current plan only supports the <strong>{allowedTypes[0]}</strong> product type. To enable multiple types, upgrade your plan.</>
                  : <>No product types are enabled in your current plan. Upgrade to access product types.</>
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Selection Summary */}
      {settings.product_types_enabled && (
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
                Your store is configured to offer: <strong className="text-neutral-900 capitalize">{effectiveTypes.length > 0 ? effectiveTypes.join(', ') : 'No types selected'}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Product Type Settings'}
        </Button>
      </div>

      {/* Next Steps */}
      {(() => {
        const actions = getQuickActions(settings, tenantId, effectiveTypes);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue setting up your product catalog
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
