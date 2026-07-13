"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  ShoppingCart,
  Package,
  ArrowRight,
  Globe,
  Store,
  RefreshCw,
  Sparkles,
  Bot,
  Lock,
} from "lucide-react";

import { useTenantComplete } from "@/hooks/dashboard/useTenantComplete";
import DemoBadge from "@/components/shared/DemoBadge";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { trackBehaviorClient } from "@/utils/behaviorTracking";
import { platformHomeService } from "@/services/PlatformHomeSingletonService";
import { faqService } from '@/services/FaqService';

import DashboardSkeleton from "./DashboardSkeleton";
import SubscriptionStateBanner from "@/components/subscription/SubscriptionStateBanner";
import LocationStatusBanner from "@/components/tenant/LocationStatusBanner";
import TenantLimitBadge from "@/components/tenant/TenantLimitBadge";
import TierBadge from "./TierBadge";
import UserProfileBadge from "./UserProfileBadge";
import { SubscriptionDisplayCard } from "@/components/subscription/SubscriptionDisplayCard";
import HoursStatusBadge from "@/components/storefront/HoursStatusBadge";

import KpiCard from "./KpiCard";
import SystemStatusCard from "./SystemStatusCard";
import TaskChecklist from "./TaskChecklist";
import GrowthTipCard from "./GrowthTipCard";
import CapabilityShowcase from "./CapabilityShowcase";
import ConstraintAlertBanner from "./ConstraintAlertBanner";
import QuickLinksCard from "./QuickLinksCard";
import StoreAccessCard from "./StoreAccessCard";
import { useAllCapabilities } from "@/hooks/tenant-access/useCapabilityAccess";
import type { TipContext } from "@/lib/growth-tips/tipEngine";
import CrmTenantWidget from '@/components/crm/CrmTenantWidget';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';
import { useMerchantGates } from '@/hooks/tenant-access/useCapabilityAccess';
import { botService } from '@/services/BotService';
import PublicBotWidget from '@/components/bot/PublicBotWidget';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { useTenantBehaviorAccess } from '@/hooks/tenant-access/useTenantBehaviorAccess';

interface TenantDashboardV2Props {
  tenantId: string;
}

/* ─── Sparkline data placeholder (sparklines removed until real historical API is available) ─── */

export default function TenantDashboardV2({ tenantId }: TenantDashboardV2Props) {
  const { user } = useAuth();
  const {
    tenant: tenantData,
    tier,
    usage,
    organizationTenants,
    loading: completeLoading,
    primaryLoading,
    error: completeError,
    refresh: refreshTenantData,
  } = useTenantComplete(tenantId, true);

  const { profile, loading: profileLoading } = useUserProfile();
  const allCaps = useAllCapabilities(tenantId);
  const { gates: merchantGates } = useMerchantGates(tenantId);
  const { canEdit } = useTenantBehaviorAccess(tenantId);

  // Subscription-status-aware capability flags
  const chatbotEnabled = allCaps.data?.chatbotOptions?.enabled ?? true;
  const crmEnabled = allCaps.data?.crmOptions?.enabled ?? true;
  const isWritable = allCaps.data?.subscriptionContext?.writable ?? true;

  const [
    { data: businessProfile },
    { data: businessFAQs },
    { data: faqOptions },
    { data: botConfig },
    { data: botStats },
    { data: crmStats },
  ] = useQueries({
    queries: [
      {
        queryKey: ['tenant', 'business-profile', tenantId],
        queryFn: () => platformHomeService.getTenantProfile(tenantId),
        enabled: !!tenantId,
        staleTime: 60 * 1000,
        retry: 0,
      },
      {
        queryKey: ['tenant', 'faqs', tenantId],
        queryFn: () => faqService.listFAQs(tenantId),
        enabled: !!tenantId,
        staleTime: 60 * 1000,
        retry: 0,
      },
      {
        queryKey: ['tenant', 'faq-options', tenantId],
        queryFn: () => faqService.getOptions(tenantId),
        enabled: !!tenantId,
        staleTime: 60 * 1000,
        retry: 0,
      },
      {
        queryKey: ['bot', 'config', tenantId],
        queryFn: () => botService.getConfig(tenantId),
        enabled: !!tenantId,
        staleTime: 60 * 1000,
        retry: 0,
      },
      {
        queryKey: ['bot', 'stats', tenantId],
        queryFn: () => botService.getDashboardStats(tenantId),
        enabled: !!tenantId,
        staleTime: 60 * 1000,
        retry: 0,
      },
      {
        queryKey: ['crm', 'stats', tenantId],
        queryFn: () => crmTenantCrmService.getStats(),
        enabled: !!user,
        staleTime: 30 * 1000,
        retry: 0,
        throwOnError: false,
      },
    ],
  });

  const loading = primaryLoading;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const error = completeError;
  const { status: hoursStatus } = useStoreStatus(tenantId || tenantData?.id || "", false);

  const faqSize = businessFAQs ? (businessFAQs as any).length : 0;
  const merchantSettings = faqOptions?.settings ?? {};

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTenantData();
    } finally {
      setIsRefreshing(false);
    }
  };
  useEffect(() => {
    if (tenantId) {
      trackBehaviorClient({
        entityType: "dashboard",
        entityId: `tenant_dashboard_${tenantId}`,
        entityName: "Tenant Dashboard",
        pageType: "tenant_dashboard",
        context: { tenantId },
      });
    }
  }, [tenantId]);

  const canManageFaq = merchantSettings.faq_enabled ?? true;


  if (loading) {
    return <DashboardSkeleton />;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-xl font-bold text-rose-600 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const firstName = user?.firstName || profile?.name?.split(" ")[0] || "there";
  const hasProducts = !!usage?.totalItems && usage.totalItems > 0;
  const hasStorefront = tenantData?.statusInfo?.showStorefront;
  const hasPublishedDirectory = tenantData?.hasPublishedDirectory;
  const hasFeaturedProducts = businessProfile?.hasFeaturedProducts;
  //new tasks
  const hasHours = !!businessProfile?.hours;
  const hasMap = !!businessProfile?.latitude && !!businessProfile?.longitude;
  const hasStoreCategory = !!(businessProfile as any)?.gbpCategoryId;
  const hasSlug = !!businessProfile?.slug;
  const hasLogo = !!businessProfile?.logo_url;

  // ─── Growth Tip Context ───
  const subscriptionStatus = tenantData?.subscriptionStatus || 'active';
  const isTrial = subscriptionStatus === 'trialing' || subscriptionStatus === 'trial';
  const trialEndsAt = (tenantData as any)?.effectiveExpiresAt;
  const trialDaysLeft = isTrial && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const tipContext: TipContext = {
    tierLevel: tier?.effective?.level || 'discovery',
    tierName: tier?.effective?.name || 'Discovery',
    canUpgrade: tier?.canUpgrade ?? false,
    upgradeOptions: tier?.upgradeOptions ?? [],
    capabilities: allCaps.data ?? null,
    usage: {
      totalItems: usage?.totalItems ?? 0,
      activeItems: usage?.activeItems ?? 0,
      orders: usage?.orders ?? 0,
    },
    businessState: {
      hasProducts,
      hasStorefront: !!hasStorefront,
      hasPublishedDirectory: !!hasPublishedDirectory,
      hasFAQs: faqSize > 0,
      hasHours,
      hasLogo,
      hasMap,
      hasStoreCategory,
      hasSlug,
    },
    subscriptionStatus,
    isTrial,
    trialDaysLeft,
    isReadOnly: !isWritable,
    isPastDue: subscriptionStatus === 'past_due',
    locationStatus: tenantData?.locationStatus || 'active',
    reopeningDate: (tenantData?.statusInfo as any)?.reopeningDate ?? null,
    tenantId,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {businessProfile?.logo_url ? (
                <Link href={`/t/${tenantId}/dashboard`} className="min-w-0">
                  <Image
                    src={businessProfile.logo_url}
                    alt={tenantData?.name || "Store"}
                    width={120}
                    height={36}
                    className="object-contain h-9 w-auto max-w-full"
                  />
                </Link>
              ) : (
                <Link href={`/t/${tenantId}/dashboard`} className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900 truncate">{tenantData?.name || "Store"}</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {profile && <UserProfileBadge profile={profile} />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Banners ── */}
        <SubscriptionStateBanner tenantId={tenantId} />
        {tenantData?.locationStatus && (
          <LocationStatusBanner
            locationStatus={tenantData.locationStatus as any}
            reopeningDate={tenantData.statusInfo?.reopeningDate}
            tenantName={tenantData.name || "This Location"}
            tenantId={tenantId}
            variant="full"
          />
        )}

        {/* ── Page Title ── */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight flex items-center gap-2 flex-wrap">
            {tenantData?.name || "Store"} dashboard
            <DemoBadge isDemo={tenantData?.isDemo} demoExpiresAt={tenantData?.demoExpiresAt} size="md" />
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Welcome back, {firstName}. Here&apos;s what&apos;s happening today.
          </p>
        </div>

        {/* ── Meta Bar: Tier + Limits ── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {tier?.organization?.name && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100">
              <Globe className="w-3.5 h-3.5" />
              {tier.organization.name}
            </span>
          )}
          <TenantLimitBadge variant="compact" showUpgrade={true} />
          {tier && <TierBadge tier={tier} showDetails={false} />}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Constraint Alert Banner ── */}
        <ConstraintAlertBanner capabilities={allCaps.data} tenantId={tenantId} />

        {/* ── KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <KpiCard
              label="Orders"
              value={(usage?.orders || 0).toString()}
              icon={ShoppingCart}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <KpiCard
              label="Products Live"
              value={(usage?.activeItems || 0).toString()}
              icon={Package}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
          </motion.div>
        </div>

        {/* ── 2/3 + 1/3 Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left (2/3) — Support & Help Desk, Plan Summary, Task Checklist */}
          <div className="lg:col-span-2 space-y-6">
            {/* Support & Help Desk — combined card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                {/* Header: Support + Help Desk links */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Support & Help Desk</h3>
                  </div>
                  <Link href={`/t/${tenantId}/support`} className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
                    All tickets
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* CRM Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{crmStats?.open_ticket_count ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Tickets</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{crmStats?.pending_task_count ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Tasks</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{crmStats?.open_inquiry_count ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Inquiries</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{crmStats?.unread_alert_count ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Alerts</p>
                  </div>
                </div>

                {/* CRM Widget — always available as platform communication channel */}
                <CrmTenantWidget tenantId={tenantId} isWritable={isWritable} />

                {/* Divider */}
                <div className="border-t border-gray-100 my-4" />

                {/* Bot Stat Badges */}
                {chatbotEnabled ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-medium text-gray-700">Store Assistant</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          botConfig?.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            botConfig?.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
                          }`} />
                          {botConfig?.status === 'active' ? 'Online' : 'Inactive'}
                        </span>
                      </div>
                      <Link href={`/t/${tenantId}/bot`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                        Configure bot
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{botStats?.totalConversations ?? 0}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Conversations</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{botStats?.activeConversations ?? 0}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Active</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{botStats?.resolvedByFaq ?? 0}</p>
                        <p className="text-xs text-gray-500 mt-0.5">FAQ Resolved</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{botStats?.avgRating ? botStats.avgRating.toFixed(1) : '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Avg Rating</p>
                      </div>
                    </div>

                    {/* Inline bot preview */}
                    {botConfig?.status === 'active' && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-500">Live preview</span>
                          <span className="text-xs text-gray-400">Test the exact experience your customers see</span>
                        </div>
                        <PublicBotWidget tenantId={tenantId} pageContext="dashboard" inline />
                      </div>
                    )}

                    {/* Bot footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{botConfig?.botName || 'Assistant'}</span>
                      <Link href={`/t/${tenantId}/bot/conversations`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                        View conversations →
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-50 border border-gray-200">
                    <Lock className="w-5 h-5 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 text-center">Chatbot is unavailable with your current subscription plan.</p>
                    <Link href={`/t/${tenantId}/settings/subscription`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-2">
                      Upgrade plan →
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Plan Summary — slim widget */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
              <PlanSummaryWidget
                capabilities={allCaps.data}
                loading={allCaps.loading}
                tenantId={tenantId}
                merchantGates={merchantGates}
              />
            </motion.div>

            {/* Task Checklist */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
              <TaskChecklist tenantId={tenantId} />
            </motion.div>
          </div>

          {/* Right (1/3) — Quick Links, Capabilities, System Status, Growth, Hours */}
          <div className="space-y-6">

            {/* Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}>
              <QuickLinksCard tenantId={tenantId} />
            </motion.div>

            {/* Stores — grouped visibility for Featured Store + Feature Store */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }}>
              <StoreAccessCard tenantId={tenantId} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <CapabilityShowcase
                capabilities={allCaps.data}
                tenantId={tenantId}
                canUpgrade={tier?.canUpgrade ?? false}
                readOnly={!canEdit}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
              <SystemStatusCard tenantId={tenantId} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <GrowthTipCard tipContext={tipContext} />
            </motion.div>

            {/* Hours Status */}
            {hoursStatus && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">Business Hours</h3>
                  <HoursStatusBadge status={hoursStatus} size="lg" />
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* ── Bottom: Subscription Full Card ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
          <SubscriptionDisplayCard
            tenantId={tenantId}
            capabilities={allCaps.data}
            tierData={{
              tier: tier?.effective?.id || allCaps.data?.tierKey || tenantData?.subscriptionTier || "starter",
              subscriptionStatus: tenantData?.subscriptionStatus || "active",
              trialEndsAt: (tenantData as any)?.effectiveExpiresAt || null,
              subscriptionEndsAt: tenantData?.subscriptionEndsAt || null,
              isChain: tier?.isChain || false,
              organizationId: tier?.organizationId || tenantData?.organizationId || undefined,
              organizationName: tier?.organizationName || undefined,
              organizationTenants,
              organizationTier: tier?.rawTierData?.organizationTier,
              tenantTier: tier?.rawTierData?.tenantTier,
            }}
          />
        </motion.div>
      </main>

    </div>
  );
}
