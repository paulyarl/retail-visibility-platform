"use client";

import Link from "next/link";
import { RefreshCw, Zap, Users, ShoppingCart, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@mantine/core";

interface OrgQuickActionsBarProps {
  organizationId: string;
  heroLocation?: { tenantId: string; tenantName: string };
  onSyncFromHero: () => void;
  syncing: boolean;
  onTabChange?: (tab: string) => void;
}

export default function OrgQuickActionsBar({
  organizationId,
  heroLocation,
  onSyncFromHero,
  syncing,
  onTabChange,
}: OrgQuickActionsBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="gradient"
          style={{ color: "white" }}
          size="sm"
          onClick={onSyncFromHero}
          disabled={syncing || !heroLocation}
          leftSection={<RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />}
        >
          {syncing ? "Syncing..." : "Sync from Hero"}
        </Button>

        {onTabChange && (
          <Button
            variant="light"
            size="sm"
            onClick={() => onTabChange("propagation")}
            leftSection={<Zap className="w-4 h-4" />}
          >
            Propagation
          </Button>
        )}

        {onTabChange && (
          <Button
            variant="light"
            size="sm"
            onClick={() => onTabChange("team")}
            leftSection={<Users className="w-4 h-4" />}
          >
            Team
          </Button>
        )}

        <Link href={`/settings/organization/commerce?organizationId=${organizationId}`}>
          <Button variant="light" size="sm" leftSection={<ShoppingCart className="w-4 h-4" />}>
            Commerce
          </Button>
        </Link>

        {onTabChange && (
          <Button
            variant="light"
            size="sm"
            onClick={() => onTabChange("billing")}
            leftSection={<CreditCard className="w-4 h-4" />}
          >
            Billing
          </Button>
        )}

        <Link href="/settings/subscription" className="ml-auto">
          <Button variant="subtle" size="sm" rightSection={<ArrowRight className="w-4 h-4" />}>
            Upgrade Plan
          </Button>
        </Link>
      </div>
    </div>
  );
}
