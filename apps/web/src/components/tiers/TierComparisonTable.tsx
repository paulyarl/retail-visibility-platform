'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FEATURE_MAPPING, getFeaturesByTier } from '@/lib/tiers/feature-mapping';

interface TierComparisonTableProps {
  tiers?: string[];
  compact?: boolean;
}

export function TierComparisonTable({ 
  tiers = ['discovery', 'storefront', 'commitment', 'professional', 'enterprise'],
  compact = false 
}: TierComparisonTableProps) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Get all unique marketing benefits across all tiers
  const allBenefits = Array.from(
    new Set(
      tiers.flatMap(tier => 
        getFeaturesByTier(tier).map(f => f.marketingBenefit)
      )
    )
  );

  const toggleFeature = (benefit: string) => {
    const newExpanded = new Set(expandedFeatures);
    if (newExpanded.has(benefit)) {
      newExpanded.delete(benefit);
    } else {
      newExpanded.add(benefit);
    }
    setExpandedFeatures(newExpanded);
  };

  const getTierAvailability = (benefit: string, tier: string) => {
    const tierFeatures = getFeaturesByTier(tier);
    const feature = tierFeatures.find(f => f.marketingBenefit === benefit);
    return feature ? {
      available: true,
      category: feature.category,
      adminFeatures: feature.adminFeatures
    } : null;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      discovery: 'blue',
      storefront: 'purple', 
      commitment: 'green',
      professional: 'amber',
      enterprise: 'red'
    };
    return colors[tier as keyof typeof colors] || 'gray';
  };

  return (
    <div className={`space-y-6 ${compact ? 'max-w-6xl' : 'max-w-full'} mx-auto`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className={`font-bold ${compact ? 'text-2xl' : 'text-3xl'} text-neutral-900 mb-2`}>
          Tier Comparison Matrix
        </h2>
        <p className={`${compact ? 'text-sm' : 'text-base'} text-neutral-600`}>
          See exactly what's included at each tier
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className={`w-full ${compact ? 'text-sm' : ''} border border-neutral-200 rounded-lg overflow-hidden`}>
          {/* Header Row */}
          <thead className="bg-neutral-50">
            <tr>
              <th className={`text-left p-4 font-semibold text-neutral-900 border-b ${compact ? 'w-1/3' : 'w-2/5'}`}>
                Marketing Benefits
              </th>
              {tiers.map(tier => (
                <th key={tier} className={`text-center p-4 font-semibold text-${getTierColor(tier)}-600 border-b`}>
                  <div className="space-y-1">
                    <div className="capitalize">{tier}</div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs bg-${getTierColor(tier)}-50 text-${getTierColor(tier)}-600 border-${getTierColor(tier)}-200`}
                    >
                      {getTierPrice(tier)}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Feature Rows */}
          <tbody>
            {allBenefits.map((benefit, index) => (
              <tr key={benefit} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                {/* Feature Name */}
                <td className={`p-4 border-b ${compact ? 'text-sm' : ''}`}>
                  <div className="space-y-1">
                    <div className="font-medium text-neutral-900">{benefit}</div>
                    {expandedFeatures.has(benefit) && (
                      <div className="text-xs text-neutral-500">
                        {getBenefitDescription(benefit)}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFeature(benefit)}
                      className="text-xs p-0 h-auto"
                    >
                      {expandedFeatures.has(benefit) ? 'Hide details' : 'Show details'}
                    </Button>
                  </div>
                </td>

                {/* Tier Availability */}
                {tiers.map(tier => {
                  const availability = getTierAvailability(benefit, tier);
                  const color = getTierColor(tier);
                  
                  return (
                    <td key={tier} className={`p-4 border-b text-center`}>
                      {availability ? (
                        <div className="space-y-2">
                          {/* Checkmark */}
                          <div className={`inline-flex items-center justify-center w-8 h-8 bg-${color}-100 rounded-full`}>
                            <svg className={`w-4 h-4 text-${color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          
                          {/* Category Badge */}
                          {!compact && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs bg-${getCategoryColor(availability.category)}-50 text-${getCategoryColor(availability.category)}-700`}
                            >
                              {formatCategoryName(availability.category)}
                            </Badge>
                          )}

                          {/* Expanded Features */}
                          {expandedFeatures.has(benefit) && (
                            <div className="space-y-1">
                              <div className="text-xs text-neutral-500">
                                {availability.adminFeatures.length} technical features
                              </div>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {availability.adminFeatures.slice(0, 3).map(feature => (
                                  <Badge 
                                    key={feature}
                                    variant="outline" 
                                    className="text-xs border-neutral-300 text-neutral-600"
                                  >
                                    {formatFeatureName(feature)}
                                  </Badge>
                                ))}
                                {availability.adminFeatures.length > 3 && (
                                  <Badge variant="outline" className="text-xs border-neutral-300 text-neutral-600">
                                    +{availability.adminFeatures.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-8 h-8">
                          <svg className="w-4 h-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
        <div className="flex items-center gap-6 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-2 h-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg className="w-3 h-3 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span>Not Available</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
              Category
            </Badge>
            <span>Feature category</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getTierPrice(tier: string): string {
  const prices = {
    discovery: '$29/mo',
    storefront: '$59/mo',
    commitment: '$99/mo',
    professional: '$199/mo',
    enterprise: '$499/mo'
  };
  return prices[tier as keyof typeof prices] || '';
}

function getBenefitDescription(benefit: string): string {
  const descriptions: Record<string, string> = {
    'Clover POS Integration & Real-Time Sync': 'Automatic inventory synchronization with Clover POS for single source of truth',
    'Real-Time Inventory Management': 'Centralized inventory tracking with live updates and stock availability indicators',
    'SKU Scanning + Inventory Intelligence': 'Complete product data capture with nutrition facts, allergens, and analytics',
    'Quick Start Wizard': 'Generate 50-100 realistic products in seconds with auto-categorization',
    'Full Google Business Profile Integration': 'Complete GMB sync with categories, hours, photos, and products',
    'Google Search & Shopping Optimization': 'SEO-optimized pages that appear in Google Search and Shopping',
    'Google Maps & SWIS (See What\'s In Store)': 'Live inventory shown on Google Maps mobile',
    'Branded Public Storefront': 'Complete branded store presence hosted on the platform',
    'Smart Product Categories': 'Google Product Taxonomy with 5,595 categories and auto-categorization',
    'Smart Business Hours': 'Complex scheduling with multiple periods and real-time status',
    'Platform Directory & Discovery': 'Enhanced directory listings with shopper inquiry system',
    'QR Code Marketing & Sharing': 'High-res QR codes for products, storefront, and directory',
    'Add to Cart & Checkout Flow': 'Complete shopping experience with cart management',
    'Commitment Commerce - Holding Deposits': '10-15% holding deposits to capture shopper intent',
    'Click & Collect / BOPIS': 'Buy online, pick up in store with scheduling',
    'Full Online Payment Collection': 'Complete e-commerce payments with multiple methods',
    'Analytics & Conversion Reporting': 'Track reservations, pickups, abandonment, and revenue',
    'Multi-Location Management': 'Manage all locations with propagation and testing',
    'API Access & Custom Integrations': 'Advanced API access for custom integrations',
    'Enterprise Security & Compliance': 'Bank-level security with role-based access and audit logs'
  };
  return descriptions[benefit] || '';
}

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatFeatureName(feature: string): string {
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getCategoryColor(category: string): string {
  const colors = {
    'clover-inventory': 'blue',
    'google-visibility': 'green',
    'platform-presence': 'purple',
    'commerce-conversion': 'amber',
    'management-growth': 'cyan'
  };
  return colors[category as keyof typeof colors] || 'gray';
}
