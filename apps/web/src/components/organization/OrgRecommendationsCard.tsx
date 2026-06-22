"use client";

import { motion } from "framer-motion";
import {
  Zap, Users, Sparkles, ShoppingCart, FileQuestion, CreditCard,
  ArrowRight, type LucideIcon,
} from "lucide-react";
import type { OrganizationData } from "./types";

interface OrgRecommendationsCardProps {
  orgData: OrganizationData;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  onNavigate?: (tab: string) => void;
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
}: OrgRecommendationsCardProps) {
  const heroId = heroLocation?.tenantId;
  const nonHero = orgData.locationBreakdown.filter((l) => l.tenantId !== heroId);
  const locationsWithoutSkus = nonHero.filter((l) => l.skuCount === 0).length;
  const locPct = (orgData.current.totalLocations / orgData.limits.maxLocations) * 100;
  const skuPct = (orgData.current.totalSKUs / orgData.limits.maxTotalSKUs) * 100;

  const recs: Recommendation[] = [];

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
