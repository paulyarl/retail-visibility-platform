"use client";

import { Shield, Crown, Check, Lock, Sparkles, Zap, LayoutDashboard, MapPin, Users, ShoppingCart, CreditCard, ArrowUpCircle, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { OrgCapabilitiesState, OrgTabKey, OrgPanelKey, OrgPropagationType } from "@/services/OrgCapabilityService";

interface OrgPlanSummaryPanelProps {
  orgCaps: OrgCapabilitiesState | undefined;
  loading?: boolean;
  tierName?: string;
  readOnly?: boolean;
}

const TAB_LABELS: Record<OrgTabKey, string> = {
  overview: "Overview",
  locations: "Locations",
  propagation: "Propagation",
  capabilities: "Capabilities",
  team: "Team",
  commerce: "Commerce",
  billing: "Billing",
};

const TAB_ICONS: Record<OrgTabKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  locations: MapPin,
  propagation: Zap,
  capabilities: Sparkles,
  team: Users,
  commerce: ShoppingCart,
  billing: CreditCard,
};

const PANEL_LABELS: Record<OrgPanelKey, string> = {
  task_checklist: "Task Checklist",
  quick_links: "Quick Links",
  system_status: "System Status",
  recommendations: "Recommendations",
  crm_summary: "CRM Summary",
};

const PROPAGATION_LABELS: Record<OrgPropagationType, string> = {
  org_propagation_products: "Products",
  org_propagation_categories: "Categories",
  org_propagation_business_info: "Business Info",
  org_propagation_settings: "Settings",
};

const ALL_TABS: OrgTabKey[] = ["overview", "locations", "propagation", "capabilities", "team", "commerce", "billing"];
const ALL_PANELS: OrgPanelKey[] = ["task_checklist", "quick_links", "system_status", "recommendations", "crm_summary"];
const ALL_PROPAGATION: OrgPropagationType[] = [
  "org_propagation_products", "org_propagation_categories",
  "org_propagation_business_info", "org_propagation_settings",
];

type ItemStatus = "enabled" | "locked" | "purchased";

interface SummaryItem {
  key: string;
  label: string;
  icon?: typeof LayoutDashboard;
  status: ItemStatus;
}

export default function OrgPlanSummaryPanel({ orgCaps, loading, tierName, readOnly }: OrgPlanSummaryPanelProps) {
  if (loading || !orgCaps) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <div className="h-32 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    );
  }

  const { tier, enabled, isFlexible, allowedTabs, allowedPanels, allowedPropagationTypes, purchasedFeatureKeys, subscriptionContext } = orgCaps;
  const isLocked = subscriptionContext && !subscriptionContext.writable;

  const isPurchased = (key: string): boolean => !!purchasedFeatureKeys?.includes(key);

  const tabItems: SummaryItem[] = ALL_TABS.map((tab) => {
    const featureKey = `org_tab_${tab}`;
    return {
      key: tab,
      label: TAB_LABELS[tab],
      icon: TAB_ICONS[tab],
      status: allowedTabs.includes(tab)
        ? (isPurchased(featureKey) ? "purchased" : "enabled")
        : "locked",
    };
  });

  const panelItems: SummaryItem[] = ALL_PANELS.map((panel) => {
    const featureKey = `org_panel_${panel}`;
    return {
      key: panel,
      label: PANEL_LABELS[panel],
      status: allowedPanels.includes(panel)
        ? (isPurchased(featureKey) ? "purchased" : "enabled")
        : "locked",
    };
  });

  const propagationItems: SummaryItem[] = ALL_PROPAGATION.map((prop) => {
    return {
      key: prop,
      label: PROPAGATION_LABELS[prop],
      status: allowedPropagationTypes.includes(prop)
        ? (isPurchased(prop) ? "purchased" : "enabled")
        : "locked",
    };
  });

  const enabledCount = [...tabItems, ...panelItems, ...propagationItems].filter((i) => i.status === "enabled").length;
  const totalCount = tabItems.length + panelItems.length + propagationItems.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 border-b ${isLocked ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-950/20 border-red-200 dark:border-red-900/30' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-gray-100 dark:border-gray-800'}`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isLocked ? 'bg-gradient-to-br from-red-400 to-red-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                {isLocked ? (
                  <Lock className="h-5 w-5 text-white" />
                ) : (
                  <Crown className="h-5 w-5 text-white" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold text-lg ${isLocked ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-white'}`}>
                  {tier?.name || tierName || "Chain Plan"}
                </h3>
                {tier?.key && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isLocked ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                    <Shield className="w-3 h-3" />
                    {tier.key}
                  </span>
                )}
                {isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <Lock className="w-3 h-3" />
                    Read-only
                  </span>
                )}
                {isFlexible && !isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Flexible
                  </span>
                )}
              </div>
              {tier?.description && (
                <p className={`text-sm mt-0.5 ${isLocked ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>{tier.description}</p>
              )}
              {!isLocked && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {enabledCount} of {totalCount} features unlocked
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        {isLocked ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-100 text-base">
                  Subscription {subscriptionContext?.internalStatus}
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Your organization subscription is {subscriptionContext?.internalStatus}. Organization features are in read-only mode.
                </p>
              </div>
            </div>
            <Link
              href={readOnly ? "#" : "/settings/subscription"}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${readOnly ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
              aria-disabled={readOnly}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Upgrade plan
            </Link>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Tabs section */}
            <Section title="Dashboard Tabs" items={tabItems} />

            {/* Panels section */}
            <Section title="Overview Panels" items={panelItems} />

            {/* Propagation section */}
            <Section title="Propagation Types" items={propagationItems} />
          </div>
        )}

        {/* Footer */}
        {!enabled && !isLocked && (
          <div className="px-6 py-4 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-100 dark:border-amber-900/30">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Organization features are not enabled on your current plan.
              </p>
              <Link
                href={readOnly ? "#" : "/settings/subscription"}
                className={`ml-auto inline-flex items-center gap-1 text-sm font-medium ${readOnly ? "text-gray-400 cursor-not-allowed" : "text-blue-600 dark:text-blue-400 hover:underline"}`}
                aria-disabled={readOnly}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Upgrade
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, items }: { title: string; items: SummaryItem[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
        {title}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isEnabled = item.status === "enabled";
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-lg p-2.5 border text-sm ${
                item.status === "purchased"
                  ? "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30"
                  : isEnabled
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    item.status === "purchased" ? "text-amber-500" : isEnabled ? "text-emerald-500" : "text-gray-400 dark:text-gray-600"
                  }`}
                />
              )}
              <span
                className={`truncate ${
                  item.status === "purchased"
                    ? "text-amber-700 dark:text-amber-400"
                    : isEnabled
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {item.label}
              </span>
              {item.status === "purchased" ? (
                <BadgeCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 ml-auto" />
              ) : isEnabled ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 ml-auto" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600 flex-shrink-0 ml-auto" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
