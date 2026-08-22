'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type CampaignDetail, type Audit } from '@/services/MarketingOpsService';

const marketingOpsService = MarketingOpsService.getInstance();

interface Props {
  campaign: CampaignDetail;
  audits: Audit[];
}

/**
 * Gold Standard Discovery Panel
 *
 * Shown on the campaign detail Overview tab for gold-standard discovery
 * campaigns. Warns when no active gold-standard profile exists for the
 * category (the operator must run an Establishment campaign first).
 *
 * When an active profile exists, displays:
 *   - The active profile reference (version, platform focus)
 *   - Candidate evaluations from discovery audits (quality scores,
 *     branding artifacts, destination URLs, curation actions)
 *   - Per-platform gold-standard slot coverage (up to 4 per platform)
 */
export default function GoldStandardDiscoveryPanel({ campaign, audits }: Props) {
  const [activeProfile, setActiveProfile] = useState<IntelligenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaign.category) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const active = await marketingOpsService.resolveIntelligenceProfile(campaign.category, 'gold_standards', undefined, campaign.intelligence_platform ?? undefined);
        if (cancelled) return;
        setActiveProfile(active);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load gold-standard profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaign.category]);

  const platformLabel = campaign.intelligence_platform
    ? campaign.intelligence_platform === 'all'
      ? 'All Platforms'
      : campaign.intelligence_platform.charAt(0).toUpperCase() + campaign.intelligence_platform.slice(1)
    : '—';

  // Filter audits to gold_standard_scan platform
  const goldStandardAudits = audits.filter((a) => a.platform === 'gold_standard_scan' && a.audit_data);

  // Extract candidates from audit data
  const allCandidates: Array<{
    business_name: string;
    city?: string;
    state?: string;
    ownership_type?: string;
    location_count_estimate?: number | null;
    independence_rationale?: string | null;
    platform_evaluations?: Array<any>;
    category_notes?: string;
  }> = [];
  for (const audit of goldStandardAudits) {
    const data = audit.audit_data as any;
    if (data?.candidates && Array.isArray(data.candidates)) {
      allCandidates.push(...data.candidates);
    }
  }

  // Count gold-standard candidates per platform
  const platformSlotCounts: Record<string, number> = {};
  for (const candidate of allCandidates) {
    if (!candidate.platform_evaluations) continue;
    for (const pe of candidate.platform_evaluations) {
      if (pe.is_gold_standard === true) {
        platformSlotCounts[pe.platform] = (platformSlotCounts[pe.platform] || 0) + 1;
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Prerequisite warning — no active gold-standard profile */}
      {!loading && !activeProfile && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">
            No Active Gold Standard Profile
          </h4>
          <p className="text-xs text-red-800 dark:text-red-400 leading-relaxed">
            Run an <span className="font-medium">Establishment</span> campaign first to create the
            gold-standard profile parameters for {campaign.category || 'this category'}. Discovery
            campaigns consume the active profile to evaluate candidates against expected fields and
            quality gates. Without an active profile, discovery runs in degraded mode.
          </p>
          <a
            href="/settings/admin/marketing-ops/intelligence-profiles"
            className="inline-block mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            View Intelligence Profiles →
          </a>
        </div>
      )}

      {/* Active profile reference */}
      {activeProfile && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">
            Active Gold Standard Profile
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Profile ID</div>
              <div className="font-medium text-gray-900 dark:text-white">{activeProfile.id}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Version</div>
              <div className="font-medium text-gray-900 dark:text-white">v{activeProfile.version}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Category</div>
              <div className="font-medium text-gray-900 dark:text-white">{activeProfile.category_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Platform + slot coverage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Platform Focus</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{platformLabel}</div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Gold Standard Slots</div>
          {Object.keys(platformSlotCounts).length === 0 ? (
            <div className="text-sm text-gray-400">No slots filled yet</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(platformSlotCounts).map(([platform, count]) => (
                <div key={platform} className="text-xs flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{platform}</span>
                  <span className={`font-medium ${count >= 4 ? 'text-green-600' : 'text-amber-600'}`}>
                    {count}/4 {count >= 4 ? '(full)' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Candidate evaluations from discovery audits */}
      {allCandidates.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Discovered Candidates ({allCandidates.length})
          </h5>
          <div className="space-y-3">
            {allCandidates.map((candidate, idx) => (
              <div key={idx} className="border border-gray-100 dark:border-neutral-700 rounded p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {candidate.business_name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      {candidate.city && <span>{candidate.city}{candidate.state ? `, ${candidate.state}` : ''}</span>}
                      {candidate.ownership_type && (
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          candidate.ownership_type === 'independent' || candidate.ownership_type === 'small_group'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {candidate.ownership_type === 'independent' ? 'Independent' :
                           candidate.ownership_type === 'small_group' ? `Small group${candidate.location_count_estimate ? ` (${candidate.location_count_estimate})` : ''}` :
                           candidate.ownership_type === 'franchise' ? 'Franchise' :
                           candidate.ownership_type === 'chain' ? 'Chain' : candidate.ownership_type}
                        </span>
                      )}
                    </div>
                    {candidate.independence_rationale && (
                      <div className="text-xs text-gray-500 mt-1">{candidate.independence_rationale}</div>
                    )}
                    {candidate.category_notes && (
                      <div className="text-xs text-gray-500 mt-1">{candidate.category_notes}</div>
                    )}
                  </div>
                </div>
                {candidate.platform_evaluations && candidate.platform_evaluations.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {candidate.platform_evaluations.map((pe: any, peIdx: number) => (
                      <div key={peIdx} className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-neutral-900/50 rounded p-2">
                        <span className="font-medium capitalize text-gray-700 dark:text-gray-300">{pe.platform}</span>
                        {pe.quality_score != null && (
                          <span className="text-gray-500">Score: {pe.quality_score}/10</span>
                        )}
                        {pe.is_gold_standard && (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">
                            Gold Standard
                          </span>
                        )}
                        {pe.profile_url && (
                          <a href={pe.profile_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline ml-auto">
                            View Profile ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && activeProfile && allCandidates.length === 0 && (
        <div className="bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No discovery audits imported yet. Run the gold-standard scan prompt in the Prompts tab,
            then import the result to evaluate candidates against the active profile.
          </p>
        </div>
      )}
    </div>
  );
}
