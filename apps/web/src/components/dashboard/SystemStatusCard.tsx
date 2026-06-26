"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, MinusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  systemStatusService,
  type SystemStatusData,
  type SystemStatusItem,
} from "@/services/SystemStatusSingletonService";

interface SystemStatusCardProps {
  tenantId: string;
}

function StatusRow({ item }: { item: SystemStatusItem }) {
  const icon = (() => {
    switch (item.status) {
      case "ok":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />;
      case "inactive":
        return <MinusCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />;
    }
  })();

  const content = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className={`text-sm ${item.status === "inactive" ? "text-gray-400" : "text-gray-600"}`}>
          {item.label}
        </span>
      </div>
      {item.detail && (
        <span className="text-xs text-gray-400 truncate">{item.detail}</span>
      )}
    </div>
  );

  if (item.link) {
    return (
      <Link href={item.link} className="block hover:bg-gray-50 -mx-1 px-1 py-0.5 rounded transition-colors">
        {content}
      </Link>
    );
  }

  return content;
}

export default function SystemStatusCard({ tenantId }: SystemStatusCardProps) {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    let mounted = true;
    setLoading(true);

    systemStatusService.getSystemStatus(tenantId).then((result) => {
      if (mounted) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [tenantId]);

  const overall = data?.overall ?? "operational";
  const visibleItems = data?.items.filter((i) => i.status !== "inactive") ?? [];

  const headerColor =
    overall === "operational" ? "bg-emerald-500" :
    overall === "attention" ? "bg-amber-500" :
    "bg-rose-500";

  const headerText =
    overall === "operational" ? "All Systems Operational" :
    overall === "attention" ? "Attention Needed" :
    "Critical Issues";

  const subText =
    overall === "operational"
      ? "Everything is running smoothly. Your store is live and visible."
      : overall === "attention"
      ? "Some systems require your attention."
      : "Immediate action required.";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {loading ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${headerColor}`} />
        )}
        <h3 className="font-semibold text-gray-900">
          {loading ? "Checking systems…" : headerText}
        </h3>
      </div>
      {!loading && (
        <p className="text-sm text-gray-500 mb-4">{subText}</p>
      )}
      <div className="space-y-2.5">
        {loading ? (
          <>
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
          </>
        ) : visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <StatusRow key={item.key} item={item} />
          ))
        ) : (
          <p className="text-sm text-gray-400">No status data available.</p>
        )}
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
