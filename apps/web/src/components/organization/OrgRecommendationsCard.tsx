"use client";

import { motion } from "framer-motion";
import {
  Zap, Users, Sparkles, ShoppingCart, FileQuestion, CreditCard,
  ArrowRight, Package, Download, Wrench, Layers, type LucideIcon,
} from "lucide-react";
import type { OrganizationData } from "./types";
import type { OrgProductTypeRollup, OrgProductMix } from "@/services/OrgCapabilityService";

interface OrgRecommendationsCardProps {
  orgData: OrganizationData;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  onNavigate?: (tab: string) => void;
  productTypeRollup?: OrgProductTypeRollup | null;
  productMix?: OrgProductMix | null;
}

interface Recommendation {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  cta: string;
  tab?: string;
  href?: string;
}

export default function OrgRecommendationsCard({
  orgData,
  heroLocation,
  onNavigate,
  productTypeRollup,
  productMix,
}: OrgRecommendationsCardProps) {
  const heroId = heroLocation?.tenantId;
  const nonHero = orgData.locationBreakdown.filter((l) => l.tenantId !== heroId);
  const locationsWithoutSkus = nonHero.filter((l) => l.skuCount === 0).length;
  const locPct = (orgData.current.totalLocations / orgData.limits.maxLocations) * 100;
  const skuPct = (orgData.current.totalSKUs / orgData.limits.maxTotalSKUs) * 100;

  const recs: Recommendation[] = [];

  // --- Product type-aware recommendations ---
  if (productTypeRollup && productMix) {
    const mixTypes = new Set(productMix.mix.map((m) => m.productType));
    const rollupLocations = productTypeRollup.locations;

    // 1. Hero has product types that other locations don't support
    if (heroLocation && heroLocation.skuCount > 0) {
      const heroRollup = rollupLocations.find((l) => l.tenantId === heroLocation.tenantId);
      if (heroRollup && heroRollup.enabled && heroRollup.selectedTypes.length > 0) {
        const heroTypes = heroRollup.selectedTypes;
        const unsupportedLocations = rollupLocations.filter(
          (l) => l.tenantId !== heroLocation.tenantId &&
                 l.enabled &&
                 !heroTypes.every((t: string) => l.allowedTypes.includes(t) || l.isFlexible)
        );
        if (unsupportedLocations.length > 0) {
          recs.push({
            icon: Package, iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600",
            title: "Product type mismatch across locations",
            description: `Your hero location has ${heroRollup.selectedTypes.join(", ")} products but ${unsupportedLocations.length} location${unsupportedLocations.length !== 1 ? "s" : ""} don't support ${heroRollup.selectedTypes.length > 1 ? "all types" : "that type"}. Update their product type settings.`,
            cta: "View locations", tab: "locations",
          });
        }
      }
    }

    // 2. Has digital products but no delivery method configured
    if (mixTypes.has("digital")) {
      const digitalLocations = rollupLocations.filter(
        (l) => l.enabled && (l.selectedTypes.includes("digital") || l.isFlexible)
      );
      if (digitalLocations.length > 0) {
        recs.push({
          icon: Download, iconBg: "bg-violet-50 dark:bg-violet-900/20", iconColor: "text-violet-600",
          title: "Configure digital product delivery",
          description: `You have digital products across ${digitalLocations.length} location${digitalLocations.length !== 1 ? "s" : ""}. Set up download links or email delivery in commerce settings.`,
          cta: "Configure delivery", tab: "commerce",
        });
      }
    }

    // 3. Has service products but no booking flow
    if (mixTypes.has("service")) {
      const serviceLocations = rollupLocations.filter(
        (l) => l.enabled && (l.selectedTypes.includes("service") || l.isFlexible)
      );
      if (serviceLocations.length > 0) {
        recs.push({
          icon: Wrench, iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600",
          title: "Set up service booking flow",
          description: `You have service products across ${serviceLocations.length} location${serviceLocations.length !== 1 ? "s" : ""}. Configure booking lead time and cancellation policy in commerce settings.`,
          cta: "Configure booking", tab: "commerce",
        });
      }
    }

    // 4. Has physical products but no shipping rates
    if (mixTypes.has("physical")) {
      const physicalLocations = rollupLocations.filter(
        (l) => l.enabled && (l.selectedTypes.includes("physical") || l.isFlexible)
      );
      if (physicalLocations.length > 0) {
        recs.push({
          icon: Layers, iconBg: "bg-cyan-50 dark:bg-cyan-900/20", iconColor: "text-cyan-600",
          title: "Configure shipping rates",
          description: `You have physical products across ${physicalLocations.length} location${physicalLocations.length !== 1 ? "s" : ""}. Set up default shipping rates and pickup options in commerce settings.`,
          cta: "Configure shipping", tab: "commerce",
        });
      }
    }

    // 5. Product types disabled on some locations that have those products
    const disabledWithProducts = productMix.perLocation.filter((loc) => {
      const rollupLoc = rollupLocations.find((l) => l.tenantId === loc.tenantId);
      return rollupLoc && !rollupLoc.enabled && loc.totalItems > 0;
    });
    if (disabledWithProducts.length > 0) {
      recs.push({
        icon: Zap, iconBg: "bg-red-50 dark:bg-red-900/20", iconColor: "text-red-600",
        title: "Product types disabled on locations with products",
        description: `${disabledWithProducts.length} location${disabledWithProducts.length !== 1 ? "s" : ""} have products but product types are disabled. Enable product types to ensure proper commerce behavior.`,
        cta: "View locations", tab: "locations",
      });
    }
  }

  if (heroLocation && heroLocation.skuCount > 0 && locationsWithoutSkus > 0) {
    recs.push({
      icon: Zap, iconBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600",
      title: "Propagate your catalog",
      description: `${locationsWithoutSkus} location${locationsWithoutSkus !== 1 ? "s" : ""} still without products. Sync from hero now.`,
      cta: "Sync now", tab: "propagation",
    });
  }

  recs.push({
    icon: Users, iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600",
    title: "Invite team members",
    description: "Add employees across locations to delegate management tasks.",
    cta: "Manage team", tab: "team",
  });

  recs.push({
    icon: Sparkles, iconBg: "bg-violet-50 dark:bg-violet-900/20", iconColor: "text-violet-600",
    title: "Enable CRM for customer support",
    description: "Manage tickets and inquiries across all your locations from one place.",
    cta: "View capabilities", tab: "capabilities",
  });

  recs.push({
    icon: ShoppingCart, iconBg: "bg-cyan-50 dark:bg-cyan-900/20", iconColor: "text-cyan-600",
    title: "Configure commerce settings",
    description: "Set up payment options and order settings for all locations.",
    cta: "Configure", tab: "commerce",
  });

  if (heroId) {
    recs.push({
      icon: FileQuestion, iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600",
      title: "Set up FAQ for self-service",
      description: "Create FAQs for your hero location to reduce support tickets.",
      cta: "Create FAQs", href: `/t/${heroId}/faq`,
    });
  }

  if (locPct >= 80 || skuPct >= 80) {
    recs.push({
      icon: CreditCard, iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600",
      title: "Upgrade your plan",
      description: `You're at ${Math.max(locPct, skuPct).toFixed(0)}% capacity. Upgrade to avoid limits.`,
      cta: "View plans", tab: "billing",
    });
  }

  if (recs.length === 0) return null;

  const handleClick = (rec: Recommendation, e: React.MouseEvent) => {
    if (rec.tab && onNavigate) {
      e.preventDefault();
      onNavigate(rec.tab);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recs.map((rec, i) => {
            const Icon = rec.icon;
            return (
              <div
                key={i}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 ${rec.iconBg} rounded-lg`}>
                    <Icon className={`w-4 h-4 ${rec.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                      {rec.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {rec.description}
                    </p>
                  </div>
                </div>
                <a
                  href={rec.href || "#"}
                  onClick={(e) => handleClick(rec, e)}
                  className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                >
                  {rec.cta}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
