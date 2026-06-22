"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, X, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrgCapabilityRollup as RollupData } from "@/services/OrgCapabilityService";

interface OrgCapabilityRollupProps {
  data: RollupData | undefined;
  loading?: boolean;
}

export default function OrgCapabilityRollup({ data, loading }: OrgCapabilityRollupProps) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
        <div className="h-8 w-48 animate-pulse bg-gray-100 dark:bg-gray-800 rounded mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.totalLocations === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 text-center">
        <Building2 className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No locations in this organization.</p>
      </div>
    );
  }

  const selectedLoc = data.locations.find((l) => l.tenantId === selectedLocation);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
          Capability Rollup
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {data.totalLocations} location{data.totalLocations !== 1 ? "s" : ""} in chain
        </p>
      </div>

      {/* Domain table */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {data.domains.map((domain) => {
          const isExpanded = expandedDomain === domain.key;
          const allEnabled = domain.enabledCount === domain.totalLocations;
          const noneEnabled = domain.enabledCount === 0;

          return (
            <div key={domain.key}>
              <button
                onClick={() => setExpandedDomain(isExpanded ? null : domain.key)}
                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                  {domain.label}
                </span>
                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2 w-32">
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        allEnabled
                          ? "bg-emerald-500"
                          : noneEnabled
                            ? "bg-gray-300 dark:bg-gray-700"
                            : "bg-amber-400"
                      }`}
                      style={{ width: `${(domain.enabledCount / domain.totalLocations) * 100}%` }}
                    />
                  </div>
                </div>
                {/* Count badge */}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    allEnabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : noneEnabled
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {domain.enabledCount}/{domain.totalLocations}
                </span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-3 pt-1 bg-gray-50/50 dark:bg-gray-800/20">
                      {/* Per-location breakdown */}
                      <div className="space-y-1">
                        {data.locations.map((loc) => {
                          const isEnabled = loc.domains[domain.key];
                          return (
                            <button
                              key={loc.tenantId}
                              onClick={() => setSelectedLocation(selectedLocation === loc.tenantId ? null : loc.tenantId)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-left"
                            >
                              <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">
                                {loc.tenantName}
                              </span>
                              {isEnabled ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3 h-3" />
                                  Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600">
                                  <X className="w-3 h-3" />
                                  Disabled
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Selected location detail */}
      <AnimatePresence>
        {selectedLoc && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="px-6 py-4 bg-blue-50/50 dark:bg-blue-950/10">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                {selectedLoc.tenantName} — All Capabilities
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.domains.map((domain) => {
                  const isEnabled = selectedLoc.domains[domain.key];
                  return (
                    <div
                      key={domain.key}
                      className={`flex items-center gap-2 rounded-lg p-2 border text-xs ${
                        isEnabled
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
                          : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                      }`}
                    >
                      <span className={`truncate ${isEnabled ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-600"}`}>
                        {domain.label}
                      </span>
                      {isEnabled ? (
                        <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 ml-auto" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400 dark:text-gray-600 flex-shrink-0 ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
