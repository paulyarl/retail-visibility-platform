"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, MapPin, Zap, Sparkles, Users, ShoppingCart, CreditCard,
  AlertCircle,
} from "lucide-react";
import { Modal, Button } from "@mantine/core";
import { toast } from "@/hooks/use-toast";
import { ProtectedCard } from "@/lib/auth/ProtectedCard";
import { AccessPresets } from "@/lib/auth/useAccessControl";
import AccessDenied from "@/components/AccessDenied";
import { organizationsService } from "@/services/OrganizationsSingletonService";

import { useOrgDashboardData } from "@/hooks/organization/useOrgDashboardData";
import { useOrgTabAccess } from "@/hooks/organization/useOrgTabAccess";
import type { TabDef, OrganizationData } from "./types";
import type { OrgTabKey } from "@/services/OrgCapabilityService";

import OrgDashboardHeader from "./OrgDashboardHeader";
import OrgTabNav from "./OrgTabNav";
import OrgSelectionScreen from "./OrgSelectionScreen";
import OrgDashboardSkeleton from "./OrgDashboardSkeleton";
import OrgHeroLocationBanner from "./OrgHeroLocationBanner";
import OrgHeroLocationModal from "./OrgHeroLocationModal";
import OrgKpiGrid from "./OrgKpiGrid";
import OrgUsageGauges from "./OrgUsageGauges";
import OrgQuickActionsBar from "./OrgQuickActionsBar";
import OrgLocationTable from "./OrgLocationTable";
import OrgPropagationPanel from "./OrgPropagationPanel";
import OrgCategorySyncModal from "./OrgCategorySyncModal";
import OrgBillingCard from "./OrgBillingCard";
import OrgCommerceCard from "./OrgCommerceCard";
import OrgTaskChecklist from "./OrgTaskChecklist";
import OrgQuickLinks from "./OrgQuickLinks";
import OrgSystemStatusCard from "./OrgSystemStatusCard";
import OrgRecommendationsCard from "./OrgRecommendationsCard";
import OrgCrmSummaryCard from "./OrgCrmSummaryCard";
import OrgTeamOverview from "./OrgTeamOverview";
import OrgEmployeeDistribution from "./OrgEmployeeDistribution";
import OrgLockedTab from "./OrgLockedTab";
import OrgPlanSummaryPanel from "./OrgPlanSummaryPanel";
import OrgCapabilityRollup from "./OrgCapabilityRollup";
import OrgBotStatusCard from "./OrgBotStatusCard";
import OrgBotWidget from "./OrgBotWidget";
import { useOrgCapabilityRollup } from "@/hooks/organization/useOrgCapabilityRollup";
import { useOrgBotStatus } from "@/hooks/organization/useOrgBotStatus";

const TABS: TabDef[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "propagation", label: "Propagation", icon: Zap },
  { key: "capabilities", label: "Capabilities", icon: Sparkles },
  { key: "team", label: "Team", icon: Users },
  { key: "commerce", label: "Commerce", icon: ShoppingCart },
  { key: "billing", label: "Billing", icon: CreditCard },
];

interface OrganizationDashboardProps {
  tenantId?: string | null;
}

export default function OrganizationDashboard({ tenantId }: OrganizationDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [urlOrgId, setUrlOrgId] = useState<string | null>(null);

  // Parse URL param on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setUrlOrgId(params.get("organizationId"));
    }
  }, []);

  const {
    organizationId, orgData, billingCounters,
    userRole, tenantRole, userCanAccess, isPlatformAdmin, hasOrgContext,
    availableOrganizations, loadingOrganizations, loading, error,
  } = useOrgDashboardData(tenantId, urlOrgId);

  // Handler state
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [settingHero, setSettingHero] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [categorySyncResult, setCategorySyncResult] = useState<any>(null);
  const [showCategorySyncModal, setShowCategorySyncModal] = useState(false);
  const [categorySyncScope, setCategorySyncScope] = useState<"single" | "all">("all");
  const [selectedSyncTenantId, setSelectedSyncTenantId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const heroLocation = useMemo(() => {
    if (!orgData) return undefined;
    return orgData.locationBreakdown.find(
      (loc) => loc.metadata?.isHeroLocation
    );
  }, [orgData]);

  // Org capability + RBAC tab gating
  const {
    visibleTabs, lockedTabs, isTabAllowed, isTabLocked,
    isPanelAllowed, isPropagationAllowed, orgCaps, loading: capsLoading,
  } = useOrgTabAccess(TABS, organizationId || null, tenantRole, isPlatformAdmin);

  // Capability rollup across all locations
  const { data: rollupData, isLoading: rollupLoading } = useOrgCapabilityRollup(organizationId);

  // Bot status across all locations
  const { data: botStatusData, isLoading: botStatusLoading } = useOrgBotStatus(organizationId);

  // Derive tier name for locked tab CTA
  const lockedTierName = billingCounters?.subscriptionTier || orgData?.subscriptionTier || "Chain Professional";

  // Handlers (preserved from original)
  const handleSetHeroLocation = async (newTenantId: string) => {
    if (!newTenantId || !organizationId) return;
    setSettingHero(true);
    try {
      const data = await organizationsService.updateHeroLocation(organizationId, newTenantId);
      if (!data) throw new Error("Failed to set hero location");
      toast({
        title: "Hero location updated",
        description: `${data.heroTenantName} is now the hero location.`,
        variant: "success",
      });
      setShowHeroModal(false);
      // Refresh data via React Query cache invalidation
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSettingHero(false);
    }
  };

  const handleSyncFromHero = async () => {
    if (!organizationId) return;
    setShowConfirmSync(false);
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await organizationsService.syncFromHero(organizationId);
      if (!data) throw new Error("Failed to sync from hero");
      setSyncResult(data);
      toast({ title: "Sync complete", description: "Products synced from hero location.", variant: "success" });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCategoriesToGBP = async () => {
    if (!organizationId) return;
    if (categorySyncScope === "single" && !selectedSyncTenantId) {
      toast({ title: "Select a location", description: "Please select a location for single-location sync.", variant: "warning" });
      return;
    }
    setSyncingCategories(true);
    setCategorySyncResult(null);
    setShowCategorySyncModal(false);
    try {
      const requestBody: any = { strategy: "platform_to_gbp", dryRun: false };
      if (categorySyncScope === "single") {
        requestBody.scope = "tenant";
        requestBody.tenantId = selectedSyncTenantId;
      } else {
        requestBody.scope = "organization";
        requestBody.organizationId = organizationId;
      }
      const data = await organizationsService.mirrorCategories(requestBody);
      if (data) {
        setCategorySyncResult({
          success: true,
          message: `Categories synced to ${categorySyncScope === "single" ? "1 location" : "all locations"} successfully`,
          jobId: data.jobId,
        });
      } else {
        setCategorySyncResult({ success: false, message: "Failed to sync categories" });
      }
    } catch {
      setCategorySyncResult({ success: false, message: "Failed to sync categories to GBP" });
    } finally {
      setSyncingCategories(false);
    }
  };

  // Loading / Error / Access states
  if (loading) return <OrgDashboardSkeleton />;

  if (!userCanAccess) {
    return (
      <AccessDenied
        pageTitle="Organization Dashboard"
        pageDescription="Manage your chain organization"
        title="Access Restricted"
        message="The Organization Dashboard is only available to organization members (must be owner/admin of at least one location)."
        userRole={tenantRole}
        backLink={{ href: "/settings", label: "Back to Settings" }}
      />
    );
  }

  if (!hasOrgContext) {
    return (
      <OrgSelectionScreen
        loading={loadingOrganizations}
        availableOrganizations={availableOrganizations}
        isPlatformAdmin={isPlatformAdmin}
        tenantRole={tenantRole}
      />
    );
  }

  if (error || !orgData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 max-w-md w-full shadow-sm text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <p className="text-rose-600 dark:text-rose-400">{error || "No organization data available"}</p>
          <Button variant="light" className="mt-4" onClick={() => router.push("/settings")}>
            Return to Settings
          </Button>
        </div>
      </div>
    );
  }

  const orgName = billingCounters?.organizationName || orgData.organizationName;
  const tier = billingCounters?.subscriptionTier || orgData.subscriptionTier;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <OrgDashboardHeader
        orgName={orgName}
        organizationId={organizationId}
        tier={tier}
        onRefresh={() => router.refresh()}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OrgTabNav activeTab={activeTab} onTabChange={setActiveTab} tabs={visibleTabs.length > 0 ? visibleTabs : TABS} />

        {/* Locked tab placeholder */}
        {isTabLocked(activeTab as OrgTabKey) && (
          <OrgLockedTab
            tabLabel={TABS.find((t) => t.key === activeTab)?.label || activeTab}
            tierName={lockedTierName}
          />
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && isTabAllowed("overview") && (
          <div className="space-y-6">
            <OrgHeroLocationBanner heroLocation={heroLocation} onChangeHero={() => setShowHeroModal(true)} />
            <OrgKpiGrid billingCounters={billingCounters} orgData={orgData} />
            <OrgQuickActionsBar
              organizationId={organizationId}
              heroLocation={heroLocation}
              onSyncFromHero={() => setShowConfirmSync(true)}
              syncing={syncing}
              onTabChange={setActiveTab}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <OrgUsageGauges billingCounters={billingCounters} orgData={orgData} />
                {isPanelAllowed("recommendations") && (
                  <OrgRecommendationsCard
                    orgData={orgData}
                    heroLocation={heroLocation}
                    onNavigate={setActiveTab}
                  />
                )}
                <OrgBillingCard billingCounters={billingCounters} />
              </div>
              <div className="space-y-6">
                {isPanelAllowed("task_checklist") && (
                  <OrgTaskChecklist
                    orgData={orgData}
                    heroLocation={heroLocation}
                    onNavigate={setActiveTab}
                  />
                )}
                {isPanelAllowed("system_status") && (
                  <OrgSystemStatusCard orgData={orgData} heroLocation={heroLocation} />
                )}
                {isPanelAllowed("quick_links") && (
                  <OrgQuickLinks
                    organizationId={organizationId}
                    heroLocation={heroLocation}
                    isPlatformAdmin={isPlatformAdmin}
                    onNavigate={setActiveTab}
                  />
                )}
                {isPanelAllowed("crm_summary") && (
                  <OrgCrmSummaryCard
                    organizationId={organizationId}
                    locations={orgData.locationBreakdown}
                  />
                )}
                <OrgBotStatusCard
                  data={botStatusData}
                  loading={botStatusLoading}
                />
                <OrgCommerceCard organizationId={organizationId} />
              </div>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === "locations" && isTabAllowed("locations") && (
          <OrgLocationTable
            locations={orgData.locationBreakdown}
            heroLocation={heroLocation}
            maxTotalSKUs={orgData.limits.maxTotalSKUs}
            currentPage={currentPage}
            locationsPerPage={5}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Propagation Tab */}
        {activeTab === "propagation" && isTabAllowed("propagation") && (
          <ProtectedCard tenantId={tenantId} accessOptions={AccessPresets.CHAIN_PROPAGATION} hideWhenDenied={true}>
            <OrgPropagationPanel
              organizationId={organizationId}
              heroLocation={heroLocation}
              syncing={syncing}
              syncResult={syncResult}
              syncingCategories={syncingCategories}
              categorySyncResult={categorySyncResult}
              onSyncFromHero={() => setShowConfirmSync(true)}
              onOpenCategorySync={() => setShowCategorySyncModal(true)}
            />
          </ProtectedCard>
        )}

        {/* Capabilities Tab */}
        {activeTab === "capabilities" && isTabAllowed("capabilities") && (
          <div className="space-y-6">
            <OrgPlanSummaryPanel
              orgCaps={orgCaps}
              loading={capsLoading}
              tierName={lockedTierName}
            />
            <OrgCapabilityRollup
              data={rollupData}
              loading={rollupLoading}
            />
            <OrgBotStatusCard
              data={botStatusData}
              loading={botStatusLoading}
            />
            <OrgSystemStatusCard orgData={orgData} heroLocation={heroLocation} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OrgRecommendationsCard
                orgData={orgData}
                heroLocation={heroLocation}
                onNavigate={setActiveTab}
              />
              <OrgCrmSummaryCard
                organizationId={organizationId}
                locations={orgData.locationBreakdown}
              />
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && isTabAllowed("team") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <OrgTeamOverview locations={orgData.locationBreakdown} />
            </div>
            <div className="space-y-6">
              <OrgEmployeeDistribution locations={orgData.locationBreakdown} />
            </div>
          </div>
        )}

        {/* Commerce Tab */}
        {activeTab === "commerce" && isTabAllowed("commerce") && (
          <div className="space-y-6">
            <OrgCommerceCard organizationId={organizationId} />
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && isTabAllowed("billing") && (
          <div className="space-y-6">
            <OrgBillingCard billingCounters={billingCounters} />
            <OrgUsageGauges billingCounters={billingCounters} orgData={orgData} />
          </div>
        )}
      </main>

      {/* Modals */}
      <OrgHeroLocationModal
        open={showHeroModal}
        locations={orgData.locationBreakdown}
        currentHeroId={heroLocation?.tenantId}
        onSelect={handleSetHeroLocation}
        onClose={() => setShowHeroModal(false)}
        settingHero={settingHero}
      />
      <OrgCategorySyncModal
        open={showCategorySyncModal}
        locations={orgData.locationBreakdown}
        scope={categorySyncScope}
        selectedTenantId={selectedSyncTenantId}
        onScopeChange={setCategorySyncScope}
        onTenantSelect={setSelectedSyncTenantId}
        onSync={handleSyncCategoriesToGBP}
        onClose={() => setShowCategorySyncModal(false)}
        syncing={syncingCategories}
      />
      <Modal
        opened={showConfirmSync}
        onClose={() => setShowConfirmSync(false)}
        title="Confirm Sync"
        centered
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This will copy all products from your hero location to all other locations. Continue?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="light" onClick={() => setShowConfirmSync(false)}>
            Cancel
          </Button>
          <Button variant="gradient" style={{ color: "white" }} onClick={handleSyncFromHero}>
            Sync Now
          </Button>
        </div>
      </Modal>

      {/* Org Bot Widget — fixed bottom-right */}
      {organizationId && orgCaps?.enabled && orgCaps?.orgAvailable && (
        <OrgBotWidget
          organizationId={organizationId}
          orgName={orgName}
          enabled={true}
        />
      )}
    </div>
  );
}
