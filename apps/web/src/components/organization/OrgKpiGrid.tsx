"use client";

import { motion } from "framer-motion";
import { MapPin, Package, CreditCard, Activity } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import type { BillingCounters, OrganizationData } from "./types";

interface OrgKpiGridProps {
  billingCounters: BillingCounters | null;
  orgData: OrganizationData;
}

export default function OrgKpiGrid({ billingCounters, orgData }: OrgKpiGridProps) {
  const data = billingCounters || orgData;
  const tierName = (billingCounters?.subscriptionTier || orgData.subscriptionTier || "UNKNOWN")
    .replace(/_/g, " ").toUpperCase();
  const statusIcon = orgData.status.overall === "ok" ? "✅" : orgData.status.overall === "warning" ? "⚠️" : "❌";

  const cards = [
    {
      label: "Locations",
      value: data.current.totalLocations.toString(),
      icon: MapPin,
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Products",
      value: data.current.totalSKUs.toLocaleString(),
      icon: Package,
      iconBg: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600",
    },
    {
      label: "Subscription",
      value: tierName,
      icon: CreditCard,
      iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600",
    },
    {
      label: "Chain Health",
      value: statusIcon,
      icon: Activity,
      iconBg: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * index }}
        >
          <KpiCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
          />
        </motion.div>
      ))}
    </div>
  );
}
