'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type CampaignDetail, type Audit } from '@/services/MarketingOpsService';

const marketingOpsService = MarketingOpsService.getInstance();

interface Props {
  campaign: CampaignDetail;
  audits: Audit[];
}

interface PlatformEvaluation {
  platform: string;
  profile_url?: string | null;
  quality_score?: number | null;
  quality_rationale?: string | null;
  is_gold_standard?: boolean | null;
  branding_artifacts?: {
    has_logo?: boolean | null;
    has_cover_photo?: boolean | null;
    has_profile_photo?: boolean | null;
    photo_count?: number | null;
    photo_types?: string[];
  } | null;
  platform_config?: {
    primary_category?: string | null;
    claimed?: boolean | null;
    review_count?: number | null;
    rating?: number | null;
    attributes?: string[];
  } | null;
  quality_gates_passed?: string[];
  quality_gates_failed?: string[];
}

interface Candidate {
  business_name: string;
  city?: string;
  state?: string;
  nap?: { name?: string | null; address?: string | null; phone?: string | null };
  ownership_type?: string;
  location_count_estimate?: number | null;
  independence_rationale?: string | null;
  platform_evaluations?: PlatformEvaluation[];
  category_notes?: string | null;
}

interface ExcludedCandidate {
  business_name: string;
  reason: string;
}

interface ScanMetadata {
  scan_date?: string;
  sources_consulted?: string[];
  selection_criteria?: string;
  platforms_evaluated?: string[];
  expected_field_derivation?: string;
  platform_focus?: string;
  excluded_candidates?: ExcludedCandidate[];
}

/**
 * Gold Standard Discovery Panel
 *
 * Shown on the campaign detail Overview tab for gold-standard discovery
 * campaigns. Displays:
 *   - The active gold-standard profile reference
 *   - Per-platform slot coverage (up to 4 gold-standard candidates per platform)
 *   - Candidate evaluations with quality scores, gate pass/fail breakdowns,
 *     and analyst rationale
 *   - Excluded candidates (chains/franchises the analyst filtered out)
 *   - Next-step guidance when no candidates qualified
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
  }, [campaign.category, campaign.intelligence_platform]);

  const platformLabel = campaign.intelligence_platform
    ? campaign.intelligence_platform === 'all'
      ? 'All Platforms'
      : campaign.intelligence_platform.charAt(0).toUpperCase() + campaign.intelligence_platform.slice(1)
    : '—';

  // Filter audits to gold_standard_scan platform
  const goldStandardAudits = audits.filter((a) => a.platform === 'gold_standard_scan' && a.audit_data);

  // Extract candidates + scan metadata from audit data
  const allCandidates: Candidate[] = [];
  let scanMetadata: ScanMetadata | null = null;
  for (const audit of goldStandardAudits) {
    const data = audit.audit_data as any;
    if (data?.candidates && Array.isArray(data.candidates)) {
      allCandidates.push(...data.candidates);
    }
    if (data?.scan_metadata) {
      scanMetadata = data.scan_metadata;
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

  const totalGoldStandard = Object.values(platformSlotCounts).reduce((a, b) => a + b, 0);
  const excludedCandidates = scanMetadata?.excluded_candidates ?? [];

  // Pretty-print a gate field name: "primary_category_exact_match" → "Primary category exact match"
  const prettyGate = (gate: string): string => {
    return gate
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const prettyPlatform = (platform: string): string => {
    return platform === 'apple_maps' ? 'Apple Maps' : platform === 'bbb' ? 'BBB' : platform.charAt(0).toUpperCase() + platform.slice(1);
  };

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
            <div>
              <div className="text-gray-500 dark:text-gray-400">Platform Scope</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {activeProfile.reference_platform ? prettyPlatform(activeProfile.reference_platform) : 'Cross-platform'}
              </div>
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
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Gold Standard Slots
            <span className="ml-1 text-gray-400 font-normal">(analyst-assigned, up to 4 per platform)</span>
          </div>
          {Object.keys(platformSlotCounts).length === 0 ? (
            <div className="text-sm text-gray-400">
              No candidates qualified
              <div className="text-xs mt-1 text-gray-400">
                The analyst evaluated {allCandidates.length} candidate{allCandidates.length !== 1 ? 's' : ''} against the
                established quality gates. None passed all non-negotiable gates.
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {Object.entries(platformSlotCounts).map(([platform, count]) => (
                <div key={platform} className="text-xs flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300">{prettyPlatform(platform)}</span>
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
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Discovered Candidates ({allCandidates.length})
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Each candidate was evaluated per-platform against the established gold-standard quality gates.
            A candidate must pass <span className="font-medium">all non-negotiable gates</span> on a platform
            to be flagged gold standard there.
          </p>
          <div className="space-y-4">
            {allCandidates.map((candidate, idx) => {
              const goldPlatforms = (candidate.platform_evaluations ?? [])
                .filter((pe) => pe.is_gold_standard === true)
                .map((pe) => pe.platform);
              const bestScore = Math.max(...(candidate.platform_evaluations ?? []).map((pe) => pe.quality_score ?? 0));
              return (
                <div key={idx} className="border border-gray-100 dark:border-neutral-700 rounded-lg p-3">
                  {/* Candidate header */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {candidate.business_name}
                        </span>
                        {goldPlatforms.length > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                            Gold Standard ({goldPlatforms.length} platform{goldPlatforms.length !== 1 ? 's' : ''})
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium">
                            Did not qualify
                          </span>
                        )}
                        {candidate.ownership_type && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
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
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        {candidate.city && <span>{candidate.city}{candidate.state ? `, ${candidate.state}` : ''}</span>}
                        {bestScore > 0 && <span className="text-gray-400">Best score: {bestScore}/10</span>}
                      </div>
                      {candidate.independence_rationale && (
                        <div className="text-xs text-gray-500 mt-1">{candidate.independence_rationale}</div>
                      )}
                      {candidate.category_notes && (
                        <div className="text-xs text-gray-500 mt-1 italic">{candidate.category_notes}</div>
                      )}
                    </div>
                  </div>

                  {/* Per-platform evaluations */}
                  {candidate.platform_evaluations && candidate.platform_evaluations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {candidate.platform_evaluations.map((pe, peIdx) => {
                        const passed = pe.quality_gates_passed ?? [];
                        const failed = pe.quality_gates_failed ?? [];
                        const failedNonNegotiable = failed.filter((g) =>
                          // Heuristic: gates that contain "claimed", "verified", "ownership",
                          // "category", "hours_accuracy", "places_claimed" are non-negotiable.
                          // The scan data doesn't include severity per gate result, so we
                          // show all failed gates. The analyst's is_gold_standard flag is
                          // the authoritative pass/fail indicator.
                          true
                        );
                        return (
                          <div key={peIdx} className={`rounded p-2 border ${
                            pe.is_gold_standard
                              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                              : 'border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50'
                          }`}>
                            {/* Platform header row */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {prettyPlatform(pe.platform)}
                              </span>
                              {pe.quality_score != null && (
                                <span className={`font-medium ${
                                  (pe.quality_score ?? 0) >= 8 ? 'text-green-600' :
                                  (pe.quality_score ?? 0) >= 6 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {pe.quality_score}/10
                                </span>
                              )}
                              {pe.is_gold_standard && (
                                <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded font-medium">
                                  Gold Standard
                                </span>
                              )}
                              {pe.platform_config?.rating != null && (
                                <span className="text-gray-400">
                                  ★ {pe.platform_config.rating} ({pe.platform_config.review_count ?? '?'} reviews)
                                </span>
                              )}
                              {pe.profile_url && (
                                <a href={pe.profile_url} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline ml-auto">
                                  View Profile ↗
                                </a>
                              )}
                            </div>
                            {/* Quality rationale */}
                            {pe.quality_rationale && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                {pe.quality_rationale}
                              </div>
                            )}
                            {/* Gate pass/fail summary */}
                            {(passed.length > 0 || failed.length > 0) && (
                              <div className="mt-1.5 flex items-start gap-3 flex-wrap">
                                {passed.length > 0 && (
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-0.5">
                                      Passed ({passed.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {passed.map((g) => (
                                        <span key={g} className="text-xs px-1 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
                                          {prettyGate(g)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {failed.length > 0 && (
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-red-500 dark:text-red-400 font-medium mb-0.5">
                                      Failed ({failed.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {failed.map((g) => (
                                        <span key={g} className="text-xs px-1 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded">
                                          {prettyGate(g)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Excluded candidates (chains/franchises) */}
      {excludedCandidates.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Excluded by Analyst ({excludedCandidates.length})
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            The analyst excluded these businesses because they are chains, franchises, or trade-only
            distributors. Gold-standard benchmarks reflect what independent operators can achieve.
          </p>
          <div className="space-y-1">
            {excludedCandidates.map((exc, idx) => (
              <div key={idx} className="text-xs flex items-start gap-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">{exc.business_name}</span>
                <span className="text-gray-400">— {exc.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next-step guidance when no candidates qualified */}
      {!loading && activeProfile && allCandidates.length > 0 && totalGoldStandard === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            No Candidates Met the Bar — Next Steps
          </h5>
          <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed mb-3">
            The analyst evaluated {allCandidates.length} independent candidate{allCandidates.length !== 1 ? 's' : ''} against
            the established gold-standard quality gates for {campaign.category || 'this category'}.
            None passed all non-negotiable gates on any platform. This is a valid outcome — the bar is
            set by the establishment scan&apos;s exemplars (e.g. Naimie&apos;s at 9.6/10 on Google) and
            most independents won&apos;t clear it on every platform.
          </p>
          <div className="space-y-2">
            <div className="text-xs font-medium text-blue-900 dark:text-blue-300">Try narrowing the scan:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Platform-specific</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Run a discovery scan with platform focus = Google. A single-platform scan goes deeper
                  and may surface stronger candidates than a cross-platform scan.
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">State or region</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Target a state with a strong beauty supply scene (CA, NY, TX, GA). The establishment
                  exemplars are concentrated in these markets.
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">City-specific</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Run a city-level discovery scan for Los Angeles, Houston, or Atlanta where independent
                  beauty supply stores have deep community roots.
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-700 dark:text-blue-400">
            Alternatively, the existing establishment exemplars (Naimie&apos;s, Frends Beauty, Alcone, Zoet) remain
            the active gold standard. These candidates can still be audited and fulfilled against that bar —
            they just didn&apos;t qualify as new exemplars.
          </div>
        </div>
      )}

      {/* Empty state — no audits imported yet */}
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
