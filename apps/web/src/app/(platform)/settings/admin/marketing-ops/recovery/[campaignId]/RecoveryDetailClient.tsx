'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, Sparkles, Save, AlertCircle, FileText, Paperclip, MessageSquare, Copy, Upload, Play, X } from 'lucide-react';
import Link from 'next/link';
import recoveryOpsService, { DisputeIntake, RecoveryDraft } from '@/services/RecoveryOpsService';
import { StageBadge } from '@/components/marketing-ops/StageBadge';
import ChannelReadinessWidget from '@/components/marketing-ops/ChannelReadinessWidget';

export default function RecoveryDetailClient({ campaignId }: { campaignId: string }) {
  const [intake, setIntake] = useState<DisputeIntake | null>(null);
  const [draft, setDraft] = useState<RecoveryDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [responseDraft, setResponseDraft] = useState('');
  const [submissionGuide, setSubmissionGuide] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<{
    deliveryLog: {
      id: string;
      delivery_status: string | null;
      delivery_attempts: number | null;
      last_delivery_error: string | null;
      retry_after: string | null;
      created_at: string;
      notes: string;
    } | null;
    deliverable: {
      id: string;
      delivery_status: string | null;
      delivered_at: string | null;
    } | null;
  } | null>(null);
  const [resending, setResending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [intakeResult, draftResult, deliveryResult] = await Promise.all([
        recoveryOpsService.getIntake(campaignId),
        recoveryOpsService.getDraft(campaignId),
        recoveryOpsService.getDeliveryStatus(campaignId).catch(() => null),
      ]);
      setIntake(intakeResult);
      setDraft(draftResult);
      if (draftResult) {
        const responseSection = draftResult.mkt_deliverable_sections?.find((s) => s.section_type === 'response_draft');
        const guideSection = draftResult.mkt_deliverable_sections?.find((s) => s.section_type === 'submission_guide');
        setResponseDraft(responseSection?.content || '');
        setSubmissionGuide(guideSection?.content || '');
      }
      if (deliveryResult) setDeliveryStatus(deliveryResult);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery campaign');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setActionMessage(null);
    try {
      await recoveryOpsService.editDraft(campaignId, { responseDraft, submissionGuide });
      setEditing(false);
      setActionMessage({ type: 'success', text: 'Draft saved successfully.' });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to save draft' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this resolution draft? This will transition to Resolved & Closed and email the owner.')) return;
    setApproving(true);
    setActionMessage(null);
    try {
      await recoveryOpsService.approveDraft(campaignId);
      setActionMessage({ type: 'success', text: 'Resolution approved and delivered to owner.' });
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to approve draft' });
    } finally {
      setApproving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate the resolution draft? The current draft will be archived and a new AI execution will be enqueued.')) return;
    setRegenerating(true);
    setActionMessage(null);
    try {
      await recoveryOpsService.regenerate(campaignId);
      setActionMessage({ type: 'success', text: 'Regeneration enqueued. Check back in a few minutes for the new draft.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to regenerate draft' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleResendDelivery = async () => {
    if (!confirm('Resend the resolution email to the owner? This will reset the retry counter and attempt a new delivery.')) return;
    setResending(true);
    setActionMessage(null);
    try {
      const result = await recoveryOpsService.resendDelivery(campaignId);
      if (result.success) {
        setActionMessage({ type: 'success', text: `Delivery resent successfully (attempt ${result.attempts}).` });
      } else {
        setActionMessage({ type: 'error', text: `Resend failed: ${result.error || 'Unknown error'}` });
      }
      fetchData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to resend delivery' });
    } finally {
      setResending(false);
    }
  };

  const handleCopyPrompt = async () => {
    setCopying(true);
    setActionMessage(null);
    try {
      const result = await recoveryOpsService.getPromptText(campaignId);
      await navigator.clipboard.writeText(result.renderedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setActionMessage({ type: 'success', text: 'Prompt copied to clipboard. Paste it into any external AI (ChatGPT, Claude, etc.) and import the JSON result.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to copy prompt' });
    } finally {
      setCopying(false);
    }
  };

  const handleImportExternal = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    setImportError(null);
    setActionMessage(null);
    try {
      const result = await recoveryOpsService.importExternalResult(campaignId, importJson.trim());
      if (result.passed) {
        setActionMessage({ type: 'success', text: 'External result imported successfully. The draft is now ready for review.' });
        setShowImportModal(false);
        setImportJson('');
        fetchData();
      } else {
        setImportError(result.errors?.join('; ') || 'Imported output failed schema validation');
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to import external result');
    } finally {
      setImporting(false);
    }
  };

  const handleExecuteDirect = async () => {
    if (!confirm('Execute the Recovery AI Agent directly via API? This will call the configured AI provider and generate a draft immediately.')) return;
    setExecuting(true);
    setActionMessage(null);
    try {
      const result = await recoveryOpsService.executeDirect(campaignId);
      if (result.passed) {
        setActionMessage({ type: 'success', text: 'AI execution completed. The draft is now ready for review.' });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: result.errors?.join('; ') || 'AI output failed validation. Check filter flags and try again.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to execute directly' });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const draftSection = (type: string) => draft?.mkt_deliverable_sections?.find((s) => s.section_type === type);
  const isDrafted = draft?.status === 'drafted';
  const isApproved = draft?.status === 'approved';

  return (
    <div className="space-y-6">
      {/* Action banner */}
      {actionMessage && (
        <div className={`rounded-lg p-4 border ${
          actionMessage.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <p className={`text-sm ${actionMessage.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {actionMessage.text}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/admin/marketing-ops" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            ← Back to Dashboard
          </Link>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Campaign Cycle banner — makes the recovery outreach model explicit */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Recovery Campaign Cycle</h2>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
          Recovery campaigns have their own outreach cycle — distinct from the review pipeline&apos;s Opener + Follow-Up pages.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="font-medium text-gray-900 dark:text-white">1. Audit</div>
            <div className="text-gray-500 dark:text-gray-400">Complaint identified</div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="font-medium text-gray-900 dark:text-white">2. Framework</div>
            <div className="text-gray-500 dark:text-gray-400">Response preview</div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="font-medium text-gray-900 dark:text-white">3. Outreach Opener</div>
            <div className="text-gray-500 dark:text-gray-400">Day 1 email (intake link)</div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="font-medium text-gray-900 dark:text-white">4. Follow-Ups</div>
            <div className="text-gray-500 dark:text-gray-400">Day 2 SMS + Day 4 DM</div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
            <div className="font-medium text-gray-900 dark:text-white">5. Resolution</div>
            <div className="text-gray-500 dark:text-gray-400">AI draft → Approve → Deliver</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
          <strong>Outreach Opener + Follow-Ups</strong> = the Day 1/2/4 cascade (email → SMS → DM), auto-fired by the scheduler.
          This is the recovery equivalent of the review pipeline&apos;s Opener + Follow-Up workspace pages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Complaint + Intake */}
        <div className="lg:col-span-1 space-y-6">
          {/* Intake panel */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Owner Intake</h3>
            </div>
            {intake ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Owner Statement</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{intake.owner_statement}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Proposed Resolution</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{intake.proposed_resolution}</p>
                </div>
                {intake.service_date && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Service Date</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{intake.service_date}</p>
                  </div>
                )}
                {intake.status_flag && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status Flag</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{intake.status_flag}</p>
                  </div>
                )}
                {/* Evidence payload — only for profile_repair intakes */}
                {(intake as any).intake_kind === 'profile_repair' && (intake as any).evidence_payload && (
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 p-3 space-y-2">
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Evidence Payload</p>
                    {(() => {
                      const ev = (intake as any).evidence_payload as any;
                      return (
                        <>
                          {ev.proof_of_location && ev.proof_of_location.length > 0 && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>Proof of location:</strong> {ev.proof_of_location.length} document(s)
                            </p>
                          )}
                          {ev.storefront_photos && ev.storefront_photos.length > 0 && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>Storefront photos:</strong> {ev.storefront_photos.length} photo(s)
                            </p>
                          )}
                          {ev.google_profile_id && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>Google profile ID:</strong> {ev.google_profile_id}
                            </p>
                          )}
                          {ev.suspension_notice_details && (ev.suspension_notice_details.date || ev.suspension_notice_details.quoted_reason) && (
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400"><strong>Suspension notice:</strong></p>
                              {ev.suspension_notice_details.date && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 ml-2">Date: {ev.suspension_notice_details.date}</p>
                              )}
                              {ev.suspension_notice_details.quoted_reason && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 ml-2">Reason: {ev.suspension_notice_details.quoted_reason}</p>
                              )}
                            </div>
                          )}
                          {ev.duplicate_listing_url && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <strong>Duplicate listing URL:</strong>{' '}
                              <a href={ev.duplicate_listing_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{ev.duplicate_listing_url}</a>
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Submitted</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {intake.submitted_at ? new Date(intake.submitted_at).toLocaleString() : 'Not yet submitted'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No intake submitted yet.</p>
            )}
          </div>

          {/* Attachments panel */}
          {intake && intake.mkt_dispute_attachments && intake.mkt_dispute_attachments.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Attachments</h3>
              </div>
              <div className="space-y-2">
                {intake.mkt_dispute_attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{a.file_name}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase">{a.file_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel Readiness — shows email/phone/social availability +
              cascade readiness + intake email status. */}
          <ChannelReadinessWidget
            campaignId={campaignId}
            intakeEmail={intake?.owner_email ?? null}
          />
        </div>

        {/* Right column: Draft + Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Draft panel */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resolution Draft</h3>
                {draft && <StageBadge stage={draft.status === 'approved' ? 'resolved_and_closed' : 'final_resolution_drafted'} />}
              </div>
              {isDrafted && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Edit
                </button>
              )}
            </div>

            {draft ? (
              <div className="space-y-4">
                {/* Response Draft */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Response Draft</p>
                  {editing ? (
                    <textarea
                      value={responseDraft}
                      onChange={(e) => setResponseDraft(e.target.value)}
                      rows={8}
                      className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {responseDraft || draftSection('response_draft')?.content || '(empty)'}
                    </p>
                  )}
                </div>

                {/* Submission Guide */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Submission Guide</p>
                  {editing ? (
                    <textarea
                      value={submissionGuide}
                      onChange={(e) => setSubmissionGuide(e.target.value)}
                      rows={6}
                      className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {submissionGuide || draftSection('submission_guide')?.content || '(empty)'}
                    </p>
                  )}
                </div>

                {/* Edit save/cancel */}
                {editing && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setResponseDraft(draftSection('response_draft')?.content || '');
                        setSubmissionGuide(draftSection('submission_guide')?.content || '');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-700 dark:text-gray-200 dark:border-neutral-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No resolution draft yet.</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  The AI agent will generate a draft after the owner submits their intake.
                </p>
              </div>
            )}
          </div>

          {/* AI Workspace — Dual Mode (mirrors review pipeline) */}
          {intake && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Workspace</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">Dual-mode: Copy-Paste Bridge or Direct API</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Copy Prompt */}
                <button
                  onClick={handleCopyPrompt}
                  disabled={copying || editing}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700/50 disabled:opacity-50 transition-colors"
                >
                  <Copy className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {copied ? 'Copied!' : 'Copy Prompt'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Copy rendered prompt for external AI
                  </span>
                </button>

                {/* Import External Result */}
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={editing}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700/50 disabled:opacity-50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Import External Result</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Paste JSON from an external AI run
                  </span>
                </button>

                {/* Direct Execute */}
                <button
                  onClick={handleExecuteDirect}
                  disabled={executing || editing}
                  className="flex flex-col items-center gap-2 p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700/50 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {executing ? 'Executing...' : 'Execute via API'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Run the AI agent directly in-platform
                  </span>
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Copy-Paste Bridge:</strong> Copy the prompt, run it in any external AI (ChatGPT, Claude, etc.),
                  then import the JSON result. The platform validates it against the recovery_resolution schema.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  <strong>Direct API:</strong> Executes the AI agent immediately via the configured provider.
                  No need to wait for the scheduler job.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {isDrafted && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleApprove}
                  disabled={approving || editing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approving ? 'Approving...' : 'Approve & Deliver'}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating || editing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-700 dark:text-gray-200 dark:border-neutral-600 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {regenerating ? 'Regenerating...' : 'Regenerate Draft'}
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Approving will transition to Resolved &amp; Closed and email the resolution to the owner.
                Regenerating will archive this draft and re-run the AI agent.
              </p>
            </div>
          )}

          {isApproved && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  This resolution has been approved and delivered to the owner.
                </p>
              </div>
            </div>
          )}

          {/* Delivery Status Panel — shows delivery outcome + resend for failed deliveries */}
          {isApproved && deliveryStatus && (
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Delivery Status</h3>
              {(() => {
                const log = deliveryStatus.deliveryLog;
                const del = deliveryStatus.deliverable;
                const status = log?.delivery_status || del?.delivery_status || 'sent';
                const attempts = log?.delivery_attempts ?? 0;
                const error = log?.last_delivery_error;
                const deliveredAt = del?.delivered_at;
                const retryAfter = log?.retry_after;

                if (status === 'sent') {
                  return (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Delivered
                      </span>
                      {deliveredAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(deliveredAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                }

                if (status === 'failed' || status === 'retrying') {
                  const isPermanent = status === 'failed' && attempts >= 3;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                          isPermanent
                            ? 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
                            : 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          {isPermanent ? 'Delivery Failed (Permanent)' : 'Retrying'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Attempts: {attempts}/3
                        </span>
                        {retryAfter && !isPermanent && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Next retry: {new Date(retryAfter).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {error && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                          <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">{error}</p>
                        </div>
                      )}
                      <button
                        onClick={handleResendDelivery}
                        disabled={resending}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                        {resending ? 'Resending...' : 'Resend Email'}
                      </button>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Resending will reset the retry counter and attempt a new delivery immediately.
                      </p>
                    </div>
                  );
                }

                return (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Status: {status}
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Import External Result Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Import External AI Result</h3>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setImportError(null); setImportJson(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Paste the JSON returned by the external AI (e.g., ChatGPT, Claude) after running the recovery resolution prompt.
                The platform will validate it against the <code className="text-xs bg-gray-100 dark:bg-neutral-700 px-1 py-0.5 rounded">recovery_resolution</code> schema.
              </p>
              <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium mb-1">Expected JSON shape:</p>
                <pre className="overflow-x-auto">{`{
  "recovery_resolution": {
    "deliverableText": "<string >= 50 chars>",
    "submissionGuide": "<string >= 20 chars>"
  }
}`}</pre>
              </div>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={10}
                placeholder='{"recovery_resolution": {"deliverableText": "...", "submissionGuide": "..."}}'
                className="w-full text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {importError && (
                <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{importError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-neutral-700">
              <button
                onClick={() => { setShowImportModal(false); setImportError(null); setImportJson(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-700 dark:text-gray-200 dark:border-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleImportExternal}
                disabled={importing || !importJson.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing...' : 'Import Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
