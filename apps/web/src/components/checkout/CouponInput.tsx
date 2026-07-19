import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { PublicCouponService } from '@/services/PublicCouponService';
import { usePublicCouponOptionsCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';

export default function CouponInput({ tenantId, onDiscountApplied }: { tenantId: string; onDiscountApplied?: (discountCents: number, couponCode: string) => void }) {
  const searchParams = useSearchParams();
  const { data: couponCap, loading: capLoading } = usePublicCouponOptionsCapability(tenantId);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const autoAppliedRef = useRef(false);

  const publicCouponService = PublicCouponService.getInstance();

  const handleApply = async (codeToApply?: string) => {
    const couponCode = (codeToApply || code).trim();
    if (!couponCode) return;
    setLoading(true);
    setError(null);
    try {
      const result = await publicCouponService.validateCoupon(tenantId, couponCode);
      if (result?.valid && result?.discountCents) {
        setDiscount(result.discountCents);
        setAppliedCode(couponCode);
        if (codeToApply) setCode(couponCode);
        onDiscountApplied?.(result.discountCents, couponCode);
        toast({ title: 'Coupon applied', description: `You saved $${(result.discountCents / 100).toFixed(2)}`, variant: 'success' });
      } else {
        const msg = result?.message || 'Invalid or expired coupon';
        setError(msg);
        toast({ title: 'Coupon invalid', description: msg, variant: 'destructive' });
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to validate coupon';
      setError(msg);
      toast({ title: 'Coupon error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoAppliedRef.current) return;
    if (capLoading || !couponCap?.enabled) return;
    const urlCoupon = searchParams?.get('coupon');
    if (urlCoupon && urlCoupon.trim()) {
      autoAppliedRef.current = true;
      handleApply(urlCoupon.trim());
    }
  }, [searchParams, capLoading, couponCap]);

  if (capLoading) return null;
  if (!couponCap?.enabled) return null;

  return (
    <div className="border rounded-lg p-4 mb-4 bg-gray-50">
      <h3 className="font-semibold mb-2 text-gray-900">Apply Coupon</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
          placeholder="Enter coupon code"
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={loading}
        />
        <button
          onClick={() => handleApply()}
          disabled={loading || !code.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
        >
          {loading ? 'Checking...' : 'Apply'}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      {discount !== null && appliedCode && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-green-700 text-sm font-medium">
            ✓ {appliedCode} applied — You saved ${(discount / 100).toFixed(2)}
          </p>
          <button
            onClick={() => { setDiscount(null); setAppliedCode(null); setCode(''); setError(null); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
