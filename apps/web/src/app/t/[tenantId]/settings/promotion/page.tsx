"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mantine/core';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, TrendingUp, Eye, MousePointer, Calendar, DollarSign, Check, X, CreditCard, RefreshCw, History, Lock } from 'lucide-react';
import { DirectoryPromotionService, PromotionPlan, PromotionPurchase } from '@/services/DirectoryPromotionService';
import { useDirectoryPromotionCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { clientLogger } from '@/lib/client-logger';

const TIER_FEATURES: Record<string, string[]> = {
  basic: ['Gold marker on map', 'Promoted badge', 'Higher visibility', 'Basic analytics'],
  premium: ['Everything in Basic', 'Featured in search results', 'Homepage carousel spot', 'Detailed analytics dashboard', 'Chatbot promotion awareness'],
  featured: ['Everything in Premium', 'Highest search priority', 'Premium badge styling', 'Enhanced carousel placement', 'Automated renewal protection'],
};

const TIER_COLORS: Record<string, string> = {
  basic: 'from-amber-500 to-amber-600',
  premium: 'from-blue-500 to-blue-600',
  featured: 'from-purple-500 to-purple-600',
};




export default function PromotionSettingsPage({ tenantId: propTenantId }: { tenantId?: string } = {}) {
  const params = useParams();
  const router = useRouter();
  const tenantId = propTenantId || (params?.tenantId as string);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [purchases, setPurchases] = useState<PromotionPurchase[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: promoCapability, loading: capLoading } = useDirectoryPromotionCapability(tenantId);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, plansData, purchasesData] = await Promise.all([
        DirectoryPromotionService.getStatus(tenantId),
        DirectoryPromotionService.listPlans(tenantId),
        DirectoryPromotionService.listPurchases(tenantId),
      ]);
      setStatus(statusData);
      setPlans(plansData);
      setPurchases(purchasesData);
      if (plansData.length > 0 && !selectedPlanKey) {
        const firstPremium = plansData.find(p => p.tier === 'premium');
        setSelectedPlanKey((firstPremium || plansData[0]).planKey);
      }
    } catch (err) {
      clientLogger.error('Error fetching promotion data:', { detail: err });
      setError('Failed to load promotion data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePurchase = async () => {
    if (!selectedPlanKey) return;
    setProcessing(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/t/${tenantId}/settings/promotion?status=success`;
      const cancelUrl = `${origin}/t/${tenantId}/settings/promotion?status=cancelled`;

      const result = await DirectoryPromotionService.createPurchase(tenantId, {
        planKey: selectedPlanKey,
        successUrl,
        cancelUrl,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message || 'Failed to start checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRenew = async (purchaseId: string) => {
    setProcessing(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/t/${tenantId}/settings/promotion?status=renewed`;
      const cancelUrl = `${origin}/t/${tenantId}/settings/promotion?status=cancelled`;

      const result = await DirectoryPromotionService.renewPurchase(tenantId, purchaseId, {
        successUrl,
        cancelUrl,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message || 'Failed to start renewal checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your promotion? It will remain active until the current period expires.')) return;

    setProcessing(true);
    setError(null);
    try {
      await DirectoryPromotionService.cancelPromotion(tenantId);
      await fetchData();
    } catch (err) {
      const message = (err as Error).message;
      setError(message || 'Failed to cancel promotion. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || capLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading promotion settings...</p>
        </div>
      </div>
    );
  }

  const isActive = status?.isPromoted && status?.promotionExpiresAt && new Date(status.promotionExpiresAt) > new Date();
  const activePurchase = status?.activePurchase;

  // Tier gate: filter plans by allowed tiers from capability
  const allowedTiers = promoCapability?.allowedTiers || [];
  const gatedPlans = promoCapability?.enabled
    ? plans.filter(p => allowedTiers.includes(p.tier as any))
    : [];
  const selectedPlan = gatedPlans.find(p => p.planKey === selectedPlanKey);

  // Group plans by tier (use gated plans for selection)
  const plansByTier: Record<string, PromotionPlan[]> = {};
  for (const plan of gatedPlans) {
    if (!plansByTier[plan.tier]) plansByTier[plan.tier] = [];
    plansByTier[plan.tier].push(plan);
  }
  const tierOrder = ['basic', 'premium', 'featured'];

  // Capability gated — show upgrade prompt instead of plans
  const isCapabilityGated = !promoCapability?.enabled || gatedPlans.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-amber-500" />
          Directory Promotion
        </h1>
        <p className="mt-2 text-gray-600">
          Stand out on the map and get more visibility for your store
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current Status */}
      {isActive && status && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Promotion Active
              </h3>
              <p className="mt-1 text-gray-700">
                Your store is currently promoted with <span className="font-semibold capitalize">{status.promotionTier}</span> tier
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Expires: {status.promotionExpiresAt ? new Date(status.promotionExpiresAt).toLocaleDateString() : 'Never'}
              </p>
              {activePurchase && activePurchase.status === 'grace_period' && (
                <p className="mt-1 text-sm text-red-600 font-medium">
                  ⚠ Grace period — renewal payment failed. Update your payment method to avoid losing promotion.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {activePurchase && (
                <button
                  onClick={() => handleRenew(activePurchase.id)}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {processing ? 'Processing...' : 'Renew Now'}
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {processing ? 'Processing...' : 'Cancel'}
              </button>
            </div>
          </div>

          {/* Analytics */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-sm">Impressions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{(status.promotionImpressions || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <MousePointer className="w-4 h-4" />
                <span className="text-sm">Clicks</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{(status.promotionClicks || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Detailed analytics link */}
          <div className="mt-4">
            <Link
              href={`/t/${tenantId}/settings/promotion/analytics`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <TrendingUp className="w-4 h-4" />
              View detailed analytics
            </Link>
          </div>
        </div>
      )}

      {/* Capability gated — upgrade prompt */}
      {!isActive && isCapabilityGated && !loading && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg p-8 mb-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Directory Promotion Not Available</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Your current plan doesn't include directory promotion. Upgrade your subscription to promote your store on the directory map and search results.
          </p>
          <button
            onClick={() => router.push(`/t/${tenantId}/settings/subscription`)}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <TrendingUp className="w-5 h-5" />
            View Plans
          </button>
        </div>
      )}

      {/* Plan Selection */}
      {!isActive && !isCapabilityGated && gatedPlans.length > 0 && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Promotion</h2>

            {/* Tier cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {tierOrder.map((tier) => {
                const tierPlans = plansByTier[tier] || [];
                if (tierPlans.length === 0) return null;
                const minPrice = Math.min(...tierPlans.map(p => p.priceCents));
                const features = TIER_FEATURES[tier] || [];
                const isPopular = tier === 'premium';

                return (
                  <button
                    key={tier}
                    onClick={() => {
                      const firstPlan = tierPlans[0];
                      if (firstPlan) setSelectedPlanKey(firstPlan.planKey);
                    }}
                    className={`relative rounded-xl border-2 p-6 transition-all text-left w-full ${
                      selectedPlan && selectedPlan.tier === tier
                        ? 'border-blue-600 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          POPULAR
                        </span>
                      </div>
                    )}

                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${TIER_COLORS[tier] || 'from-gray-400 to-gray-500'} flex items-center justify-center mb-4`}>
                      <Star className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2 capitalize">{tier} Promotion</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold text-gray-900">{DirectoryPromotionService.formatCurrency(minPrice)}</span>
                      <span className="text-gray-600">starting</span>
                    </div>

                    <ul className="space-y-3 mb-4">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Duration selection for selected tier */}
            {selectedPlan && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Select Duration — <span className="capitalize">{selectedPlan.tier}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(plansByTier[selectedPlan.tier] || []).map((plan) => (
                    <button
                      key={plan.planKey}
                      onClick={() => setSelectedPlanKey(plan.planKey)}
                      className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlanKey === plan.planKey
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {plan.durationDays === 30 ? 'Monthly' :
                             plan.durationDays === 90 ? 'Quarterly' :
                             plan.durationDays === 365 ? 'Annual' :
                             `${plan.durationDays} days`}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{plan.durationDays} days</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{DirectoryPromotionService.formatCurrency(plan.priceCents, plan.currency)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price Summary */}
            {selectedPlan && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Order Summary
                  </h3>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-gray-700">
                    <span>{selectedPlan.label}</span>
                    <span className="font-semibold">{DirectoryPromotionService.formatCurrency(selectedPlan.priceCents, selectedPlan.currency)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Duration</span>
                    <span className="font-semibold">{selectedPlan.durationDays} days</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Total</span>
                      <span>{DirectoryPromotionService.formatCurrency(selectedPlan.priceCents, selectedPlan.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checkout Button */}
            <div className="flex justify-end">
              <button
                onClick={handlePurchase}
                disabled={processing || !selectedPlanKey}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-lg flex items-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {processing ? 'Redirecting to checkout...' : selectedPlan ? `Checkout — ${DirectoryPromotionService.formatCurrency(selectedPlan.priceCents, selectedPlan.currency)}` : 'Select a plan'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* No plans available */}
      {!isActive && !isCapabilityGated && gatedPlans.length === 0 && !loading && (
        <div className="bg-gray-50 rounded-lg p-8 text-center mb-8">
          <p className="text-gray-600">No promotion plans are currently available. Please check back later.</p>
        </div>
      )}

      {/* Purchase History */}
      {purchases.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Purchase History
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tier</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Start Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Expires</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{purchase.planKey}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        purchase.tier === 'featured' ? 'bg-purple-100 text-purple-800' :
                        purchase.tier === 'premium' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {purchase.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        purchase.status === 'active' ? 'bg-green-100 text-green-800' :
                        purchase.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        purchase.status === 'grace_period' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {DirectoryPromotionService.formatStatus(purchase.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {purchase.startsAt ? new Date(purchase.startsAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {purchase.expiresAt ? new Date(purchase.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {DirectoryPromotionService.formatCurrency(purchase.priceCents, purchase.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(purchase.status === 'active' || purchase.status === 'grace_period' || purchase.status === 'expired') && (
                        <button
                          onClick={() => handleRenew(purchase.id)}
                          disabled={processing}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 flex items-center gap-1 ml-auto"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Renew
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Benefits Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Why Promote Your Store?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">3x More Views</h4>
              <p className="text-gray-600 text-sm">Promoted listings get 3x more views than regular listings</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <MousePointer className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">2x More Clicks</h4>
              <p className="text-gray-600 text-sm">Get twice as many clicks to your store page</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Stand Out</h4>
              <p className="text-gray-600 text-sm">Gold marker and promoted badge make you visible</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Track ROI</h4>
              <p className="text-gray-600 text-sm">Detailed analytics show your promotion performance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
