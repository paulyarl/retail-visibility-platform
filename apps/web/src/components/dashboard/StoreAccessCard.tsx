"use client";

import Link from "next/link";
import { Sparkles, Bolt, TrendingUp, CreditCard, Store, ArrowRight } from "lucide-react";

interface StoreAccessCardProps {
  tenantId: string;
}

export default function StoreAccessCard({ tenantId }: StoreAccessCardProps) {
  const stores = [
    {
      title: "App Store",
      description: "Browse all plans, features, placements, and promotions in one place",
      href: `/t/${tenantId}/settings/store`,
      icon: Store,
      iconBg: "bg-gradient-to-br from-blue-50 to-purple-50",
      iconColor: "text-blue-600",
      badge: "All-in-one",
      badgeBg: "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700",
    },
    {
      title: "Featured Store",
      description: "Pay to spotlight your products in featured placement spots",
      href: `/t/${tenantId}/settings/featured-store`,
      icon: Sparkles,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      badge: "Products",
      badgeBg: "bg-purple-50 text-purple-700",
    },
    {
      title: "Feature Store",
      description: "Purchase à la carte capability features to enhance your plan",
      href: `/t/${tenantId}/settings/feature-store`,
      icon: Bolt,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      badge: "Capabilities",
      badgeBg: "bg-violet-50 text-violet-700",
    },
    {
      title: "Directory Promotion",
      description: "Boost your store visibility on the directory map and search",
      href: `/t/${tenantId}/settings/promotion`,
      icon: TrendingUp,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      badge: "Directory",
      badgeBg: "bg-amber-50 text-amber-700",
    },
    {
      title: "Subscription",
      description: "Manage your plan tier, upgrade, and view included features",
      href: `/t/${tenantId}/settings/subscription`,
      icon: CreditCard,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      badge: "Plan",
      badgeBg: "bg-blue-50 text-blue-700",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-1">Stores</h3>
      <p className="text-xs text-gray-500 mb-4">Purchase product placements and capability features</p>
      <div className="space-y-3">
        {stores.map((store) => {
          const Icon = store.icon;
          return (
            <Link
              key={store.href}
              href={store.href}
              className="flex items-center gap-3 p-3 rounded-xl transition-colors group hover:bg-gray-50"
            >
              <div className={`p-2 rounded-lg transition-colors ${store.iconBg}`}>
                <Icon className={`w-4 h-4 ${store.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{store.title}</p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${store.badgeBg}`}>
                    {store.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{store.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
