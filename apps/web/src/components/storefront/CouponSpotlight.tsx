import React, { useEffect, useState, useCallback } from 'react';
import { Percent, DollarSign, Truck, Gift, Copy, Check } from 'lucide-react';
import { PublicCouponService } from '@/services/PublicCouponService';
import { usePublicCouponOptionsCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';

export interface SpotlightCoupon {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed' | 'free_shipping' | 'gift';
  discountValue: number;
  promotionalMessage?: string;
  termsSummary?: string;
  expiresAt?: string | null;
  isActive?: boolean;
  redemptionCount?: number;
  maxRedemptions?: number | null;
}

export default function CouponSpotlight({
  tenantId,
  coupon: couponProp,
  variant = 'banner',
  className = '',
}: {
  tenantId: string;
  coupon?: SpotlightCoupon | null;
  variant?: 'banner' | 'card' | 'strip';
  className?: string;
}) {
  const { data: capState, loading: capLoading } = usePublicCouponOptionsCapability(tenantId);
  const [fetchedCoupon, setFetchedCoupon] = useState<SpotlightCoupon | null>(null);
  const [copied, setCopied] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  const publicCouponService = PublicCouponService.getInstance();

  // Fetch spotlight coupon if not passed as prop
  useEffect(() => {
    if (couponProp !== undefined) {
      setFetchedCoupon(couponProp);
      return;
    }
    if (!tenantId || capLoading) return;
    if (!capState?.enabled || !capState?.canUseSpotlight) return;

    let cancelled = false;
    const fetchSpotlight = async () => {
      try {
        const result = await publicCouponService.getSpotlightCoupon(tenantId);
        if (!cancelled && result) {
          setFetchedCoupon(result);
        }
      } catch {
        // non-critical
      }
    };
    fetchSpotlight();
    return () => { cancelled = true; };
  }, [tenantId, capState?.enabled, capState?.canUseSpotlight, capLoading, couponProp, publicCouponService]);

  const coupon = couponProp !== undefined ? couponProp : fetchedCoupon;

  // Auto-hide checks: expired or exhausted
  useEffect(() => {
    if (!coupon) return;
    if (coupon.expiresAt) {
      const expiry = new Date(coupon.expiresAt);
      const now = new Date();
      const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff > 0 ? diff : 0);
    } else {
      setDaysLeft(null);
    }
  }, [coupon]);

  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isExhausted = coupon?.maxRedemptions != null && (coupon.redemptionCount ?? 0) >= coupon.maxRedemptions;

  // Track view event on mount
  useEffect(() => {
    if (!coupon || isExpired || isExhausted) return;
    publicCouponService.trackEvent(tenantId, {
      eventType: 'view',
      couponId: coupon.id,
      couponCode: coupon.code,
      surface: 'spotlight',
    });
  }, [coupon?.id, tenantId, isExpired, isExhausted, publicCouponService, coupon]);

  const handleCopy = useCallback(() => {
    if (!coupon) return;
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      publicCouponService.trackEvent(tenantId, {
        eventType: 'copy',
        couponId: coupon.id,
        couponCode: coupon.code,
        surface: 'spotlight',
      });
    });
  }, [coupon, tenantId, publicCouponService]);

  const handleApplyClick = useCallback(() => {
    if (!coupon) return;
    publicCouponService.trackEvent(tenantId, {
      eventType: 'click',
      couponId: coupon.id,
      couponCode: coupon.code,
      surface: 'spotlight',
    });
  }, [coupon, tenantId, publicCouponService]);

  // Render nothing if loading, capability disabled, no coupon, expired, or exhausted
  if (capLoading) return null;
  if (!capState?.enabled || !capState?.canUseSpotlight) return null;
  if (!coupon) return null;
  if (isExpired || isExhausted) return null;

  const iconMap = {
    percent: Percent,
    fixed: DollarSign,
    free_shipping: Truck,
    gift: Gift,
  };
  const Icon = iconMap[coupon.discountType] || Percent;

  const discountText =
    coupon.discountType === 'percent'
      ? `${coupon.discountValue}% off`
      : coupon.discountType === 'fixed'
      ? `$${(coupon.discountValue / 100).toFixed(2)} off`
      : coupon.discountType === 'free_shipping'
      ? 'Free Shipping'
      : 'Special Offer';

  const base = 'rounded-lg overflow-hidden shadow-sm';
  const variants = {
    banner: 'w-full bg-gradient-to-r from-amber-400 to-amber-600 text-white p-6',
    card: 'border border-amber-200 bg-amber-50 p-4',
    strip: 'bg-amber-100 text-amber-900 px-4 py-2 flex items-center gap-3',
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold">{discountText}</div>
          {coupon.promotionalMessage && (
            <div className="text-sm opacity-90">{coupon.promotionalMessage}</div>
          )}
          <div className="text-xs opacity-75 flex items-center gap-2 mt-1">
            <span>Code: <span className="font-mono font-semibold">{coupon.code}</span></span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 hover:underline focus:outline-none"
              aria-label="Copy coupon code"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {daysLeft !== null && (
            <div className="text-xs opacity-75 mt-1">
              {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Expires today'}
            </div>
          )}
        </div>
        <a
          href={`/checkout?coupon=${encodeURIComponent(coupon.code)}`}
          onClick={handleApplyClick}
          className="text-sm font-semibold underline hover:opacity-80 whitespace-nowrap"
        >
          Apply now
        </a>
      </div>
      {coupon.termsSummary && (
        <div className="text-xs opacity-75 mt-1">{coupon.termsSummary}</div>
      )}
    </div>
  );
}
