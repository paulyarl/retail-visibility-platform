"use client";

import { MessageSquare, Bot, FileQuestion, Package, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { OrgBotStatus } from "@/services/OrgCapabilityService";

interface OrgBotStatusCardProps {
  data: OrgBotStatus | undefined;
  loading?: boolean;
}

export default function OrgBotStatusCard({ data, loading }: OrgBotStatusCardProps) {
  if (loading || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <div className="h-6 w-32 animate-pulse bg-gray-100 dark:bg-gray-800 rounded mb-3" />
        <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  if (data.totalLocations === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 text-center">
        <Bot className="w-7 h-7 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No locations in this organization.</p>
      </div>
    );
  }

  const allActive = data.totalActive === data.totalLocations;
  const noneActive = data.totalActive === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Chatbot Status
            </h3>
            <span
              className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                allActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : noneActive
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {data.totalActive}/{data.totalLocations} active
            </span>
          </div>
        </div>

        {/* Location rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.locations.map((loc) => (
            <div key={loc.tenantId} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    loc.botActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                  {loc.tenantName}
                </span>
                <Link
                  href={`/t/${loc.tenantId}/bot`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                >
                  <Link2 className="w-3 h-3" />
                  Manage
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 ml-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {loc.conversationCount} conv.
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    loc.hasFaqEmbeddings
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-500 dark:text-amber-500"
                  }`}
                >
                  <FileQuestion className="w-3 h-3" />
                  FAQ KB
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    loc.hasProductEmbeddings
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-500 dark:text-amber-500"
                  }`}
                >
                  <Package className="w-3 h-3" />
                  Product KB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
