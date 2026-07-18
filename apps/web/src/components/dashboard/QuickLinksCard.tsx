"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Store, Package, MapPin, CreditCard, Truck, ShoppingCart,
  HelpCircle, Bot, Headset, Globe, Star, Users, Settings,
  Share2, Building2, User, BarChart3,
  ArrowRight, Loader2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuickLinks } from "@/hooks/dashboard/useQuickLinks";

const ICONS: Record<string, LucideIcon> = {
  Store, Package, MapPin, CreditCard, Truck, ShoppingCart,
  HelpCircle, Bot, Headset, Globe, Star, Users, Settings, Share2, Building2, User, BarChart3,
};

const ICON_COLORS: Record<string, { bg: string; text: string }> = {
  store: { bg: "bg-blue-50 group-hover:bg-blue-100", text: "text-blue-600" },
  visibility: { bg: "bg-emerald-50 group-hover:bg-emerald-100", text: "text-emerald-600" },
  commerce: { bg: "bg-violet-50 group-hover:bg-violet-100", text: "text-violet-600" },
  engagement: { bg: "bg-indigo-50 group-hover:bg-indigo-100", text: "text-indigo-600" },
  settings: { bg: "bg-amber-50 group-hover:bg-amber-100", text: "text-amber-600" },
};

interface QuickLinksCardProps {
  tenantId: string;
}

export default function QuickLinksCard({ tenantId }: QuickLinksCardProps) {
  const { links, loading } = useQuickLinks(tenantId);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 5;
  const visibleLinks = showAll ? links : links.slice(0, INITIAL_COUNT);
  const hasMore = links.length > INITIAL_COUNT;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
      <div className="space-y-2">
        {loading ? (
          <>
            <div className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            <div className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            <div className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            <div className="h-14 bg-gray-50 rounded-xl animate-pulse" />
          </>
        ) : visibleLinks.length > 0 ? (
          visibleLinks.map((link) => {
            const Icon = ICONS[link.icon] ?? Store;
            const colors = ICON_COLORS[link.category] ?? ICON_COLORS.store;
            return (
              <Link
                key={link.id}
                href={link.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors group ${
                  link.badge === "Action needed"
                    ? "bg-rose-50 hover:bg-rose-100 border border-rose-100"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{link.label}</p>
                    {link.badge && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          link.badge === "Action needed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {link.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{link.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
              </Link>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-gray-300" />
          </div>
        )}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
        >
          {showAll ? (
            <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show {links.length - INITIAL_COUNT} more <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
}
