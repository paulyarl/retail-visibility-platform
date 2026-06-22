"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { OrganizationData } from "./types";

interface OrgTaskChecklistProps {
  orgData: OrganizationData;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  onNavigate?: (tab: string) => void;
}

interface TaskItem {
  id: string;
  label: string;
  done: boolean;
  link: string;
  tab?: string;
}

export default function OrgTaskChecklist({
  orgData,
  heroLocation,
  onNavigate,
}: OrgTaskChecklistProps) {
  const tasks: TaskItem[] = useMemo(() => {
    const heroId = heroLocation?.tenantId;
    const nonHeroLocations = orgData.locationBreakdown.filter(
      (l) => l.tenantId !== heroId
    );
    const allNonHeroHaveSkus = nonHeroLocations.length > 0 && nonHeroLocations.every((l) => l.skuCount > 0);

    return [
      {
        id: "hero",
        label: "Set your hero location",
        done: !!heroLocation,
        link: "",
        tab: "propagation",
      },
      {
        id: "hero-products",
        label: "Add products to hero location",
        done: !!heroLocation && heroLocation.skuCount > 0,
        link: heroId ? `/t/${heroId}/items` : "",
      },
      {
        id: "propagate",
        label: "Propagate catalog to all locations",
        done: allNonHeroHaveSkus,
        link: "",
        tab: "propagation",
      },
      {
        id: "commerce",
        label: "Configure commerce settings",
        done: false,
        link: "",
        tab: "commerce",
      },
      {
        id: "team",
        label: "Invite team members",
        done: false,
        link: "",
        tab: "team",
      },
      {
        id: "crm",
        label: "Enable CRM for support",
        done: false,
        link: "",
        tab: "capabilities",
      },
      {
        id: "faq",
        label: "Set up FAQ for hero location",
        done: false,
        link: heroId ? `/t/${heroId}/faq` : "",
      },
      {
        id: "directory",
        label: "Publish directory listings",
        done: false,
        link: "",
        tab: "locations",
      },
      {
        id: "payments",
        label: "Connect payment gateways",
        done: false,
        link: heroId ? `/t/${heroId}/settings/payment-gateways` : "",
      },
      {
        id: "subscription",
        label: "Activate subscription",
        done: orgData.subscriptionStatus === "active",
        link: "",
        tab: "billing",
      },
    ];
  }, [orgData, heroLocation]);

  const completed = tasks.filter((t) => t.done).length;
  const percent = Math.round((completed / tasks.length) * 100);

  const handleClick = (task: TaskItem, e: React.MouseEvent) => {
    if (!task.link && task.tab && onNavigate) {
      e.preventDefault();
      onNavigate(task.tab);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Chain Setup</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {completed} of {tasks.length} completed
      </p>

      <div className="flex items-center justify-center mb-5">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-gray-100 dark:text-gray-800"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            />
            <path
              className="text-blue-600"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeDasharray={`${percent}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900 dark:text-white">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.link || "#"}
            onClick={(e) => handleClick(task, e)}
            className="flex items-center gap-3 group"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                task.done
                  ? "bg-emerald-500"
                  : "border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-400"
              }`}
            >
              {task.done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span
              className={`text-sm transition-colors ${
                task.done
                  ? "text-gray-400 dark:text-gray-600 line-through"
                  : "text-gray-700 dark:text-gray-300 group-hover:text-blue-600"
              }`}
            >
              {task.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
