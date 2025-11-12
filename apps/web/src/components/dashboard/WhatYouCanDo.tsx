import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import FeatureCard from "./FeatureCard";
import { 
  getFeaturesForTier, 
  getLockedFeatures, 
  getFeaturesByPillar,
  getPillarInfo,
  PLATFORM_PILLARS 
} from "@/lib/features/feature-catalog";
import { ResolvedTier } from "@/lib/tiers/tier-resolver";

export interface WhatYouCanDoProps {
  tier: ResolvedTier;
  tenantId: string;
}

/**
 * What You Can Do Section
 * Friendly, engaging showcase organized by platform pillars
 * Creates a natural flow/story through capabilities
 */
export default function WhatYouCanDo({ tier, tenantId }: WhatYouCanDoProps) {
  const availableFeatures = getFeaturesForTier(tier.effective.level);
  const lockedFeatures = getLockedFeatures(tier.effective.level);

  // Group features by pillar for storytelling flow
  const featuresByPillar = getFeaturesByPillar(availableFeatures);
  
  // Get pillar keys in order
  const pillarKeys = Object.keys(PLATFORM_PILLARS).sort((a, b) => {
    const pillarA = getPillarInfo(a as keyof typeof PLATFORM_PILLARS);
    const pillarB = getPillarInfo(b as keyof typeof PLATFORM_PILLARS);
    return pillarA.order - pillarB.order;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-neutral-900 mb-2">
          What You Can Do Here 🚀
        </h2>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          Your {tier.effective.name} plan gives you access to some seriously cool stuff. 
          Here's everything you can do to make your business run smoother!
        </p>
      </div>

      {/* Launch Features Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Clover Integration */}
        <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-green-900">
                      Clover POS
                    </h3>
                    <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-semibold rounded-full">
                      NEW
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-green-800 text-sm">
                Real-time stock sync! Sell in Clover → Storefront & Google update instantly. No overselling!
              </p>
              <a
                href={`/t/${tenantId}/settings/integrations/clover`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm"
              >
                <span>Connect</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Square Integration */}
        <Card className="border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-indigo-900">
                      Square POS
                    </h3>
                    <span className="px-2 py-0.5 bg-indigo-200 text-indigo-800 text-xs font-semibold rounded-full">
                      NEW
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-indigo-800 text-sm">
                Real-time stock sync! Sell in Square → Storefront & Google update instantly. No overselling!
              </p>
              <a
                href={`/t/${tenantId}/settings/integrations/square`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-sm"
              >
                <span>Connect</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Smart Barcode Scanner */}
        <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-blue-900">
                      Smart Scanner
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-semibold rounded-full">
                      NEW
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-blue-800 text-sm">
                Scan → auto-fill everything. Magic!
              </p>
              <a
                href={`/t/${tenantId}/scan`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
              >
                <span>Start Scanning</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Features by Pillar (Natural Flow) */}
      {pillarKeys.map(pillarKey => {
        const pillar = getPillarInfo(pillarKey as keyof typeof PLATFORM_PILLARS);
        const pillarFeatures = featuresByPillar[pillarKey];

        if (!pillarFeatures || pillarFeatures.length === 0) return null;

        return (
          <div key={pillarKey} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{pillar.emoji}</span>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-neutral-900">
                  {pillar.title}
                </h3>
                <p className="text-sm text-neutral-600">{pillar.subtitle}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {pillarFeatures.length} feature{pillarFeatures.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pillarFeatures.map(feature => (
                <FeatureCard
                  key={feature.id}
                  feature={{
                    id: feature.id,
                    name: feature.name,
                    description: feature.description,
                    icon: feature.icon,
                    route: feature.route ? `/t/${tenantId}${feature.route}` : undefined
                  }}
                  status="available"
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Upgrade Section - Show locked features */}
      {lockedFeatures.length > 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full mb-3">
              <span className="text-xl">✨</span>
              <span className="font-semibold text-sm">Want Even More?</span>
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">
              Unlock These Awesome Features
            </h3>
            <p className="text-neutral-600 max-w-2xl mx-auto">
              Upgrade your plan to get access to these powerful tools. They'll help you work smarter, not harder!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lockedFeatures.slice(0, 6).map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={{
                  id: feature.id,
                  name: feature.name,
                  description: feature.tagline,
                  icon: feature.icon
                }}
                status="locked"
                requiredTier={feature.requiredTier}
                onUpgrade={() => {
                  window.location.href = `/t/${tenantId}/settings/subscription`;
                }}
              />
            ))}
          </div>

          {lockedFeatures.length > 6 && (
            <div className="text-center">
              <p className="text-neutral-600 mb-4">
                Plus {lockedFeatures.length - 6} more features waiting for you!
              </p>
              <a
                href={`/t/${tenantId}/settings/subscription`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                <span>View All Plans</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Chain Context Message with Propagation Highlight */}
      {tier.isChain && tier.organization && (
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-purple-900">
                    🏢 Chain Organization Power
                  </h4>
                  <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-semibold rounded-full">
                    NEW
                  </span>
                </div>
                <p className="text-purple-800 text-sm mb-3">
                  You're on the <strong>{tier.organization.name}</strong> plan through your organization. 
                  {tier.tenant && " Plus, you've got some extra features just for this location!"}
                </p>
                <div className="bg-white/50 rounded-lg p-3 border border-purple-200">
                  <p className="text-purple-900 text-sm font-medium mb-1">
                    ⚡ Chain-Wide Updates Available
                  </p>
                  <p className="text-purple-700 text-xs">
                    Your organization can push updates to all locations instantly. 
                    Update prices, add products, or change settings across your entire chain with one click!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google-Only Tier Upgrade CTA - Show for Google-Only users */}
      {tier.effective.name?.toLowerCase().includes('google') && (
        <Card className="border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-lg">
                <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xl font-bold text-cyan-900">
                    🚀 Add a Public Storefront? Upgrade to Starter
                  </h4>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-200 to-blue-200 text-cyan-800 text-xs font-semibold rounded-full">
                    $49/mo
                  </span>
                </div>
                <p className="text-cyan-800 text-sm mb-4">
                  You're crushing it with Google! Add a <strong>public storefront</strong> to reach even more customers directly.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/70 rounded-lg p-3 border border-cyan-200">
                    <p className="text-cyan-900 text-sm font-semibold mb-1">✓ Public Storefront</p>
                    <p className="text-cyan-700 text-xs">Your own online store</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-cyan-200">
                    <p className="text-cyan-900 text-sm font-semibold mb-1">✓ Product Search</p>
                    <p className="text-cyan-700 text-xs">Customers find what they need</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-cyan-200">
                    <p className="text-cyan-900 text-sm font-semibold mb-1">✓ Up to 3 Locations</p>
                    <p className="text-cyan-700 text-xs">Expand your reach</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-cyan-200">
                    <p className="text-cyan-900 text-sm font-semibold mb-1">✓ QR Codes</p>
                    <p className="text-cyan-700 text-xs">Bridge online & in-store</p>
                  </div>
                </div>

                <a
                  href={`/t/${tenantId}/settings/subscription`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <span>Upgrade to Starter</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial Tier Upgrade CTA - Show for Trial users */}
      {tier.effective.name?.toLowerCase().includes('trial') && (
        <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xl font-bold text-blue-900">
                    🚀 Ready to Go Live? Upgrade to Starter
                  </h4>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-blue-200 to-indigo-200 text-blue-800 text-xs font-semibold rounded-full">
                    $49/mo
                  </span>
                </div>
                <p className="text-blue-800 text-sm mb-4">
                  Your trial ends soon! Upgrade to <strong>Starter</strong> to keep your storefront live and unlock more features.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <p className="text-blue-900 text-sm font-semibold mb-1">✓ Keep Your Storefront</p>
                    <p className="text-blue-700 text-xs">Stay live with 500 SKUs</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <p className="text-blue-900 text-sm font-semibold mb-1">✓ Google Shopping</p>
                    <p className="text-blue-700 text-xs">Reach more customers</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <p className="text-blue-900 text-sm font-semibold mb-1">✓ Up to 3 Locations</p>
                    <p className="text-blue-700 text-xs">Grow your business</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <p className="text-blue-900 text-sm font-semibold mb-1">✓ QR Codes</p>
                    <p className="text-blue-700 text-xs">Drive in-store traffic</p>
                  </div>
                </div>

                <a
                  href={`/t/${tenantId}/settings/subscription`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <span>Upgrade to Starter</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Starter Tier Upgrade CTA - Show for Starter users */}
      {tier.effective.level === 'starter' && (
        <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-lg">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xl font-bold text-emerald-900">
                    🚀 Level Up to Professional
                  </h4>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-200 to-green-200 text-emerald-800 text-xs font-semibold rounded-full">
                    $149/mo
                  </span>
                </div>
                <p className="text-emerald-800 text-sm mb-4">
                  Ready to grow? <strong>Professional</strong> gives you 10x more SKUs, advanced features, and up to 10 locations.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/70 rounded-lg p-3 border border-emerald-200">
                    <p className="text-emerald-900 text-sm font-semibold mb-1">✓ 5,000 SKUs</p>
                    <p className="text-emerald-700 text-xs">10x your catalog (vs 500)</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-emerald-200">
                    <p className="text-emerald-900 text-sm font-semibold mb-1">✓ 10 Locations</p>
                    <p className="text-emerald-700 text-xs">Expand your reach (vs 3)</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-emerald-200">
                    <p className="text-emerald-900 text-sm font-semibold mb-1">✓ Google Business Profile</p>
                    <p className="text-emerald-700 text-xs">Full integration & sync</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-emerald-200">
                    <p className="text-emerald-900 text-sm font-semibold mb-1">✓ Enhanced Branding</p>
                    <p className="text-emerald-700 text-xs">Custom colors & logos</p>
                  </div>
                </div>

                <a
                  href={`/t/${tenantId}/settings/subscription`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <span>Upgrade to Professional</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Organization Tier Upgrade CTA - Show for Professional tier users */}
      {(tier.effective.level === 'pro' || tier.effective.name?.toLowerCase().includes('professional')) && !tier.isChain && (
        <Card className="border-2 border-gradient-to-r from-purple-300 to-pink-300 bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xl font-bold text-purple-900">
                    🚀 Ready to Scale? Go Organization Tier
                  </h4>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-purple-200 to-pink-200 text-purple-800 text-xs font-semibold rounded-full">
                    UNLIMITED
                  </span>
                </div>
                <p className="text-purple-800 text-sm mb-4">
                  Managing multiple locations? Organization tier gives you <strong>unlimited locations</strong> and powerful chain-wide management tools.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⚡</span>
                      <p className="text-purple-900 text-sm font-semibold">Chain-Wide Propagation</p>
                    </div>
                    <p className="text-purple-700 text-xs">
                      Update all locations instantly - products, prices, hours, settings
                    </p>
                  </div>
                  
                  <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🎯</span>
                      <p className="text-purple-900 text-sm font-semibold">Selective Targeting</p>
                    </div>
                    <p className="text-purple-700 text-xs">
                      Push updates to specific locations or groups
                    </p>
                  </div>
                  
                  <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📅</span>
                      <p className="text-purple-900 text-sm font-semibold">Scheduled Updates</p>
                    </div>
                    <p className="text-purple-700 text-xs">
                      Schedule changes for future dates and times
                    </p>
                  </div>
                  
                  <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">↩️</span>
                      <p className="text-purple-900 text-sm font-semibold">Rollback Capability</p>
                    </div>
                    <p className="text-purple-700 text-xs">
                      Undo changes if something goes wrong
                    </p>
                  </div>
                </div>

                <a
                  href={`/t/${tenantId}/settings/subscription`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <span>Upgrade to Organization</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Helpful Tip */}
      <Card className="border-2 border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-1">
                Pro Tip
              </h4>
              <p className="text-amber-800 text-sm">
                Not sure where to start? Try the <strong>Product Catalog</strong> first! 
                Add a few items to get a feel for how everything works. 
                You can always explore more features as you go. We're here to help! 🎉
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
