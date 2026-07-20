'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { AlertCircle, Save, Tag, Percent, DollarSign, Truck, Gift, Target, QrCode, Spotlight, Settings, Plus, List, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCouponOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import { CouponService, Coupon } from '@/services/CouponService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';
import { clientLogger } from '@/lib/client-logger';
import { toast } from '@/hooks/use-toast';

interface CouponOptionsSettingsClientProps {
  tenantId: string;
}

interface CouponSettings {
  couponEnabled: boolean;
  spotlightEnabled: boolean;
  featuredCouponId: string | null;
  percentOffEnabled: boolean;
  fixedAmountEnabled: boolean;
  freeShippingEnabled: boolean;
  bogoEnabled: boolean;
  targetProductsEnabled: boolean;
  qrSharingEnabled: boolean;
}

interface FeatureToggle {
  key: keyof CouponSettings;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tierFlag: (cap: NonNullable<ReturnType<typeof useCouponOptionsCapability>['data']>) => boolean;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  { key: 'percentOffEnabled', label: 'Percent Off', description: 'Offer percentage-based discounts (e.g. 20% off)', icon: Percent, tierFlag: cap => cap.canUsePercentOff },
  { key: 'fixedAmountEnabled', label: 'Fixed Amount', description: 'Offer fixed-dollar discounts (e.g. $10 off)', icon: DollarSign, tierFlag: cap => cap.canUseFixedAmount },
  { key: 'freeShippingEnabled', label: 'Free Shipping', description: 'Offer free shipping coupons', icon: Truck, tierFlag: cap => cap.canUseFreeShipping },
  { key: 'bogoEnabled', label: 'BOGO', description: 'Buy-one-get-one promotions', icon: Gift, tierFlag: cap => cap.canUseBogo },
  { key: 'targetProductsEnabled', label: 'Target Products', description: 'Restrict coupons to specific products or categories', icon: Target, tierFlag: cap => cap.canTargetProducts },
  { key: 'qrSharingEnabled', label: 'QR Sharing', description: 'Generate QR codes for coupon sharing', icon: QrCode, tierFlag: cap => cap.canUseQrSharing },
  { key: 'spotlightEnabled', label: 'Spotlight', description: 'Highlight a featured coupon on your storefront', icon: Spotlight, tierFlag: cap => cap.canUseSpotlight },
];

function getQuickActions(settings: CouponSettings, tenantId: string, tierAllowed: boolean): { id: string; label: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; variant: 'general' | 'product' }[] {
  const actions: { id: string; label: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; variant: 'general' | 'product' }[] = [];

  if (!tierAllowed || !settings.couponEnabled) return actions;

  actions.push({
    id: 'manage-coupons',
    label: 'Manage Coupons',
    description: 'View and edit your coupon codes',
    href: `/t/${tenantId}/settings/coupons`,
    icon: List,
    variant: 'general',
  });

  actions.push({
    id: 'create-coupon',
    label: 'Create Coupon',
    description: 'Add a new discount code for customers',
    href: `/t/${tenantId}/settings/coupons`,
    icon: Plus,
    variant: 'product',
  });

  actions.push({
    id: 'coupon-analytics',
    label: 'View Analytics',
    description: 'Track coupon performance and redemption rates',
    href: `/t/${tenantId}/settings/coupons/analytics`,
    icon: ArrowRight,
    variant: 'general',
  });

  return actions;
}

export default function CouponOptionsSettingsClient({ tenantId }: CouponOptionsSettingsClientProps) {
  const couponCap = useCouponOptionsCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const capState = couponCap.data;
  const tierAllowed = !!capState && (capState.enabled || capState.isFlexible || (capState.allowedDiscountTypes?.length ?? 0) > 0);

  const [settings, setSettings] = useState<CouponSettings>({
    couponEnabled: false,
    spotlightEnabled: false,
    featuredCouponId: null,
    percentOffEnabled: true,
    fixedAmountEnabled: true,
    freeShippingEnabled: true,
    bogoEnabled: true,
    targetProductsEnabled: true,
    qrSharingEnabled: true,
  });

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedSettings, couponsResult] = await Promise.all([
        tenantInfoService.getCouponSettings(tenantId),
        CouponService.getInstance().listCoupons(tenantId).catch(() => ({ coupons: [] as Coupon[], total: 0 })),
      ]);
      setSettings({
        couponEnabled: fetchedSettings?.couponEnabled ?? false,
        spotlightEnabled: fetchedSettings?.spotlightEnabled ?? false,
        featuredCouponId: fetchedSettings?.featuredCouponId ?? null,
        percentOffEnabled: fetchedSettings?.percentOffEnabled ?? true,
        fixedAmountEnabled: fetchedSettings?.fixedAmountEnabled ?? true,
        freeShippingEnabled: fetchedSettings?.freeShippingEnabled ?? true,
        bogoEnabled: fetchedSettings?.bogoEnabled ?? true,
        targetProductsEnabled: fetchedSettings?.targetProductsEnabled ?? true,
        qrSharingEnabled: fetchedSettings?.qrSharingEnabled ?? true,
      });
      setCoupons(couponsResult.coupons.filter(c => c.isActive));
    } catch (err) {
      clientLogger.error('Failed to load coupon options settings:', { detail: err });
      toast({ title: 'Error', description: 'Failed to load coupon options', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await tenantInfoService.updateCouponSettings(tenantId, settings);
      toast({ title: 'Saved', description: 'Coupon options settings have been updated', variant: 'success' });
      setMessage({ type: 'success', text: 'Coupon options settings saved successfully.' });
    } catch (err: any) {
      clientLogger.error('Failed to save coupon options settings:', { detail: err });
      setMessage({ type: 'error', text: err?.message || 'Failed to save coupon options settings' });
      toast({ title: 'Error', description: err?.message || 'Failed to save coupon options settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof CouponSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (couponCap.loading || loading) {
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
      <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} highlightCapability="coupon_options" tenantId={tenantId} />

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
            <Tag className="h-5 w-5 text-primary-600" />
            Coupon Capability
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable coupons for this tenant.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Tag className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Enable Coupons</p>
                <p className="text-sm text-neutral-600">Allow coupon creation, redemption, and customer discounts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!tierAllowed && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              {tierAllowed && !settings.couponEnabled && (
                <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
              )}
              <Switch
                id="coupon-enabled-toggle"
                checked={tierAllowed ? settings.couponEnabled : false}
                onCheckedChange={() => handleToggle('couponEnabled')}
                disabled={!tierAllowed}
              />
            </div>
          </div>

          {!tierAllowed && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Coupons are not included in your current plan. Upgrade to enable coupon creation and discounts.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Coupon Features
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Toggle individual coupon features on or off. Features not included in your plan are shown but disabled.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {FEATURE_TOGGLES.map(({ key, label, description, icon: IconComp, tierFlag }) => {
              const isTierAllowed = capState ? tierFlag(capState) : false;
              const isSelected = !!settings[key];
              const canSelect = settings.couponEnabled && isTierAllowed;

              return (
                <div
                  key={key}
                  onClick={() => canSelect && handleToggle(key)}
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
                      {!isTierAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                      )}
                      {isTierAllowed && !isSelected && settings.couponEnabled && (
                        <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">{description}</p>
                  </div>
                  <Switch
                    checked={canSelect ? isSelected : false}
                    onCheckedChange={() => canSelect && handleToggle(key)}
                    disabled={!canSelect}
                  />
                </div>
              );
            })}
          </div>

          {/* Spotlight Featured Coupon Picker */}
          {settings.couponEnabled && settings.spotlightEnabled && (capState?.canUseSpotlight ?? false) && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-2">
              <p className="font-medium text-sm text-neutral-900">Featured Coupon</p>
              <Select
                value={settings.featuredCouponId ?? ''}
                onChange={e => setSettings(prev => ({ ...prev, featuredCouponId: e.target.value || null }))}
                disabled={saving}
              >
                <option value="">Select a featured coupon</option>
                {coupons.map(coupon => (
                  <option key={coupon.id} value={coupon.id}>
                    {coupon.code} ({coupon.discountType})
                  </option>
                ))}
              </Select>
              {coupons.length === 0 && (
                <p className="text-xs text-amber-600">Create an active coupon on the management page first.</p>
              )}
            </div>
          )}

          {!tierAllowed && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                No coupon features are enabled in your current plan. Upgrade to access coupon features.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Coupon Options'}
        </Button>
      </div>

      {/* What's Next */}
      {(() => {
        const actions = getQuickActions(settings, tenantId, tierAllowed);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue building your coupon program
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
