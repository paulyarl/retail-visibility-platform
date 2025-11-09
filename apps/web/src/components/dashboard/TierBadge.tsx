import { ResolvedTier } from "@/lib/tiers/tier-resolver";

export interface TierBadgeProps {
  tier: ResolvedTier;
  showDetails?: boolean;
}

/**
 * Tier Badge Component
 * Shows current tier with visual indicator
 * Displays chain information if applicable
 */
export default function TierBadge({ tier, showDetails = false }: TierBadgeProps) {
  const getTierColor = (level: string) => {
    switch (level) {
      case 'starter':
        return 'bg-neutral-100 text-neutral-700 border-neutral-300';
      case 'growth':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'pro':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'enterprise':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'custom':
        return 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-300';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  const getTierIcon = (level: string) => {
    switch (level) {
      case 'starter':
        return '🌱';
      case 'growth':
        return '📈';
      case 'pro':
        return '⭐';
      case 'enterprise':
        return '🏢';
      case 'custom':
        return '💎';
      default:
        return '📦';
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      {/* Main Tier Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getTierColor(tier.effective.level)}`}>
        <span className="text-lg">{getTierIcon(tier.effective.level)}</span>
        <span className="font-semibold text-sm">{tier.effective.name}</span>
      </div>

      {/* Chain Information */}
      {showDetails && tier.isChain && (
        <div className="text-xs text-neutral-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>
            {tier.organization && tier.tenant
              ? `Organization ${tier.organization.name || 'benefits'} + Location enhancements`
              : tier.organization
              ? `Organization-wide ${tier.organization.name || 'benefits'}`
              : 'Chain location'}
          </span>
        </div>
      )}

      {/* Feature Source Indicators */}
      {showDetails && tier.tenant && tier.organization && (
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
            {tier.effective.features.filter(f => f.source === 'organization').length} org features
          </span>
          <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded">
            {tier.effective.features.filter(f => f.source === 'tenant').length} location features
          </span>
        </div>
      )}
    </div>
  );
}
