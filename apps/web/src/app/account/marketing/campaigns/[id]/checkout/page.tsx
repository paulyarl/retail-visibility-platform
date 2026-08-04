'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Tag, Check, Loader2, Lock } from 'lucide-react';
import marketingCustomerService, {
  CustomerCampaignProjection,
  ApplicableCoupon,
} from '@/services/MarketingCustomerService';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PortalCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = (params?.id as string) || '';

  const [campaign, setCampaign] = useState<CustomerCampaignProjection | null>(null);
  const [coupons, setCoupons] = useState<ApplicableCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment method state
  const [savedMethods, setSavedMethods] = useState<Array<{
    id: string;
    cardLast4: string | null;
    cardBrand: string | null;
    isDefault: boolean;
  }>>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [useNewCard, setUseNewCard] = useState(false);

  // Coupon state
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');

  // Checkout state
  const [processing, setProcessing] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    clientSecret?: string;
    paymentIntentId?: string;
    amountCents: number;
    discountCents: number;
  } | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [camp, applicableCoupons] = await Promise.all([
          marketingCustomerService.getCampaign(campaignId),
          marketingCustomerService.getApplicableCoupons(campaignId),
        ]);
        setCampaign(camp);
        setCoupons(applicableCoupons);

        // Fetch saved payment methods (platform scope)
        // These come from the existing customer-payment-methods service
        try {
          const res = await fetch('/api/customer-payment-methods?tenantId=platform', {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            const methods = (data.data || data || []).filter((m: any) => m.tenantId === 'platform');
            setSavedMethods(methods);
            const defaultMethod = methods.find((m: any) => m.isDefault);
            if (defaultMethod) {
              setSelectedMethodId(defaultMethod.id);
            } else if (methods.length > 0) {
              setSelectedMethodId(methods[0].id);
            } else {
              setUseNewCard(true);
            }
          }
        } catch {
          // Non-critical — fall back to new card
          setUseNewCard(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load checkout');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campaignId]);

  const handleCheckout = async () => {
    if (!campaign) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await marketingCustomerService.createCheckout({
        campaignId: campaign.id,
        savedCouponId: selectedCouponId || undefined,
        couponCode: couponCode || undefined,
        useSavedMethodId: !useNewCard && selectedMethodId ? selectedMethodId : undefined,
      });

      // If off-session charge succeeded (no clientSecret), we're done
      if (result.stage && !result.clientSecret) {
        setSuccess(true);
        setTimeout(() => router.push('/account/marketing'), 2000);
        return;
      }

      // Interactive checkout — needs Stripe Elements
      if (result.clientSecret) {
        setCheckoutData({
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          amountCents: result.amountCents,
          discountCents: result.discountCents,
        });
      }
    } catch (err: any) {
      // SCA-required errors return 402 with clientSecret
      if (err.message?.includes('authentication_required')) {
        setError('This card requires authentication. Please use a new card below.');
        setUseNewCard(true);
      } else {
        setError(err.message || 'Checkout failed');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/account/marketing" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to My Services
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
        <p className="text-gray-500 mt-2">Redirecting to your services...</p>
      </div>
    );
  }

  if (!campaign) return null;

  const packagePrice = 0; // The campaign projection doesn't expose package_price_cents;
  // the backend checkout endpoint resolves it. We show the amount from checkoutData if available.

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/account/marketing/campaigns/${campaign.id}`}
        className="text-gray-400 hover:text-gray-600 flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Campaign
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="text-gray-500 mt-1">{campaign.businessName} — {campaign.serviceCategoryLabel}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}

      {/* Payment method selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5" /> Payment Method
        </h2>

        {savedMethods.length > 0 && (
          <div className="space-y-2">
            {savedMethods.map((m) => (
              <label
                key={m.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  !useNewCard && selectedMethodId === m.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={!useNewCard && selectedMethodId === m.id}
                  onChange={() => {
                    setSelectedMethodId(m.id);
                    setUseNewCard(false);
                  }}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {m.cardBrand ? m.cardBrand.charAt(0).toUpperCase() + m.cardBrand.slice(1) : 'Card'} •••• {m.cardLast4}
                  </p>
                  {m.isDefault && <span className="text-xs text-blue-600">Default</span>}
                </div>
              </label>
            ))}
          </div>
        )}

        <label
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            useNewCard ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            checked={useNewCard}
            onChange={() => setUseNewCard(true)}
            className="w-4 h-4"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">New card</p>
            <p className="text-xs text-gray-500">Enter a new payment method</p>
          </div>
        </label>

        {useNewCard && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              You'll be redirected to Stripe to complete payment securely.
            </p>
          </div>
        )}
      </div>

      {/* Coupon selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Tag className="w-5 h-5" /> Coupon
        </h2>

        {coupons.length > 0 && (
          <div className="space-y-2">
            {coupons.map((c) => (
              <label
                key={c.savedCouponId}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedCouponId === c.savedCouponId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="coupon"
                    checked={selectedCouponId === c.savedCouponId}
                    onChange={() => {
                      setSelectedCouponId(c.savedCouponId);
                      setCouponCode('');
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.label}</p>
                    <p className="text-xs text-green-600">Save {formatPrice(c.discountCents)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono">{c.code}</span>
              </label>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Or enter a code</label>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              setSelectedCouponId('');
            }}
            placeholder="Enter coupon code"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Service</span>
            <span className="text-gray-900">{campaign.serviceCategoryLabel}</span>
          </div>
          {checkoutData && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="text-gray-900">{formatPrice(checkoutData.amountCents + checkoutData.discountCents)}</span>
              </div>
              {checkoutData.discountCents > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(checkoutData.discountCents)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(checkoutData.amountCents)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pay button */}
      <button
        onClick={handleCheckout}
        disabled={processing || (!selectedMethodId && !useNewCard && savedMethods.length === 0)}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {processing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
        ) : (
          <><Lock className="w-5 h-5" /> Pay {checkoutData ? formatPrice(checkoutData.amountCents) : 'Now'}</>
        )}
      </button>

      {/* Stripe Elements mount point for interactive checkout */}
      {checkoutData?.clientSecret && useNewCard && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Enter Card Details</h3>
          <div id="stripe-payment-element" />
          <button
            onClick={async () => {
              // The Stripe Elements integration would mount here.
              // For now, this is a placeholder — the actual Stripe.js
              // integration requires the publishable key + Elements provider.
              setError('Stripe Elements integration required. Please use a saved card or contact support.');
            }}
            className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >
            Confirm Payment
          </button>
        </div>
      )}
    </div>
  );
}
