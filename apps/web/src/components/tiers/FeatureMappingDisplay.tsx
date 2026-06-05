'use client';

import { Badge } from '@/components/ui/Badge';
import { FEATURE_MAPPING, getFeaturesByTier, CATEGORY_COLORS, TIER_COLORS } from '@/lib/tiers/feature-mapping';

interface FeatureMappingDisplayProps {
  selectedTier?: string;
  showCategories?: boolean;
  compact?: boolean;
}

export function FeatureMappingDisplay({ 
  selectedTier = 'discovery', 
  showCategories = true, 
  compact = false 
}: FeatureMappingDisplayProps) {
  const tierFeatures = getFeaturesByTier(selectedTier);
  
  if (!tierFeatures.length) return null;

  const groupedFeatures = tierFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof tierFeatures>);

  return (
    <div className={`space-y-6 ${compact ? 'max-w-4xl' : ''}`}>
      {/* Tier Header */}
      <div className={`text-center ${compact ? 'mb-4' : 'mb-8'}`}>
        <h2 className={`font-bold ${compact ? 'text-xl' : 'text-2xl'} capitalize text-${TIER_COLORS[selectedTier as keyof typeof TIER_COLORS]}-600 mb-2`}>
          {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Tier
        </h2>
        <p className={`${compact ? 'text-sm' : 'text-base'} text-neutral-600`}>
          {getTierDescription(selectedTier)}
        </p>
      </div>

      {/* Features by Category */}
      {Object.entries(groupedFeatures).map(([category, features]) => (
        <div key={category} className="space-y-4">
          {/* Category Header */}
          <div className="flex items-center gap-3">
            <div className={`h-1 w-8 bg-gradient-to-r ${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]} rounded-full`}></div>
            <h3 className={`font-semibold ${compact ? 'text-base' : 'text-lg'} capitalize text-neutral-900`}>
              {formatCategoryName(category)}
            </h3>
            <Badge variant="outline" className="text-xs">
              {features.length} {features.length === 1 ? 'feature' : 'features'}
            </Badge>
          </div>

          {/* Features Grid */}
          <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {features.map((feature) => (
              <div 
                key={feature.marketingBenefit}
                className={`p-4 rounded-lg border-l-4 bg-gradient-to-r ${
                  CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
                }/5 to-transparent border-l-${TIER_COLORS[selectedTier as keyof typeof TIER_COLORS]}-500`}
              >
                {/* Marketing Benefit */}
                <div className="mb-3">
                  <h4 className={`font-semibold ${compact ? 'text-sm' : 'text-base'} text-neutral-900 mb-1`}>
                    {feature.marketingBenefit}
                  </h4>
                  {!compact && (
                    <p className="text-xs text-neutral-600 italic">
                      Tier {feature.tier.charAt(0).toUpperCase() + feature.tier.slice(1)}
                    </p>
                  )}
                </div>

                {/* Admin Features */}
                <div className="space-y-1">
                  <p className={`text-xs font-medium text-${TIER_COLORS[selectedTier as keyof typeof TIER_COLORS]}-600 mb-2`}>
                    Technical Implementation:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {feature.adminFeatures.slice(0, compact ? 3 : undefined).map((adminFeature) => (
                      <Badge 
                        key={adminFeature}
                        variant="secondary" 
                        className="text-xs bg-neutral-100 text-neutral-700"
                      >
                        {formatFeatureName(adminFeature)}
                      </Badge>
                    ))}
                    {!compact && feature.adminFeatures.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{feature.adminFeatures.length - 3} more
                      </Badge>
                    )}
                  </div>
                  {!compact && (
                    <details className="mt-2">
                      <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700">
                        View all {feature.adminFeatures.length} technical features
                      </summary>
                      <div className="mt-2 space-y-1">
                        {feature.adminFeatures.map((adminFeature) => (
                          <div key={adminFeature} className="text-xs text-neutral-600 pl-2 border-l-2 border-neutral-200">
                            {formatFeatureName(adminFeature)}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper functions
function getTierDescription(tier: string): string {
  const descriptions = {
    discovery: 'Get found on Google with complete visibility stack',
    storefront: 'Own your platform presence with branded storefront',
    commitment: 'Capture intent and drive foot traffic with commerce',
    professional: 'Full e-commerce platform with advanced features',
    enterprise: 'Complete business solution with enterprise tools'
  };
  return descriptions[tier as keyof typeof descriptions] || '';
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
