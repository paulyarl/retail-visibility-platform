"use client";

import { motion } from "framer-motion";
import { MapPin, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { BillingCounters, OrganizationData } from "./types";

interface OrgUsageGaugesProps {
  billingCounters: BillingCounters | null;
  orgData: OrganizationData;
}

function getGaugeColor(percentage: number) {
  if (percentage >= 100) return "bg-rose-500";
  if (percentage >= 90) return "bg-amber-500";
  return "bg-emerald-500";
}

function getGaugeTextColor(percentage: number) {
  if (percentage >= 100) return "text-rose-600";
  if (percentage >= 90) return "text-amber-600";
  return "text-emerald-600";
}

export default function OrgUsageGauges({ billingCounters, orgData }: OrgUsageGaugesProps) {
  const data = billingCounters || orgData;
  const locPct = (data.current.totalLocations / data.limits.maxLocations) * 100;
  const skuPct = (data.current.totalSKUs / data.limits.maxTotalSKUs) * 100;
  const hasWarnings = orgData.status.overall !== "ok";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Usage & Capacity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Locations */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Locations</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.current.totalLocations}
              </span>
              <span className="text-sm text-gray-400">/ {data.limits.maxLocations}</span>
              <span className={`text-xs font-semibold ${getGaugeTextColor(locPct)} ml-auto`}>
                {locPct.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getGaugeColor(locPct)}`}
                style={{ width: `${Math.min(locPct, 100)}%` }}
              />
            </div>
          </div>

          {/* SKUs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Products</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.current.totalSKUs.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">/ {data.limits.maxTotalSKUs.toLocaleString()}</span>
              <span className={`text-xs font-semibold ${getGaugeTextColor(skuPct)} ml-auto`}>
                {skuPct.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getGaugeColor(skuPct)}`}
                style={{ width: `${Math.min(skuPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Warning Messages */}
        {hasWarnings && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-300 text-sm mb-1">
                  Action Required
                </h4>
                <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
                  {orgData.status.skus === "at_limit" && (
                    <li>You've reached your SKU limit. Upgrade your plan or remove items to add more.</li>
                  )}
                  {orgData.status.skus === "warning" && (
                    <li>You're approaching your SKU limit ({skuPct.toFixed(0)}% used).</li>
                  )}
                  {orgData.status.locations === "at_limit" && (
                    <li>You've reached your location limit. Upgrade to add more locations.</li>
                  )}
                  {orgData.status.locations === "warning" && (
                    <li>You're approaching your location limit ({locPct.toFixed(0)}% used).</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
