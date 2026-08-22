'use client';

import { useEffect, useState } from 'react';
import { MarketingOpsService, type IntelligenceProfile, type Campaign } from '@/services/MarketingOpsService';
import GoldStandardProfileView from './GoldStandardProfileView';

const marketingOpsService = MarketingOpsService.getInstance();

interface Props {
  campaign: Campaign;
}

/**
 * Gold Standard Establishment Panel
 *
 * Shown on the campaign detail Overview tab for gold-standard establishment
 * campaigns. Explains that the establishment campaign creates the profile
 * parameters (expected_fields, quality_gates, pattern exemplars) and requires
 * operator review + activation before downstream consumption.
 *
 * If a draft gold-standard profile was imported from the establishment scan,
 * shows a link to review and activate it in the Intelligence Profiles page.
 * If an active gold-standard profile already exists for this category, shows
 * its version and last-activated date.
 */
export default function GoldStandardEstablishmentPanel({ campaign }: Props) {
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
          marketingOpsService.listIntelligenceProfileDrafts('gold_standards'),
          marketingOpsService.resolveIntelligenceProfile(campaign.category, 'gold_standards', undefined, campaign.intelligence_platform ?? undefined),
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
          drafts.filter((p) => {
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
          }),
        );
        setActiveProfile(active);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load gold-standard profiles');
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

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
          Gold Standard Establishment
        </h4>
        <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
          This campaign establishes the gold-standard profile parameters for
          <span className="font-medium"> {campaign.category || 'this category'}</span> on
          <span className="font-medium"> {platformLabel}</span>.
          The establishment scan produces expected fields, quality gates, and pattern exemplars.
          The resulting profile is imported as a <span className="font-medium">draft</span> and must be
          reviewed and activated by an operator before downstream campaigns (discovery, audit, fulfill)
          can consume it.
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
              <div className="text-xs text-gray-500 mt-1">
                Updated: {activeProfile.updated_at ? new Date(activeProfile.updated_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">No active profile yet</div>
          )}
        </div>
      </div>

      {/* Active gold-standard profile — operator-friendly structured view */}
      {!loading && activeProfile && (
        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Active Gold Standard Profile Details
            </h5>
            <a
              href="/settings/admin/marketing-ops/intelligence-profiles"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage in Intelligence Profiles →
            </a>
          </div>
          <GoldStandardProfileView profile={activeProfile} />
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
            The establishment scan produced a draft gold-standard profile. Review and activate it
            in the Intelligence Profiles page before running discovery campaigns.
          </p>
          <div className="space-y-2">
            {draftProfiles.map((p) => (
              <div key={`${p.id}-${p.version}`} className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded p-2 border border-blue-100 dark:border-blue-800">
                <div className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{p.category_name}</span>
                  <span className="text-gray-500 ml-2">v{p.version}</span>
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
            No gold-standard profile has been established yet. Run the establishment prompt
            in the Prompts tab, then import the result to create a draft profile.
          </p>
        </div>
      )}
    </div>
  );
}
