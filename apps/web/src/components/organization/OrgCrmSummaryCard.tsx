"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { Ticket, AlertCircle, Inbox, ArrowRight } from "lucide-react";
import { crmAdminService } from "@/services/crm/CrmAdminService";
import type { OrganizationData } from "./types";

interface OrgCrmSummaryCardProps {
  organizationId: string;
  locations: OrganizationData["locationBreakdown"];
}

export default function OrgCrmSummaryCard({
  organizationId,
  locations,
}: OrgCrmSummaryCardProps) {
  const tenantIds = locations.map((l) => l.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ["org-crm-summary", organizationId],
    queryFn: async () => {
      const allTickets = await Promise.all(
        tenantIds.map((tid) =>
          crmAdminService.listTickets(tid).catch(() => [] as any[])
        )
      );
      const orgTickets = allTickets.flat();
      const openTickets = orgTickets.filter((t: any) => t.status === "open" || t.status === "in_progress");
      const urgentTickets = openTickets.filter((t: any) => t.priority === "urgent" || t.priority === "high");
      return {
        total: orgTickets.length,
        open: openTickets.length,
        urgent: urgentTickets.length,
      };
    },
    enabled: !!organizationId && tenantIds.length > 0,
    staleTime: 60 * 1000,
  });

  const stats = data || { total: 0, open: 0, urgent: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
              <Ticket className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">CRM Summary</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cross-location support tickets
              </p>
            </div>
          </div>
          <Link href="/settings/admin/crm">
            <span className="text-xs text-blue-600 font-medium hover:underline cursor-pointer">
              View all
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Open Tickets</span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {stats.open}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Urgent</span>
              </div>
              <span className={`text-lg font-bold ${stats.urgent > 0 ? "text-rose-600" : "text-gray-900 dark:text-white"}`}>
                {stats.urgent}
              </span>
            </div>

            <Link
              href="/settings/admin/crm"
              className="flex items-center justify-center gap-1 text-sm text-blue-600 font-medium hover:underline pt-2"
            >
              Go to CRM Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
