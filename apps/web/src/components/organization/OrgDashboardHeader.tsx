"use client";

import Link from "next/link";
import { Building2, RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";

interface OrgDashboardHeaderProps {
  orgName: string;
  organizationId: string;
  tier?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function OrgDashboardHeader({
  orgName,
  organizationId,
  tier,
  onRefresh,
  refreshing,
}: OrgDashboardHeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {orgName}
              </h1>
              <div className="flex items-center gap-2">
                {tier && (
                  <Badge variant="default" className="text-xs">
                    {tier.replace(/_/g, " ")}
                  </Badge>
                )}
                <span className="text-xs text-gray-400 font-mono">{organizationId}</span>
              </div>
            </div>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
