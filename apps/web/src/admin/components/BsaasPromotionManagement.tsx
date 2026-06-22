/**
 * BSaaS Promotion Management
 *
 * Admin component for creating and managing Stripe Coupons and Promotion Codes.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminBsaasPromotionsService,
  type BsaasCoupon,
  type BsaasPromotionCode,
  type CreateCouponRequest,
  type CreatePromotionCodeRequest,
} from '@/services/AdminBsaasPromotionsService';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Tag, Ticket, Plus, Trash2, RefreshCw } from 'lucide-react';

function formatStripeDate(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDiscount(coupon: BsaasCoupon): string {
  if (coupon.percent_off) return `${coupon.percent_off}% off`;
  if (coupon.amount_off) return `$${(coupon.amount_off / 100).toFixed(2)} off`;
  return '—';
}

function formatDuration(coupon: BsaasCoupon): string {
  if (coupon.duration === 'once') return 'Once';
  if (coupon.duration === 'repeating') return `Repeating (${coupon.duration_in_months}mo)`;
  if (coupon.duration === 'forever') return 'Forever';
  return coupon.duration;
}

export default function BsaasPromotionManagement() {
  const [coupons, setCoupons] = useState<BsaasCoupon[]>([]);
  const [promotionCodes, setPromotionCodes] = useState<BsaasPromotionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);

  const [couponForm, setCouponForm] = useState<CreateCouponRequest>({
    name: '',
    percent_off: undefined,
    amount_off: undefined,
    duration: 'once',
    duration_in_months: undefined,
  });

  const [promoForm, setPromoForm] = useState<CreatePromotionCodeRequest>({
    coupon_id: '',
    code: '',
    max_redemptions: undefined,
    expires_at: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminBsaasPromotionsService.getPromotions();
      setCoupons(data.coupons || []);
      setPromotionCodes(data.promotionCodes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCoupon = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const req: CreateCouponRequest = {
        name: couponForm.name,
        duration: couponForm.duration,
        ...(couponForm.percent_off ? { percent_off: couponForm.percent_off } : {}),
        ...(couponForm.amount_off ? { amount_off: couponForm.amount_off } : {}),
        ...(couponForm.duration === 'repeating' && couponForm.duration_in_months
          ? { duration_in_months: couponForm.duration_in_months }
          : {}),
      };
      await adminBsaasPromotionsService.createCoupon(req);
      setSuccess('Coupon created successfully');
      setShowCouponForm(false);
      setCouponForm({ name: '', percent_off: undefined, amount_off: undefined, duration: 'once', duration_in_months: undefined });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePromotionCode = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const req: CreatePromotionCodeRequest = {
        coupon_id: promoForm.coupon_id,
        ...(promoForm.code ? { code: promoForm.code } : {}),
        ...(promoForm.max_redemptions ? { max_redemptions: promoForm.max_redemptions } : {}),
        ...(promoForm.expires_at ? { expires_at: new Date(promoForm.expires_at).toISOString() } : {}),
      };
      await adminBsaasPromotionsService.createPromotionCode(req);
      setSuccess('Promotion code created successfully');
      setShowPromoForm(false);
      setPromoForm({ coupon_id: '', code: '', max_redemptions: undefined, expires_at: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create promotion code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, code: string) => {
    if (!confirm(`Deactivate promotion code "${code}"? This cannot be undone.`)) return;
    try {
      setSubmitting(true);
      setError(null);
      await adminBsaasPromotionsService.deactivatePromotionCode(id);
      setSuccess(`Promotion code "${code}" deactivated`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate promotion code');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-48 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5" />
            BSaaS Promotions
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Manage Stripe coupons and promotion codes for BSaaS checkout discounts.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <p className="text-sm">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
            ×
          </button>
        </div>
      )}

      {/* Coupons Section */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Coupons
          </h3>
          <button
            onClick={() => setShowCouponForm(!showCouponForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Coupon
          </button>
        </div>

        {showCouponForm && (
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600">Name</label>
                <input
                  type="text"
                  value={couponForm.name}
                  onChange={e => setCouponForm({ ...couponForm, name: e.target.value })}
                  placeholder="e.g. Summer Sale 50%"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Duration</label>
                <select
                  value={couponForm.duration}
                  onChange={e => setCouponForm({ ...couponForm, duration: e.target.value as any })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                >
                  <option value="once">Once</option>
                  <option value="repeating">Repeating</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Percent Off (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={couponForm.percent_off ?? ''}
                  onChange={e => setCouponForm({ ...couponForm, percent_off: e.target.value ? Number(e.target.value) : undefined, amount_off: undefined })}
                  placeholder="e.g. 50"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Amount Off (cents)</label>
                <input
                  type="number"
                  min={1}
                  value={couponForm.amount_off ?? ''}
                  onChange={e => setCouponForm({ ...couponForm, amount_off: e.target.value ? Number(e.target.value) : undefined, percent_off: undefined })}
                  placeholder="e.g. 500 ($5.00)"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              {couponForm.duration === 'repeating' && (
                <div>
                  <label className="text-xs font-medium text-neutral-600">Duration (months)</label>
                  <input
                    type="number"
                    min={1}
                    value={couponForm.duration_in_months ?? ''}
                    onChange={e => setCouponForm({ ...couponForm, duration_in_months: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="e.g. 3"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateCoupon}
                disabled={submitting || !couponForm.name || (!couponForm.percent_off && !couponForm.amount_off)}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Coupon'}
              </button>
              <button
                onClick={() => setShowCouponForm(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Discount</th>
                <th className="px-4 py-2 text-left font-medium">Duration</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No coupons yet</td>
                </tr>
              ) : coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-neutral-400">{c.id}</div>
                  </td>
                  <td className="px-4 py-3">{formatDiscount(c)}</td>
                  <td className="px-4 py-3">{formatDuration(c)}</td>
                  <td className="px-4 py-3">
                    {c.valid ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">Valid</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">Expired</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatStripeDate(c.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promotion Codes Section */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            Promotion Codes
          </h3>
          <button
            onClick={() => setShowPromoForm(!showPromoForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Promotion Code
          </button>
        </div>

        {showPromoForm && (
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600">Coupon</label>
                <select
                  value={promoForm.coupon_id}
                  onChange={e => setPromoForm({ ...promoForm, coupon_id: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                >
                  <option value="">Select a coupon...</option>
                  {coupons.filter(c => c.valid).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Code (optional — auto-generated if blank)</label>
                <input
                  type="text"
                  value={promoForm.code}
                  onChange={e => setPromoForm({ ...promoForm, code: e.target.value })}
                  placeholder="e.g. SUMMER50"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Max Redemptions (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={promoForm.max_redemptions ?? ''}
                  onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g. 100"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Expires At (optional)</label>
                <input
                  type="date"
                  value={promoForm.expires_at ? promoForm.expires_at.split('T')[0] : ''}
                  onChange={e => setPromoForm({ ...promoForm, expires_at: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreatePromotionCode}
                disabled={submitting || !promoForm.coupon_id}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Promotion Code'}
              </button>
              <button
                onClick={() => setShowPromoForm(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Coupon ID</th>
                <th className="px-4 py-2 text-right font-medium">Redemptions</th>
                <th className="px-4 py-2 text-right font-medium">Max</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promotionCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No promotion codes yet</td>
                </tr>
              ) : promotionCodes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
                  <td className="px-4 py-3 text-xs text-neutral-400">{p.coupon_id}</td>
                  <td className="px-4 py-3 text-right">{p.times_redeemed}</td>
                  <td className="px-4 py-3 text-right">{p.max_redemptions ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.active ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatStripeDate(p.expires_at)}</td>
                  <td className="px-4 py-3">
                    {p.active && (
                      <button
                        onClick={() => handleDeactivate(p.id, p.code)}
                        disabled={submitting}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
