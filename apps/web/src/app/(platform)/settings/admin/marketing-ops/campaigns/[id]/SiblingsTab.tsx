'use client';

/**
 * SiblingsTab — multi-archetype sibling campaigns panel
 *
 * Shows all sibling campaigns for the same business prospect, with:
 *   - Archetype badges per sibling
 *   - Primary sibling indicator
 *   - Stage + engagement cycle
 *   - "Create Sibling" button (opens triage alternatives)
 *   - "Cycle to Next Engagement" button (visible only at delivered/retainer_won)
 *
 * Sprint 3 — S3.3.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRightCircle, Repeat, Users, Plus, X } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService from '@/services/MarketingOpsService';
import { StageBadge } from '@/components/marketing-ops/StageBadge';
import ArchetypeBadge from '@/components/marketing-ops/ArchetypeBadge';

interface SiblingsTabProps {
  campaignId: string;
  campaign: any;
  onRefresh: () => void;
}

interface SiblingSummary {
  id: string;
  businessName: string | null;
  campaignCategory: string;
  repairTrack: string | null;
  stage: string;
  isPrimarySibling: boolean;
  engagementCycle: number;
  businessProspectId: string | null;
  estimatedFeeCents: number | null;
  archetype: string | null;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  review_management: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recovery_management: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  triage_management: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  profile_repair: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function SiblingsTab({ campaignId, campaign, onRefresh }: SiblingsTabProps) {
  const [siblings, setSiblings] = useState<SiblingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycling, setCycling] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    archetype: 'A5',
    campaignCategory: 'profile_repair',
    repairTrack: '',
    repairIssueType: '',
    notes: '',
  });

  const fetchSiblings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.listSiblings(campaignId);
      setSiblings(result ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load siblings');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchSiblings(); }, [fetchSiblings]);

  const handleCycle = async () => {
    setCycling(true);
    try {
      await marketingOpsService.cycleToNextEngagement(campaignId);
      onRefresh();
      fetchSiblings();
    } catch (err: any) {
      setError(err.message || 'Failed to cycle to next engagement');
    } finally {
      setCycling(false);
    }
  };

  // Cycle button appears only at delivered/retainer_won stage
  const canCycle = campaign?.stage === 'delivered' || campaign?.stage === 'retainer_won';

  const handleManualCreate = async () => {
    setFormError(null);
    if (!form.campaignCategory) {
      setFormError('Campaign category is required');
      return;
    }
    setCreating(true);
    try {
      await marketingOpsService.createSiblingCampaign(campaignId, {
        archetype: form.archetype,
        campaignCategory: form.campaignCategory,
        repairTrack: form.repairTrack || undefined,
        repairIssueType: form.repairIssueType || undefined,
        notes: form.notes || undefined,
      });
      setShowManualForm(false);
      setForm({ archetype: 'A5', campaignCategory: 'profile_repair', repairTrack: '', repairIssueType: '', notes: '' });
      onRefresh();
      fetchSiblings();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create sibling campaign');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading siblings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const prospectId = campaign?.businessProspectId ?? siblings[0]?.businessProspectId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Sibling Campaigns
          </h3>
          {prospectId && (
            <p className="text-xs text-gray-500 mt-0.5">
              Prospect ID: <span className="font-mono">{prospectId}</span>
            </p>
          )}
        </div>
        {canCycle && (
          <button
            onClick={handleCycle}
            disabled={cycling}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {cycling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
            Cycle to Next Engagement
          </button>
        )}
        <button
          onClick={() => setShowManualForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
        >
          {showManualForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          Create Sibling Manually
        </button>
      </div>

      {/* Manual sibling creation form */}
      {showManualForm && (
        <div className="rounded-lg bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Manual Sibling Creation</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              Use this when signals didn't catch a pain dimension — e.g. an explicit request from the prospect during a call.
            </p>
          </div>
          {formError && (
            <div className="text-xs text-red-700 dark:text-red-400">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Archetype</label>
              <select
                value={form.archetype}
                onChange={(e) => setForm((f) => ({ ...f, archetype: e.target.value }))}
                className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
              >
                <option value="A1">A1 — Review Gap</option>
                <option value="A2">A2 — BBB Crisis</option>
                <option value="A3">A3 — Listing Drift</option>
                <option value="A4">A4 — CTA Gap</option>
                <option value="A5">A5 — Dual Triage</option>
                <option value="A6">A6 — Product Visibility</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Campaign Category</label>
              <select
                value={form.campaignCategory}
                onChange={(e) => setForm((f) => ({ ...f, campaignCategory: e.target.value, repairTrack: '' }))}
                className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
              >
                <option value="profile_repair">profile_repair</option>
                <option value="review_management">review_management</option>
                <option value="recovery_management">recovery_management</option>
                <option value="triage_management">triage_management</option>
              </select>
            </div>
          </div>
          {form.campaignCategory === 'profile_repair' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Repair Track (optional)</label>
                <select
                  value={form.repairTrack}
                  onChange={(e) => setForm((f) => ({ ...f, repairTrack: e.target.value }))}
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                >
                  <option value="">— (decide later)</option>
                  <option value="standard">standard</option>
                  <option value="escalated">escalated</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Repair Issue Type (optional)</label>
                <input
                  type="text"
                  value={form.repairIssueType}
                  onChange={(e) => setForm((f) => ({ ...f, repairIssueType: e.target.value }))}
                  placeholder="e.g. NAP drift, broken website"
                  className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Prospect requested review management during call on 8/8"
              rows={2}
              className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCreate}
              disabled={creating}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Sibling'}
            </button>
            <button
              onClick={() => setShowManualForm(false)}
              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Siblings list */}
      {siblings.length === 0 ? (
        <div className="text-center py-12 rounded-lg bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No sibling campaigns yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Use the triage card (seek stage) or the "Create Sibling Manually" button above to add campaigns for this prospect.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {siblings.map((sibling) => (
            <div
              key={sibling.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-neutral-700 flex items-center justify-center">
                  {sibling.isPrimarySibling ? (
                    <span className="text-xs font-bold text-green-600">P</span>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">S</span>
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/settings/admin/marketing-ops/campaigns/${sibling.id}`}
                    className="font-medium text-sm text-gray-900 dark:text-white hover:text-blue-600 truncate"
                  >
                    {sibling.businessName || 'Unnamed Campaign'}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    {sibling.archetype && (
                      <ArchetypeBadge archetype={sibling.archetype} />
                    )}
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[sibling.campaignCategory] ?? 'bg-gray-100 text-gray-700'}`}>
                      {sibling.campaignCategory.replace(/_/g, ' ')}
                    </span>
                    {sibling.repairTrack && (
                      <span className="text-[10px] text-gray-500">
                        track: {sibling.repairTrack}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      cycle {sibling.engagementCycle}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StageBadge stage={sibling.stage as any} />
                {sibling.estimatedFeeCents != null && (
                  <span className="text-xs text-gray-500">
                    ${(sibling.estimatedFeeCents / 100).toFixed(0)}
                  </span>
                )}
                {sibling.isPrimarySibling && (
                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Primary
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Multi-gallery token link */}
      {prospectId && siblings.length > 1 && (
        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3">
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
            <ArrowRightCircle className="w-3.5 h-3.5" />
            Multi-Diagnostic Gallery
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            This prospect has {siblings.length} siblings. Generate a multi-gallery token to share all diagnostic reports in one link — issued with an SMS-friendly short URL (/g/…).
          </p>
        </div>
      )}
    </div>
  );
}
