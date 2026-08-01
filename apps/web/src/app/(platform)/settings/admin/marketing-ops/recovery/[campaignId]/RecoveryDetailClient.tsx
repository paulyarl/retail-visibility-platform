'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, Sparkles, Save, AlertCircle, FileText, Paperclip, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import recoveryOpsService, { DisputeIntake, RecoveryDraft } from '@/services/RecoveryOpsService';
import { StageBadge } from '@/components/marketing-ops/StageBadge';

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

  const fetchData = useCallback(async () => {
    try {
      const [intakeResult, draftResult] = await Promise.all([
        recoveryOpsService.getIntake(campaignId),
        recoveryOpsService.getDraft(campaignId),
      ]);
      setIntake(intakeResult);
      setDraft(draftResult);
      if (draftResult) {
        const responseSection = draftResult.mkt_deliverable_sections?.find((s) => s.section_type === 'response_draft');
        const guideSection = draftResult.mkt_deliverable_sections?.find((s) => s.section_type === 'submission_guide');
        setResponseDraft(responseSection?.content || '');
        setSubmissionGuide(guideSection?.content || '');
      }
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
        </div>
      </div>
    </div>
  );
}
