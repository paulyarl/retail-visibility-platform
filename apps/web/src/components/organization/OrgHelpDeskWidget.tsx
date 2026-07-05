"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Ticket, AlertCircle, Inbox, ArrowRight, Lock, Plus, MessageSquare,
} from "lucide-react";
import { crmAdminService } from "@/services/crm/CrmAdminService";
import type { OrganizationData } from "./types";

interface OrgHelpDeskWidgetProps {
  organizationId: string;
  locations: OrganizationData["locationBreakdown"];
  readOnly?: boolean;
  isPlatformAdmin?: boolean;
}

interface LocationTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  tenantId: string;
  tenantName: string;
  created_at: string;
}

export default function OrgHelpDeskWidget({
  organizationId,
  locations,
  readOnly = false,
  isPlatformAdmin = false,
}: OrgHelpDeskWidgetProps) {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tenantIds = locations.map((l) => l.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ["org-help-desk", organizationId],
    queryFn: async () => {
      const allTickets = await Promise.all(
        tenantIds.map((tid) =>
          crmAdminService
            .listTickets(tid)
            .then((tickets) =>
              (tickets || []).map((t: any) => ({
                ...t,
                tenantId: tid,
                tenantName: locations.find((l) => l.tenantId === tid)?.tenantName || tid,
              }))
            )
            .catch(() => [] as LocationTicket[])
        )
      );
      const orgTickets = allTickets.flat() as LocationTicket[];
      const openTickets = orgTickets.filter(
        (t) => t.status === "open" || t.status === "in_progress"
      );
      const urgentTickets = openTickets.filter(
        (t) => t.priority === "urgent" || t.priority === "high"
      );
      const recentOpen = openTickets
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      const byLocation = tenantIds.map((tid) => ({
        tenantId: tid,
        tenantName: locations.find((l) => l.tenantId === tid)?.tenantName || tid,
        openCount: openTickets.filter((t) => t.tenantId === tid).length,
      }));

      return {
        total: orgTickets.length,
        open: openTickets.length,
        urgent: urgentTickets.length,
        recentOpen,
        byLocation,
      };
    },
    enabled: !!organizationId && tenantIds.length > 0,
    staleTime: 60 * 1000,
  });

  const stats = data || { total: 0, open: 0, urgent: 0, recentOpen: [], byLocation: [] };

  const canCreateTicket = !readOnly || isPlatformAdmin;

  const handleCreateTicket = async () => {
    if (!newTitle.trim() || !locations[0]) return;
    setSubmitting(true);
    try {
      await crmAdminService.createTicket(locations[0].tenantId, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setShowNewTicket(false);
      setNewTitle("");
      setNewDescription("");
    } catch {
      // silently fail — toast handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
              <Ticket className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Help Desk</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cross-location support tickets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/admin/crm"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              All tickets
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Stat Badges */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.open}</p>
            <p className="text-xs text-gray-500 mt-0.5">Open</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
            <p className={`text-2xl font-bold ${stats.urgent > 0 ? "text-rose-600" : "text-gray-900 dark:text-white"}`}>
              {stats.urgent}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Urgent</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total</p>
          </div>
        </div>

        {/* Recent Open Tickets */}
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        ) : stats.recentOpen.length > 0 ? (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Open Tickets</p>
            {stats.recentOpen.map((t) => (
              <Link
                key={t.id}
                href={`/settings/admin/crm/tenants/${t.tenantId}`}
                className="flex items-start justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      t.priority === "urgent" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : "bg-blue-400"
                    }`} />
                    <p className="text-sm truncate text-gray-700 dark:text-gray-300">{t.title}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t.tenantName}</p>
                </div>
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-2 flex-shrink-0 self-center ${
                  t.status === "open" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {t.status?.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 mb-4">
            <Inbox className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No open tickets across locations</p>
          </div>
        )}

        {/* Open by Location */}
        {stats.byLocation.some((l) => l.openCount > 0) && (
          <div className="space-y-1.5 mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Open by Location</p>
            {stats.byLocation
              .filter((l) => l.openCount > 0)
              .map((l) => (
                <Link
                  key={l.tenantId}
                  href={`/settings/admin/crm/tenants/${l.tenantId}`}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{l.tenantName}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{l.openCount}</span>
                </Link>
              ))}
          </div>
        )}

        {/* New Ticket Button */}
        {canCreateTicket && (
          <button
            onClick={() => setShowNewTicket(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Support Ticket
          </button>
        )}

        {/* New Ticket Modal */}
        {showNewTicket && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setShowNewTicket(false)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-1">New Support Ticket</h3>
              <p className="text-xs text-gray-500 mb-4">
                Will be created for {locations[0]?.tenantName || "hero location"}
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  autoFocus
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe your issue..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowNewTicket(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTicket}
                    disabled={!newTitle.trim() || submitting}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
