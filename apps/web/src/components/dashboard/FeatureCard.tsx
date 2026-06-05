import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { TierFeature } from "@/lib/tiers/tier-resolver";

export interface FeatureCardProps {
  feature: {
    id: string;
    name: string;
    description: string;
    icon?: string;
    route?: string;
  };
  status: 'available' | 'locked';
  tierInfo?: TierFeature;
  requiredTier?: string;
  onAction?: () => void;
  onUpgrade?: () => void;
}

/**
 * Feature Card Component
 * Shows available or locked features with appropriate CTAs
 * Adapts based on tier access
 */
export default function FeatureCard({
  feature,
  status,
  tierInfo,
  requiredTier,
  onAction,
  onUpgrade
}: FeatureCardProps) {
  const getFeatureIcon = (icon?: string): React.ReactElement => {
    // Map icon names to SVG icons
    const icons: Record<string, React.ReactElement> = {
      inventory: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      location: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      analytics: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      api: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      ai: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      default: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    };

    return icons[icon || 'default'] || icons.default;
  };

  if (status === 'locked') {
    return (
      <Card className="relative overflow-hidden border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-400 transition-colors">
        {/* Locked Overlay */}
        <div className="absolute top-2 right-2">
          <div className="p-1.5 bg-neutral-200 rounded-full">
            <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-neutral-200 rounded-lg text-neutral-500">
              {getFeatureIcon(feature.icon)}
            </div>
            <div className="flex-1">
              <CardTitle className="text-neutral-600">{feature.name}</CardTitle>
              {requiredTier && (
                <span className="text-xs text-neutral-500 mt-1 block">
                  Requires {requiredTier} plan
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-neutral-600 mb-4">{feature.description}</p>
          <Button 
            className="w-full" 
            onClick={onUpgrade}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Upgrade to Unlock
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Available Feature
  const cardContent = (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-200">
        {/* Feature Source Badge */}
        {tierInfo?.source && tierInfo.source !== 'tenant' && (
          <div className="absolute top-2 right-2">
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {tierInfo.source === 'organization' ? 'Org' : 'Enhanced'}
            </span>
          </div>
        )}

        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
              {getFeatureIcon(feature.icon)}
            </div>
            <div className="flex-1">
              <CardTitle>{feature.name}</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-neutral-600 mb-4">{feature.description}</p>
          <div className="flex items-center text-primary-600 text-sm font-medium">
            <span>Get Started</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </CardContent>
      </Card>
  );

  // Wrap with Link if route is provided
  if (feature.route) {
    return <Link href={feature.route}>{cardContent}</Link>;
  }

  return cardContent;
}
