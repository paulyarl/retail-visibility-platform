'use client';

import { useEffect, useState } from 'react';
import { X, Lock, Check, AlertCircle } from 'lucide-react';
import marketIntelCustomerService, { UnlockResult } from '@/services/MarketIntelCustomerService';

interface MarketIntelPaywallProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}

/**
 * MarketIntelPaywall — modal that handles the unlock checkout flow.
 *
 * Phase 3 flow (§6.2):
 *   1. POST /unlock → returns clientSecret (Stripe PaymentIntent).
 *   2. Frontend confirms with Stripe Elements (simplified here — a real
 *      integration would load Stripe.js and mount the card element).
 *   3. POST /unlock/confirm → records the unlock + revenue row.
 *   4. onUnlocked() → sidebar re-fetches full content.
 *
 * Edge cases handled:
 *   - alreadyOwner → close + show full content (free).
 *   - alreadyUnlocked → close + show full content.
 *   - tenant_required → show "register a business account" message.
 *   - error → show the error message.
 *
 * NOTE: This is a Phase 3 scaffold. The Stripe Elements confirmation
 * step is stubbed — a full Stripe.js integration would mount the card
 * element and call stripe.confirmCardPayment(clientSecret). For now,
 * the modal shows the price + "Pay $29" button that triggers the
 * unlock + confirm flow. The actual Stripe confirmation will be wired
 * when the Stripe.js dependency is confirmed in the frontend.
 */
export function MarketIntelPaywall({ slug, open, onClose, onUnlocked }: MarketIntelPaywallProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockResult, setUnlockResult] = useState<UnlockResult | null>(null);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setUnlockResult(null);
      setTenantRequired(false);
    }
  }, [open]);

  if (!open) return null;

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    setTenantRequired(false);

    const result = await marketIntelCustomerService.createUnlock(slug);
    setUnlockResult(result);

    if (result.error === 'tenant_required') {
      setTenantRequired(true);
      setLoading(false);
      return;
    }

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // alreadyOwner or alreadyUnlocked → free access, no payment needed.
    if (result.alreadyOwner || result.alreadyUnlocked) {
      onUnlocked();
      onClose();
      return;
    }

    // We have a clientSecret — in a full Stripe.js integration, this is
    // where we'd mount Stripe Elements and confirm the payment. For the
    // Phase 3 scaffold, we show the payment step. The confirm step
    // happens after the user completes the Stripe checkout.
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!unlockResult?.paymentIntentId) return;
    setLoading(true);
    setError(null);

    const result = await marketIntelCustomerService.confirmUnlock(slug, unlockResult.paymentIntentId);

    if (result.unlocked) {
      onUnlocked();
      onClose();
    } else {
      setError(result.error || 'Confirmation failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unlock Full Report</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {tenantRequired && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    You'll need a business account for this
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Market Intel reports are a business product — register or link your
                    business account to purchase.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!tenantRequired && !unlockResult?.clientSecret && (
            <>
              <div className="space-y-2">
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                  Market Intelligence Report
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get the complete market analysis for this business, including:
                </p>
                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    All growth opportunities with full descriptions
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    Complete category signal checklist with evidence
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    Gold standard benchmark comparison
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    Market density + metro dynamics
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    Downloadable PDF report
                  </li>
                </ul>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">$29</span>
                  <span className="text-sm text-gray-500">one-time, permanent</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Per business. Owner? Claim this business for free access instead.
                </p>
              </div>
            </>
          )}

          {unlockResult?.clientSecret && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Payment intent created. Complete the payment to unlock the full report.
              </p>
              <p className="text-xs text-gray-400">
                Payment Intent ID: {unlockResult.paymentIntentId}
              </p>
              <p className="text-xs text-gray-400 italic">
                (Stripe Elements confirmation will be wired in the next iteration.
                For now, click confirm to simulate a successful payment.)
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          {!unlockResult?.clientSecret && !tenantRequired && (
            <button
              onClick={handleUnlock}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Unlock for $29'}
            </button>
          )}
          {unlockResult?.clientSecret && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
