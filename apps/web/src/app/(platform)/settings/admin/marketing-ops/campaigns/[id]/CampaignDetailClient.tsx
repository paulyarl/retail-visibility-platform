'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Pencil, Trash2, ChevronRight, FileText, Download, Send, Sparkles, Store, Link2, Copy, ExternalLink, Flame, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { CampaignDetail, CampaignStage, Audit, MarketingFile, StageHistory, Deliverable, DeliverableType, DeliverableTemplate, DemoStorefrontResult, MarketingRevenue, PromptTemplate, PromptType } from '@/services/MarketingOpsService';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';
import { useStaffUsers, staffDisplayName } from '@/components/marketing-ops/PlatformUserSelect';
import CategoryAnalysisAuditCard from '@/components/marketing-ops/CategoryAnalysisAuditCard';
import CityAnalysisAuditCard from '@/components/marketing-ops/CityAnalysisAuditCard';
import BusinessAnalysisAuditCard from '@/components/marketing-ops/BusinessAnalysisAuditCard';
import SyncReportCard from '@/components/marketing-ops/SyncReportCard';
import CategoryOverviewSection from '@/components/marketing-ops/CategoryOverviewSection';
import CityOverviewSection from '@/components/marketing-ops/CityOverviewSection';
import BusinessContactCard from '@/components/marketing-ops/BusinessContactCard';
import OutreachFollowUpCard from '@/components/marketing-ops/OutreachFollowUpCard';
import ReviewResponsePipelineCard from '@/components/marketing-ops/ReviewResponsePipelineCard';

type Tab = 'overview' | 'audits' | 'files' | 'deliverables' | 'prompts' | 'history' | 'lineage';

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];

/**
 * Stage → prompt_type mapping used by the Prompts tab to surface only
 * stage-relevant prompts for the current campaign.
 *
 * - seek / preview_built / shown: discovery & audit prompts (seek), plus the
 *   scope-specific analysis prompt (category_analysis for category scope,
 *   city_analysis for city scope).
 * - paid / delivered: fulfillment prompts (fulfill), with filter available for
 *   QA on generated responses.
 * - retainer_pitched / retainer_won: retainer prompts.
 * - filter is always available (QA pass on any generated output).
 * - lost / dead / tenant_onboarded: no stage-specific prompts — show all
 *   scope-matching prompts so the operator can still run ad-hoc work.
 */
const STAGE_PROMPT_TYPES: Record<CampaignStage, PromptType[]> = {
  seek: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  preview_built: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  shown: ['seek', 'category_analysis', 'city_analysis', 'filter'],
  paid: ['fulfill', 'filter'],
  delivered: ['fulfill', 'filter'],
  retainer_pitched: ['retainer', 'filter'],
  retainer_won: ['retainer', 'filter'],
  lost: [],
  dead: [],
  tenant_onboarded: [],
};

const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  seek: 'Seek',
  fulfill: 'Fulfill',
  filter: 'Filter',
  retainer: 'Retainer',
  category_analysis: 'Category Analysis',
  city_analysis: 'City Analysis',
};

export default function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const staffUsers = useStaffUsers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState<DeliverableTemplate[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoStorefrontResult | null>(null);
  const [linkingTenant, setLinkingTenant] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revenue, setRevenue] = useState<MarketingRevenue[]>([]);
  const [readinessDialog, setReadinessDialog] = useState<{ toStage: CampaignStage } | null>(null);
  const [readinessChecking, setReadinessChecking] = useState(false);
  const [readinessEnriching, setReadinessEnriching] = useState(false);
  const [contactReadiness, setContactReadiness] = useState<{ hasPhone: boolean; hasEmail: boolean; hasWebsite: boolean; hasSocial: boolean; complete: boolean } | null>(null);
  // Sprint 5: latest city_analysis execution for SyncReportCard
  const [cityScanExecutionId, setCityScanExecutionId] = useState<string | null>(null);
  const [genForm, setGenForm] = useState<{ templateId: string; deliverableType: DeliverableType; isPreview: boolean; content: string }>({
    templateId: '',
    deliverableType: 'review_responses',
    isPreview: true,
    content: '',
  });

  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.getCampaign(campaignId);
      setCampaign(data);
      marketingOpsService.getCampaignRevenue(campaignId).then(setRevenue).catch(() => {});
      // Pre-fetch contact readiness so the warning dot can render on the
      // preview_built pipeline button before the operator clicks it.
      if (data.stage === 'seek') {
        marketingOpsService.getContactReadiness(campaignId).then(setContactReadiness).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Sprint 5: for city-scope campaigns, find the latest execution with a
  // sync_report so the SyncReportCard can render it.
  useEffect(() => {
    if (campaign?.scope !== 'city') {
      setCityScanExecutionId(null);
      return;
    }
    marketingOpsService
      .listExecutions(campaignId)
      .then((execs) => {
        // Find the latest execution that has a sync_report (i.e. syncFromExecution ran).
        const withSync = execs
          .filter((e) => e.sync_report != null)
          .sort((a, b) => (b.executed_at || '').localeCompare(a.executed_at || ''));
        setCityScanExecutionId(withSync[0]?.id ?? null);
      })
      .catch(() => setCityScanExecutionId(null));
  }, [campaign?.scope, campaignId]);

  const fetchDeliverables = useCallback(async () => {
    try {
      const [delivs, templates] = await Promise.all([
        marketingOpsService.listDeliverables(campaignId),
        marketingOpsService.listDeliverableTemplates({ is_active: true }),
      ]);
      setDeliverables(delivs);
      setDeliverableTemplates(templates);
    } catch {
      // silent fail — deliverables tab will show empty state
    }
  }, [campaignId]);

  useEffect(() => {
    if (activeTab === 'deliverables') {
      fetchDeliverables();
    }
  }, [activeTab, fetchDeliverables]);

  // Prompts tab: fetch scope-matching prompt templates. Stage filtering is
  // applied client-side via STAGE_PROMPT_TYPES so the operator sees only
  // stage-relevant prompts for this campaign.
  useEffect(() => {
    if (activeTab !== 'prompts' || !campaign) return;
    setPromptsLoading(true);
    marketingOpsService
      .listPromptTemplates({ scope: campaign.scope, is_active: true })
      .then(setPromptTemplates)
      .catch(() => setPromptTemplates([]))
      .finally(() => setPromptsLoading(false));
  }, [activeTab, campaign]);

  const handleSetHotProspect = async (isHot: boolean) => {
    try {
      await marketingOpsService.setHotProspect(campaignId, { isHot });
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to update hot prospect status');
    }
  };

  const handleClearDeprioritized = async () => {
    try {
      await marketingOpsService.clearDeprioritized(campaignId);
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to clear deprioritization');
    }
  };

  const handleTransition = async (toStage: CampaignStage) => {
    // Soft stage-gate: seek → preview_built with incomplete contact data
    // prompts the operator to enrich or proceed. Cancel aborts the transition.
    if (campaign?.stage === 'seek' && toStage === 'preview_built') {
      setReadinessChecking(true);
      try {
        const readiness = await marketingOpsService.getContactReadiness(campaignId);
        setContactReadiness(readiness);
        if (!readiness.complete) {
          setReadinessDialog({ toStage });
          return; // Wait for operator decision.
        }
      } catch {
        // Readiness check failed — proceed with transition (soft gate).
      } finally {
        setReadinessChecking(false);
      }
    }
    await runTransition(toStage);
  };

  const runTransition = async (toStage: CampaignStage) => {
    setTransitioning(true);
    try {
      await marketingOpsService.transitionStage(campaignId, { to_stage: toStage, trigger_type: 'manual' });
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to transition stage');
    } finally {
      setTransitioning(false);
      setReadinessDialog(null);
    }
  };

  const handleEnrichFromDialog = async () => {
    setReadinessEnriching(true);
    try {
      await marketingOpsService.enrichContact(campaignId, { force: false });
      await fetchCampaign();
      // Re-check readiness after enrichment.
      const readiness = await marketingOpsService.getContactReadiness(campaignId);
      setContactReadiness(readiness);
      if (readiness.complete) {
        // Auto-proceed once enriched.
        setReadinessDialog(null);
        await runTransition('preview_built');
      }
    } catch (err: any) {
      setError(err.message || 'GBP enrichment failed');
    } finally {
      setReadinessEnriching(false);
    }
  };

  const handleGenerateDemo = async () => {
    setGeneratingDemo(true);
    try {
      const result = await marketingOpsService.generateDemoStorefront(campaignId);
      setDemoResult(result);
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to generate demo storefront');
    } finally {
      setGeneratingDemo(false);
    }
  };

  const handleLinkTenant = async () => {
    const tenantId = prompt('Enter the tenant ID to link this campaign to:');
    if (!tenantId?.trim()) return;
    setLinkingTenant(true);
    try {
      await marketingOpsService.linkTenant(campaignId, tenantId.trim());
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to link tenant');
    } finally {
      setLinkingTenant(false);
    }
  };

  const handleCopyDemoUrl = async () => {
    if (!demoResult) return;
    try {
      await navigator.clipboard.writeText(demoResult.demoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await marketingOpsService.deleteCampaign(campaignId);
      window.location.href = '/settings/admin/marketing-ops/campaigns';
    } catch (err: any) {
      setError(err.message || 'Failed to delete campaign');
    }
  };

  const formatCurrency = (cents: number | null) => cents != null ? `$${(cents / 100).toLocaleString()}` : '—';
  const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString() : '—';

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'audits', label: 'Audits', count: campaign?.audits?.length },
    { key: 'files', label: 'Files', count: campaign?.files?.length },
    { key: 'deliverables', label: 'Deliverables', count: deliverables.length },
    { key: 'prompts', label: 'Prompts' },
    { key: 'history', label: 'Stage History', count: campaign?.stage_history?.length },
    { key: 'lineage', label: 'Derived Campaigns', count: campaign?.children?.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Stage-gate readiness dialog — seek → preview_built with no phone/website */}
        {readinessDialog && (
          <div className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Contact incomplete</h3>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              This campaign has no phone or website on file. Enriching from Google Business Profile now gives you the
              right outreach channel before building a preview. You can also proceed anyway.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEnrichFromDialog}
                disabled={readinessEnriching}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {readinessEnriching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Enrich from GBP
              </button>
              <button
                type="button"
                onClick={() => runTransition('preview_built')}
                disabled={transitioning}
                className="rounded-md bg-white dark:bg-neutral-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50"
              >
                Proceed anyway
              </button>
              <button
                type="button"
                onClick={() => setReadinessDialog(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : campaign ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.business_name ?? campaign.category ?? campaign.city}</h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300 uppercase">
                    {campaign.scope}
                  </span>
                  <StageBadge stage={campaign.stage} size="md" />
                  {campaign.is_hot_prospect && !campaign.hot_prospect_deprioritized && (
                    <span
                      title={campaign.hot_prospect_reason ? `Hot prospect: ${campaign.hot_prospect_reason}${campaign.hot_prospect_set_at ? `\nSet: ${new Date(campaign.hot_prospect_set_at).toLocaleString()}` : ''}` : 'Hot prospect'}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      <Flame className="w-3 h-3" />
                      Hot Prospect
                    </span>
                  )}
                  {campaign.hot_prospect_deprioritized && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      Deprioritized
                    </span>
                  )}
                  {campaign.demo_tenant_id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                      <Store className="w-3 h-3" />
                      Demo Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {campaign.scope} · {campaign.category} · {campaign.city}{campaign.neighborhood ? ` · ${campaign.neighborhood}` : ''}
                  {campaign.display_id && ` · ${campaign.display_id}`}
                </p>
                {campaign.parent_campaign && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Derived from{' '}
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${campaign.parent_campaign.id}`}
                      className="text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      {campaign.parent_campaign.business_name ?? campaign.parent_campaign.category ?? campaign.parent_campaign.id}
                    </Link>
                    {' '}(parent · {campaign.parent_campaign.scope})
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateDemo}
                  disabled={generatingDemo}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 dark:bg-neutral-800 dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/20 disabled:opacity-50"
                >
                  <Store className={`w-4 h-4 ${generatingDemo ? 'animate-pulse' : ''}`} />
                  {generatingDemo ? 'Generating...' : campaign.demo_tenant_id ? 'Get Demo Link' : 'Demo Storefront'}
                </button>
                <Link
                  href="/settings/admin/marketing-ops/prompts"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 dark:bg-neutral-800 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/20"
                >
                  <FileText className="w-4 h-4" />
                  Prompt Library
                </Link>
                {!campaign.tenant_id && (
                  <button
                    onClick={handleLinkTenant}
                    disabled={linkingTenant}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700 disabled:opacity-50"
                  >
                    <Link2 className="w-4 h-4" />
                    {linkingTenant ? 'Linking...' : 'Link Tenant'}
                  </button>
                )}
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${campaignId}/edit`}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 dark:bg-neutral-800 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={fetchCampaign}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Demo Storefront Result */}
            {demoResult && (
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 p-4 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">
                      Demo Storefront Active — {demoResult.template.replace(/_/g, ' ')} template
                    </p>
                    <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">
                      Expires {new Date(demoResult.expiresAt).toLocaleDateString()} · share the demo URL with the prospect
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDemoUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-lg hover:bg-teal-100 dark:bg-neutral-800 dark:text-teal-300 dark:border-teal-700"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? 'Copied!' : 'Copy Demo URL'}
                    </button>
                    <a
                      href={demoResult.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Demo
                    </a>
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${campaignId}/demo`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-lg hover:bg-teal-100 dark:bg-neutral-800 dark:text-teal-300 dark:border-teal-700"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Stage Pipeline */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 mb-6">
              <div className="flex items-center gap-1 overflow-x-auto">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const currentIdx = PIPELINE_STAGES.indexOf(campaign.stage);
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  // Warning dot on preview_built when contact readiness is incomplete.
                  const showReadinessDot = stage === 'preview_built'
                    && campaign.stage === 'seek'
                    && contactReadiness != null
                    && !contactReadiness.complete;
                  return (
                    <div key={stage} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => handleTransition(stage)}
                        disabled={transitioning || isCurrent || readinessChecking}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors relative ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : isPast
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-600'
                        }`}
                      >
                        {STAGE_LABELS[stage]}
                        {showReadinessDot && (
                          <span
                            title="Contact data incomplete — stage-gate will prompt"
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-white dark:ring-neutral-800"
                          />
                        )}
                      </button>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 mx-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-neutral-700">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Business Contact card — visible before preview_built so the
                    operator has the right outreach channel at hand. */}
                <BusinessContactCard campaign={campaign} onEnriched={fetchCampaign} />
                {/* Outreach & Follow-Up card — only for business-scope campaigns
                    in outreach stages (preview_built/shown/paid). */}
                {campaign.scope === 'business'
                  && ['preview_built', 'shown', 'paid'].includes(campaign.stage)
                  && (
                    <OutreachFollowUpCard campaign={campaign} onLogged={fetchCampaign} />
                  )}
                {/* Review Response Pipeline — per-platform review response tracking
                    with staged progression (Google → Yelp → Facebook) and follow-up gating. */}
                {campaign.scope === 'business' && (
                  <ReviewResponsePipelineCard campaignId={campaign.id} onRefresh={fetchCampaign} />
                )}
                {/* Deliverable Construction link — visible once the campaign is paid.
                    Opens the post-payment workspace: owner voice calibration, batch
                    review response generation, recovery playbook, and render. */}
                {campaign.scope === 'business'
                  && ['paid', 'delivered'].includes(campaign.stage)
                  && (
                    <Link
                      href={`/settings/admin/marketing-ops/deliverables/${campaign.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    >
                      Deliverable Construction →
                    </Link>
                  )}
                {/* Hot-prospect override controls (Sprint 3) */}
                {campaign.scope === 'business' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleSetHotProspect(!campaign.is_hot_prospect)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border ${
                        campaign.is_hot_prospect
                          ? 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                          : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Flame className="w-3 h-3" />
                      {campaign.is_hot_prospect ? 'Mark not hot' : 'Mark hot'}
                    </button>
                    {campaign.hot_prospect_deprioritized && (
                      <button
                        onClick={handleClearDeprioritized}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        Resume auto-follow-ups
                      </button>
                    )}
                  </div>
                )}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {/* Scope-conditional primary content */}
                {campaign.scope === 'category' ? (
                  <CategoryOverviewSection campaign={campaign} />
                ) : campaign.scope === 'city' ? (
                  <>
                    <CityOverviewSection campaign={campaign} />
                    {cityScanExecutionId && (
                      <div className="mt-4">
                        <SyncReportCard
                          executionId={cityScanExecutionId}
                          campaignId={campaignId}
                          onRefresh={fetchCampaign}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DetailField label="Contact Method" value={campaign.contact_method} />
                    <DetailField label="Contact Info" value={campaign.contact_info} />
                    <DetailField label="Assigned To" value={staffDisplayName(staffUsers, campaign.assigned_to)} />
                    <DetailField label="GBP Claimed" value={campaign.gbp_claimed != null ? (campaign.gbp_claimed ? 'Yes' : 'No') : null} />
                    <DetailField label="Unaddressed Reviews" value={campaign.unaddressed_reviews?.toString()} />
                    <DetailField label="Last Review Date" value={formatDate(campaign.last_review_date)} />
                    <DetailField label="Has Website" value={campaign.has_website} />
                    <DetailField label="NAP Consistent" value={campaign.nap_consistent != null ? (campaign.nap_consistent ? 'Yes' : 'No') : null} />
                    <DetailField label="Pain Score" value={campaign.pain_score?.toString()} />
                    <DetailField label="Estimated Tier" value={campaign.estimated_tier} />
                    <DetailField label="Estimated Fee" value={formatCurrency(campaign.estimated_fee_cents)} />
                    <DetailField label="Amount Paid" value={formatCurrency(campaign.amount_paid_cents)} />
                    <DetailField label="Retainer Status" value={campaign.retainer_status} />
                    <DetailField label="Retainer Amount" value={formatCurrency(campaign.retainer_amount_cents)} />
                    <DetailField label="Retainer Start" value={formatDate(campaign.retainer_start_date)} />
                    <DetailField label="Package Delivered" value={campaign.package_delivered} />
                    <DetailField label="Date Entered" value={formatDate(campaign.date_entered)} />
                    <DetailField label="Date Paid" value={formatDate(campaign.date_paid)} />
                  </div>
                )}

                {/* Pricing & Payment — business scope always; non-business only when tenant-linked */}
                {(campaign.scope === 'business' || campaign.tenant_id) && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pricing & Payment</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DetailField label="Package Price" value={formatCurrency(campaign.package_price_cents ?? null)} />
                    <DetailField label="Service Category" value={campaign.service_category?.replace(/_/g, ' ') ?? null} />
                    <DetailField label="Coupon Code" value={campaign.coupon_code ?? null} />
                    <DetailField label="Subscription Tier ID" value={campaign.subscription_tier_id ?? null} />
                  </div>
                  {revenue.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Revenue Records</h4>
                      <div className="space-y-2">
                        {revenue.map((rev) => (
                          <div key={rev.id} className="flex items-center justify-between border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(rev.amount_cents)}</span>
                              {rev.discount_cents > 0 && (
                                <span className="text-xs text-green-600 dark:text-green-400">-{formatCurrency(rev.discount_cents)} discount</span>
                              )}
                              <span className="text-xs text-gray-400">{rev.gateway_type}</span>
                              {rev.service_category && (
                                <span className="text-xs text-gray-400">{rev.service_category.replace(/_/g, ' ')}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400">{new Date(rev.recorded_at).toLocaleDateString()}</span>
                              <a
                                href={marketingOpsService.getReceiptUrl(campaignId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <Download className="w-3 h-3" />
                                Receipt
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Conversion (Tenant Prospecting Channel) */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Conversion</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DetailField label="Campaign Origin" value={campaign.campaign_origin ?? 'prospect'} />
                    <DetailField label="First Touch" value={campaign.first_touch_source?.replace(/_/g, ' ')} />
                    <DetailField label="Last Touch" value={campaign.last_touch_source?.replace(/_/g, ' ')} />
                    <DetailField label="Tenant Onboarded" value={formatDate(campaign.date_tenant_onboarded ?? null)} />
                    <div>
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Linked Tenant</dt>
                      <dd className="text-sm mt-0.5">
                        {campaign.tenant_id ? (
                          <Link href={`/t/${campaign.tenant_id}/settings/tenant`} className="text-teal-600 dark:text-teal-400 hover:underline">
                            {campaign.tenant_id}
                          </Link>
                        ) : (
                          <span className="text-gray-900 dark:text-white">—</span>
                        )}
                      </dd>
                    </div>
                    <DetailField label="Demo Tenant" value={campaign.demo_tenant_id ?? null} />
                  </div>
                </div>
                {campaign.notes && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-neutral-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{campaign.notes}</p>
                  </div>
                )}
                </div>
              </div>
            )}

            {activeTab === 'audits' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {(campaign.audits ?? []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No audits recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(campaign.audits ?? []).map((audit: Audit) =>
                      audit.platform === 'category_analysis' && audit.audit_data ? (
                        <CategoryAnalysisAuditCard key={audit.id} audit={audit} campaignId={campaignId} />
                      ) : audit.platform === 'business_analysis' && audit.audit_data ? (
                        <BusinessAnalysisAuditCard key={audit.id} audit={audit} campaignId={campaignId} onSynced={fetchCampaign} />
                      ) : audit.platform === 'city_analysis' && audit.audit_data ? (
                        <CityAnalysisAuditCard key={audit.id} audit={audit} />
                      ) : audit.platform === 'city_analysis_summary' ? (
                        <div key={audit.id} className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-blue-900 dark:text-blue-300">City Pain Scan — Summary</span>
                            <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
                          </div>
                          {audit.audit_data?.summary && (
                            <p className="text-sm text-gray-700 dark:text-gray-300">{audit.audit_data.summary}</p>
                          )}
                          {audit.audit_data?.category_rankings?.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">Category rankings ({audit.audit_data.category_rankings.length})</summary>
                              <pre className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 overflow-auto max-h-40">{JSON.stringify(audit.audit_data.category_rankings, null, 2)}</pre>
                            </details>
                          )}
                          {audit.audit_data?.city_metrics && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">City metrics</summary>
                              <pre className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 overflow-auto max-h-40">{JSON.stringify(audit.audit_data.city_metrics, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        <div key={audit.id} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{audit.platform}</span>
                            <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            {audit.review_count != null && <DetailField label="Reviews" value={audit.review_count.toString()} />}
                            {audit.average_rating != null && <DetailField label="Avg Rating" value={audit.average_rating.toString()} />}
                            {audit.unaddressed_reviews != null && <DetailField label="Unaddressed" value={audit.unaddressed_reviews.toString()} />}
                            {audit.photo_count != null && <DetailField label="Photos" value={audit.photo_count.toString()} />}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'files' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {(campaign.files ?? []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No files attached yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(campaign.files ?? []).map((file: MarketingFile) => (
                      <div key={file.id} className="flex items-center justify-between border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{file.file_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{file.file_type} · {file.mime_type ?? 'unknown'}</p>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(file.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'deliverables' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Generated Deliverables</h3>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate New
                  </button>
                </div>

                {deliverables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No deliverables generated yet.</p>
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate First Deliverable
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliverables.map((deliv) => (
                      <div key={deliv.id} className="flex items-center justify-between border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{deliv.file_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {deliv.deliverable_type.replace(/_/g, ' ')} · {deliv.status}
                              {deliv.is_watermarked && ' · watermarked'}
                              {deliv.sent_at && ` · sent via ${deliv.sent_method}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={marketingOpsService.getDeliverableDownloadUrl(deliv.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                          {!deliv.sent_at && (
                            <button
                              onClick={async () => {
                                const method = prompt('Send method (email, sms, hand_delivery, portal_download, other):', 'email');
                                if (!method) return;
                                try {
                                  await marketingOpsService.sendDeliverable(deliv.id, method);
                                  await fetchDeliverables();
                                } catch (err: any) {
                                  setError(err.message || 'Failed to mark as sent');
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                              <Send className="w-3 h-3" />
                              Mark Sent
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prompts' && campaign && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Compatible Prompts</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Filtered by scope <span className="font-medium uppercase">{campaign.scope}</span> and stage{' '}
                      <span className="font-medium">{campaign.stage}</span>. Opening a workspace pre-selects this campaign.
                    </p>
                  </div>
                  <Link
                    href={`/settings/admin/marketing-ops/prompts?campaignId=${campaignId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 dark:bg-neutral-800 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-900/20"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Browse all prompts
                  </Link>
                </div>

                {promptsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : (() => {
                  const allowedTypes = STAGE_PROMPT_TYPES[campaign.stage] ?? [];
                  const stageRelevant = allowedTypes.length
                    ? promptTemplates.filter((t) => allowedTypes.includes(t.prompt_type))
                    : promptTemplates;
                  if (stageRelevant.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <FileText className="w-10 h-10 text-gray-300 dark:text-neutral-600 mb-2" />
                        <p className="text-sm text-gray-400">
                          No active {campaign.scope}-scope prompts for the <span className="font-medium">{campaign.stage}</span> stage.
                        </p>
                        <Link
                          href={`/settings/admin/marketing-ops/prompts?campaignId=${campaignId}`}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Sparkles className="w-3 h-3" />
                          Create a prompt
                        </Link>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stageRelevant.map((t) => (
                        <div key={t.id} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</h4>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300">
                              {PROMPT_TYPE_LABELS[t.prompt_type]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-neutral-900/50 rounded p-2 line-clamp-3 flex-1">
                            {t.body.slice(0, 160)}{t.body.length > 160 ? '...' : ''}
                          </p>
                          {t.output_schema?.name && (
                            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">Schema: {t.output_schema.name}</p>
                          )}
                          <Link
                            href={`/settings/admin/marketing-ops/prompts/${t.id}?campaignId=${campaignId}`}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 self-start"
                          >
                            Open Workspace
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {(campaign.stage_history ?? []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No stage transitions recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {(campaign.stage_history ?? []).map((hist: StageHistory) => (
                      <div key={hist.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {hist.from_stage && <StageBadge stage={hist.from_stage} />}
                          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-neutral-600" />
                          <StageBadge stage={hist.to_stage} />
                        </div>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(hist.changed_at).toLocaleString()}</span>
                        {hist.notes && <span className="text-xs text-gray-500 dark:text-gray-400">· {hist.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lineage' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {/* Parent */}
                {campaign.parent_campaign ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Parent Campaign</h3>
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${campaign.parent_campaign.id}`}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {campaign.parent_campaign.business_name ?? campaign.parent_campaign.category ?? campaign.parent_campaign.id}
                      </span>
                      <span className="text-xs text-gray-400 uppercase">{campaign.parent_campaign.scope}</span>
                      <StageBadge stage={campaign.parent_campaign.stage} size="sm" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-4">This campaign has no parent (it is a top-level campaign).</p>
                )}

                {/* Children */}
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Derived Campaigns</h3>
                {(campaign.children ?? []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">
                    No derived campaigns yet. Use the &ldquo;Campaign&rdquo; button on a competitor in the Audits tab
                    (category analysis) to spawn a business-scope child campaign.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(campaign.children ?? []).map((child) => (
                      <Link
                        key={child.id}
                        href={`/settings/admin/marketing-ops/campaigns/${child.id}`}
                        className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {child.business_name ?? child.id}
                          </span>
                          <span className="text-xs text-gray-400 uppercase flex-shrink-0">{child.scope}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StageBadge stage={child.stage} size="sm" />
                          {child.created_at && (
                            <span className="text-xs text-gray-400">{new Date(child.created_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400">Campaign not found.</p>
          </div>
        )}
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generate Deliverable</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template (optional)</label>
                <select
                  value={genForm.templateId}
                  onChange={(e) => setGenForm({ ...genForm, templateId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">No template (use default layout)</option>
                  {deliverableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deliverable Type</label>
                <select
                  value={genForm.deliverableType}
                  onChange={(e) => setGenForm({ ...genForm, deliverableType: e.target.value as DeliverableType })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="review_responses">Review Responses</option>
                  <option value="service_menu">Service Menu</option>
                  <option value="gbp_audit">GBP Audit Report</option>
                  <option value="testimonial_cards">Testimonial Cards</option>
                  <option value="nap_report">NAP Consistency Report</option>
                  <option value="seo_content">SEO Content</option>
                  <option value="lead_magnet">Lead Magnet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (optional)</label>
                <textarea
                  rows={4}
                  value={genForm.content}
                  onChange={(e) => setGenForm({ ...genForm, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Custom content for the deliverable. Leave empty to use execution output."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_preview"
                  checked={genForm.isPreview}
                  onChange={(e) => setGenForm({ ...genForm, isPreview: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_preview" className="text-sm text-gray-700 dark:text-gray-300">
                  Generate as preview (watermarked)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setGenerating(true);
                  try {
                    await marketingOpsService.generateDeliverable(campaignId, {
                      templateId: genForm.templateId || undefined,
                      deliverableType: genForm.deliverableType,
                      isPreview: genForm.isPreview,
                      content: genForm.content || undefined,
                    });
                    setShowGenerateModal(false);
                    await fetchDeliverables();
                  } catch (err: any) {
                    setError(err.message || 'Failed to generate deliverable');
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={generating}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{value ?? '—'}</dd>
    </div>
  );
}
