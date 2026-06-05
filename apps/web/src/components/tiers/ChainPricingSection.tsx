'use client';

import { useState } from 'react';
import { Card } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CHAIN_TIERS, getChainTiersByLocationCount, getChainPricingSummary, CHAIN_BENEFITS } from '@/lib/tiers/chain-pricing';

interface ChainPricingSectionProps {
  compact?: boolean;
}

export function ChainPricingSection({ compact = false }: ChainPricingSectionProps) {
  const [locationCount, setLocationCount] = useState(5);
  const [selectedTier, setSelectedTier] = useState(CHAIN_TIERS[2]); // Default to Chain Commitment

  const eligibleTiers = getChainTiersByLocationCount(locationCount);
  const pricingSummary = getChainPricingSummary(locationCount);

  const handleLocationChange = (count: number) => {
    setLocationCount(count);
    // Auto-select the highest eligible tier
    const newEligibleTiers = getChainTiersByLocationCount(count);
    if (newEligibleTiers.length > 0) {
      setSelectedTier(newEligibleTiers[newEligibleTiers.length - 1]);
    }
  };

  return (
    <div className={`space-y-8 ${compact ? 'max-w-6xl' : 'max-w-full'} mx-auto`}>
      {/* Header */}
      <div className="text-center">
        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white mb-4">
          🚀 ENTERPRISE CHAIN MANAGEMENT
        </Badge>
        <h2 className={`font-bold ${compact ? 'text-3xl' : 'text-4xl'} text-neutral-900 mb-3`}>
          Multi-Location Chain Pricing
        </h2>
        <p className={`${compact ? 'text-lg' : 'text-xl'} text-neutral-600 mb-4`}>
          Massive savings for chains and franchises
        </p>
      </div>

      {/* Location Count Selector */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">How many locations?</h3>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLocationChange(Math.max(2, locationCount - 1))}
              disabled={locationCount <= 2}
            >
              -
            </Button>
            <div className="text-3xl font-bold text-blue-600 min-w-[80px] text-center">
              {locationCount}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLocationChange(locationCount + 1)}
            >
              +
            </Button>
          </div>
          <p className="text-sm text-neutral-600">
            {eligibleTiers.length > 0 
              ? `Eligible for ${eligibleTiers.map(t => t.name.replace('Chain ', '')).join(', ')}`
              : 'Contact us for custom enterprise pricing'
            }
          </p>
        </div>
      </Card>

      {/* Pricing Summary */}
      {pricingSummary && (
        <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-green-800">Your Chain Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${pricingSummary.monthlyTotal.toLocaleString()}
                </div>
                <div className="text-sm text-green-700">per month</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${pricingSummary.annualTotal.toLocaleString()}
                </div>
                <div className="text-sm text-green-700">per year</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${pricingSummary.savings.annualSavings.toLocaleString()}
                </div>
                <div className="text-sm text-green-700">annual savings</div>
              </div>
            </div>
            <div className="text-sm text-green-700">
              {pricingSummary.savings.discountPercentage}% discount vs individual pricing
            </div>
          </div>
        </Card>
      )}

      {/* Chain Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {CHAIN_TIERS.map((tier) => {
          const isEligible = locationCount >= tier.minLocations && locationCount <= tier.maxLocations;
          const isSelected = selectedTier.name === tier.name;
          const monthlyTotal = parseInt(tier.price.replace('$', '')) * locationCount;
          
          return (
            <Card 
              key={tier.name}
              className={`border-2 transition-all ${
                isEligible 
                  ? isSelected 
                    ? 'border-green-500 shadow-lg bg-green-50' 
                    : 'border-green-300 bg-white hover:border-green-400'
                  : 'border-neutral-200 bg-neutral-50 opacity-50'
              }`}
              withBorder={isEligible}
              padding="lg"
              radius="md"
            >
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className={`font-bold ${compact ? 'text-base' : 'text-lg'} text-neutral-900`}>
                    {tier.name}
                  </h3>
                  <div className="space-y-1">
                    <Badge 
                      variant={tier.popular ? "success" : "default"}
                      className={tier.popular ? "bg-green-500 text-white" : "bg-neutral-100 text-neutral-700"}
                    >
                      {tier.badge}
                    </Badge>
                    <div className={`font-bold ${compact ? 'text-xl' : 'text-2xl'} text-neutral-900`}>
                      {tier.price}
                      <span className="text-sm font-normal text-neutral-600">{tier.period}</span>
                    </div>
                    <div className="text-sm text-neutral-600">
                      ${monthlyTotal.toLocaleString()}/month for {locationCount} locations
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-900">{tier.tagline}</p>
                  <p className="text-xs text-neutral-600">{tier.description}</p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-green-600">
                    {tier.discount} off individual pricing
                  </div>
                  <div className="text-xs text-neutral-500">
                    {tier.minLocations}-{tier.maxLocations === 999 ? '∞' : tier.maxLocations} locations
                  </div>
                </div>

                <Button
                  variant={isEligible ? "default" : "outline"}
                  size="sm"
                  className={`w-full ${isEligible ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  disabled={!isEligible}
                  onClick={() => setSelectedTier(tier)}
                >
                  {isEligible ? tier.cta : 'Not Available'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Chain Benefits */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-xl font-bold text-neutral-900 mb-6 text-center">Chain Benefits Over Individual Subscriptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHAIN_BENEFITS.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="text-2xl">{benefit.icon}</div>
              <div>
                <h4 className="font-semibold text-neutral-900">{benefit.title}</h4>
                <p className="text-sm text-neutral-600">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Tier Details */}
      {selectedTier && (
        <Card className="p-6">
          <h3 className="text-xl font-bold text-neutral-900 mb-4">
            {selectedTier.name} Features
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-neutral-900 mb-2">What's Included:</h4>
              <ul className="space-y-1">
                {selectedTier.features.slice(0, compact ? 5 : undefined).map((feature: any, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}</span>
                  </li>
                ))}
                {!compact && selectedTier.features.length > 5 && (
                  <li className="text-sm text-neutral-500">
                    +{selectedTier.features.length - 5} more features
                  </li>
                )}
              </ul>
            </div>
            
            {selectedTier.excluded.length > 0 && (
              <div>
                <h4 className="font-semibold text-neutral-900 mb-2">Not Included:</h4>
                <ul className="space-y-1">
                  {selectedTier.excluded.map((feature: any, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-neutral-500">
                      <span className="text-neutral-400 mt-0.5">—</span>
                      <span>{typeof feature === 'object' ? feature.featureName || feature.featureKey : feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
