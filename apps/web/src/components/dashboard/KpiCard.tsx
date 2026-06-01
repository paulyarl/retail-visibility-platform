"use client";

import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import Sparkline from "./Sparkline";

interface KpiCardProps {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  sparklineData?: number[];
}

export default function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  iconBg,
  iconColor,
  sparklineData,
}: KpiCardProps) {
  const isUp = (trend ?? 0) >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {trend !== undefined && (
            <>
              {isUp ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className={`text-xs font-semibold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                {isUp ? "+" : ""}{trend}%
              </span>
            </>
          )}
          {trendLabel && <span className="text-xs text-gray-400 ml-1">{trendLabel}</span>}
        </div>
        {sparklineData && (
          <Sparkline data={sparklineData} color={isUp ? "#10b981" : "#f43f5e"} />
        )}
      </div>
    </div>
  );
}
