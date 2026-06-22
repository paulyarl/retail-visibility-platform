"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CreditCard, FileText, ArrowRight } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import SubscriptionUsageBadge from "@/components/subscription/SubscriptionUsageBadge";
import type { BillingCounters } from "./types";

interface OrgBillingCardProps {
  billingCounters: BillingCounters | null;
}

export default function OrgBillingCard({ billingCounters }: OrgBillingCardProps) {
  if (!billingCounters) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Billing & Subscription</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage payment methods, invoices, and plan
              </p>
            </div>
          </div>
          <Badge variant={billingCounters.subscriptionStatus === "active" ? "success" : "warning"}>
            {billingCounters.subscriptionStatus?.toUpperCase() || "UNKNOWN"}
          </Badge>
        </div>

        <div className="mb-4">
          <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/settings/subscription">
            <Button variant="gradient" style={{ color: "white" }} size="sm" leftSection={<CreditCard className="w-4 h-4" />}>
              Manage Plan
            </Button>
          </Link>
          <Link href="/settings/billing/invoices">
            <Button variant="light" size="sm" leftSection={<FileText className="w-4 h-4" />}>
              View Invoices
            </Button>
          </Link>
          <Link href="/settings/subscription" className="ml-auto">
            <Button variant="subtle" size="sm" rightSection={<ArrowRight className="w-4 h-4" />}>
              Upgrade
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
