"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@mantine/core";
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  Zap,
  Clock,
  ArrowRight,
  BarChart3,
  Globe,
  Settings,
  Store,
  RefreshCw,
  Sparkles,
  Target,
  CreditCard,
  MessageSquare,
  MapPin,
  Rocket,
} from "lucide-react";

import { useTenantComplete } from "@/hooks/dashboard/useTenantComplete";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreStatus } from "@/hooks/useStoreStatus";
import { trackBehaviorClient } from "@/utils/behaviorTracking";
import { platformHomeService } from "@/services/PlatformHomeSingletonService";
import { faqService } from '@/services/FaqService';
import { canManageTenantSettings, isPlatformAdmin, isTenantOwner } from "@/lib/auth/access-control";

import DashboardSkeleton from "./DashboardSkeleton";
import SubscriptionStateBanner from "@/components/subscription/SubscriptionStateBanner";
import LocationStatusBanner from "@/components/tenant/LocationStatusBanner";
import TenantLimitBadge from "@/components/tenant/TenantLimitBadge";
import TierBadge from "./TierBadge";
import UserProfileBadge from "./UserProfileBadge";
import PlanSummaryPanel from "@/components/settings/PlanSummaryPanel";
import { SubscriptionDisplayCard } from "@/components/subscription/SubscriptionDisplayCard";
import HoursStatusBadge from "@/components/storefront/HoursStatusBadge";

import KpiCard from "./KpiCard";
import MiniAreaChart from "./MiniAreaChart";
import SystemStatusCard from "./SystemStatusCard";
import TaskChecklist from "./TaskChecklist";
import RecommendationCard from "./RecommendationCard";
import GrowthTipCard from "./GrowthTipCard";
import TierHeroIllustration from "./TierHeroIllustration";
import CapabilityShowcase from "./CapabilityShowcase";
import { useAllCapabilities, useMerchantGates } from "@/hooks/tenant-access/useCapabilityAccess";
import CrmTenantWidget from '@/components/crm/CrmTenantWidget';
import BotTenantWidget from '@/components/bot/BotTenantWidget';

interface TenantDashboardV2Props {
  tenantId: string;
}

/* ─── Demo sparkline data (replace with real historical API when available) ─── */
const DEMO_SALES = [1200, 1350, 1280, 1420, 1550, 1480, 1620, 1750, 1680, 1820, 1950, 2100];
const DEMO_ORDERS = [45, 52, 48, 58, 62, 55, 68, 72, 65, 78, 82, 90];
const DEMO_PRODUCTS = [120, 125, 130, 128, 135, 140, 138, 145, 150, 148, 155, 160];
const DEMO_VISITORS = [320, 340, 310, 380, 400, 370, 420, 450, 430, 480, 510, 540];

export default function TenantDashboardV2({ tenantId }: TenantDashboardV2Props) {
  const { user } = useAuth();
  const {
    tenant: tenantData,
    tier,
    usage,
    organizationTenants,
    loading: completeLoading,
    error: completeError,
    refresh: refreshTenantData,
  } = useTenantComplete(tenantId, true);

  const { profile, loading: profileLoading } = useUserProfile();
  const allCaps = useAllCapabilities(tenantId);
  const { gates: merchantGates } = useMerchantGates(tenantId);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [businessProfileLoading, setBusinessProfileLoading] = useState(true);

  const [businessFAQs, setBusinessFAQs] = useState<any>(null);
  const [businessFAQsLoading, setBusinessFAQsLoading] = useState(true);

  const canManageSettings = user ? canManageTenantSettings(user, tenantId) : false;
  const canManageCapabilities = user ? (isPlatformAdmin(user) || isTenantOwner(user)) : false;
  const loading = completeLoading || profileLoading || businessProfileLoading;
  const error = completeError;
  const { status: hoursStatus } = useStoreStatus(tenantId || tenantData?.id || "", false);

  const faqSize = businessFAQs ? (businessFAQs as any).length : 0;

  // console.log(`faqSize: ${faqSize}`);

  /* Track view */
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

  /* Fetch business profile for logo */
  useEffect(() => {
    const fetchBusinessProfile = async () => {
      try {
        const data = await platformHomeService.getTenantProfile(tenantId);
        if (data) setBusinessProfile(data);
      } catch {
        /* ignore */
      } finally {
        setBusinessProfileLoading(false);
      }
    };
    if (tenantId) fetchBusinessProfile();
  }, [tenantId]);

  /* Fetch business profile for logo */
  useEffect(() => {
    const fetchBusinessFAQs = async () => {
      try {
        const data = await faqService.listFAQs(tenantId);
        if (data) setBusinessFAQs(data);
      } catch {
        /* ignore */
      } finally {
        setBusinessFAQsLoading(false);
      }
    };
    if (tenantId) fetchBusinessFAQs();
  }, [tenantId]);

  // Merchant gate settings (tier-filtered merchant preferences)
  const [merchantSettings, setMerchantSettings] = useState<Record<string, boolean>>({});
  const [settingsLoading, setSettingsLoading] = useState(true);


  useEffect(() => {
    if (!tenantId) return;
    faqService.getOptions(tenantId)
      .then(({ settings }) => setMerchantSettings(settings))
      .catch(() => setMerchantSettings({}))
      .finally(() => setSettingsLoading(false));
  }, [tenantId]);

  const canManageFaq = merchantSettings.faq_enabled ?? true;


  if (loading) return <DashboardSkeleton />;
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
  const hasStoreCategory = !!businessProfile?.gbpCategoryId;
  const hasSlug = !!businessProfile?.slug;
  const hasLogo = !!businessProfile?.logo_url;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {businessProfile?.logo_url ? (
                <Link href={`/t/${tenantId}/dashboard`}>
                  <Image
                    src={businessProfile.logo_url}
                    alt={tenantData?.name || "Store"}
                    width={120}
                    height={36}
                    className="object-contain h-9 w-auto"
                  />
                </Link>
              ) : (
                <Link href={`/t/${tenantId}/dashboard`} className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900">{tenantData?.name || "Store"}</span>
                </Link>
              )}
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {[
                { label: "Dashboard", href: `/t/${tenantId}/dashboard`, icon: BarChart3 },
                { label: "Orders", href: `/t/${tenantId}/orders`, icon: ShoppingCart },
                { label: "Products", href: `/t/${tenantId}/items`, icon: Package },
                { label: "Settings", href: `/t/${tenantId}/settings`, icon: Settings },
              ].map((item) => (
                <Link key={item.label} href={item.href}>
                  <Button variant="subtle" size="sm" className="text-gray-600 hover:text-blue-600 hover:bg-blue-50">
                    <item.icon className="w-4 h-4 mr-1.5" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
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

        {/* ── Tier Hero Illustration ── */}
        <div className="mb-6">
          <TierHeroIllustration tier={tier} tenantName={tenantData?.name} />
        </div>

        {/* ── Hero ── */}
        <div className="mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
              Your business is growing.
              <br />
              <span className="text-blue-600">What&apos;s next?</span>
            </h1>
            <p className="text-gray-500 mt-2 text-base sm:text-lg">
              Great work, {firstName}! You&apos;re building something amazing.
            </p>
          </motion.div>
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
            onClick={() => refreshTenantData()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <KpiCard
              label="Total Sales"
              value={`$${((usage?.orders || 0) * 42.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              trend={18}
              trendLabel="vs last month"
              icon={DollarSign}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              sparklineData={DEMO_SALES}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <KpiCard
              label="Orders"
              value={(usage?.orders || 0).toString()}
              trend={14}
              trendLabel="vs last month"
              icon={ShoppingCart}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              sparklineData={DEMO_ORDERS}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <KpiCard
              label="Products Live"
              value={(usage?.activeItems || 0).toString()}
              trend={22}
              trendLabel="vs last month"
              icon={Package}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              sparklineData={DEMO_PRODUCTS}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <KpiCard
              label="Store Visitors"
              value={((usage?.activeItems || 0) * 3.2).toFixed(0)}
              trend={8}
              trendLabel="vs last month"
              icon={Users}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              sparklineData={DEMO_VISITORS}
            />
          </motion.div>
        </div>

        {/* ── 2/3 + 1/3 Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Overview */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Performance Overview</h3>
                    <p className="text-sm text-gray-500">Sales and activity over the last 30 days</p>
                  </div>
                  <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>This Week</option>
                    <option>Last Week</option>
                    <option>This Month</option>
                  </select>
                </div>
                <div className="h-48 w-full flex items-end justify-center overflow-hidden">
                  <MiniAreaChart data={DEMO_SALES} color="#2563eb" width={600} height={180} />
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                    <span className="text-xs text-gray-500">Sales</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span className="text-xs text-gray-500">Previous Period</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Automation Impact */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Automation Impact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2.5 bg-purple-100 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">12.5 hrs</p>
                      <p className="text-xs text-gray-500">Time Saved</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2.5 bg-emerald-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">$2,340</p>
                      <p className="text-xs text-gray-500">Revenue Attributed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="p-2.5 bg-blue-100 rounded-lg">
                      <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">86</p>
                      <p className="text-xs text-gray-500">Orders Automated</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-700"
                        >
                          {i}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Active Workflows</p>
                      <p className="text-xs text-gray-500 truncate">
                        New Order → Payment → Inventory → Customer Notified → Shipped
                      </p>
                    </div>
                    <Link href={`/t/${tenantId}/settings/integrations`}>
                      <Button size="sm" variant="light" className="text-blue-700 bg-blue-100 hover:bg-blue-200">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>


            {/* Systems Operational | Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Help Desk &amp; Bot</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CRM Support Widget */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <CrmTenantWidget tenantId={tenantId} />
                  </div>
                  {/* Bot Widget */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <BotTenantWidget tenantId={tenantId} />
                  </div>
                </div>
              </div>
            </motion.div>
            {/* Capabilities */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Capabilities for You</h3>
                </div>
                {tier && canManageCapabilities && (
                  <PlanSummaryPanel capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} merchantGates={merchantGates} />
                )}
              </div>
            </motion.div>
            {/* Recommendations */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Recommended for You</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RecommendationCard
                    icon={ShoppingCart}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                    title="Recover Abandoned Carts"
                    description="Send emails automatically and recover more sales."
                    cta="Set Up"
                    ctaLink={`/t/${tenantId}/settings/integrations`}
                  />
                  <RecommendationCard
                    icon={Target}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title="Offer Volume Discounts"
                    description="Encourage larger orders and increase average order value."
                    cta="Create Discount"
                    ctaLink={`/t/${tenantId}/settings`}
                  />
                  <RecommendationCard
                    icon={Globe}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    title="Sync with Accounting"
                    description="Keep your books updated with real-time sync."
                    cta="Connect Now"
                    ctaLink={`/t/${tenantId}/settings/integrations`}
                  />
                  <RecommendationCard
                    icon={CreditCard}
                    iconBg="bg-violet-50"
                    iconColor="text-violet-600"
                    title="Run Targeted Ads"
                    description="Reach more customers with smart ad campaigns."
                    cta="Create Campaign"
                    ctaLink={`/t/${tenantId}/settings`}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right (1/3) */}
          <div className="space-y-6">

            {/* Quick Links */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.39 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
                <div className="space-y-2">
                  <Link href={`/tenant/${tenantId}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Store className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Storefront</p>
                      <p className="text-xs text-gray-500 truncate">View your public store</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </Link>

                  <Link
                    href={hasPublishedDirectory ? `/directory/${tenantData?.slug || tenantId}` : `/t/${tenantId}/settings/directory`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`p-2 rounded-lg transition-colors ${hasPublishedDirectory ? "bg-emerald-50 group-hover:bg-emerald-100" : "bg-gray-50 group-hover:bg-gray-100"}`}>
                      <MapPin className={`w-4 h-4 ${hasPublishedDirectory ? "text-emerald-600" : "text-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Directory Entry</p>
                      <p className="text-xs text-gray-500 truncate">
                        {hasPublishedDirectory ? "Your public directory listing" : "Publish your directory listing"}
                      </p>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-colors ${hasPublishedDirectory ? "text-gray-400 group-hover:text-emerald-600" : "text-gray-400 group-hover:text-gray-600"}`} />
                  </Link>

                  <Link href={`/t/${tenantId}/settings/users`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Team</p>
                      <p className="text-xs text-gray-500 truncate">Manage your team</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                  </Link>

                  <Link href={`/t/${tenantId}/reviews`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Reviews</p>
                      <p className="text-xs text-gray-500 truncate">Manage customer reviews</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                  </Link>

                  <Link href={`/t/${tenantId}/support`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-600">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Support Hub</p>
                      <p className="text-xs text-gray-500 truncate">Tickets, tasks & help</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 transition-colors" />
                  </Link>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <CapabilityShowcase
                capabilities={allCaps.data}
                tenantId={tenantId}
                canUpgrade={tier?.canUpgrade ?? false}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
              <SystemStatusCard hoursStatus={hoursStatus} syncIssues={0} tenantId={tenantId} />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <TaskChecklist
                tenantId={tenantId}
                hasProducts={hasProducts}
                hasStorefront={!!hasStorefront}
                hasPublishedDirectory={!!hasPublishedDirectory}
                hasFeaturedProducts={!!hasFeaturedProducts}
                hasFAQs={faqSize > 0}
                canManageFaq={canManageFaq}
                locationStatus={tenantData?.locationStatus}
                subscriptionStatus={tenantData?.subscriptionStatus}
                hasHours={hasHours}
                hasMap={hasMap}
                hasStoreCategory={hasStoreCategory}
                hasSlug={hasSlug}
                hasLogo={hasLogo}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <GrowthTipCard />
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

            {/* Subscription display (compact) */}

          </div>
        </div>

        {/* ── Bottom: Subscription Full Card ── */}
        {tier && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
            <SubscriptionDisplayCard
              tenantId={tenantId}
              tierData={{
                tier: tier.effective?.id || "starter",
                subscriptionStatus: tenantData?.subscriptionStatus || "active",
                trialEndsAt: null,
                subscriptionEndsAt: null,
                isChain: tier.isChain,
                organizationId: tier.organizationId,
                organizationName: tier.organizationName,
                organizationTenants,
                organizationTier: tier.organization
                  ? {
                    tier_key: tier.organization.id,
                    display_name: tier.organization.name,
                    price_monthly: tier.organization.limits?.maxProducts ? 299.99 : 0,
                    max_skus: tier.organization.limits?.maxProducts || 0,
                    max_locations: tier.organization.limits?.maxLocations || 0,
                    features: tier.organization.features?.map((f) => ({
                      feature_key: f.id,
                      feature_name: f.name,
                      is_enabled: f.enabled !== false,
                    })),
                  }
                  : undefined,
                tenantTier: tier.tenant
                  ? {
                    tier_key: tier.tenant.id,
                    display_name: tier.tenant.name,
                    price_monthly: tier.tenant.limits?.maxProducts ? 49 : 0,
                    max_skus: tier.tenant.limits?.maxProducts || 0,
                    max_locations: tier.tenant.limits?.maxLocations || 0,
                    features: tier.tenant.features?.map((f) => ({
                      feature_key: f.id,
                      feature_name: f.name,
                      is_enabled: f.enabled !== false,
                    })),
                  }
                  : undefined,
              }}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
