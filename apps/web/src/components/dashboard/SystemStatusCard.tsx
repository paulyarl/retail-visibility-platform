"use client";

import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SystemStatusCardProps {
  hoursStatus?: {
    isOpen?: boolean;
    label?: string;
  } | null;
  syncIssues?: number;
  tenantId: string;
}

function StatusRow({ label, status }: { label: string; status: "ok" | "warning" | "error" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      {status === "ok" ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : status === "warning" ? (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-rose-500" />
      )}
    </div>
  );
}

export default function SystemStatusCard({ hoursStatus, syncIssues = 0, tenantId }: SystemStatusCardProps) {
  const allGood = hoursStatus?.isOpen !== false && syncIssues === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${allGood ? "bg-emerald-500" : "bg-amber-500"}`} />
        <h3 className="font-semibold text-gray-900">
          {allGood ? "All Systems Operational" : "Attention Needed"}
        </h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {allGood
          ? "Everything is running smoothly. Your store is live and visible."
          : "Some systems require your attention."}
      </p>
      <div className="space-y-2.5">
        <StatusRow label="Store" status={hoursStatus?.isOpen !== false ? "ok" : "warning"} />
        <StatusRow label="Payments" status="ok" />
        <StatusRow label="Inventory" status={syncIssues === 0 ? "ok" : "warning"} />
        <StatusRow label="Integrations" status="ok" />
        <StatusRow label="Automations" status="ok" />
      </div>
      <Link
        href={`/t/${tenantId}/settings`}
        className="mt-4 inline-flex items-center text-sm text-blue-600 font-medium hover:underline"
      >
        View System Status <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Link>
    </div>
  );
}
