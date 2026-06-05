"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAllCapabilities } from "@/hooks/tenant-access/useCapabilityAccess";

interface TaskChecklistProps {
  tenantId: string;
  hasProducts: boolean;
  hasStorefront: boolean;
  hasPublishedDirectory: boolean;
  locationStatus?: string;
  subscriptionStatus?: string;
}

interface TaskItem {
  id: string;
  label: string;
  done: boolean;
  link: string;
}

export default function TaskChecklist({
  tenantId,
  hasProducts,
  hasStorefront,
  hasPublishedDirectory,
  locationStatus,
  subscriptionStatus,
}: TaskChecklistProps) {
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });

  const tasks: TaskItem[] = useMemo(() => {
    const caps = allCaps.data;
    // Check capability states for feature availability
    const canSetupPayments = caps?.commerce?.enabled ?? true;
    const canManageInventory = caps?.productOptions?.enabled ?? true;
    const canManageShipping = caps?.fulfillment?.enabled ?? true;
    const canManageDiscounts = caps?.commerce?.enabled ?? true;

    return [
      {
        id: "location",
        label: "Verify your business location",
        done: locationStatus === "active",
        link: `/t/${tenantId}/settings/location-status`,
      },
      {
        id: "subscription",
        label: "Activate your subscription",
        done: subscriptionStatus === "active",
        link: `/t/${tenantId}/settings/subscription`,
      },
      {
        id: "payments",
        label: "Connect payment providers",
        done: canSetupPayments,
        link: `/t/${tenantId}/settings/payment-gateways`,
      },
      {
        id: "products",
        label: "Add your first product",
        done: hasProducts,
        link: `/t/${tenantId}/items/create`,
      },
      {
        id: "shipping",
        label: "Set up shipping rates",
        done: canManageShipping,
        link: `/t/${tenantId}/settings/fulfillment`,
      },
      {
        id: "inventory",
        label: "Manage inventory",
        done: canManageInventory,
        link: `/t/${tenantId}/items`,
      },
      {
        id: "discounts",
        label: "Create your first discount",
        done: canManageDiscounts,
        link: `/t/${tenantId}/settings/commerce`,
      },
      {
        id: "storefront",
        label: "Publish your storefront",
        done: hasStorefront,
        link: `/t/${tenantId}/settings/tenant`,
      },
      {
        id: "directory",
        label: "Publish your directory listing",
        done: hasPublishedDirectory,
        link: `/t/${tenantId}/settings/directory`,
      },
    ];
  }, [allCaps.data, hasProducts, hasStorefront, hasPublishedDirectory, locationStatus, subscriptionStatus, tenantId]);

  const completed = tasks.filter((t) => t.done).length;
  const percent = Math.round((completed / tasks.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-1">Next Steps</h3>
      <p className="text-sm text-gray-500 mb-4">
        {completed} of {tasks.length} completed
      </p>

      {/* Progress ring */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-gray-100"
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
            <span className="text-sm font-bold text-gray-900">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link key={task.id} href={task.link} className="flex items-center gap-3 group">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${task.done ? "bg-emerald-500" : "border-2 border-gray-200 group-hover:border-blue-400"
                }`}
            >
              {task.done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span
              className={`text-sm transition-colors ${task.done
                  ? "text-gray-400 line-through"
                  : "text-gray-700 group-hover:text-blue-600"
                }`}
            >
              {task.label}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href={`/t/${tenantId}/quick-start`}
        className="mt-4 inline-flex items-center text-sm text-blue-600 font-medium hover:underline"
      >
        View all tasks <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Link>
    </div>
  );
}
