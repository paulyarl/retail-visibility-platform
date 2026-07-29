'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Pencil, Trash2, ChevronRight, FileText, Download, Send, Sparkles, Store, Link2, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { CampaignDetail, CampaignStage, Audit, MarketingFile, StageHistory, Deliverable, DeliverableType, DeliverableTemplate, DemoStorefrontResult } from '@/services/MarketingOpsService';
import { StageBadge, STAGE_LABELS } from '@/components/marketing-ops/StageBadge';

type Tab = 'overview' | 'audits' | 'files' | 'deliverables' | 'history';

const PIPELINE_STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];

export default function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState<DeliverableTemplate[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoStorefrontResult | null>(null);
  const [linkingTenant, setLinkingTenant] = useState(false);
  const [copied, setCopied] = useState(false);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

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

  const handleTransition = async (toStage: CampaignStage) => {
    setTransitioning(true);
    try {
      await marketingOpsService.transitionStage(campaignId, { to_stage: toStage, trigger_type: 'manual' });
      await fetchCampaign();
    } catch (err: any) {
      setError(err.message || 'Failed to transition stage');
    } finally {
      setTransitioning(false);
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
    { key: 'history', label: 'Stage History', count: campaign?.stage_history?.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/settings/admin/marketing-ops/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
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
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.business_name}</h1>
                  <StageBadge stage={campaign.stage} size="md" />
                  {campaign.demo_tenant_id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400">
                      <Store className="w-3 h-3" />
                      Demo Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {campaign.category} · {campaign.city}{campaign.neighborhood ? ` · ${campaign.neighborhood}` : ''}
                  {campaign.display_id && ` · ${campaign.display_id}`}
                </p>
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
                  return (
                    <div key={stage} className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => handleTransition(stage)}
                        disabled={transitioning || isCurrent}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : isPast
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-600'
                        }`}
                      >
                        {STAGE_LABELS[stage]}
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
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailField label="Contact Method" value={campaign.contact_method} />
                  <DetailField label="Contact Info" value={campaign.contact_info} />
                  <DetailField label="Assigned To" value={campaign.assigned_to} />
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
            )}

            {activeTab === 'audits' && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
                {(campaign.audits ?? []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No audits recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {(campaign.audits ?? []).map((audit: Audit) => (
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
                    ))}
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
