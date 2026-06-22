"use client";

import { Crown, ChevronRight, Check } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import type { OrganizationData } from "./types";

interface OrgHeroLocationModalProps {
  open: boolean;
  locations: OrganizationData["locationBreakdown"];
  currentHeroId?: string;
  onSelect: (tenantId: string) => void;
  onClose: () => void;
  settingHero: boolean;
}

export default function OrgHeroLocationModal({
  open,
  locations,
  currentHeroId,
  onSelect,
  onClose,
  settingHero,
}: OrgHeroLocationModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Select Hero Location
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose the location with the most complete product catalog to use as your master source.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {locations.map((location) => {
            const isCurrent = location.tenantId === currentHeroId;
            return (
              <button
                key={location.tenantId}
                onClick={() => onSelect(location.tenantId)}
                disabled={settingHero}
                className={`w-full p-4 text-left rounded-xl border-2 transition-all disabled:opacity-50 ${
                  isCurrent
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {location.tenantName}
                      </h3>
                      {isCurrent && (
                        <Badge variant="warning" className="text-xs">
                          <Crown className="w-3 h-3 mr-0.5" />
                          Current Hero
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {location.skuCount.toLocaleString()} products
                    </p>
                  </div>
                  {isCurrent ? (
                    <Check className="w-5 h-5 text-amber-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
