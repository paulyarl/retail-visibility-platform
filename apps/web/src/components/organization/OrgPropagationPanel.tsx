"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, Tag, Package, Globe, Clock, Building, Flag, Users, Palette,
  CheckCircle2, ArrowRight, AlertTriangle, XCircle, type LucideIcon,
} from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import type { OrganizationData } from "./types";
import type { OrgProductTypeRollup } from "@/services/OrgCapabilityService";

interface PropCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  borderClass: string;
  title: string;
  status: string;
  statusVariant: "success" | "default";
  description: string;
  subLabel: string;
  disabled?: boolean;
  actionLabel: string;
  onAction?: () => void;
  actionHref?: string;
  syncing?: boolean;
  resultMessage?: { success: boolean; message: string; jobId?: string } | null;
}

function PropCard({
  icon: Icon, iconBg, iconColor, borderClass, title, status, statusVariant,
  description, subLabel, disabled, actionLabel, onAction, actionHref, syncing, resultMessage,
}: PropCardProps) {
  return (
    <div className={`p-4 bg-white dark:bg-gray-900 rounded-xl border-2 ${borderClass} transition-colors`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{title}</h4>
            <Badge variant={statusVariant} className="text-xs">{status}</Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{description}</p>
          <p className="text-xs text-gray-400">{subLabel}</p>
        </div>
      </div>
      {actionHref ? (
        <Link href={actionHref}>
          <Button variant="gradient" style={{ color: "white" }} size="sm" className="w-full" disabled={disabled}>
            {actionLabel}
          </Button>
        </Link>
      ) : (
        <Button
          variant="gradient"
          style={{ color: "white" }}
          size="sm"
          className="w-full"
          disabled={disabled || syncing}
          onClick={onAction}
        >
          {syncing ? "Syncing..." : actionLabel}
        </Button>
      )}
      {resultMessage && (
        <div className={`mt-2 p-2 rounded text-xs ${resultMessage.success ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-400"}`}>
          {resultMessage.success ? "✅" : "❌"} {resultMessage.message}
          {resultMessage.jobId && <div className="text-xs mt-1">Job ID: {resultMessage.jobId}</div>}
        </div>
      )}
    </div>
  );
}

function SyncSkippedBreakdown({ skipped }: { skipped: Array<{ item_id?: string; tenantId?: string; sku?: string; reason: string }> }) {
  const byReason: Record<string, Array<{ sku?: string; tenantId?: string }>> = {};
  for (const s of skipped) {
    const key = s.reason;
    if (!byReason[key]) byReason[key] = [];
    byReason[key].push({ sku: s.sku, tenantId: s.tenantId });
  }

  const productTypeSkips = Object.entries(byReason).filter(([reason]) => reason.startsWith("product_type_not_allowed"));
  const otherSkips = Object.entries(byReason).filter(([reason]) => !reason.startsWith("product_type_not_allowed"));

  return (
    <div className="mt-3 space-y-2">
      {productTypeSkips.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Product Type Mismatches ({productTypeSkips.reduce((sum, [, items]) => sum + items.length, 0)} items skipped)
            </p>
          </div>
          <div className="space-y-1.5">
            {productTypeSkips.map(([reason, items]) => {
              const productType = reason.replace("product_type_not_allowed: ", "");
              return (
                <div key={reason} className="text-xs text-amber-700 dark:text-amber-500">
                  <span className="font-medium capitalize">{productType}</span> products skipped — {items.length} item{items.length !== 1 ? "s" : ""}
                  <span className="text-amber-500 ml-1">
                    ({items.slice(0, 3).map((i) => i.sku).join(", ")}{items.length > 3 ? `, +${items.length - 3} more` : ""})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {otherSkips.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Other Skips ({otherSkips.reduce((sum, [, items]) => sum + items.length, 0)} items)
          </p>
          <div className="space-y-1">
            {otherSkips.map(([reason, items]) => (
              <p key={reason} className="text-xs text-gray-500 dark:text-gray-500">
                {reason}: {items.length} item{items.length !== 1 ? "s" : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface OrgPropagationPanelProps {
  organizationId: string;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  syncing: boolean;
  syncResult: any;
  syncingCategories: boolean;
  categorySyncResult: { success: boolean; message: string; jobId?: string } | null;
  onSyncFromHero: () => void;
  onOpenCategorySync: () => void;
  productTypeRollup?: OrgProductTypeRollup | undefined;
}

export default function OrgPropagationPanel({
  organizationId,
  heroLocation,
  syncing,
  syncResult,
  syncingCategories,
  categorySyncResult,
  onSyncFromHero,
  onOpenCategorySync,
  productTypeRollup,
}: OrgPropagationPanelProps) {
  const heroId = heroLocation?.tenantId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Propagation Control Panel
              <Badge variant="warning" className="text-xs">Admin Only</Badge>
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Advanced tools for managing product distribution</p>
          </div>
        </div>

        {/* Product Type Awareness Section */}
        {productTypeRollup && productTypeRollup.totalLocations > 0 && (
          <div className="mb-6 p-4 bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-violet-600" />
              <h4 className="text-xs font-semibold text-violet-900 dark:text-violet-300 uppercase tracking-wide">
                Product Type Compatibility
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {productTypeRollup.locations.map((loc) => {
                const isDisabled = !loc.enabled;
                const hasRestrictions = loc.enabled && !loc.isFlexible && loc.allowedTypes.length > 0 && loc.allowedTypes.length < 4;
                return (
                  <div
                    key={loc.tenantId}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      isDisabled
                        ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500"
                        : hasRestrictions
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                    }`}
                    title={
                      isDisabled
                        ? "Product types disabled"
                        : hasRestrictions
                          ? `Allows: ${loc.allowedTypes.join(", ")}`
                          : "All product types allowed"
                    }
                  >
                    <span className="font-medium">{loc.tenantName}</span>
                    {isDisabled ? (
                      <span className="ml-1.5">— disabled</span>
                    ) : hasRestrictions ? (
                      <span className="ml-1.5">— {loc.allowedTypes.join(", ")} only</span>
                    ) : (
                      <span className="ml-1.5">— all types</span>
                    )}
                  </div>
                );
              })}
            </div>
            {productTypeRollup.summary.misalignedCount > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {productTypeRollup.summary.misalignedCount} location{productTypeRollup.summary.misalignedCount !== 1 ? "s" : ""} have restricted product types — some items may be skipped during sync
              </div>
            )}
          </div>
        )}

        {/* Group 1: Product & Catalog */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Product & Catalog Management
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PropCard
              icon={Tag} iconBg="bg-purple-100 dark:bg-purple-900/20" iconColor="text-purple-600"
              borderClass="border-purple-200 dark:border-purple-800 hover:border-purple-400"
              title="Categories" status="ACTIVE" statusVariant="success"
              description="Propagate product categories and Google taxonomy alignments"
              subLabel="Bulk propagation"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#categories` : undefined}
            />
            <PropCard
              icon={Package} iconBg="bg-blue-100 dark:bg-blue-900/20" iconColor="text-blue-600"
              borderClass="border-blue-200 dark:border-blue-800 hover:border-blue-400"
              title="Products/SKUs" status="ACTIVE" statusVariant="success"
              description="Propagate individual or bulk products to locations"
              subLabel="Single or bulk"
              disabled={!heroLocation}
              actionLabel="Sync All from Hero"
              onAction={onSyncFromHero}
              syncing={syncing}
            />
            <PropCard
              icon={Globe} iconBg="bg-indigo-100 dark:bg-indigo-900/20" iconColor="text-indigo-600"
              borderClass="border-indigo-200 dark:border-indigo-800 hover:border-indigo-400"
              title="GBP Category Sync" status="ACTIVE" statusVariant="success"
              description="Sync product categories to Google Business Profile"
              subLabel="Organization-wide sync"
              disabled={!organizationId}
              actionLabel="Sync to GBP"
              onAction={onOpenCategorySync}
              syncing={syncingCategories}
              resultMessage={categorySyncResult}
            />
          </div>
        </div>

        {/* Group 2: Business Information */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Business Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PropCard
              icon={Clock} iconBg="bg-green-100 dark:bg-green-900/20" iconColor="text-green-600"
              borderClass="border-green-200 dark:border-green-800 hover:border-green-400"
              title="Business Hours" status="NEW" statusVariant="default"
              description="Propagate regular and special hours to all locations"
              subLabel="Hours template"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#hours` : undefined}
            />
            <PropCard
              icon={Building} iconBg="bg-cyan-100 dark:bg-cyan-900/20" iconColor="text-cyan-600"
              borderClass="border-cyan-200 dark:border-cyan-800 hover:border-cyan-400"
              title="Business Profile" status="NEW" statusVariant="default"
              description="Propagate business description, attributes, and settings"
              subLabel="Profile info"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#profile` : undefined}
            />
          </div>
        </div>

        {/* Group 3: Configuration & Settings */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Configuration & Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PropCard
              icon={Flag} iconBg="bg-indigo-100 dark:bg-indigo-900/20" iconColor="text-indigo-600"
              borderClass="border-indigo-200 dark:border-indigo-800 hover:border-indigo-400"
              title="Feature Flags" status="NEW" statusVariant="default"
              description="Enable or disable features across all locations"
              subLabel="Centralized control"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#flags` : undefined}
            />
            <PropCard
              icon={Users} iconBg="bg-pink-100 dark:bg-pink-900/20" iconColor="text-pink-600"
              borderClass="border-pink-200 dark:border-pink-800 hover:border-pink-400"
              title="User Roles & Permissions" status="NEW" statusVariant="default"
              description="Propagate user invitations and role assignments"
              subLabel="Team management"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#roles` : undefined}
            />
          </div>
        </div>

        {/* Group 4: Branding & Assets */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Branding & Assets
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PropCard
              icon={Palette} iconBg="bg-orange-100 dark:bg-orange-900/20" iconColor="text-orange-600"
              borderClass="border-orange-200 dark:border-orange-800 hover:border-orange-400"
              title="Brand Assets" status="NEW" statusVariant="default"
              description="Propagate logos, colors, and branding elements"
              subLabel="Brand consistency"
              disabled={!heroLocation}
              actionLabel="Configure →"
              actionHref={heroId ? `/t/${heroId}/settings/propagation#brand` : undefined}
            />
          </div>
        </div>

        {/* Consolidated Sync Result Display */}
        {syncResult && (
          <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Sync Complete!
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-emerald-800 dark:text-emerald-400">
              <div>
                <p className="font-semibold">Hero Location</p>
                <p>{syncResult.hero_location?.tenantName || "Unknown"}</p>
              </div>
              <div>
                <p className="font-semibold">Source Items</p>
                <p>{syncResult.hero_location?.item_count || 0}</p>
              </div>
              <div>
                <p className="font-semibold">Created</p>
                <p className="text-emerald-700 dark:text-emerald-500">✅ {syncResult.summary.created}</p>
              </div>
              <div>
                <p className="font-semibold">Skipped</p>
                <p className="text-amber-700 dark:text-amber-500">⏭️ {syncResult.summary.skipped}</p>
              </div>
            </div>

            {/* Product Type Mismatch Breakdown */}
            {syncResult.results?.skipped && syncResult.results.skipped.length > 0 && (
              <SyncSkippedBreakdown skipped={syncResult.results.skipped} />
            )}

            {/* Errors */}
            {syncResult.results?.errors && syncResult.results.errors.length > 0 && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-400">
                    {syncResult.results.errors.length} Error{syncResult.results.errors.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {syncResult.results.errors.slice(0, 10).map((err: any, i: number) => (
                    <p key={i} className="text-xs text-rose-700 dark:text-rose-500">
                      SKU {err.sku}: {err.error}
                    </p>
                  ))}
                  {syncResult.results.errors.length > 10 && (
                    <p className="text-xs text-rose-500">...and {syncResult.results.errors.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
