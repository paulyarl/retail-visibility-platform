"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users, Mail, ChevronRight, UserPlus, type LucideIcon } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import { tenantInfoService } from "@/services/TenantInfoService";
import type { OrganizationData } from "./types";

interface OrgTeamOverviewProps {
  locations: OrganizationData["locationBreakdown"];
}

interface TeamData {
  tenantId: string;
  tenantName: string;
  users: any[];
  pendingInvitations: any[];
}

export default function OrgTeamOverview({ locations }: OrgTeamOverviewProps) {
  const [teamData, setTeamData] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          locations.map(async (loc) => {
            try {
              const [users, invitations] = await Promise.all([
                tenantInfoService.getUsers(loc.tenantId),
                tenantInfoService.getPendingInvitations(loc.tenantId).catch(() => [] as any[]),
              ]);
              return {
                tenantId: loc.tenantId,
                tenantName: loc.tenantName,
                users: Array.isArray(users) ? users : (users as any)?.data || [],
                pendingInvitations: Array.isArray(invitations) ? invitations : (invitations as any)?.data || [],
              };
            } catch {
              return {
                tenantId: loc.tenantId,
                tenantName: loc.tenantName,
                users: [],
                pendingInvitations: [],
              };
            }
          })
        );
        setTeamData(results);
      } catch (error) {
        console.error("Failed to fetch team data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (locations.length > 0) {
      fetchTeamData();
    }
  }, [locations]);

  const totalEmployees = teamData.reduce((sum, td) => sum + td.users.length, 0);
  const locationsWithTeams = teamData.filter((td) => td.users.length > 0).length;
  const totalPending = teamData.reduce((sum, td) => sum + td.pendingInvitations.length, 0);

  const roleColors: Record<string, string> = {
    OWNER: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    SUPPORT: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
    MEMBER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    VIEWER: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Employees", value: totalEmployees, icon: Users, color: "text-blue-600" },
          { label: "Locations with Teams", value: locationsWithTeams, icon: Users, color: "text-emerald-600" },
          { label: "Pending Invitations", value: totalPending, icon: Mail, color: "text-amber-600" },
          { label: "Total Locations", value: locations.length, icon: Users, color: "text-violet-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</span>
            </div>
          );
        })}
      </div>

      {/* Per-Location Team Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Team by Location</h3>
        <div className="space-y-2">
          {teamData.map((td, index) => {
            const roleBreakdown: Record<string, number> = {};
            td.users.forEach((u: any) => {
              const role = (u.role || "MEMBER").toUpperCase();
              roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
            });

            return (
              <motion.div
                key={td.tenantId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white">{td.tenantName}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">{td.users.length} member{td.users.length !== 1 ? "s" : ""}</span>
                    {Object.entries(roleBreakdown).map(([role, count]) => (
                      <Badge key={role} variant="default" className={`text-xs ${roleColors[role] || roleColors.MEMBER}`}>
                        {count} {role}
                      </Badge>
                    ))}
                    {td.pendingInvitations.length > 0 && (
                      <Badge variant="warning" className="text-xs">
                        {td.pendingInvitations.length} pending
                      </Badge>
                    )}
                  </div>
                </div>
                <Link href={`/t/${td.tenantId}/settings/users`}>
                  <Button variant="light" size="sm" rightSection={<ChevronRight className="w-4 h-4" />}>
                    Manage
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations */}
      {totalPending > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Pending Invitations</h3>
            <Badge variant="warning" className="text-xs">{totalPending}</Badge>
          </div>
          <div className="space-y-2">
            {teamData
              .filter((td) => td.pendingInvitations.length > 0)
              .flatMap((td) =>
                td.pendingInvitations.map((inv: any, i: number) => (
                  <div
                    key={`${td.tenantId}-${i}`}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <UserPlus className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {inv.email}
                        </div>
                        <div className="text-xs text-gray-400">
                          {td.tenantName} • {inv.role || "Member"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
          </div>
        </div>
      )}
    </div>
  );
}
