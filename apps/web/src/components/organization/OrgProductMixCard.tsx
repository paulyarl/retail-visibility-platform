"use client";

import { motion } from "framer-motion";
import { Package, Boxes, Download, Wrench, Layers, PackageX } from "lucide-react";
import type { OrgProductMix, ProductMixEntry } from "@/services/OrgCapabilityService";

interface OrgProductMixCardProps {
  data: OrgProductMix | undefined;
  loading: boolean;
}

const TYPE_META: Record<string, { label: string; icon: typeof Package; color: string; bgColor: string }> = {
  physical: { label: "Physical", icon: Package, color: "text-blue-600", bgColor: "bg-blue-500" },
  digital: { label: "Digital", icon: Download, color: "text-violet-600", bgColor: "bg-violet-500" },
  hybrid: { label: "Hybrid", icon: Layers, color: "text-cyan-600", bgColor: "bg-cyan-500" },
  service: { label: "Service", icon: Wrench, color: "text-amber-600", bgColor: "bg-amber-500" },
  unknown: { label: "Unspecified", icon: PackageX, color: "text-gray-500", bgColor: "bg-gray-400" },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] || TYPE_META.unknown;
}

export default function OrgProductMixCard({ data, loading }: OrgProductMixCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm animate-pulse">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="h-32 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
      </div>
    );
  }

  if (!data || data.totalItems === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-violet-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Product Mix</h3>
          </div>
          <div className="text-center py-8">
            <Boxes className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No products yet</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const { mix, totalItems } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-violet-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Product Mix</h3>
          <span className="text-sm text-gray-400 ml-auto">
            {totalItems.toLocaleString()} total
          </span>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden mb-4">
          {mix.map((entry: ProductMixEntry) => {
            const meta = getTypeMeta(entry.productType);
            return (
              <div
                key={entry.productType}
                className={`${meta.bgColor} transition-all`}
                style={{ width: `${entry.percentage}%` }}
                title={`${meta.label}: ${entry.count} (${entry.percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Legend with counts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mix.map((entry: ProductMixEntry) => {
            const meta = getTypeMeta(entry.productType);
            const Icon = meta.icon;
            return (
              <div key={entry.productType} className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800`}>
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {meta.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.count.toLocaleString()} ({entry.percentage.toFixed(0)}%)
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
