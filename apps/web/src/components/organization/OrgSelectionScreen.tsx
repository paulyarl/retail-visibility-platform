"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { Button } from "@mantine/core";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

interface OrgSelectionScreenProps {
  loading: boolean;
  availableOrganizations: any[];
  isPlatformAdmin: boolean;
  tenantRole: string | null;
}

export default function OrgSelectionScreen({
  loading,
  availableOrganizations,
  isPlatformAdmin,
  tenantRole,
}: OrgSelectionScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Select Organization
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Choose an organization to manage
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : isPlatformAdmin ? (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              As a Platform Admin, you can manage any organization in the system.
            </p>
            {availableOrganizations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableOrganizations.map((org, index) => (
                  <motion.div
                    key={org.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Link href={`/settings/organization?organizationId=${org.id}`}>
                      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <Badge variant={org.isActive ? "success" : "default"}>
                            {org.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {org.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {org.description || "No description"}
                        </p>
                        {org.tenants && (
                          <p className="text-xs text-gray-400 mt-2">
                            {org.tenants.length} location{org.tenants.length !== 1 ? "s" : ""}
                          </p>
                        )}
                        <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                          Manage
                          <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center shadow-sm">
                <p className="text-gray-500 dark:text-gray-400">
                  No organizations found in the system.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 max-w-md mx-auto text-center">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
              Access Your Organization via Tenant Dashboard
            </h3>
            <p className="text-amber-700 dark:text-amber-300 mb-4">
              To manage your organization settings, please access through your tenant dashboard.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
              Go to:{" "}
              <code className="bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">
                /t/[tenantId]/settings/organization
              </code>
            </p>
            <Link href="/settings">
              <Button variant="gradient" style={{ color: "white" }} className="mt-4">
                Return to Settings
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
