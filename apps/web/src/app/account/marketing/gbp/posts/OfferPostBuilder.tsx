'use client';

import { useEffect, useState } from 'react';
import { Tag, Link as LinkIcon, Wallet } from 'lucide-react';
import marketingCustomerService, { WalletCoupon } from '@/services/MarketingCustomerService';

interface OfferPostBuilderProps {
  couponCode: string;
  setCouponCode: (value: string) => void;
  redeemUrl: string;
  setRedeemUrl: (value: string) => void;
  terms: string;
  setTerms: (value: string) => void;
}

/**
 * Offer Post Builder — wires coupon short links (/s/{autoId}) into GBP offer posts.
 *
 * When composing an OFFER-type post, the merchant can select an existing
 * coupon from their coupon wallet — the coupon's short link (/s/{autoId}?c=...)
 * is auto-wired into the offer's redeem URL and the coupon code is populated.
 * This creates cross-traffic: Google post → platform coupon funnel → redemption.
 *
 * Manual entry remains available for coupons not in the wallet.
 *
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE3.md Task 4
 */
export function OfferPostBuilder({
  couponCode,
  setCouponCode,
  redeemUrl,
  setRedeemUrl,
  terms,
  setTerms,
}: OfferPostBuilderProps) {
  const [wallet, setWallet] = useState<WalletCoupon[]>([]);
  const [walletLoaded, setWalletLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    marketingCustomerService
      .listWalletCoupons()
      .then((coupons) => {
        if (!cancelled) setWallet(coupons);
      })
      .catch(() => {
        // Wallet unavailable — manual entry still works
      })
      .finally(() => {
        if (!cancelled) setWalletLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleWalletSelect = (savedCouponId: string) => {
    const coupon = wallet.find((c) => c.savedCouponId === savedCouponId);
    if (!coupon) return;
    setCouponCode(coupon.code);
    setRedeemUrl(coupon.shortUrl);
    if (!terms && coupon.terms) setTerms(coupon.terms);
  };

  return (
    <div className="space-y-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
      <p className="text-xs font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1">
        <Tag className="w-3.5 h-3.5" />
        Offer Details
      </p>

      {/* Wallet coupon picker */}
      {walletLoaded && wallet.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" />
            From Your Coupon Wallet
          </label>
          <select
            defaultValue=""
            onChange={(e) => handleWalletSelect(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="" disabled>
              Select a saved coupon...
            </option>
            {wallet.map((c) => (
              <option key={c.savedCouponId} value={c.savedCouponId}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Selecting a wallet coupon auto-fills the code, short link, and terms.
          </p>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Coupon Code</label>
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
          placeholder="e.g., SUMMER20"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1">
          <LinkIcon className="w-3.5 h-3.5" />
          Redeem URL
        </label>
        <input
          type="url"
          value={redeemUrl}
          onChange={(e) => setRedeemUrl(e.target.value)}
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="https://yourdomain.com/s/couponId"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use your coupon short link (/s/...) for cross-traffic from Google to your platform coupon funnel.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Terms & Conditions (optional)</label>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="e.g., Valid through Dec 31. One per customer."
        />
      </div>
    </div>
  );
}
