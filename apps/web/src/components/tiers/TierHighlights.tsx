'use client';

import { Badge } from '@/components/ui/Badge';
import { Star, Check, Sparkles } from 'lucide-react';

export interface HighlightedFeature {
  featureKey: string;
  featureName: string;
  marketingName?: string | null;
  highlightDescription?: string | null;
  highlightOrder: number;
}

interface TierHighlightsProps {
  tierKey: string;
  tierDisplayName: string;
  highlightedFeatures: HighlightedFeature[];
  compact?: boolean;
  showAllFeatures?: boolean;
  allFeatures?: string[];
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  discovery: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', accent: 'bg-blue-500' },
  storefront: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', accent: 'bg-purple-500' },
  commitment: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', accent: 'bg-green-500' },
  ecommerce: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', accent: 'bg-amber-500' },
  omnichannel: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', accent: 'bg-indigo-500' },
  professional: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', accent: 'bg-cyan-500' },
  enterprise: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', accent: 'bg-red-500' },
};

const TIER_TAGLINES: Record<string, string> = {
  discovery: 'Get found on Google',
  storefront: 'Your store, online',
  commitment: 'Drive foot traffic with deposits',
  ecommerce: 'Sell online, ship anywhere',
  omnichannel: 'Sell everywhere, your way',
  professional: 'Advanced tools for growth',
  enterprise: 'Multi-location empire',
};

export function TierHighlights({
  tierKey,
  tierDisplayName,
  highlightedFeatures,
  compact = false,
  showAllFeatures = false,
  allFeatures = [],
}: TierHighlightsProps) {
  const colors = TIER_COLORS[tierKey] || TIER_COLORS.discovery;
  const tagline = TIER_TAGLINES[tierKey] || '';

  // Sort by highlight order
  const sortedHighlights = [...highlightedFeatures].sort((a, b) => a.highlightOrder - b.highlightOrder);

  if (compact) {
    return (
      <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className={`h-4 w-4 ${colors.text}`} />
          <span className={`font-semibold ${colors.text}`}>{tierDisplayName}</span>
        </div>
        <ul className="space-y-1">
          {sortedHighlights.slice(0, 3).map((feature) => (
            <li key={feature.featureKey} className="flex items-start gap-2 text-sm">
              <Check className={`h-4 w-4 mt-0.5 ${colors.text} flex-shrink-0`} />
              <span className="text-neutral-700">
                {feature.marketingName || feature.featureName}
              </span>
            </li>
          ))}
          {sortedHighlights.length > 3 && (
            <li className={`text-xs ${colors.text} ml-6`}>
              +{sortedHighlights.length - 3} more key features
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${colors.text}`} />
            <h3 className={`text-xl font-bold ${colors.text}`}>{tierDisplayName}</h3>
          </div>
          {tagline && (
            <p className="text-sm text-neutral-600 mt-1">{tagline}</p>
          )}
        </div>
        <Badge className={`${colors.accent} text-white`}>
          {highlightedFeatures.length} Key Features
        </Badge>
      </div>

      {/* Highlighted Features */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
          What Makes This Tier Special
        </h4>
        <div className="grid gap-3">
          {sortedHighlights.map((feature, index) => (
            <div
              key={feature.featureKey}
              className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm"
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full ${colors.accent} text-white flex items-center justify-center text-xs font-bold`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-neutral-900">
                  {feature.marketingName || feature.featureName}
                </div>
                {feature.highlightDescription && (
                  <p className="text-sm text-neutral-600 mt-0.5">
                    {feature.highlightDescription}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Features (optional) */}
      {showAllFeatures && allFeatures.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-200">
          <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            All Included Features ({allFeatures.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {allFeatures.map((feature) => {
              const isHighlighted = highlightedFeatures.some(h => h.featureKey === feature);
              return (
                <Badge
                  key={feature}
                  variant={isHighlighted ? 'default' : 'outline'}
                  className={isHighlighted ? `${colors.accent} text-white` : 'text-neutral-600'}
                >
                  {formatFeatureName(feature)}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFeatureName(featureKey: string): string {
  return featureKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Grid layout for displaying multiple tier highlights
 */
interface TierHighlightsGridProps {
  tiers: Array<{
    tierKey: string;
    tierDisplayName: string;
    highlightedFeatures: HighlightedFeature[];
    allFeatures?: string[];
  }>;
  compact?: boolean;
}

export function TierHighlightsGrid({ tiers, compact = false }: TierHighlightsGridProps) {
  return (
    <div className={`grid gap-6 ${compact ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
      {tiers.map((tier) => (
        <TierHighlights
          key={tier.tierKey}
          tierKey={tier.tierKey}
          tierDisplayName={tier.tierDisplayName}
          highlightedFeatures={tier.highlightedFeatures}
          compact={compact}
          allFeatures={tier.allFeatures}
        />
      ))}
    </div>
  );
}
