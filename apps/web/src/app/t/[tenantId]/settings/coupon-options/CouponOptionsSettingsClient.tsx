'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCouponOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import { CouponService, Coupon } from '@/services/CouponService';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Loader2, Tag } from 'lucide-react';

interface CouponSettings {
  couponEnabled: boolean;
  spotlightEnabled: boolean;
  featuredCouponId: string | null;
}

interface CouponOptionsSettingsClientProps {
  tenantId: string;
}

export default function CouponOptionsSettingsClient({ tenantId }: CouponOptionsSettingsClientProps) {
  const router = useRouter();
  const { data: capState, loading: capLoading } = useCouponOptionsCapability(tenantId);
  const [settings, setSettings] = useState<CouponSettings>({
    couponEnabled: false,
    spotlightEnabled: false,
    featuredCouponId: null,
  });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedSettings, couponsResult] = await Promise.all([
        tenantInfoService.getCouponSettings(tenantId),
        CouponService.getInstance().listCoupons(tenantId).catch(() => ({ coupons: [] as Coupon[], total: 0 })),
      ]);
      setSettings({
        couponEnabled: fetchedSettings?.couponEnabled ?? false,
        spotlightEnabled: fetchedSettings?.spotlightEnabled ?? false,
        featuredCouponId: fetchedSettings?.featuredCouponId ?? null,
      });
      setCoupons(couponsResult.coupons.filter((c) => c.isActive));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (updates: Partial<CouponSettings>) => {
    setSaving(true);
    try {
      await tenantInfoService.updateCouponSettings(tenantId, updates);
      toast({ title: 'Coupon preferences saved', variant: 'success' });
      setSettings((prev) => ({ ...prev, ...updates }));
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save preferences', variant: 'destructive' });
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleCouponEnabledToggle = async (checked: boolean) => {
    await saveSettings({ couponEnabled: checked });
  };

  const handleSpotlightToggle = async (checked: boolean) => {
    await saveSettings({ spotlightEnabled: checked });
  };

  const handleFeaturedCouponChange = async (value: string) => {
    const featuredCouponId = value || null;
    await saveSettings({ featuredCouponId });
  };

  if (capLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const tierAllowed = !!capState?.isFlexible || (capState?.allowedDiscountTypes?.length ?? 0) > 0 || !!capState?.enabled;

  if (!tierAllowed) {
    return (
      <div className="p-6 text-center">
        <Tag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-600">Coupon options are not included in your current plan.</p>
      </div>
    );
  }

  const spotlightAllowed = capState?.canUseSpotlight ?? false;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Options</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your coupon capability preferences</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/t/${tenantId}/settings/coupons`)}>
          Manage Coupons
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-green-600" />
            Coupon Capability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Coupons</Label>
              <p className="text-xs text-gray-500">Turn the coupon capability on or off for this tenant</p>
            </div>
            <Switch
              checked={settings.couponEnabled}
              onCheckedChange={handleCouponEnabledToggle}
              disabled={saving}
            />
          </div>

          {!settings.couponEnabled && (
            <Badge variant="default">Coupons are currently disabled for customers</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spotlight Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Spotlight</Label>
              <p className="text-xs text-gray-500">Highlight a featured coupon on your storefront</p>
            </div>
            <Switch
              checked={settings.spotlightEnabled}
              onCheckedChange={handleSpotlightToggle}
              disabled={saving || !settings.couponEnabled || !spotlightAllowed}
            />
          </div>

          {settings.spotlightEnabled && (
            <div className="space-y-2">
              <Label>Featured Coupon</Label>
              <Select
                value={settings.featuredCouponId ?? ''}
                onChange={(e) => handleFeaturedCouponChange(e.target.value)}
                disabled={saving || !settings.couponEnabled || !spotlightAllowed}
              >
                <option value="">Select a featured coupon</option>
                {coupons.map((coupon) => (
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

          {!spotlightAllowed && (
            <Badge variant="default">Spotlight is not included in your current plan</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {capState?.canUsePercentOff && <Badge variant="default">Percent Off</Badge>}
          {capState?.canUseFixedAmount && <Badge variant="default">Fixed Amount</Badge>}
          {capState?.canUseFreeShipping && <Badge variant="default">Free Shipping</Badge>}
          {capState?.canUseBogo && <Badge variant="default">BOGO</Badge>}
          {capState?.canTargetProducts && <Badge variant="default">Targeted</Badge>}
          {capState?.canSetLimits && <Badge variant="default">Limits</Badge>}
          {capState?.canViewAnalytics && <Badge variant="default">Analytics</Badge>}
          {capState?.canUseQrSharing && <Badge variant="default">QR Sharing</Badge>}
          {capState?.canUseSpotlight && <Badge variant="default">Spotlight</Badge>}
          {capState?.allowedDiscountTypes?.length === 0 && !capState?.isFlexible && (
            <p className="text-sm text-gray-500">No coupon features are enabled for this tenant.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
