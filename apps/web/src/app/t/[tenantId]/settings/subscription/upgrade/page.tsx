'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import directoryPresenceUpgradeService, {
  UpgradeOptions,
  UpgradeTierOption,
} from '@/services/DirectoryPresenceUpgradeService';
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react';

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

  const handleUpgrade = async (tier: UpgradeTierOption) => {
    setUpgrading(tier.tierKey);
    setUpgradeError(null);
    setSuccess(null);
    try {
      const result = await directoryPresenceUpgradeService.upgrade(
        tenantId,
        tier.tierKey,
        billingCycle,
      );
      if (result.success) {
        setSuccess(tier.displayName || tier.name);
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
            Upgrade Your Plan
          </h1>
          <p className="text-gray-500 mt-2">
            You&apos;re currently on the free Directory Presence plan. Upgrade to sell online, manage
            inventory, and unlock the full platform.
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
        {upgradeTiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              No upgrade options are currently available for your plan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upgradeTiers.map((tier) => {
              const price =
                billingCycle === 'annual' ? tier.priceAnnual / 12 : tier.priceMonthly;
              const isUpgrading = upgrading === tier.tierKey;
              return (
                <div
                  key={tier.tierKey}
                  className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col"
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {tier.displayName || tier.name}
                    </h3>
                    {tier.description && (
                      <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
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

                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={isUpgrading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUpgrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Upgrading...
                      </>
                    ) : (
                      <>Upgrade to {tier.displayName || tier.name}</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {upgradeError && (
          <div className="mt-6 bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm">
            {upgradeError === 'payment_method_required'
              ? 'A payment method is required to upgrade to a paid tier. Add a payment method in your billing settings first.'
              : upgradeError === 'upgrade_failed'
                ? 'Upgrade failed. Please try again or contact support.'
                : upgradeError}
          </div>
        )}
      </div>
    </div>
  );
}
