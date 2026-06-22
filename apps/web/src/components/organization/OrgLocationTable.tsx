"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Crown, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import type { OrganizationData } from "./types";

interface OrgLocationTableProps {
  locations: OrganizationData["locationBreakdown"];
  heroLocation?: OrganizationData["locationBreakdown"][0];
  maxTotalSKUs: number;
  currentPage: number;
  locationsPerPage: number;
  onPageChange: (page: number) => void;
}

export default function OrgLocationTable({
  locations,
  heroLocation,
  maxTotalSKUs,
  currentPage,
  locationsPerPage,
  onPageChange,
}: OrgLocationTableProps) {
  const sorted = [...locations].sort((a, b) => b.skuCount - a.skuCount);
  const totalPages = Math.ceil(sorted.length / locationsPerPage);
  const paginated = sorted.slice((currentPage - 1) * locationsPerPage, currentPage * locationsPerPage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Location Breakdown</h3>
          <span className="text-sm text-gray-400 ml-auto">
            {sorted.length} location{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No locations in this organization</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="space-y-2">
              {paginated.map((location, index) => {
                const isHero = location.tenantId === heroLocation?.tenantId;
                const pct = maxTotalSKUs > 0 ? (location.skuCount / maxTotalSKUs) * 100 : 0;

                return (
                  <motion.div
                    key={location.tenantId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                      isHero
                        ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                        : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {location.tenantName}
                        </h4>
                        {isHero && (
                          <Badge variant="warning" className="text-xs">
                            <Crown className="w-3 h-3 mr-0.5" />
                            Hero
                          </Badge>
                        )}
                        <Badge variant="default" className="text-xs">
                          <Package className="w-3 h-3 mr-0.5" />
                          {location.skuCount.toLocaleString()} SKUs
                        </Badge>
                      </div>
                      <div className="mt-2 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {pct.toFixed(1)}% of total pool
                      </p>
                    </div>
                    <Link href={`/t/${location.tenantId}/items`}>
                      <Button variant="light" size="sm">
                        View Items
                      </Button>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((currentPage - 1) * locationsPerPage) + 1} to{" "}
                  {Math.min(currentPage * locationsPerPage, sorted.length)} of {sorted.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    leftSection={<ChevronLeft className="w-4 h-4" />}
                  >
                    Prev
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    rightSection={<ChevronRight className="w-4 h-4" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
