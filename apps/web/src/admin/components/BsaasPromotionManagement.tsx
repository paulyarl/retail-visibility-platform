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
  type CouponTargets,
} from '@/services/AdminBsaasPromotionsService';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Tag, Ticket, Plus, Trash2, RefreshCw, Target, X, QrCode } from 'lucide-react';
import PromoCodeQRDialog from './PromoCodeQRDialog';

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

const TIER_OPTIONS = ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'chain_starter', 'chain_professional', 'organization', 'enterprise'];
const TIER_TYPE_OPTIONS = ['individual', 'organization'];
const DEMO_STATUS_OPTIONS = ['demo', 'non_demo'];
const SUBSCRIPTION_STATUS_OPTIONS = ['trial', 'active', 'past_due', 'canceled', 'incomplete'];

function hasTargets(targets?: CouponTargets | null): boolean {
  if (!targets) return false;
  return !!(targets.target_features?.length || targets.target_tiers?.length || targets.target_capability_types?.length ||
    targets.target_tier_types?.length || targets.target_demo_status?.length || targets.target_subscription_statuses?.length);
}

function targetSummary(targets?: CouponTargets | null): string[] {
  if (!targets) return [];
  const parts: string[] = [];
  if (targets.target_features?.length) parts.push(`${targets.target_features.length} feature${targets.target_features.length > 1 ? 's' : ''}`);
  if (targets.target_tiers?.length) parts.push(`${targets.target_tiers.length} tier${targets.target_tiers.length > 1 ? 's' : ''}`);
  if (targets.target_capability_types?.length) parts.push(`${targets.target_capability_types.length} cap type${targets.target_capability_types.length > 1 ? 's' : ''}`);
  if (targets.target_tier_types?.length) parts.push(`tier type: ${targets.target_tier_types.join(', ')}`);
  if (targets.target_demo_status?.length) parts.push(`demo: ${targets.target_demo_status.join(', ')}`);
  if (targets.target_subscription_statuses?.length) parts.push(`${targets.target_subscription_statuses.length} sub status${targets.target_subscription_statuses.length > 1 ? 'es' : ''}`);
  return parts;
}

export default function BsaasPromotionManagement() {
  const [coupons, setCoupons] = useState<BsaasCoupon[]>([]);
  const [promotionCodes, setPromotionCodes] = useState<BsaasPromotionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingTargetsFor, setEditingTargetsFor] = useState<BsaasCoupon | null>(null);

  const [targetForm, setTargetForm] = useState<{
    target_features: string;
    target_tiers: string[];
    target_capability_types: string;
    target_tier_types: string[];
    target_demo_status: string[];
    target_subscription_statuses: string[];
  }>({
    target_features: '',
    target_tiers: [],
    target_capability_types: '',
    target_tier_types: [],
    target_demo_status: [],
    target_subscription_statuses: [],
  });

  const [couponForm, setCouponForm] = useState<CreateCouponRequest>({
    name: '',
    percent_off: undefined,
    amount_off: undefined,
    duration: 'once',
    duration_in_months: undefined,
    target_features: null,
    target_tiers: null,
    target_capability_types: null,
    target_tier_types: null,
    target_demo_status: null,
    target_subscription_statuses: null,
  });

  const [couponTargets, setCouponTargets] = useState<{
    target_features: string;
    target_tiers: string[];
    target_capability_types: string;
    target_tier_types: string[];
    target_demo_status: string[];
    target_subscription_statuses: string[];
  }>({
    target_features: '',
    target_tiers: [],
    target_capability_types: '',
    target_tier_types: [],
    target_demo_status: [],
    target_subscription_statuses: [],
  });

  const [promoForm, setPromoForm] = useState<CreatePromotionCodeRequest>({
    coupon_id: '',
    code: '',
    max_redemptions: undefined,
    expires_at: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [qrDialogFor, setQrDialogFor] = useState<{ id: string; code: string } | null>(null);

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
      const features = couponTargets.target_features
        ? couponTargets.target_features.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const capTypes = couponTargets.target_capability_types
        ? couponTargets.target_capability_types.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const req: CreateCouponRequest = {
        name: couponForm.name,
        duration: couponForm.duration,
        ...(couponForm.percent_off ? { percent_off: couponForm.percent_off } : {}),
        ...(couponForm.amount_off ? { amount_off: couponForm.amount_off } : {}),
        ...(couponForm.duration === 'repeating' && couponForm.duration_in_months
          ? { duration_in_months: couponForm.duration_in_months }
          : {}),
        ...(features.length ? { target_features: features } : {}),
        ...(couponTargets.target_tiers.length ? { target_tiers: couponTargets.target_tiers } : {}),
        ...(capTypes.length ? { target_capability_types: capTypes } : {}),
        ...(couponTargets.target_tier_types.length ? { target_tier_types: couponTargets.target_tier_types } : {}),
        ...(couponTargets.target_demo_status.length ? { target_demo_status: couponTargets.target_demo_status } : {}),
        ...(couponTargets.target_subscription_statuses.length ? { target_subscription_statuses: couponTargets.target_subscription_statuses } : {}),
      };
      await adminBsaasPromotionsService.createCoupon(req);
      setSuccess('Coupon created successfully');
      setShowCouponForm(false);
      setCouponForm({ name: '', percent_off: undefined, amount_off: undefined, duration: 'once', duration_in_months: undefined, target_features: null, target_tiers: null, target_capability_types: null, target_tier_types: null, target_demo_status: null, target_subscription_statuses: null });
      setCouponTargets({ target_features: '', target_tiers: [], target_capability_types: '', target_tier_types: [], target_demo_status: [], target_subscription_statuses: [] });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTargets = async () => {
    if (!editingTargetsFor) return;
    try {
      setSubmitting(true);
      setError(null);
      const features = targetForm.target_features
        ? targetForm.target_features.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const capTypes = targetForm.target_capability_types
        ? targetForm.target_capability_types.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      await adminBsaasPromotionsService.updateCouponTargets(editingTargetsFor.id, {
        target_features: features.length ? features : null,
        target_tiers: targetForm.target_tiers.length ? targetForm.target_tiers : null,
        target_capability_types: capTypes.length ? capTypes : null,
        target_tier_types: targetForm.target_tier_types.length ? targetForm.target_tier_types : null,
        target_demo_status: targetForm.target_demo_status.length ? targetForm.target_demo_status : null,
        target_subscription_statuses: targetForm.target_subscription_statuses.length ? targetForm.target_subscription_statuses : null,
      });
      setSuccess('Coupon targets updated successfully');
      setEditingTargetsFor(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update coupon targets');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditTargets = (coupon: BsaasCoupon) => {
    const t = coupon.targets;
    setTargetForm({
      target_features: t?.target_features?.join(', ') || '',
      target_tiers: t?.target_tiers || [],
      target_capability_types: t?.target_capability_types?.join(', ') || '',
      target_tier_types: t?.target_tier_types || [],
      target_demo_status: t?.target_demo_status || [],
      target_subscription_statuses: t?.target_subscription_statuses || [],
    });
    setEditingTargetsFor(coupon);
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

            {/* Targeting Section */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-semibold text-neutral-600">Coupon Targeting (optional)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Features (comma-separated feature keys)</label>
                  <input
                    type="text"
                    value={couponTargets.target_features}
                    onChange={e => setCouponTargets({ ...couponTargets, target_features: e.target.value })}
                    placeholder="e.g. chatbot_flexible, crm_flexible"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Tiers</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {TIER_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCouponTargets({
                          ...couponTargets,
                          target_tiers: couponTargets.target_tiers.includes(t)
                            ? couponTargets.target_tiers.filter(x => x !== t)
                            : [...couponTargets.target_tiers, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${couponTargets.target_tiers.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Capability Types (comma-separated)</label>
                  <input
                    type="text"
                    value={couponTargets.target_capability_types}
                    onChange={e => setCouponTargets({ ...couponTargets, target_capability_types: e.target.value })}
                    placeholder="e.g. chatbot_options, crm_options"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Tier Types</label>
                  <div className="mt-1 flex gap-1.5">
                    {TIER_TYPE_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCouponTargets({
                          ...couponTargets,
                          target_tier_types: couponTargets.target_tier_types.includes(t)
                            ? couponTargets.target_tier_types.filter(x => x !== t)
                            : [...couponTargets.target_tier_types, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${couponTargets.target_tier_types.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Demo Status</label>
                  <div className="mt-1 flex gap-1.5">
                    {DEMO_STATUS_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCouponTargets({
                          ...couponTargets,
                          target_demo_status: couponTargets.target_demo_status.includes(t)
                            ? couponTargets.target_demo_status.filter(x => x !== t)
                            : [...couponTargets.target_demo_status, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${couponTargets.target_demo_status.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Subscription Statuses</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {SUBSCRIPTION_STATUS_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCouponTargets({
                          ...couponTargets,
                          target_subscription_statuses: couponTargets.target_subscription_statuses.includes(t)
                            ? couponTargets.target_subscription_statuses.filter(x => x !== t)
                            : [...couponTargets.target_subscription_statuses, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${couponTargets.target_subscription_statuses.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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
                <th className="px-4 py-2 text-left font-medium">Targets</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No coupons yet</td>
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
                    {hasTargets(c.targets) ? (
                      <div className="flex flex-wrap gap-1">
                        {targetSummary(c.targets).map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">All (no restrictions)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.valid ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">Valid</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">Expired</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatStripeDate(c.created)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEditTargets(c)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                    >
                      <Target className="w-3.5 h-3.5" />
                      Edit Targets
                    </button>
                  </td>
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
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQrDialogFor({ id: p.id, code: p.code })}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Targets Modal */}
      {editingTargetsFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Edit Coupon Targets
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">{editingTargetsFor.name} ({editingTargetsFor.id})</p>
              </div>
              <button onClick={() => setEditingTargetsFor(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Features (comma-separated)</label>
                  <input
                    type="text"
                    value={targetForm.target_features}
                    onChange={e => setTargetForm({ ...targetForm, target_features: e.target.value })}
                    placeholder="e.g. chatbot_flexible, crm_flexible"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Tiers</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {TIER_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetForm({
                          ...targetForm,
                          target_tiers: targetForm.target_tiers.includes(t)
                            ? targetForm.target_tiers.filter(x => x !== t)
                            : [...targetForm.target_tiers, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${targetForm.target_tiers.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Capability Types (comma-separated)</label>
                  <input
                    type="text"
                    value={targetForm.target_capability_types}
                    onChange={e => setTargetForm({ ...targetForm, target_capability_types: e.target.value })}
                    placeholder="e.g. chatbot_options, crm_options"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Tier Types</label>
                  <div className="mt-1 flex gap-1.5">
                    {TIER_TYPE_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetForm({
                          ...targetForm,
                          target_tier_types: targetForm.target_tier_types.includes(t)
                            ? targetForm.target_tier_types.filter(x => x !== t)
                            : [...targetForm.target_tier_types, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${targetForm.target_tier_types.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Demo Status</label>
                  <div className="mt-1 flex gap-1.5">
                    {DEMO_STATUS_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetForm({
                          ...targetForm,
                          target_demo_status: targetForm.target_demo_status.includes(t)
                            ? targetForm.target_demo_status.filter(x => x !== t)
                            : [...targetForm.target_demo_status, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${targetForm.target_demo_status.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600">Target Subscription Statuses</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {SUBSCRIPTION_STATUS_OPTIONS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetForm({
                          ...targetForm,
                          target_subscription_statuses: targetForm.target_subscription_statuses.includes(t)
                            ? targetForm.target_subscription_statuses.filter(x => x !== t)
                            : [...targetForm.target_subscription_statuses, t],
                        })}
                        className={`px-2 py-1 text-xs rounded-md border ${targetForm.target_subscription_statuses.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-xs text-neutral-500 bg-blue-50 border border-blue-100 rounded-md p-3">
                Leave fields empty to remove restrictions. All non-empty fields must match (AND logic). Within each field, any match passes (OR logic).
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
              <button
                onClick={() => setEditingTargetsFor(null)}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTargets}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Targets'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Dialog */}
      {qrDialogFor && (
        <PromoCodeQRDialog
          promotionCodeId={qrDialogFor.id}
          promotionCode={qrDialogFor.code}
          open={true}
          onClose={() => setQrDialogFor(null)}
        />
      )}
    </div>
  );
}
