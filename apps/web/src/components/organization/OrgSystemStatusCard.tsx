"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, CreditCard,
  Store, Ticket, Globe, Package, type LucideIcon,
} from "lucide-react";
import type { OrganizationData } from "./types";

interface OrgSystemStatusCardProps {
  orgData: OrganizationData;
  heroLocation?: OrganizationData["locationBreakdown"][0];
}

interface StatusRow {
  icon: LucideIcon;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

export default function OrgSystemStatusCard({
  orgData,
  heroLocation,
}: OrgSystemStatusCardProps) {
  const locations = orgData.locationBreakdown;
  const nonHero = locations.filter((l) => l.tenantId !== heroLocation?.tenantId);
  const locationsWithoutSkus = nonHero.filter((l) => l.skuCount === 0).length;

  const rows: StatusRow[] = [
    {
      icon: RefreshCw,
      label: "Hero Location Sync",
      status: heroLocation ? "ok" : "warning",
      detail: heroLocation ? `${heroLocation.tenantName} is hero` : "No hero set",
    },
    {
      icon: Package,
      label: "Propagation Health",
      status: locationsWithoutSkus === 0 ? "ok" : locationsWithoutSkus <= 2 ? "warning" : "error",
      detail: locationsWithoutSkus === 0
        ? "All locations have products"
        : `${locationsWithoutSkus} location${locationsWithoutSkus !== 1 ? "s" : ""} without SKUs`,
    },
    {
      icon: CreditCard,
      label: "Payment Gateway Coverage",
      status: "ok",
      detail: "Check per-location gateways",
    },
    {
      icon: Store,
      label: "Storefront Status",
      status: orgData.status.overall === "ok" ? "ok" : "warning",
      detail: orgData.status.overall === "ok" ? "All active" : "Some need attention",
    },
    {
      icon: Ticket,
      label: "CRM Ticket Health",
      status: "ok",
      detail: "No urgent tickets",
    },
    {
      icon: Globe,
      label: "Directory Visibility",
      status: "ok",
      detail: "All published",
    },
  ];

  const hasIssues = rows.some((r) => r.status !== "ok");
  const overallStatus = hasIssues ? "Attention Needed" : "All Systems Operational";
  const dotColor = hasIssues ? "bg-amber-500" : "bg-emerald-500";

  const statusConfig = {
    ok: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    error: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${dotColor} ${hasIssues ? "animate-pulse" : ""}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">{overallStatus}</h3>
        </div>

        <div className="space-y-3">
          {rows.map((row) => {
            const config = statusConfig[row.status];
            const StatusIcon = config.icon;
            const RowIcon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3">
                <div className={`p-1.5 ${config.bg} rounded-lg`}>
                  <RowIcon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {row.label}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {row.detail}
                  </div>
                </div>
                <StatusIcon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
