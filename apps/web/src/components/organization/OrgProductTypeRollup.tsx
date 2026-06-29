"use client";

import { motion } from "framer-motion";
import { Package, Download, Layers, Wrench, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { OrgProductTypeRollup as OrgProductTypeRollupData, ProductTypeLocationState } from "@/services/OrgCapabilityService";

interface OrgProductTypeRollupProps {
  data: OrgProductTypeRollupData | undefined;
  loading: boolean;
}

const TYPE_ICON: Record<string, typeof Package> = {
  physical: Package,
  digital: Download,
  hybrid: Layers,
  service: Wrench,
};

const TYPE_COLOR: Record<string, string> = {
  physical: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  digital: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  hybrid: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20",
  service: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  flexible: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  none: "text-gray-400 bg-gray-50 dark:bg-gray-800/50",
};

function TypeBadge({ type, label }: { type: string; label?: string }) {
  const Icon = TYPE_ICON[type] || Package;
  const colorClass = TYPE_COLOR[type] || TYPE_COLOR.none;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {label || type}
    </span>
  );
}

export default function OrgProductTypeRollup({ data, loading }: OrgProductTypeRollupProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm animate-pulse">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
          <div className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
          <div className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || data.totalLocations === 0) {
    return null;
  }

  const { locations, summary } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-violet-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Product Type Alignment</h3>
          <span className="text-sm text-gray-400 ml-auto">
            {summary.enabledCount}/{data.totalLocations} enabled
          </span>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">{summary.enabledCount} enabled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">{summary.disabledCount} disabled</span>
          </div>
          {summary.misalignedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">{summary.misalignedCount} misaligned</span>
            </div>
          )}
        </div>

        {/* Location rows */}
        <div className="space-y-2">
          {locations.map((loc: ProductTypeLocationState) => (
            <div
              key={loc.tenantId}
              className={`flex items-center justify-between p-3 rounded-xl ${
                loc.enabled
                  ? "bg-gray-50 dark:bg-gray-800/50"
                  : "bg-gray-50/50 dark:bg-gray-800/30 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {loc.tenantName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {loc.enabled ? (
                      <>
                        <TypeBadge type={loc.type} label={loc.isFlexible ? "Flexible" : loc.type} />
                        {loc.allowedTypes.length > 0 && (
                          <span className="text-xs text-gray-400">
                            allows: {loc.allowedTypes.join(", ")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Product types disabled</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {loc.enabled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
