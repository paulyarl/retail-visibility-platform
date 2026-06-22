"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap, Tag, Package, Globe, Clock, Building, Flag, Users, Palette,
  CheckCircle2, ArrowRight, type LucideIcon,
} from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import type { OrganizationData } from "./types";

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

interface OrgPropagationPanelProps {
  organizationId: string;
  heroLocation?: OrganizationData["locationBreakdown"][0];
  syncing: boolean;
  syncResult: any;
  syncingCategories: boolean;
  categorySyncResult: { success: boolean; message: string; jobId?: string } | null;
  onSyncFromHero: () => void;
  onOpenCategorySync: () => void;
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
          </div>
        )}
      </div>
    </motion.div>
  );
}
