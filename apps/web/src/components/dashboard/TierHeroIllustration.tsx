"use client";

import Image from "next/image";
import { ResolvedTier } from "@/lib/tiers/tier-resolver";
import { Rocket, Store, Zap, Crown, Building2, Sparkles } from "lucide-react";

interface TierHeroIllustrationProps {
  tier: ResolvedTier | null;
  tenantName?: string;
}

/**
 * Maps tier level to wizard signup imagery and color theme.
 * Falls back to a generated SVG illustration when images are unavailable.
 */
export default function TierHeroIllustration({ tier, tenantName }: TierHeroIllustrationProps) {
  if (!tier) return null;

  const level = tier.effective.level;
  const name = tier.effective.name;

  // Tier → wizard image mapping
  const wizardMap: Record<string, { image: string; icon: React.ReactNode; gradient: string; accent: string }> = {
    discovery: {
      image: "/images/wizard/step-02-discovery.png",
      icon: <Sparkles className="w-6 h-6" />,
      gradient: "from-blue-500 to-indigo-600",
      accent: "text-blue-600",
    },
    storefront: {
      image: "/images/wizard/step-03-storefront.png",
      icon: <Store className="w-6 h-6" />,
      gradient: "from-violet-500 to-purple-600",
      accent: "text-violet-600",
    },
    commitment: {
      image: "/images/wizard/step-04-commitment.png",
      icon: <Zap className="w-6 h-6" />,
      gradient: "from-emerald-500 to-teal-600",
      accent: "text-emerald-600",
    },
    professional: {
      image: "/images/wizard/step-05-ecommerce.png",
      icon: <Rocket className="w-6 h-6" />,
      gradient: "from-amber-500 to-orange-600",
      accent: "text-amber-600",
    },
    enterprise: {
      image: "/images/wizard/step-07-enterprise.png",
      icon: <Crown className="w-6 h-6" />,
      gradient: "from-rose-500 to-pink-600",
      accent: "text-rose-600",
    },
    chain_starter: {
      image: "/images/wizard/step-06-omnichannel.png",
      icon: <Building2 className="w-6 h-6" />,
      gradient: "from-cyan-500 to-blue-600",
      accent: "text-cyan-600",
    },
    chain_professional: {
      image: "/images/wizard/step-06-omnichannel.png",
      icon: <Building2 className="w-6 h-6" />,
      gradient: "from-cyan-500 to-blue-600",
      accent: "text-cyan-600",
    },
    chain_enterprise: {
      image: "/images/wizard/step-07-enterprise.png",
      icon: <Crown className="w-6 h-6" />,
      gradient: "from-rose-500 to-pink-600",
      accent: "text-rose-600",
    },
  };

  const config = wizardMap[level] || {
    image: "/images/wizard/step-01-mission.png",
    icon: <Sparkles className="w-6 h-6" />,
    gradient: "from-gray-400 to-slate-500",
    accent: "text-gray-600",
  };

  const isChain = tier.isChain;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-slate-800 text-white shadow-lg">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
        {/* Illustration side */}
        <div className="relative w-full sm:w-48 h-40 sm:h-48 flex-shrink-0">
          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${config.gradient} opacity-20 blur-xl`} />
          <div className="relative w-full h-full rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
            <Image
              src={config.image}
              alt={`${name} tier illustration`}
              fill
              className="object-contain p-3"
              unoptimized
              onError={(e) => {
                // Fallback: hide broken image, show icon instead
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Fallback icon layer */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`p-4 rounded-full bg-gradient-to-br ${config.gradient} text-white shadow-lg`}>
                {config.icon}
              </div>
            </div>
          </div>
        </div>

        {/* Text side */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/20`}>
              {config.icon}
              {isChain ? "Organization" : name}
            </span>
            {tier.canUpgrade && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Upgrade Available
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            {isChain
              ? `${tenantName || "Your Chain"} is powered by Organization tier`
              : `${tenantName || "Your Store"} is on ${name}`}
          </h2>

          <p className="text-sm text-gray-300 mb-4 max-w-md">
            {isChain
              ? "You have chain-wide management, selective targeting, and scheduled updates across all locations."
              : `Your ${name} plan includes ${tier.effective.features.length} features. Unlock more as you grow.`}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            {tier.effective.limits.maxProducts && (
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                <span className="text-gray-400">Products</span>{" "}
                <span className="font-semibold">{tier.effective.limits.maxProducts.toLocaleString()}</span>
              </div>
            )}
            {tier.effective.limits.maxLocations && (
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                <span className="text-gray-400">Locations</span>{" "}
                <span className="font-semibold">{tier.effective.limits.maxLocations}</span>
              </div>
            )}
            {tier.effective.limits.maxUsers && (
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                <span className="text-gray-400">Users</span>{" "}
                <span className="font-semibold">{tier.effective.limits.maxUsers}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
