'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type IntelligenceFocus, type Campaign } from '@/services/MarketingOpsService';
import GoldStandardProfileView, { isGoldStandardProfile } from './GoldStandardProfileView';
import CategoryProfileView from './CategoryProfileView';
import { profileScopeLabel } from '@/lib/intelligence-profile-scope';

const marketingOpsService = MarketingOpsService.getInstance();

interface Props {
  campaign: Campaign;
}

// Focus-specific copy + styling. Gold-standards keeps the amber treatment and
// the slot-coverage card; emerging/competitive use blue/violet and skip the
// slot card (it counts gold-standard-flagged candidates, which is a
// gold-standard-only concept).
const FOCUS_THEME: Record<
  IntelligenceFocus,
  {
    label: string;
    headerBg: string;
    headerBorder: string;
    headerTitleClass: string;
    headerBodyClass: string;
    establishmentNoun: string;
    produces: string;
    downstream: string;
  }
> = {
  gold_standards: {
    label: 'Gold Standard',
    headerBg: 'bg-amber-50 dark:bg-amber-900/10',
    headerBorder: 'border-amber-200 dark:border-amber-700',
    headerTitleClass: 'text-amber-900 dark:text-amber-300',
    headerBodyClass: 'text-amber-800 dark:text-amber-400',
    establishmentNoun: 'gold-standard profile parameters',
    produces:
      'The establishment scan produces expected fields, quality gates, and pattern exemplars.',
    downstream:
      'The resulting profile is imported as a draft and must be reviewed and activated by an operator before downstream campaigns (discovery, audit, fulfill) can consume it.',
  },
  emerging: {
    label: 'Emerging',
    headerBg: 'bg-blue-50 dark:bg-blue-900/10',
    headerBorder: 'border-blue-200 dark:border-blue-700',
    headerTitleClass: 'text-blue-900 dark:text-blue-300',
    headerBodyClass: 'text-blue-800 dark:text-blue-400',
    establishmentNoun: 'category intelligence profile',
    produces:
      'The establishment scan produces terminology, specialized sources (with capabilities and limitations), discovery patterns, evidence rules, prohibited inferences, and category signals for low-visibility, hard-to-find businesses.',
    downstream:
      'The resulting profile is imported as a draft and must be reviewed and activated by an operator before emerging discovery campaigns can consume it as their discovery criteria.',
  },
  competitive: {
    label: 'Competitive',
    headerBg: 'bg-violet-50 dark:bg-violet-900/10',
    headerBorder: 'border-violet-200 dark:border-violet-700',
    headerTitleClass: 'text-violet-900 dark:text-violet-300',
    headerBodyClass: 'text-violet-800 dark:text-violet-400',
    establishmentNoun: 'category intelligence profile',
    produces:
      'The establishment scan produces terminology, specialized sources (with capabilities and limitations), discovery patterns, evidence rules, prohibited inferences, and category signals for analyzing established competitors.',
    downstream:
      'The resulting profile is imported as a draft and must be reviewed and activated by an operator before competitive discovery campaigns can consume it as their evaluation criteria.',
  },
};

/**
 * Intelligence Establishment Panel
 *
 * Shown on the campaign detail Overview tab for intelligence-scope
 * establishment campaigns (any focus: gold_standards, emerging, competitive).
 * Explains that the establishment campaign creates the profile parameters for
 * its focus and requires operator review + activation before downstream
 * consumption.
 *
 * - If a draft profile was imported from the establishment scan, shows a link
 *   to review and activate it in the Intelligence Profiles page.
 * - If an active profile already exists for this category/focus/scope, shows
 *   its version, last-activated date, and an operator-friendly structured view
 *   (GoldStandardProfileView for gold-standard-shaped configs,
 *   CategoryProfileView for the §10 Category Intelligence Profile shape used
 *   by emerging/competitive establishment scans).
 * - For gold_standards, additionally renders the per-platform gold-standard
 *   slot coverage card (counts analyst-flagged gold-standard candidates).
 */
export default function IntelligenceEstablishmentPanel({ campaign }: Props) {
  const focus: IntelligenceFocus = (campaign.intelligence_focus as IntelligenceFocus) || 'emerging';
  const theme = FOCUS_THEME[focus] ?? FOCUS_THEME.emerging;
  const isGoldStandard = focus === 'gold_standards';

  const [draftProfiles, setDraftProfiles] = useState<IntelligenceProfile[]>([]);
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
        const [drafts, active] = await Promise.all([
          marketingOpsService.listIntelligenceProfileDrafts(focus),
          marketingOpsService.resolveIntelligenceProfile(
            campaign.category,
            focus,
            campaign.city || undefined,
            campaign.intelligence_platform ?? undefined,
            campaign.state || undefined,
          ),
        ]);
        if (cancelled) return;
        // Filter drafts to this campaign's category using normalized
        // comparison (lowercase, underscores/hyphens → spaces) so that
        // LLM-produced snake_case keys like "beauty_supply" match the
        // campaign's display category "Beauty Supply".
        const normalizedCategory = campaign.category
          .trim()
          .toLowerCase()
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ');
        setDraftProfiles(
          drafts
            .filter((p) => {
              const normalizedKey = (p.category_key || '')
                .trim()
                .toLowerCase()
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ');
              if (normalizedKey !== normalizedCategory) return false;
              // Platform filter: show drafts that match the campaign's
              // platform OR cross-platform drafts (reference_platform = null).
              const campaignPlatform = campaign.intelligence_platform ?? null;
              if (!campaignPlatform) return true;
              return p.reference_platform === campaignPlatform || p.reference_platform === null;
            })
            .sort((a, b) => {
              // Prefer drafts whose region scope matches the campaign's
              // city/state so the operator sees the most relevant draft first.
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
              return score(b) - score(a);
            }),
        );
        setActiveProfile(active);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load intelligence profiles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaign.category, campaign.city, campaign.state, campaign.intelligence_platform, focus]);

  const platformLabel = campaign.intelligence_platform
    ? campaign.intelligence_platform === 'all'
      ? 'All Platforms'
      : campaign.intelligence_platform.charAt(0).toUpperCase() + campaign.intelligence_platform.slice(1)
    : '—';

  const prettyPlatform = (platform: string): string => {
    return platform === 'apple_maps' ? 'Apple Maps' : platform === 'bbb' ? 'BBB' : platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  // Per-platform gold-standard slot counts + occupants from the active
  // profile's candidates. Gold-standards-only — emerging/competitive profiles
  // do not carry is_gold_standard candidate flags.
  const profileSlotCounts: Record<string, number> = (() => {
    const counts: Record<string, number> = {};
    if (!activeProfile?.configuration_json) return counts;
    const config = activeProfile.configuration_json as any;
    const candidates: Array<{ platform_evaluations?: Array<{ platform: string; is_gold_standard?: boolean | null }> }> =
      Array.isArray(config.candidates) ? config.candidates : [];
    for (const c of candidates) {
      for (const pe of c.platform_evaluations ?? []) {
        if (pe.is_gold_standard === true) {
          counts[pe.platform] = (counts[pe.platform] || 0) + 1;
        }
      }
    }
    return counts;
  })();

  const profileSlotOccupants: Record<string, Array<{ business_name: string; city?: string; state?: string; quality_score?: number | null; profile_url?: string | null }>> = (() => {
    const map: Record<string, Array<{ business_name: string; city?: string; state?: string; quality_score?: number | null; profile_url?: string | null }>> = {};
    if (!activeProfile?.configuration_json) return map;
    const config = activeProfile.configuration_json as any;
    const candidates: Array<{
      business_name: string;
      city?: string;
      state?: string;
      platform_evaluations?: Array<{ platform: string; is_gold_standard?: boolean | null; quality_score?: number | null; profile_url?: string | null }>;
    }> = Array.isArray(config.candidates) ? config.candidates : [];
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

  return (
    <div className="space-y-4">
      <div className={`${theme.headerBg} border ${theme.headerBorder} rounded-lg p-4`}>
        <h4 className={`text-sm font-semibold ${theme.headerTitleClass} mb-2`}>
          {theme.label} Establishment
        </h4>
        <p className={`text-xs ${theme.headerBodyClass} leading-relaxed`}>
          This campaign establishes the {theme.establishmentNoun} for
          <span className="font-medium"> {campaign.category || 'this category'}</span> on
          <span className="font-medium"> {platformLabel}</span>.
          {' '}{theme.produces}{' '}
          {theme.downstream}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Platform Focus</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{platformLabel}</div>
        </div>
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Active Profile</div>
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : activeProfile ? (
            <div className="text-sm text-gray-900 dark:text-white">
              <span className="font-medium">{activeProfile.id}</span> v{activeProfile.version}
              {activeProfile.reference_platform && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 capitalize">
                  ({activeProfile.reference_platform})
                </span>
              )}
              <span className={`ml-2 text-xs ${profileScopeLabel(activeProfile).kind === 'nationwide' ? 'text-gray-400' : profileScopeLabel(activeProfile).kind === 'state' ? 'text-blue-600 dark:text-blue-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                · {profileScopeLabel(activeProfile).label}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                Updated: {activeProfile.updated_at ? new Date(activeProfile.updated_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">No active profile yet</div>
          )}
        </div>
      </div>

      {/* Active profile — operator-friendly structured view. Gold-standard
          shapes render GoldStandardProfileView; the §10 Category Intelligence
          Profile shape (emerging/competitive) renders CategoryProfileView. */}
      {!loading && activeProfile && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Active {theme.label} Profile Details
            </h5>
            <a
              href="/settings/admin/marketing-ops/intelligence-profiles"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage in Intelligence Profiles →
            </a>
          </div>
          {isGoldStandardProfile(activeProfile) ? (
            <GoldStandardProfileView profile={activeProfile} />
          ) : (
            <CategoryProfileView profile={activeProfile} />
          )}
        </div>
      )}

      {/* Per-platform gold-standard slot coverage — gold-standards only.
          Mirrors the discovery overview's slot card so the establishment
          report states how many of the up-to-4 slots per platform are filled
          by the analyst-flagged establishment candidates. */}
      {isGoldStandard && !loading && activeProfile && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Gold Standard Slots
            <span className="ml-1 text-gray-400 font-normal">(up to 4 per platform)</span>
          </div>
          {Object.keys(profileSlotCounts).length === 0 ? (
            <div className="text-sm text-gray-400">
              No candidates in profile slots yet
              <div className="text-xs mt-1 text-gray-400">
                The establishment scan did not flag any candidates as gold standard on a platform.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(profileSlotCounts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([platform, count]) => {
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
                          {occupants.map((occ, i) => (
                            <div key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                              <span className="text-amber-500">&bull;</span>
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
                                  &#8599;
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {draftProfiles.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Draft Profiles Awaiting Review ({draftProfiles.length})
          </h5>
          <p className="text-xs text-blue-800 dark:text-blue-400 mb-3">
            The establishment scan produced a draft {theme.establishmentNoun}. Review and activate it
            in the Intelligence Profiles page before running {isGoldStandard ? 'discovery campaigns' : `${theme.label.toLowerCase()} discovery campaigns`}.
          </p>
          <div className="space-y-2">
            {draftProfiles.map((p) => (
              <div key={`${p.id}-${p.version}`} className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{p.category_name}</span>
                  <span className="text-gray-500 ml-2">v{p.version}</span>
                  {profileScopeLabel(p).kind !== 'nationwide' && (
                    <span className={`ml-2 text-xs ${profileScopeLabel(p).kind === 'state' ? 'text-blue-600 dark:text-blue-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                      · {profileScopeLabel(p).label}
                    </span>
                  )}
                </div>
                <a
                  href="/settings/admin/marketing-ops/intelligence-profiles"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Review &amp; Activate →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !activeProfile && draftProfiles.length === 0 && (
        <div className="bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No {theme.label.toLowerCase()} profile has been established yet. Run the establishment prompt
            in the Prompts tab, then import the result to create a draft profile.
          </p>
        </div>
      )}
    </div>
  );
}
