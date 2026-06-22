"use client";

import Link from "next/link";
import {
  Shield, Building2, Sparkles, BarChart3, CreditCard, ShoppingCart,
  Zap, LayoutDashboard, LifeBuoy, Compass, ArrowRight, type LucideIcon,
} from "lucide-react";
import type { OrganizationData } from "./types";

interface OrgQuickLinksProps {
  organizationId: string;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  isPlatformAdmin: boolean;
  onNavigate?: (tab: string) => void;
}

interface QuickLink {
  icon: LucideIcon;
  label: string;
  subLabel: string;
  href: string;
  tab?: string;
}

export default function OrgQuickLinks({
  organizationId,
  heroLocation,
  isPlatformAdmin,
  onNavigate,
}: OrgQuickLinksProps) {
  const heroId = heroLocation?.tenantId;

  const adminLinks: QuickLink[] = isPlatformAdmin ? [
    { icon: Shield, label: "Admin CRM", subLabel: "Tickets & tasks", href: "/settings/admin/crm" },
    { icon: Building2, label: "Organizations", subLabel: "Manage all orgs", href: "/settings/admin/organizations" },
    { icon: Sparkles, label: "Capabilities", subLabel: "Feature flags", href: "/settings/admin/capabilities" },
    { icon: BarChart3, label: "Analytics", subLabel: "Platform metrics", href: "/settings/admin/analytics" },
  ] : [];

  const chainLinks: QuickLink[] = [
    { icon: CreditCard, label: "Subscription", subLabel: "Plan & billing", href: "/settings/subscription" },
    { icon: ShoppingCart, label: "Commerce", subLabel: "Payment settings", href: "", tab: "commerce" },
    { icon: Zap, label: "Propagation", subLabel: "Sync products", href: "", tab: "propagation" },
    { icon: LayoutDashboard, label: "Billing", subLabel: "Invoices & usage", href: "", tab: "billing" },
  ];

  const perLocationLinks: QuickLink[] = heroId ? [
    { icon: LayoutDashboard, label: "Hero Dashboard", subLabel: heroLocation?.tenantName || "Hero location", href: `/t/${heroId}/dashboard` },
    { icon: LifeBuoy, label: "Hero Support", subLabel: "Tickets & help", href: `/t/${heroId}/support` },
    { icon: Building2, label: "Hero Settings", subLabel: "Location config", href: `/t/${heroId}/settings` },
  ] : [];

  const resourceLinks: QuickLink[] = [
    { icon: Compass, label: "Directory", subLabel: "Public listings", href: "/directory" },
    { icon: LifeBuoy, label: "Help & Support", subLabel: "Request assistance", href: "/settings/admin/crm/requests" },
  ];

  const sections = [
    { title: "Platform Admin", links: adminLinks },
    { title: "Chain Management", links: chainLinks },
    { title: "Hero Location", links: perLocationLinks },
    { title: "Resources", links: resourceLinks },
  ].filter((s) => s.links.length > 0);

  const handleClick = (link: QuickLink, e: React.MouseEvent) => {
    if (!link.href && link.tab && onNavigate) {
      e.preventDefault();
      onNavigate(link.tab);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-2">
              {section.title}
            </h4>
            <div className="space-y-1">
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.label}
                    href={link.href || "#"}
                    onClick={(e) => handleClick(link, e)}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {link.label}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {link.subLabel}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
