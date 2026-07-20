'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCouponOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { CouponService, Coupon } from '@/services/CouponService';
import { tenantInfoService } from '@/services/TenantInfoService';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Plus, Pencil, Star, QrCode, Loader2, Tag, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import CouponQRDialog from './CouponQRDialog';

interface CouponFormData {
  code: string;
  discountType: string;
  discountValue: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

const EMPTY_FORM: CouponFormData = {
  code: '',
  discountType: 'percent_off',
  discountValue: 10,
  maxRedemptions: null,
  expiresAt: null,
  isActive: true,
};

export default function CouponManagementClient({ tenantId }: { tenantId: string }) {
  const { data: capState, loading: capLoading, error: capError } = useCouponOptionsCapability(tenantId);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);
  const [featuredCouponId, setFeaturedCouponId] = useState<string | null>(null);
  const [spotlightSaving, setSpotlightSaving] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCoupon, setQrCoupon] = useState<{ id: string; code: string } | null>(null);

  const couponService = CouponService.getInstance();

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const result = await couponService.listCoupons(tenantId);
      setCoupons(result.coupons || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load coupons', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, couponService]);

  const loadSpotlightSettings = useCallback(async () => {
    try {
      const settings = await tenantInfoService.getCouponSettings(tenantId);
      if (settings) {
        setSpotlightEnabled(settings.spotlightEnabled ?? false);
        setFeaturedCouponId(settings.featuredCouponId ?? null);
      }
    } catch {
      // non-critical — fall back to merchantPreferences from capability state
      if (capState?.merchantPreferences) {
        setSpotlightEnabled(capState.merchantPreferences.spotlight_enabled ?? false);
      }
    }
  }, [tenantId, capState?.merchantPreferences]);

  useEffect(() => {
    if (capState?.enabled) {
      loadCoupons();
      loadSpotlightSettings();
    }
  }, [capState?.enabled, loadCoupons, loadSpotlightSettings]);

  if (capLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (capError || !capState || !capState.enabled) {
    return (
      <div className="p-6 text-center">
        <Tag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-600">Coupon capability is not enabled for this tenant.</p>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxRedemptions: null,
      expiresAt: coupon.expiresAt,
      isActive: coupon.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.discountValue) {
      toast({ title: 'Validation', description: 'Code and discount value are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await couponService.updateCoupon(tenantId, editingId, formData);
        toast({ title: 'Coupon updated', description: `${formData.code} has been updated`, variant: 'success' });
      } else {
        await couponService.createCoupon(tenantId, formData);
        toast({ title: 'Coupon created', description: `${formData.code} has been created`, variant: 'success' });
      }
      setModalOpen(false);
      await loadCoupons();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save coupon', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = async (coupon: Coupon) => {
    setTogglingId(coupon.id);
    const newValue = !coupon.isActive;
    try {
      await couponService.updateCoupon(tenantId, coupon.id, { isActive: newValue });
      toast({ title: newValue ? 'Coupon activated' : 'Coupon deactivated', description: `${coupon.code} is now ${newValue ? 'active' : 'inactive'}`, variant: 'success' });
      await loadCoupons();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to toggle coupon', variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleSpotlightToggle = async () => {
    setSpotlightSaving(true);
    try {
      const newValue = !spotlightEnabled;
      setSpotlightEnabled(newValue);
      await tenantInfoService.updateCouponSettings(tenantId, { spotlightEnabled: newValue });
      toast({ title: newValue ? 'Spotlight enabled' : 'Spotlight disabled', variant: 'success' });
    } catch (e: any) {
      setSpotlightEnabled(!spotlightEnabled);
      toast({ title: 'Error', description: e?.message || 'Failed to toggle spotlight', variant: 'destructive' });
    } finally {
      setSpotlightSaving(false);
    }
  };

  const handleFeatureCoupon = async (couponId: string | null) => {
    setSpotlightSaving(true);
    try {
      setFeaturedCouponId(couponId);
      await tenantInfoService.updateCouponSettings(tenantId, { featuredCouponId: couponId });
      toast({ title: 'Featured coupon updated', variant: 'success' });
    } catch (e: any) {
      setFeaturedCouponId(featuredCouponId);
      toast({ title: 'Error', description: e?.message || 'Failed to update featured coupon', variant: 'destructive' });
    } finally {
      setSpotlightSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Link
        href={`/t/${tenantId}/dashboard`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount coupons for your store</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Coupon
        </Button>
      </div>

      {capState?.canUseSpotlight && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Spotlight Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Spotlight</Label>
                <p className="text-xs text-gray-500">Highlight a featured coupon on your storefront</p>
              </div>
              <Switch
                checked={spotlightEnabled}
                onCheckedChange={handleSpotlightToggle}
                disabled={spotlightSaving}
              />
            </div>
            {spotlightEnabled && (
              <div className="space-y-2">
                <Label>Featured Coupon</Label>
                <Select
                  value={featuredCouponId ?? ''}
                  onChange={(e) => handleFeatureCoupon(e.target.value || null)}
                  disabled={spotlightSaving}
                >
                  <option value="">Select a coupon...</option>
                  {coupons.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.discountType} {c.discountValue}</option>
                  ))}
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center p-12">
              <Tag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-600">No coupons yet. Create your first coupon to get started.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Code</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Value</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Redemptions</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Expires</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm font-medium">{c.code}</td>
                    <td className="p-3 text-sm">{c.discountType}</td>
                    <td className="p-3 text-sm">{c.discountValue}</td>
                    <td className="p-3">
                      <Badge variant={c.isActive ? 'default' : 'secondary'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{c.redemptionCount}</td>
                    <td className="p-3 text-sm text-gray-500">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        {capState?.canUseSpotlight && spotlightEnabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeatureCoupon(c.id === featuredCouponId ? null : c.id)}
                            disabled={spotlightSaving}
                            title="Toggle featured"
                          >
                            <Star className={`h-4 w-4 ${c.id === featuredCouponId ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
                          </Button>
                        )}
                        {capState?.canUseQrSharing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setQrCoupon({ id: c.id, code: c.code }); setQrDialogOpen(true); }}
                            title="QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(c)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={() => handleToggleActive(c)}
                          disabled={togglingId === c.id}
                          title={c.isActive ? 'Deactivate' : 'Activate'}
                        />
                        {togglingId === c.id && (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="SAVE10"
                disabled={!!editingId}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type</Label>
                <Select
                  id="discountType"
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                >
                  <option value="percent_off">Percent Off</option>
                  <option value="fixed_amount">Fixed Amount</option>
                  {capState?.canUseFreeShipping && <option value="free_shipping">Free Shipping</option>}
                  {capState?.canUseBogo && <option value="bogo">Buy One Get One</option>}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount Value</Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxRedemptions">Max Redemptions (optional)</Label>
                <Input
                  id="maxRedemptions"
                  type="number"
                  value={formData.maxRedemptions ?? ''}
                  onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiry Date (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={formData.expiresAt ? formData.expiresAt.split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {qrCoupon && (
        <CouponQRDialog
          tenantId={tenantId}
          couponId={qrCoupon.id}
          couponCode={qrCoupon.code}
          open={qrDialogOpen}
          onClose={() => { setQrDialogOpen(false); setQrCoupon(null); }}
        />
      )}
    </div>
  );
}
