'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type CampaignDetail, type BronzeExternalFillSlot } from '@/services/MarketingOpsService';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';
import BronzeStandardProfileView from '@/components/marketing-ops/BronzeStandardProfileView';
import {
  bronzeProfileConfig,
  bronzeDiscoveryFillCandidates,
  bronzeSlotKey,
  BRONZE_MAX_SLOTS_PER_REASON,
  BRONZE_COVERAGE_STATUS_META,
  BRONZE_DIGITAL_QUALITY_META,
  BRONZE_OPERATIONAL_STATUS_META,
  BRONZE_DISCOVERED_BY_LABELS,
  BRONZE_PRESENCE_META,
  bronzePlatformLabel,
  type BronzeReasonCoverageEntry,
  type BronzeSlot,
  type BronzeDiscoveryCandidate,
} from '@/lib/bronze-standard-profile';

const marketingOpsService = MarketingOpsService.getInstance();

interface Props {
  campaign: CampaignDetail;
}

/** Normalize a category key/name for comparison (snake_case → spaced, lower). */
const normalizeCategory = (v: string | null | undefined) =>
  (v || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

/** Pretty-print a reason_key when no catalog label is available. */
const prettyReasonKey = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Bronze Standard Discovery Panel
 *
 * Shown on the campaign detail Overview tab for bronze-standard discovery
 * campaigns — the bronze mirror of GoldStandardDiscoveryPanel. Displays:
 *   - The active bronze-standard profile reference (the slot board owner)
 *   - Per-reason slot coverage (up to 2 exemplars per catalog reason) with
 *     occupants and empty-slot notes
 *   - Fill candidates discovered by the imported city scan (the draft
 *     profile's reason_coverage), each promotable into the active profile
 *     with a click — one active version bump per fill, like gold
 *   - The full scan output (BronzeStandardProfileView) as a collapsed detail
 *
 * When no active profile exists yet, the imported draft IS the scan's work
 * product: the board renders the draft's proposed coverage and the CTA is
 * to review + activate it in the Intelligence Profiles page.
 */
export default function BronzeStandardDiscoveryPanel({ campaign }: Props) {
  const [activeProfile, setActiveProfile] = useState<IntelligenceProfile | null>(null);
  const [draftProfiles, setDraftProfiles] = useState<IntelligenceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fillingKey, setFillingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFullScan, setShowFullScan] = useState(false);

  useEffect(() => {
    if (!campaign.category) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [drafts, active] = await Promise.all([
          marketingOpsService.listIntelligenceProfileDrafts('bronze_standards'),
          marketingOpsService.resolveIntelligenceProfile(
            campaign.category,
            'bronze_standards',
            campaign.city || undefined,
            campaign.intelligence_platform ?? undefined,
            campaign.state || undefined,
          ),
        ]);
        if (cancelled) return;
        // Same normalized matching as IntelligenceEstablishmentPanel —
        // category + platform-or-cross-platform + city/state scope score.
        const normalizedCategory = normalizeCategory(campaign.category);
        setDraftProfiles(
          drafts
            .filter((p) => {
              if (normalizeCategory(p.category_key) !== normalizedCategory) return false;
              const campaignPlatform = campaign.intelligence_platform ?? null;
              if (!campaignPlatform) return true;
              return p.reference_platform === campaignPlatform || p.reference_platform === null;
            })
            .sort((a, b) => {
              const campaignCity = (campaign.city || '').trim().toLowerCase();
              const campaignState = (campaign.state || '').trim().toLowerCase();
              const score = (p: typeof a) => {
                const pCity = (p.reference_city || '').trim().toLowerCase();
                const pState = (p.reference_state || '').trim().toLowerCase();
                if (campaignCity && pCity === campaignCity && campaignState && pState === campaignState) return 3;
                if (campaignState && pState === campaignState) return 2;
                if (!campaignCity && !campaignState && !pCity && !pState) return 1;
                return 0;
              };
              // Scope fit first, then newest version wins within the same
              // scope — the latest import is the freshest candidate pool.
              const scopeDiff = score(b) - score(a);
              return scopeDiff !== 0 ? scopeDiff : b.version - a.version;
            }),
        );
        setActiveProfile(active);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load bronze-standard profile');
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

  const bestDraft = draftProfiles[0] ?? null;
  const boardProfile = activeProfile ?? bestDraft;
  const boardConfig = boardProfile ? bronzeProfileConfig(boardProfile) : null;
  const coverage: BronzeReasonCoverageEntry[] = boardConfig?.reason_coverage ?? [];
  const catalogLabels = new Map<string, string>();
  for (const row of boardConfig?.catalog_snapshot ?? []) {
    if (row.reason_key && row.label) catalogLabels.set(row.reason_key, row.label);
  }

  // Discovery fill candidates — slots in the imported scan draft that are
  // not already occupying the active profile's reason slots.
  const candidates: BronzeDiscoveryCandidate[] = bronzeDiscoveryFillCandidates(
    activeProfile ? bronzeProfileConfig(activeProfile) : null,
    bestDraft ? bronzeProfileConfig(bestDraft) : null,
  );
  const fillableCandidates = candidates.filter((c) => !c.alreadyInSlot);

  // Promote a discovered exemplar into the reason's slot on the ACTIVE
  // profile — direct commit, one active version bump per fill (the bronze
  // mirror of gold's "Add to slot"). The slot's discovered_by is stamped
  // operator_self_discovery: the operator's click is the confirmation, so
  // the fill is ground truth that survives re-scans (§7.3).
  const handleFill = async (candidate: BronzeDiscoveryCandidate) => {
    if (!activeProfile) return;
    const key = `${candidate.reason_key}|${bronzeSlotKey(candidate.slot)}`;
    setFillingKey(key);
    setSuccessMessage(null);
    setError(null);
    try {
      await marketingOpsService.addBronzeReasonFill(activeProfile.id, {
        reason_key: candidate.reason_key,
        slot: {
          ...candidate.slot,
          observed_platform: candidate.slot.observed_platform as BronzeExternalFillSlot['observed_platform'],
          discovered_by: 'operator_self_discovery',
          discovered_via: `Bronze discovery scan — ${campaign.title || campaign.business_name || campaign.id}`,
        },
      });
      const reasonLabel = catalogLabels.get(candidate.reason_key) ?? prettyReasonKey(candidate.reason_key);
      setSuccessMessage(`Added "${candidate.slot.business_name}" to the ${reasonLabel} slot.`);
      setRefreshTrigger((n) => n + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to fill bronze reason slot');
    } finally {
      setFillingKey(null);
    }
  };

  // Remove an occupant from a reason's slot on the ACTIVE profile (frees
  // the slot for a new discovery) — mirrors gold's slot removal.
  const handleRemove = async (entry: BronzeReasonCoverageEntry, slot: BronzeSlot) => {
    if (!activeProfile) return;
    const key = `remove:${entry.reason_key}|${bronzeSlotKey(slot)}`;
    setFillingKey(key);
    setSuccessMessage(null);
    setError(null);
    try {
      await marketingOpsService.removeBronzeReasonFill(activeProfile.id, {
        reason_key: entry.reason_key,
        business_name: slot.business_name,
        address: slot.address ?? null,
      });
      const reasonLabel = catalogLabels.get(entry.reason_key) ?? prettyReasonKey(entry.reason_key);
      setSuccessMessage(`Removed "${slot.business_name}" from the ${reasonLabel} slot.`);
      setRefreshTrigger((n) => n + 1);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove bronze reason slot');
    } finally {
      setFillingKey(null);
    }
  };

  const statusChip = (status: BronzeReasonCoverageEntry['status']) => {
    const meta = BRONZE_COVERAGE_STATUS_META[status] ?? BRONZE_COVERAGE_STATUS_META.empty_unproven;
    const cls =
      meta.color === 'green'
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
        : meta.color === 'yellow'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-gray-400';
    return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{meta.label}</span>;
  };

  const occupantLine = (entry: BronzeReasonCoverageEntry, slot: BronzeSlot, i: number) => {
    const presence = Object.entries(slot.platform_presence ?? {});
    const removeKey = `remove:${entry.reason_key}|${bronzeSlotKey(slot)}`;
    return (
      <div key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
        <span className="text-orange-500">•</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{slot.business_name}</span>
        {(slot as any).observed_city && (
          <span className="text-gray-400">
            ({(slot as any).observed_city}{(slot as any).observed_state ? `, ${(slot as any).observed_state}` : ''})
          </span>
        )}
        {slot.operational_status && (
          <span className="text-gray-400">{BRONZE_OPERATIONAL_STATUS_META[slot.operational_status]?.label ?? slot.operational_status}</span>
        )}
        {slot.digital_quality && (
          <span className={slot.digital_quality === 'very_low' ? 'text-red-500' : 'text-orange-500'}>
            {BRONZE_DIGITAL_QUALITY_META[slot.digital_quality]?.label ?? slot.digital_quality}
          </span>
        )}
        {slot.discovered_by && (
          <span className="text-gray-400">· {BRONZE_DISCOVERED_BY_LABELS[slot.discovered_by] ?? slot.discovered_by}</span>
        )}
        {presence.length > 0 && (
          <span className="text-gray-400">
            [{presence.map(([p, s]) => `${bronzePlatformLabel(p)}: ${BRONZE_PRESENCE_META[s]?.label ?? s}`).join(' · ')}]
          </span>
        )}
        {(slot.evidence_urls ?? []).map((url, j) => (
          <a
            key={j}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            title={url}
          >
            ↗
          </a>
        ))}
        {activeProfile && (
          <button
            type="button"
            disabled={fillingKey === removeKey}
            onClick={() => handleRemove(entry, slot)}
            className="ml-auto text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 disabled:opacity-50 text-xs"
            title={`Remove "${slot.business_name}" from this slot`}
          >
            {fillingKey === removeKey ? '…' : '×'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Explainer header */}
      <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-2">
          Bronze Standard Discovery
        </h4>
        <p className="text-xs text-orange-800 dark:text-orange-400 leading-relaxed">
          This campaign scans the market for exemplar businesses that fill the bronze-standard
          reason slots for <span className="font-medium">{campaign.category || 'this category'}</span>.
          Each catalog reason holds up to {BRONZE_MAX_SLOTS_PER_REASON} exemplars. Promote a
          discovered exemplar into a slot to record it on the active profile — one version bump
          per fill.
        </p>
      </div>

      {/* Prerequisite warning — nothing at this scope at all */}
      {!loading && !activeProfile && !bestDraft && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">
            No Bronze Standard Profile or Scan Result
          </h4>
          <p className="text-xs text-red-800 dark:text-red-400 leading-relaxed">
            Run the <span className="font-medium">Bronze Standard Scan</span> prompt on this campaign
            and import the result — it produces a draft profile whose reason fills become the slot
            candidates. An establishment scan can also seed the profile directly.
          </p>
        </div>
      )}

      {/* Active profile reference */}
      {activeProfile && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">
            Active Bronze Standard Profile
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
                {activeProfile.reference_platform ? bronzePlatformLabel(activeProfile.reference_platform) : 'Cross-platform'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Geographic Scope</div>
              <div className="font-medium text-gray-900 dark:text-white">{profileScopeLabel(activeProfile).label}</div>
            </div>
          </div>
        </div>
      )}

      {/* Draft notice — no active profile yet */}
      {!loading && !activeProfile && bestDraft && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
            Draft v{bestDraft.version} Awaiting Activation
          </h4>
          <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
            The imported scan produced a draft bronze profile (shown below as proposed coverage).
            Activate it in the Intelligence Profiles page to establish the slot board — after that,
            discovery fills commit to the active profile one version at a time.
          </p>
          <a
            href="/settings/admin/marketing-ops/intelligence-profiles"
            className="inline-block mt-2 text-xs text-amber-700 dark:text-amber-400 hover:underline"
          >
            Review &amp; Activate →
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Platform Focus</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{platformLabel}</div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Reason Slots
            <span className="ml-1 text-gray-400 font-normal">(up to {BRONZE_MAX_SLOTS_PER_REASON} per reason)</span>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {coverage.length} reason{coverage.length !== 1 ? 's' : ''} ·{' '}
            {coverage.reduce((n, c) => n + (c.slots?.length ?? 0), 0)} filled
          </div>
          {activeProfile && fillableCandidates.length > 0 && (
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              {fillableCandidates.length} discovered exemplar{fillableCandidates.length !== 1 ? 's' : ''} awaiting review
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

      {/* Reason slot board — active profile's committed slots, or the
          draft's proposed coverage when nothing is active yet */}
      {!loading && boardProfile && coverage.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {activeProfile ? 'Reason Slots' : `Proposed Coverage — draft v${boardProfile.version}`}
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {activeProfile
              ? 'Committed slot occupancy on the active bronze profile. Removing an occupant frees the slot for a new fill.'
              : 'The imported scan is a draft — its fills are not committed until the draft is activated.'}
          </p>
          <div className="space-y-3">
            {coverage.map((entry) => {
              const slots = entry.slots ?? [];
              const label = catalogLabels.get(entry.reason_key) ?? prettyReasonKey(entry.reason_key);
              return (
                <div key={entry.reason_key} className="border border-gray-100 dark:border-neutral-700 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${slots.length >= BRONZE_MAX_SLOTS_PER_REASON ? 'text-green-600' : 'text-gray-400'}`}>
                        {slots.length}/{BRONZE_MAX_SLOTS_PER_REASON}
                      </span>
                      {statusChip(entry.status)}
                    </div>
                  </div>
                  {slots.length > 0 && (
                    <div className="ml-2 mt-1.5 space-y-1">
                      {slots.map((slot, i) => occupantLine(entry, slot, i))}
                    </div>
                  )}
                  {entry.status !== 'filled' && entry.empty_slot_note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 ml-2 italic">
                      {entry.empty_slot_note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discovered fill candidates — draft slots not yet in the active
          profile. Only actionable once an active profile exists. */}
      {activeProfile && fillableCandidates.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Discovered Exemplars ({fillableCandidates.length})
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Exemplars the discovery scan found that are not already occupying a reason slot on the
            active profile. Filling commits directly to the active profile as a new version.
          </p>
          <div className="space-y-3">
            {fillableCandidates.map((candidate, idx) => {
              const slot = candidate.slot;
              const reasonLabel = candidate.reason_label ?? prettyReasonKey(candidate.reason_key);
              const fillKey = `${candidate.reason_key}|${bronzeSlotKey(slot)}`;
              const isFilling = fillingKey === fillKey;
              const presence = Object.entries(slot.platform_presence ?? {});
              return (
                <div key={idx} className="border border-gray-100 dark:border-neutral-700 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {slot.business_name}
                        </span>
                        <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">
                          {reasonLabel}
                        </span>
                        {slot.digital_quality && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            slot.digital_quality === 'very_low'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          }`}>
                            {BRONZE_DIGITAL_QUALITY_META[slot.digital_quality]?.label ?? slot.digital_quality}
                          </span>
                        )}
                        {slot.operational_status && (
                          <span className="text-xs text-gray-400">
                            {BRONZE_OPERATIONAL_STATUS_META[slot.operational_status]?.label ?? slot.operational_status}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        {slot.address && <span>{slot.address}</span>}
                        {(slot as any).observed_city && (
                          <span>{(slot as any).observed_city}{(slot as any).observed_state ? `, ${(slot as any).observed_state}` : ''}</span>
                        )}
                        {slot.observed_platform && (
                          <span className="text-gray-400">seen on {bronzePlatformLabel(slot.observed_platform)}</span>
                        )}
                      </div>
                      {presence.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {presence.map(([p, s]) => `${bronzePlatformLabel(p)}: ${BRONZE_PRESENCE_META[s]?.label ?? s}`).join(' · ')}
                        </div>
                      )}
                      {slot.category_fit_evidence && (
                        <div className="text-xs text-gray-500 mt-1">{slot.category_fit_evidence}</div>
                      )}
                      {slot.operational_evidence && (
                        <div className="text-xs text-gray-500 mt-0.5 italic">{slot.operational_evidence}</div>
                      )}
                      {(slot.evidence_urls ?? []).length > 0 && (
                        <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                          {(slot.evidence_urls ?? []).map((url, j) => (
                            <a
                              key={j}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Evidence ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled={isFilling || candidate.slotFull}
                        onClick={() => handleFill(candidate)}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                          candidate.slotFull
                            ? 'bg-gray-100 dark:bg-neutral-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                        }`}
                        title={candidate.slotFull ? `${reasonLabel} slot is full (${BRONZE_MAX_SLOTS_PER_REASON}/${BRONZE_MAX_SLOTS_PER_REASON})` : `Add to ${reasonLabel} slot`}
                      >
                        {isFilling ? 'Filling…' : candidate.slotFull ? 'Slot full' : `+ Fill ${reasonLabel} slot`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full scan output — the draft's complete calibration record */}
      {boardProfile && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <button
            type="button"
            onClick={() => setShowFullScan((v) => !v)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showFullScan ? 'Hide full scan output' : `View full scan output (${activeProfile ? `active v${activeProfile.version}` : `draft v${boardProfile.version}`})`}
          </button>
          {showFullScan && (
            <div className="mt-3">
              <BronzeStandardProfileView profile={boardProfile} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
