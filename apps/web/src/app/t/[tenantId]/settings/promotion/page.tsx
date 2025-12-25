"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Star, TrendingUp, Eye, MousePointer, Calendar, DollarSign, Check, X } from 'lucide-react';

interface PromotionStatus {
  isPromoted: boolean;
  promotionTier: string | null;
  promotionStartedAt: string | null;
  promotionExpiresAt: string | null;
  promotionImpressions: number;
  promotionClicks: number;
}

const PROMOTION_TIERS = [
  {
    id: 'basic',
    name: 'Basic Promotion',
    price: 20,
    features: [
      'Gold marker on map',
      'Promoted badge',
      'Higher visibility',
      'Basic analytics',
    ],
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'premium',
    name: 'Premium Promotion',
    price: 50,
    features: [
      'Everything in Basic',
      'Featured in search results',
      'Homepage carousel spot',
      'Advanced analytics',
      'Priority support',
    ],
    color: 'from-blue-500 to-blue-600',
    popular: true,
  },
  {
    id: 'featured',
    name: 'Featured Promotion',
    price: 100,
    features: [
      'Everything in Premium',
      'Guaranteed top 3 position',
      'Custom marker icon',
      'Sponsored content',
      'Dedicated account manager',
    ],
    color: 'from-purple-500 to-purple-600',
  },
];


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function PromotionSettingsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PromotionStatus | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('basic');
  const [duration, setDuration] = useState<number>(1); // months
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPromotionStatus();
  }, [tenantId]);

  const fetchPromotionStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/promotion/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        if (data.promotionTier) {
          setSelectedTier(data.promotionTier);
        }
      }
    } catch (error) {
      console.error('Error fetching promotion status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnablePromotion = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/promotion/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          durationMonths: duration,
        }),
      });

      if (response.ok) {
        await fetchPromotionStatus();
        alert('Promotion enabled successfully!');
      } else {
        alert('Failed to enable promotion. Please try again.');
      }
    } catch (error) {
      console.error('Error enabling promotion:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDisablePromotion = async () => {
    if (!confirm('Are you sure you want to disable your promotion?')) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/tenants/${tenantId}/promotion/disable`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchPromotionStatus();
        alert('Promotion disabled successfully.');
      } else {
        alert('Failed to disable promotion. Please try again.');
      }
    } catch (error) {
      console.error('Error disabling promotion:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const calculatePrice = () => {
    const tier = PROMOTION_TIERS.find(t => t.id === selectedTier);
    return tier ? tier.price * duration : 0;
  };

  const calculateSavings = () => {
    if (duration === 12) return 20; // 20% off annual
    if (duration === 3) return 10; // 10% off quarterly
    return 0;
  };

  if (loading) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-amber-500" />
          Promotion Settings
        </h1>
        <p className="mt-2 text-gray-600">
          Stand out on the map and get more visibility for your store
        </p>
      </div>

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
            </div>
            <button
              onClick={handleDisablePromotion}
              disabled={processing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {processing ? 'Processing...' : 'Disable'}
            </button>
          </div>

          {/* Analytics */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-sm">Impressions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{status.promotionImpressions.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <MousePointer className="w-4 h-4" />
                <span className="text-sm">Clicks</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{status.promotionClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Tiers */}
      {!isActive && (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Tier</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PROMOTION_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all ${
                    selectedTier === tier.id
                      ? 'border-blue-600 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        POPULAR
                      </span>
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4`}>
                    <Star className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-gray-900">${tier.price}</span>
                    <span className="text-gray-600">/month</span>
                  </div>

                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Select Duration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { months: 1, label: 'Monthly', savings: 0 },
                { months: 3, label: 'Quarterly', savings: 10 },
                { months: 12, label: 'Annual', savings: 20 },
              ].map((option) => (
                <button
                  key={option.months}
                  onClick={() => setDuration(option.months)}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    duration === option.months
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option.savings > 0 && (
                    <div className="absolute -top-2 -right-2">
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Save {option.savings}%
                      </span>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{option.months} {option.months === 1 ? 'month' : 'months'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Price Summary
              </h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Base Price ({duration} {duration === 1 ? 'month' : 'months'})</span>
                <span className="font-semibold">${calculatePrice()}</span>
              </div>
              {calculateSavings() > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Savings ({calculateSavings()}%)</span>
                  <span className="font-semibold">-${(calculatePrice() * calculateSavings() / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>${(calculatePrice() * (1 - calculateSavings() / 100)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enable Button */}
          <div className="flex justify-end">
            <button
              onClick={handleEnablePromotion}
              disabled={processing}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all shadow-lg"
            >
              {processing ? 'Processing...' : `Enable Promotion - $${(calculatePrice() * (1 - calculateSavings() / 100)).toFixed(2)}`}
            </button>
          </div>
        </>
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
