'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import directoryPresenceUpgradeService, {
  UpgradeOptions,
  UpgradeTierOption,
} from '@/services/DirectoryPresenceUpgradeService';
import customerPaymentMethodsService from '@/services/CustomerPaymentMethodsService';
import { ArrowLeft, Check, Loader2, Sparkles, CreditCard, AlertCircle } from 'lucide-react';

// --- Stripe init (lazy, guarded) ---
function getStripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
}
function isStripeConfigured(): boolean {
  const key = getStripePublishableKey();
  return !!(key && key.length > 0 && key.startsWith('pk_'));
}
const stripePromise = isStripeConfigured() ? loadStripe(getStripePublishableKey()!) : null;

// --- Card form (inline, for paid upgrades) ---
function CardForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (paymentMethodId: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setError('Stripe not loaded. Please refresh and try again.');
      return;
    }
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    try {
      setLoading(true);
      setError(null);

      // Create SetupIntent to get clientSecret
      const setupResult = await customerPaymentMethodsService.createSetupIntent('');
      if (!setupResult.success || !setupResult.clientSecret) {
        setError(setupResult.error || 'Failed to initialize card setup');
        return;
      }

      // Confirm card setup
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
        setupResult.clientSecret,
        { payment_method: { card: cardElement } },
      );

      if (confirmError) {
        setError(confirmError.message || 'Failed to confirm card setup');
        return;
      }

      if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
        onSuccess(setupIntent.payment_method as string);
      } else if (setupIntent?.status === 'requires_action') {
        setError('Additional authentication is required. Please try again or use a different card.');
      } else {
        setError(`Setup status: ${setupIntent?.status || 'unknown'}. Please try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <div className="border border-gray-200 rounded-lg p-4">
        <CardElement
          options={{
            style: {
              base: { fontSize: '16px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } },
              invalid: { color: '#e11d48' },
            },
          }}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !stripe}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" /> Confirm & Upgrade
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TierUpgradePage() {
  const params = useParams();
  const tenantId = (params?.tenantId as string) || '';

  const [options, setOptions] = useState<UpgradeOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<UpgradeTierOption | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const opts = await directoryPresenceUpgradeService.getUpgradeOptions(tenantId);
      setOptions(opts);
      if (!opts) setError('Failed to load upgrade options.');
      setLoading(false);
    })();
  }, [tenantId]);

  const handleUpgrade = async (tier: UpgradeTierOption, paymentMethodId?: string) => {
    setUpgrading(tier.tierKey);
    setUpgradeError(null);
    setSuccess(null);
    try {
      const result = await directoryPresenceUpgradeService.upgrade(
        tenantId,
        tier.tierKey,
        billingCycle,
        paymentMethodId,
      );
      if (result.success) {
        setSuccess(tier.displayName || tier.name);
        setSelectedTier(null);
      } else {
        setUpgradeError(result.error || 'upgrade_failed');
      }
    } catch (err: any) {
      setUpgradeError(err?.message || 'upgrade_failed');
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-xl font-bold text-rose-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <Link
            href={`/t/${tenantId}/dashboard`}
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Upgraded!</h2>
          <p className="text-gray-600">
            You&apos;re now on <strong>{success}</strong>. Your dashboard has been upgraded with new
            features.
          </p>
          <Link
            href={`/t/${tenantId}/dashboard`}
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            Go to Dashboard <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </div>
    );
  }

  const currentTier = options?.currentTier;
  const upgradeTiers = options?.upgradeOptions ?? [];
  const isGateway = options?.isGatewayUpgrade === true;

  // V3.1: sort gateway options so primary (presence) is first
  const sortedTiers = isGateway
    ? [...upgradeTiers].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    : upgradeTiers;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href={`/t/${tenantId}/dashboard`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-blue-600" />
            {isGateway ? 'Choose Your Presence Mode' : 'Upgrade Your Plan'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isGateway
              ? 'You\u2019re on the free Directory Presence plan. Pick a visibility surface to unlock richer features.'
              : 'Upgrade to sell online, manage inventory, and unlock the full platform.'}
          </p>
        </div>

        {/* Current tier card */}
        {currentTier && (
          <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Plan</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {currentTier.displayName || currentTier.name}
                </h2>
                {currentTier.description && (
                  <p className="text-sm text-gray-600 mt-1">{currentTier.description}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${currentTier.priceMonthly.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">/month</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing cycle toggle */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingCycle === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
            }`}
          >
            Annual
          </button>
        </div>

        {/* Upgrade options */}
        {sortedTiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              No upgrade options are currently available for your plan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTiers.map((tier) => {
              const price =
                billingCycle === 'annual' ? tier.priceAnnual / 12 : tier.priceMonthly;
              const isUpgrading = upgrading === tier.tierKey;
              const isPaid = tier.priceMonthly > 0;
              const isThisSelected = selectedTier?.tierKey === tier.tierKey;

              return (
                <div
                  key={tier.tierKey}
                  className={`bg-white rounded-xl border p-6 flex flex-col ${
                    tier.isPrimary
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-gray-200'
                  }`}
                >
                  {/* V3.1 mode badge */}
                  {isGateway && tier.mode && (
                    <div className="mb-3">
                      <span
                        className={`inline-block text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded ${
                          tier.isPrimary
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tier.mode}
                      </span>
                      {tier.isPrimary && (
                        <span className="ml-2 text-xs font-medium text-blue-600">
                          Recommended
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {tier.displayName || tier.name}
                    </h3>
                    {isGateway && tier.tagline && (
                      <p className="text-sm font-medium text-gray-700 mt-1">{tier.tagline}</p>
                    )}
                    {tier.description && (
                      <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                    )}
                    {isGateway && tier.surface && (
                      <p className="text-xs text-gray-500 mt-1">Surface: {tier.surface}</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      ${price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500">/month</span>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-green-600 mt-1">Billed annually</p>
                    )}
                  </div>

                  {tier.newFeatures.length > 0 && (
                    <div className="mb-6 flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        New Features
                      </p>
                      <ul className="space-y-2">
                        {tier.newFeatures.slice(0, 8).map((f) => (
                          <li key={f.featureKey} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{f.featureName}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* V3.1: paid tiers show inline card form when selected */}
                  {isPaid && isThisSelected ? (
                    <Elements stripe={stripePromise}>
                      <CardForm
                        onSuccess={(pmId) => handleUpgrade(tier, pmId)}
                        onCancel={() => setSelectedTier(null)}
                      />
                    </Elements>
                  ) : (
                    <button
                      onClick={() => {
                        if (isPaid) {
                          setSelectedTier(tier);
                          setUpgradeError(null);
                        } else {
                          handleUpgrade(tier);
                        }
                      }}
                      disabled={isUpgrading}
                      className={`w-full font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        tier.isPrimary
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                    >
                      {isUpgrading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Upgrading...
                        </>
                      ) : isPaid ? (
                        <>
                          <CreditCard className="w-4 h-4" /> Choose {tier.displayName || tier.name}
                        </>
                      ) : (
                        <>Upgrade to {tier.displayName || tier.name}</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {upgradeError && (
          <div className="mt-6 bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm">
            {upgradeError === 'payment_method_required'
              ? 'A payment method is required to upgrade to a paid tier. Add a payment method in your billing settings first.'
              : upgradeError === 'invalid_gateway_upgrade_target'
                ? 'This tier is not available from the free plan. Choose one of the three presence modes above.'
                : upgradeError === 'upgrade_failed'
                  ? 'Upgrade failed. Please try again or contact support.'
                  : upgradeError}
          </div>
        )}
      </div>
    </div>
  );
}
