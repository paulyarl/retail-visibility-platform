"use client";

import { Globe, Info } from "lucide-react";
import { Button } from "@mantine/core";
import type { OrganizationData } from "./types";

interface OrgCategorySyncModalProps {
  open: boolean;
  locations: OrganizationData["locationBreakdown"];
  scope: "single" | "all";
  selectedTenantId: string;
  onScopeChange: (scope: "single" | "all") => void;
  onTenantSelect: (tenantId: string) => void;
  onSync: () => void;
  onClose: () => void;
  syncing: boolean;
  readOnly?: boolean;
}

export default function OrgCategorySyncModal({
  open,
  locations,
  scope,
  selectedTenantId,
  onScopeChange,
  onTenantSelect,
  onSync,
  onClose,
  syncing,
  readOnly,
}: OrgCategorySyncModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sync Categories to GBP
          </h3>
        </div>

        <div className="space-y-4 mb-6">
          {/* Scope Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sync Scope
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="categorySyncScope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => onScopeChange("all")}
                  disabled={readOnly}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">All Locations</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Sync to all {locations.length} locations in organization
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <input
                  type="radio"
                  name="categorySyncScope"
                  value="single"
                  checked={scope === "single"}
                  onChange={() => onScopeChange("single")}
                  disabled={readOnly}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Single Location</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Test on one location before rolling out
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Tenant Selector */}
          {scope === "single" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Location
              </label>
              <select
                value={selectedTenantId}
                onChange={(e) => onTenantSelect(e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Choose a location...</option>
                {locations.map((location) => (
                  <option key={location.tenantId} value={location.tenantId}>
                    {location.tenantName} ({location.skuCount} SKUs)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Strategy Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-400">
                <strong>Use Case:</strong>{" "}
                {scope === "single"
                  ? "Test new categories on one location before chain-wide rollout"
                  : "Update all locations with latest product categories"}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="light" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            style={{ color: "white" }}
            className="flex-1"
            onClick={onSync}
            disabled={readOnly || (scope === "single" && !selectedTenantId) || syncing}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
