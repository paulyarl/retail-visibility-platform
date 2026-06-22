"use client";

import { Lock, ArrowUpCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface OrgLockedTabProps {
  tabLabel: string;
  tierName?: string;
  featureDescription?: string;
  bsaasEligible?: boolean;
  bsaasPrice?: number;
  featureKey?: string;
}

export default function OrgLockedTab({
  tabLabel,
  tierName = "Chain Professional",
  featureDescription,
  bsaasEligible = false,
  bsaasPrice,
  featureKey,
}: OrgLockedTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {tabLabel} Tab Locked
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {featureDescription || `The ${tabLabel} tab is not available on your current plan.`}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Upgrade to <span className="font-medium text-gray-700 dark:text-gray-300">{tierName}</span> to unlock this feature.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/settings/subscription"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade Plan
          </Link>

          {bsaasEligible && (
            <Link
              href={`/settings/subscription?purchase=${featureKey || ""}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-sm font-medium transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              {bsaasPrice ? `Purchase for $${bsaasPrice}/mo` : "Purchase Add-on"}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
