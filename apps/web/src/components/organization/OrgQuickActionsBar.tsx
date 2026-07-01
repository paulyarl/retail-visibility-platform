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
  readOnly?: boolean;
}

export default function OrgQuickActionsBar({
  organizationId,
  heroLocation,
  onSyncFromHero,
  syncing,
  onTabChange,
  readOnly,
}: OrgQuickActionsBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="gradient"
          style={{ color: "white" }}
          size="sm"
          onClick={onSyncFromHero}
          disabled={readOnly || syncing || !heroLocation}
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
            disabled={readOnly}
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
            disabled={readOnly}
          >
            Team
          </Button>
        )}

        <Link href={readOnly ? "#" : `/settings/organization/commerce?organizationId=${organizationId}`}>
          <Button variant="light" size="sm" leftSection={<ShoppingCart className="w-4 h-4" />} disabled={readOnly}>
            Commerce
          </Button>
        </Link>

        {onTabChange && (
          <Button
            variant="light"
            size="sm"
            onClick={() => onTabChange("billing")}
            leftSection={<CreditCard className="w-4 h-4" />}
            disabled={readOnly}
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
