"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { tenantInfoService } from "@/services/TenantInfoService";
import type { OrganizationData } from "./types";

interface OrgEmployeeDistributionProps {
  locations: OrganizationData["locationBreakdown"];
}

const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  OWNER: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
  ADMIN: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", bar: "bg-blue-500" },
  SUPPORT: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400", bar: "bg-purple-500" },
  MEMBER: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", bar: "bg-gray-400" },
  VIEWER: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-500", bar: "bg-gray-300" },
};

interface Employee {
  email: string;
  name: string;
  roles: { tenantId: string; tenantName: string; role: string }[];
}

export default function OrgEmployeeDistribution({ locations }: OrgEmployeeDistributionProps) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllUsers = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          locations.map(async (loc) => {
            try {
              const users = await tenantInfoService.getUsers(loc.tenantId);
              const userArray = Array.isArray(users) ? users : (users as any)?.data || [];
              return userArray.map((u: any) => ({
                ...u,
                tenantId: loc.tenantId,
                tenantName: loc.tenantName,
              }));
            } catch {
              return [];
            }
          })
        );
        setAllUsers(results.flat());
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };
    if (locations.length > 0) {
      fetchAllUsers();
    }
  }, [locations]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allUsers.forEach((u) => {
      const role = (u.role || "MEMBER").toUpperCase();
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  }, [allUsers]);

  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, Employee>();
    allUsers.forEach((u) => {
      const email = u.email || u.id;
      if (!map.has(email)) {
        map.set(email, {
          email,
          name: u.name || u.firstName || email.split("@")[0],
          roles: [],
        });
      }
      map.get(email)!.roles.push({
        tenantId: u.tenantId,
        tenantName: u.tenantName,
        role: (u.role || "MEMBER").toUpperCase(),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.roles.length - a.roles.length);
  }, [allUsers]);

  const maxCount = Math.max(...Object.values(roleCounts), 1);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Role Distribution</h3>

      {/* Bar Chart */}
      <div className="space-y-3 mb-6">
        {Object.entries(ROLE_COLORS).map(([role, colors]) => {
          const count = roleCounts[role] || 0;
          const pct = (count / maxCount) * 100;
          return (
            <div key={role}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{role}</span>
                <span className="text-sm text-gray-400">{count}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-2 rounded-full ${colors.bar}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Unique Employees List */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-3">
          Unique Employees ({uniqueEmployees.length})
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {uniqueEmployees.map((emp) => (
            <div
              key={emp.email}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Users className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {emp.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{emp.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {emp.roles.map((r, i) => (
                  <Badge
                    key={i}
                    variant="default"
                    className={`text-xs ${ROLE_COLORS[r.role]?.bg || ROLE_COLORS.MEMBER.bg} ${ROLE_COLORS[r.role]?.text || ROLE_COLORS.MEMBER.text}`}
                  >
                    <MapPin className="w-3 h-3 mr-0.5" />
                    {r.role.slice(0, 3)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
