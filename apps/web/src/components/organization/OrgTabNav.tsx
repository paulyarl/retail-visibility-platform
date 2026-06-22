"use client";

import { Lock } from "lucide-react";
import type { TabDef } from "./types";

interface OrgTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: TabDef[];
  lockedTabs?: string[];
}

export default function OrgTabNav({
  activeTab,
  onTabChange,
  tabs,
  lockedTabs = [],
}: OrgTabNavProps) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max border-b border-gray-100 dark:border-gray-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isLocked = lockedTabs.includes(tab.key);
          const Icon = tab.icon;

          if (isLocked) {
            return (
              <div
                key={tab.key}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed border-b-2 border-transparent"
                title="Upgrade to unlock this tab"
              >
                <Lock className="w-4 h-4" />
                {tab.label}
              </div>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
