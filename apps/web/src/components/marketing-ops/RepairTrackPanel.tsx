'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle } from 'lucide-react';
import marketingOpsService, { Campaign, RepairTrack } from '@/services/MarketingOpsService';

interface RepairTrackPanelProps {
  campaign: Campaign;
  onRefresh: () => void;
}

export default function RepairTrackPanel({ campaign, onRefresh }: RepairTrackPanelProps) {
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchTrack, setSwitchTrack] = useState<RepairTrack>('standard');
  const [switchReason, setSwitchReason] = useState('');
  const [switchIssueType, setSwitchIssueType] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (campaign.campaign_category !== 'profile_repair') return null;

  const currentTrack = (campaign as any).repair_track as RepairTrack | null;
  const issueType = (campaign as any).repair_issue_type as string | null;
  const trackDecidedAt = (campaign as any).track_decided_at as string | null;
  const trackDecisionReason = (campaign as any).track_decision_reason as string | null;

  const handleSwitch = async () => {
    if (!switchReason.trim()) {
      setError('A reason is required for track switches');
      return;
    }
    setSwitching(true);
    setError(null);
    try {
      await marketingOpsService.switchRepairTrack(campaign.id, {
        to_track: switchTrack,
        reason: switchReason,
        issue_type: switchIssueType || undefined,
      });
      setShowSwitchDialog(false);
      setSwitchReason('');
      setSwitchIssueType('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to switch track');
    } finally {
      setSwitching(false);
    }
  };

  const STANDARD_ISSUES = ['nap_drift', 'unclaimed_profile', 'missing_category', 'missing_hours', 'platform_gap'];
  const ESCALATED_ISSUES = ['suspension', 'duplicate_listing', 'hijacked_listing', 'ownership_dispute', 'address_verification_block'];

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Repair Track</h3>
        </div>
        {currentTrack && (
          <button
            onClick={() => {
              setSwitchTrack(currentTrack === 'standard' ? 'escalated' : 'standard');
              setShowSwitchDialog(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Switch Track
          </button>
        )}
      </div>

      {/* Current track status */}
      <div className="space-y-3">
        {!currentTrack ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Triage — Track Not Yet Decided</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Run the triage prompt to get an AI recommendation, then confirm a track.
              </p>
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            currentTrack === 'escalated'
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <CheckCircle className={`w-4 h-4 ${
              currentTrack === 'escalated' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`} />
            <div>
              <p className={`text-xs font-medium ${
                currentTrack === 'escalated' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
              }`}>
                {currentTrack === 'escalated' ? 'Escalated (Recovery Pipeline)' : 'Standard (Review Pipeline)'}
              </p>
              {issueType && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Issue: {issueType.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </div>
        )}

        {trackDecidedAt && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            <p>Decided: {new Date(trackDecidedAt).toLocaleString()}</p>
            {trackDecisionReason && <p className="mt-1">Reason: {trackDecisionReason}</p>}
          </div>
        )}
      </div>

      {/* Switch Track Dialog */}
      {showSwitchDialog && (
        <div className="mt-4 rounded-lg border border-purple-200 dark:border-purple-800 p-4 bg-purple-50 dark:bg-purple-900/10">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Switch to {switchTrack === 'escalated' ? 'Escalated' : 'Standard'} Track
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Reason (required)
              </label>
              <textarea
                value={switchReason}
                onChange={(e) => setSwitchReason(e.target.value)}
                rows={2}
                placeholder="Why are you switching the track?"
                className="w-full text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Revised Issue Type (optional)
              </label>
              <select
                value={switchIssueType}
                onChange={(e) => setSwitchIssueType(e.target.value)}
                className="w-full text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 rounded-lg p-2"
              >
                <option value="">— Keep current —</option>
                <optgroup label="Standard">
                  {STANDARD_ISSUES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </optgroup>
                <optgroup label="Escalated">
                  {ESCALATED_ISSUES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </optgroup>
              </select>
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSwitch}
                disabled={switching}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {switching ? 'Switching...' : 'Confirm Switch'}
              </button>
              <button
                onClick={() => { setShowSwitchDialog(false); setError(null); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-700 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
