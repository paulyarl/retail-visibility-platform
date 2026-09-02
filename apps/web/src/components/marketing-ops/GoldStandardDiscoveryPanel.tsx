'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type CampaignDetail, type Audit } from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';

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
    visual_assets?: string[];
  } | null;
  platform_config?: {
    primary_category?: string | null;
    claimed?: boolean | null;
    review_count?: number | null;
    rating?: number | null;
    attributes?: string[] | string;
    website?: string | null;
    additional_categories?: string[] | string;
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
  const [promotingKey, setPromotingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!campaign.category) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const active = await marketingOpsService.resolveIntelligenceProfile(
          campaign.category,
          'gold_standards',
          campaign.city || undefined,
          campaign.intelligence_platform ?? undefined,
          campaign.state || undefined,
        );
        if (cancelled) return;
        setActiveProfile(active);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load gold-standard profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaign.category, campaign.intelligence_platform, campaign.city, campaign.state, refreshTrigger]);

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

  // Extract establishment exemplars from the active profile's configuration_json.
  // These are the gold-standard candidates from the establishment scan — already
  // proven to meet the bar. When a discovery scan finds no new qualifiers, the
  // operator can reference these as the existing benchmark slots.
  const establishmentExemplars: Candidate[] = (() => {
    if (!activeProfile?.configuration_json) return [];
    const config = activeProfile.configuration_json as any;
    const candidates: Candidate[] = Array.isArray(config.candidates) ? config.candidates : [];
    return candidates.filter((c) =>
      c.platform_evaluations?.some((pe) => pe.is_gold_standard === true),
    );
  })();

  // Build a set of already-promoted (business_name|platform) keys from the
  // active profile's candidates. Used to show "In slot" vs "Add to slot" on
  // each platform evaluation row.
  const promotedSlots: Set<string> = (() => {
    const set = new Set<string>();
    if (!activeProfile?.configuration_json) return set;
    const config = activeProfile.configuration_json as any;
    const candidates: Candidate[] = Array.isArray(config.candidates) ? config.candidates : [];
    for (const c of candidates) {
      const name = (c.business_name || '').trim().toLowerCase();
      if (!name) continue;
      for (const pe of c.platform_evaluations ?? []) {
        if (pe.is_gold_standard === true) {
          set.add(`${name}|${(pe.platform || '').trim().toLowerCase()}`);
        }
      }
    }
    return set;
  })();

  // Per-platform slot counts from the active profile (not the scan). This
  // reflects the actual benchmark state, which changes after promotions.
  const profileSlotCounts: Record<string, number> = (() => {
    const counts: Record<string, number> = {};
    if (!activeProfile?.configuration_json) return counts;
    const config = activeProfile.configuration_json as any;
    const candidates: Candidate[] = Array.isArray(config.candidates) ? config.candidates : [];
    for (const c of candidates) {
      for (const pe of c.platform_evaluations ?? []) {
        if (pe.is_gold_standard === true) {
          counts[pe.platform] = (counts[pe.platform] || 0) + 1;
        }
      }
    }
    return counts;
  })();

  // Per-platform slot occupants from the active profile — the actual
  // businesses occupying each platform's gold-standard slots. These may
  // come from the establishment scan (analyst-flagged at profile creation)
  // or from prior discovery promotions via the "Add to slot" button.
  const profileSlotOccupants: Record<string, Array<{ business_name: string; city?: string; quality_score?: number | null; profile_url?: string | null; state?: string }>> = (() => {
    const map: Record<string, Array<{ business_name: string; city?: string; quality_score?: number | null; profile_url?: string | null; state?: string }>> = {};
    if (!activeProfile?.configuration_json) return map;
    const config = activeProfile.configuration_json as any;
    const candidates: Candidate[] = Array.isArray(config.candidates) ? config.candidates : [];
    for (const c of candidates) {
      for (const pe of c.platform_evaluations ?? []) {
        if (pe.is_gold_standard === true) {
          if (!map[pe.platform]) map[pe.platform] = [];
          map[pe.platform].push({
            business_name: c.business_name,
            city: c.city,
            state: c.state,
            quality_score: pe.quality_score ?? null,
            profile_url: pe.profile_url ?? null,
          });
        }
      }
    }
    return map;
  })();

  // Promote a discovered candidate into a platform's gold-standard slot.
  // When the active profile is nationwide and the campaign has a
  // city/state, the promotion targets a scoped profile (auto-created from
  // the nationwide profile if needed) so regionally-narrowed discoveries
  // fill regional slots without evicting nationwide exemplars. When the
  // active profile is already scoped, promote directly into it.
  const handlePromote = async (candidate: Candidate, platform: string) => {
    if (!activeProfile) return;
    const key = `${candidate.business_name}|${platform}`;
    setPromotingKey(key);
    setSuccessMessage(null);
    setError(null);
    try {
      // The scope hint is only meaningful when the active profile is the
      // NATIONWIDE profile — it tells the backend to derive/use a scoped
      // profile for the campaign's city/state. When the active profile is
      // already scoped (has reference_city/state), promote directly into
      // it; passing scope with a scoped profile id would make the backend
      // try to treat it as nationwide and fail.
      const isNationwide = !activeProfile.reference_city && !activeProfile.reference_state;
      const scope = isNationwide && (campaign.city || campaign.state)
        ? { city: campaign.city || null, state: campaign.state || null }
        : undefined;
      await marketingOpsService.addGoldStandardCandidate(activeProfile.id, {
        candidate,
        platform,
        scope,
      });
      setSuccessMessage(
        `Added "${candidate.business_name}" to the ${prettyPlatform(platform)} gold-standard slot.`,
      );
      setRefreshTrigger((n) => n + 1);
      // Auto-dismiss success message after 5s
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to promote candidate to gold-standard slot');
    } finally {
      setPromotingKey(null);
    }
  };

  // Remove a candidate from a platform's gold-standard slot (frees up a slot).
  const handleRemoveFromSlot = async (businessName: string, platform: string) => {
    if (!activeProfile) return;
    const key = `remove:${businessName}|${platform}`;
    setPromotingKey(key);
    setSuccessMessage(null);
    setError(null);
    try {
      await marketingOpsService.removeGoldStandardCandidate(activeProfile.id, {
        businessName,
        platform,
      });
      setSuccessMessage(
        `Removed "${businessName}" from the ${prettyPlatform(platform)} gold-standard slot.`,
      );
      setRefreshTrigger((n) => n + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove candidate from gold-standard slot');
    } finally {
      setPromotingKey(null);
    }
  };

  // Pretty-print a gate field name: "primary_category_exact_match" → "Primary category exact match"
  const prettyGate = (gate: string): string => {
    return gate
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const prettyPlatform = (platform: string): string => {
    return platform === 'apple_maps' ? 'Apple Maps' : platform === 'bbb' ? 'BBB' : platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  // Normalize attributes/additional_categories which may be an array or a
  // comma-separated string depending on the scan source.
  const normalizeList = (val: string[] | string | undefined | null): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  };

  // Pretty-print a branding artifact field name for display.
  const prettyBrandingField = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
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
            <div>
              <div className="text-gray-500 dark:text-gray-400">Geographic Scope</div>
              <div className="font-medium text-gray-900 dark:text-white">{profileScopeLabel(activeProfile).label}</div>
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
            <span className="ml-1 text-gray-400 font-normal">(up to 4 per platform)</span>
          </div>
          {Object.keys(profileSlotCounts).length === 0 ? (
            <div className="text-sm text-gray-400">
              No candidates in profile slots yet
              <div className="text-xs mt-1 text-gray-400">
                Promote analyst-flagged candidates from the scan below to populate the benchmark.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(profileSlotCounts).map(([platform, count]) => {
                const occupants = profileSlotOccupants[platform] ?? [];
                return (
                  <div key={platform}>
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{prettyPlatform(platform)}</span>
                      <span className={`font-medium ${count >= 4 ? 'text-green-600' : 'text-amber-600'}`}>
                        {count}/4 {count >= 4 ? '(full)' : ''}
                      </span>
                    </div>
                    {occupants.length > 0 && (
                      <div className="ml-2 mt-0.5 space-y-0.5">
                        {occupants.map((occ, i) => {
                          const removeKey = `remove:${occ.business_name}|${platform}`;
                          const isRemoving = promotingKey === removeKey;
                          return (
                            <div key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                              <span className="text-amber-500">•</span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{occ.business_name}</span>
                              {(occ.city || occ.state) && (
                                <span className="text-gray-400">
                                  ({occ.city}{occ.city && occ.state ? ', ' : ''}{occ.state})
                                </span>
                              )}
                              {occ.quality_score != null && (
                                <span className="text-gray-400">{occ.quality_score}/10</span>
                              )}
                              {occ.profile_url && (
                                <a
                                  href={occ.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                  title={`Open ${occ.business_name} on ${prettyPlatform(platform)}`}
                                >
                                  ↗
                                </a>
                              )}
                              {activeProfile && (
                                <button
                                  type="button"
                                  disabled={isRemoving}
                                  onClick={() => handleRemoveFromSlot(occ.business_name, platform)}
                                  className="ml-auto text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 disabled:opacity-50 text-xs"
                                  title={`Remove "${occ.business_name}" from ${prettyPlatform(platform)} slot`}
                                >
                                  {isRemoving ? '…' : '×'}
                                </button>
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
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg p-3 text-xs text-green-800 dark:text-green-400">
          {successMessage}
        </div>
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
                      {/* NAP + website — pull from candidate.nap and first platform_config.website */}
                      {(() => {
                        const nap = candidate.nap;
                        const website = (candidate.platform_evaluations ?? [])
                          .map((pe) => pe.platform_config?.website)
                          .find((w) => w);
                        const hasNap = nap?.address || nap?.phone;
                        if (!hasNap && !website) return null;
                        return (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                            {nap?.address && <span>{nap.address}</span>}
                            {nap?.phone && <span>{nap.phone}</span>}
                            {website && (
                              <a href={website} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline">
                                Website ↗
                              </a>
                            )}
                          </div>
                        );
                      })()}
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
                              {pe.platform_config?.claimed != null && (
                                <span className={`text-xs ${pe.platform_config.claimed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                  {pe.platform_config.claimed ? 'Claimed' : 'Unclaimed'}
                                </span>
                              )}
                              {/* Links — website + profile URL, pushed right */}
                              {(pe.platform_config?.website || pe.profile_url) && (
                                <div className="ml-auto flex items-center gap-2">
                                  {pe.platform_config?.website && (
                                    <a href={pe.platform_config.website} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline">
                                      Website ↗
                                    </a>
                                  )}
                                  {pe.profile_url && (
                                    <a href={pe.profile_url} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline">
                                      View Profile ↗
                                    </a>
                                  )}
                                </div>
                              )}
                              {/* Per-platform slot promotion — only for analyst-flagged gold-standard evaluations */}
                              {pe.is_gold_standard === true && activeProfile && (() => {
                                const slotKey = `${candidate.business_name.trim().toLowerCase()}|${pe.platform.trim().toLowerCase()}`;
                                const isPromoted = promotedSlots.has(slotKey);
                                const isPromoting = promotingKey === `${candidate.business_name}|${pe.platform}`;
                                const hasLinks = !!(pe.profile_url || pe.platform_config?.website);
                                if (isPromoted) {
                                  return (
                                    <span className={`px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium ${hasLinks ? '' : 'ml-auto'}`}>
                                      ✓ In {prettyPlatform(pe.platform)} slot
                                    </span>
                                  );
                                }
                                const slotCount = profileSlotCounts[pe.platform] ?? 0;
                                const slotFull = slotCount >= 4;
                                return (
                                  <button
                                    type="button"
                                    disabled={isPromoting || slotFull}
                                    onClick={() => handlePromote(candidate, pe.platform)}
                                    className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${hasLinks ? '' : 'ml-auto'} ${
                                      slotFull
                                        ? 'bg-gray-100 dark:bg-neutral-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                    }`}
                                    title={slotFull ? `${prettyPlatform(pe.platform)} slot is full (4/4)` : `Add to ${prettyPlatform(pe.platform)} gold-standard slot`}
                                  >
                                    {isPromoting
                                      ? 'Adding…'
                                      : slotFull
                                      ? 'Slot full'
                                      : `+ Add to ${prettyPlatform(pe.platform)} slot`}
                                  </button>
                                );
                              })()}
                            </div>
                            {/* Quality rationale */}
                            {pe.quality_rationale && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                {pe.quality_rationale}
                              </div>
                            )}
                            {/* Platform config — categories, attributes, branding artifacts */}
                            {(() => {
                              const cfg = pe.platform_config;
                              const ba = pe.branding_artifacts;
                              const addlCats = normalizeList(cfg?.additional_categories);
                              const attrs = normalizeList(cfg?.attributes);
                              const photoTypes = ba?.photo_types ?? [];
                              const brandingFlags: string[] = [];
                              if (ba?.has_logo) brandingFlags.push('Logo');
                              if (ba?.has_cover_photo) brandingFlags.push('Cover photo');
                              if (ba?.has_profile_photo) brandingFlags.push('Profile photo');
                              if (ba?.photo_count != null) brandingFlags.push(`${ba.photo_count} photos`);
                              const hasAny = cfg?.primary_category || addlCats.length > 0 || attrs.length > 0 || brandingFlags.length > 0 || photoTypes.length > 0;
                              if (!hasAny) return null;
                              return (
                                <div className="mt-1.5 space-y-1 text-xs">
                                  {/* Categories */}
                                  {(cfg?.primary_category || addlCats.length > 0) && (
                                    <div className="flex items-start gap-1.5 flex-wrap">
                                      <span className="text-gray-400 dark:text-gray-500 font-medium shrink-0">Category:</span>
                                      {cfg?.primary_category && (
                                        <span className="text-gray-600 dark:text-gray-300">{cfg.primary_category}</span>
                                      )}
                                      {addlCats.length > 0 && (
                                        <span className="text-gray-400 dark:text-gray-500">
                                          {addlCats.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {/* Attributes */}
                                  {attrs.length > 0 && (
                                    <div className="flex items-start gap-1.5 flex-wrap">
                                      <span className="text-gray-400 dark:text-gray-500 font-medium shrink-0">Attributes:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {attrs.map((attr, i) => (
                                          <span key={i} className="px-1 py-0.5 bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-gray-400 rounded">
                                            {attr}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* Branding artifacts */}
                                  {(brandingFlags.length > 0 || photoTypes.length > 0) && (
                                    <div className="flex items-start gap-1.5 flex-wrap">
                                      <span className="text-gray-400 dark:text-gray-500 font-medium shrink-0">Branding:</span>
                                      {brandingFlags.length > 0 && (
                                        <span className="text-gray-600 dark:text-gray-300">
                                          {brandingFlags.join(' · ')}
                                        </span>
                                      )}
                                      {photoTypes.length > 0 && (
                                        <span className="text-gray-400 dark:text-gray-500">
                                          ({photoTypes.map(prettyBrandingField).join(', ')})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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
            set by the establishment scan&apos;s exemplars and most independents won&apos;t clear it on every platform.
          </p>

          {/* Establishment exemplars — already proven gold-standard businesses */}
          {establishmentExemplars.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">
                Existing benchmark exemplars from the establishment profile ({establishmentExemplars.length}):
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                These businesses already qualified as gold standard in the establishment scan.
                They remain the active benchmark for audits and fulfillment. No new exemplars were
                added by this discovery scan, but the existing bar is intact.
              </p>
              <div className="space-y-1.5">
                {establishmentExemplars.map((ex, idx) => {
                  const goldPlatforms = (ex.platform_evaluations ?? [])
                    .filter((pe) => pe.is_gold_standard === true);
                  const bestScore = Math.max(...(ex.platform_evaluations ?? []).map((pe) => pe.quality_score ?? 0));
                  return (
                    <div key={idx} className="bg-white dark:bg-neutral-800 rounded p-2 border border-amber-100 dark:border-amber-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{ex.business_name}</span>
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                          Gold Standard ({goldPlatforms.length} platform{goldPlatforms.length !== 1 ? 's' : ''})
                        </span>
                        {ex.city && <span className="text-xs text-gray-500">{ex.city}{ex.state ? `, ${ex.state}` : ''}</span>}
                        {bestScore > 0 && <span className="text-xs text-gray-400">Best: {bestScore}/10</span>}
                      </div>
                      {ex.category_notes && (
                        <div className="text-xs text-gray-500 mt-1 italic">{ex.category_notes}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {goldPlatforms.map((pe) => (
                          <span key={pe.platform} className="text-xs px-1 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded">
                            {prettyPlatform(pe.platform)} {pe.quality_score != null ? `${pe.quality_score}/10` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-blue-900 dark:text-blue-300">Try narrowing the scan to find new exemplars:</div>
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
                  Target a state or region with a strong {campaign.category || 'category'} scene.
                  The establishment exemplars above show which markets already have proven benchmarks.
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">City-specific</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Run a city-level discovery scan in markets where independent {campaign.category || 'category'}
                  businesses have deep community roots. Use the exemplar cities above as a starting point.
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-700 dark:text-blue-400">
            The discovered candidates can still be audited and fulfilled against the existing gold-standard bar —
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
