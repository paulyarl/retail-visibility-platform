"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShoppingCart, ArrowRight, Lock, Sparkles, Check, Package,
} from "lucide-react";
import { bsaasPurchaseService } from "@/services/BsaasPurchaseService";
import type { OrganizationData } from "./types";

interface OrgAppStoreWidgetProps {
  organizationId: string;
  locations: OrganizationData["locationBreakdown"];
  heroLocation?: OrganizationData["locationBreakdown"][number];
  readOnly?: boolean;
  isPlatformAdmin?: boolean;
}

export default function OrgAppStoreWidget({
  organizationId,
  locations,
  heroLocation,
  readOnly = false,
  isPlatformAdmin = false,
}: OrgAppStoreWidgetProps) {
  const heroTenantId = heroLocation?.tenantId || locations[0]?.tenantId;

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["org-app-store", organizationId, heroTenantId],
    queryFn: async () => {
      if (!heroTenantId) return null;
      if (typeof window !== "undefined") {
        (window as any).__currentTenantId = heroTenantId;
      }
      const [features, bundles] = await Promise.all([
        bsaasPurchaseService.getFeatureCatalog().catch(() => []),
        bsaasPurchaseService.getBundleCatalog().catch(() => []),
      ]);
      return { features, bundles };
    },
    enabled: !!heroTenantId,
    staleTime: 60 * 1000,
  });

  const features = catalogData?.features || [];
  const bundles = catalogData?.bundles || [];

  const activePurchases = features.filter((f) => f.purchase && f.purchase.status === "active");
  const availableBundles = bundles.filter((b) => !b.allActive);
  const eligibleFeatures = features.filter((f) => f.tierEligible && !f.alreadyPurchased);

  const canPurchase = !readOnly || isPlatformAdmin;
  const storeHref = heroTenantId
    ? `/settings/feature-store?tenantId=${heroTenantId}`
    : "/settings/feature-store";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">App Store</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add-ons & bundles for your chain
              </p>
            </div>
          </div>
          <Link
            href={storeHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 transition-colors"
          >
            Browse all
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Purchases */}
            {activePurchases.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Add-ons</p>
                {activePurchases.slice(0, 4).map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{f.name}</span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">
                      {f.billingCycle === "monthly" ? "Monthly" : f.billingCycle === "annual" ? "Annual" : "Active"}
                    </span>
                  </div>
                ))}
                {activePurchases.length > 4 && (
                  <p className="text-xs text-gray-400 text-center">
                    +{activePurchases.length - 4} more active add-ons
                  </p>
                )}
              </div>
            )}

            {/* Available Bundles */}
            {availableBundles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recommended Bundles</p>
                {availableBundles.slice(0, 3).map((b) => (
                  <div
                    key={b.bundleKey}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{b.name}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {b.items.length} components · Save with bundle
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                        ${(b.priceCents / 100).toFixed(0)}/mo
                      </span>
                      {b.trialDays > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {b.trialDays}d trial
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Eligible Features */}
            {eligibleFeatures.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Available Add-ons</p>
                {eligibleFeatures.slice(0, 3).map((f) => (
                  <div
                    key={f.key}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{f.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {f.priceCents > 0
                        ? f.billingCycle === "monthly"
                          ? `$${(f.priceCents / 100).toFixed(0)}/mo`
                          : f.billingCycle === "annual"
                            ? `$${(f.priceCents / 100).toFixed(0)}/yr`
                            : `$${(f.priceCents / 100).toFixed(0)}`
                        : "Free"}
                    </span>
                  </div>
                ))}
                {eligibleFeatures.length > 3 && (
                  <Link
                    href={storeHref}
                    className="block text-xs text-violet-600 dark:text-violet-400 text-center pt-1 hover:underline"
                  >
                    +{eligibleFeatures.length - 3} more available
                  </Link>
                )}
              </div>
            )}

            {/* Empty state */}
            {activePurchases.length === 0 && availableBundles.length === 0 && eligibleFeatures.length === 0 && (
              <div className="text-center py-4">
                <ShoppingCart className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No add-ons available for your plan</p>
              </div>
            )}

            {/* CTA */}
            {canPurchase && (availableBundles.length > 0 || eligibleFeatures.length > 0) && (
              <Link
                href={storeHref}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-sm transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Visit App Store
              </Link>
            )}

            {!canPurchase && (availableBundles.length > 0 || eligibleFeatures.length > 0) && (
              <div className="flex items-center gap-2 text-gray-400 py-2">
                <Lock className="w-3.5 h-3.5" />
                <span className="text-xs">Purchases available to org admins</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
