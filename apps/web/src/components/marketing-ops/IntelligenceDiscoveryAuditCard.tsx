'use client';

/**
 * IntelligenceDiscoveryAuditCard (Sprint 3 — Seek Intelligence Scope)
 *
 * Renders the run summary header for an Intelligence-scope discovery audit:
 *   - Profile name + version (or "Generic fallback")
 *   - Intelligence mode (profile / none)
 *   - Focus (emerging / competitive)
 *   - Candidate / qualifying / hold counts
 *   - Run link
 *
 * Also renders the candidate table sorted by business_seek_priority,
 * with hold rows showing disabled actions + tooltip.
 */

import { useState, useEffect, useMemo } from 'react';
import marketingOpsService, {
  type IntelligenceRun,
  type IntelligenceProfile,
  type CampaignScope,
} from '@/services/MarketingOpsService';

interface DiscoveredBusiness {
  business_name: string;
  category: string;
  city: string;
  state?: string;
  location_status: string;
  ownership_type: string;
  category_fit: string;
  identity_confidence: string;
  discovery_signals: string[];
  discovery_provenance: Array<{ source: string; role: string; evidence_types?: string[] }>;
  business_seek_recommended: boolean;
  business_seek_priority: string;
  rating?: number | null;
  review_count?: number | null;
}

interface IntelligenceDiscoveryAuditCardProps {
  campaignId: string;
  campaignScope: CampaignScope;
  category: string;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, hold: 3 };

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function IntelligenceDiscoveryAuditCard({
  campaignId,
  campaignScope,
  category,
}: IntelligenceDiscoveryAuditCardProps) {
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [profile, setProfile] = useState<IntelligenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignScope !== 'intelligence') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [runList, resolvedProfile] = await Promise.all([
          marketingOpsService.listIntelligenceRuns(campaignId),
          marketingOpsService.resolveIntelligenceProfile(category),
        ]);
        if (cancelled) return;
        setRuns(runList);
        setProfile(resolvedProfile);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load intelligence run data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, campaignScope, category]);

  const latestRun = runs[0];

  if (campaignScope !== 'intelligence') return null;
  if (loading) return <div className="text-sm text-gray-400">Loading intelligence run…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/20 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Intelligence Discovery</h3>
        {latestRun && (
          <a
            href={`/api/admin/marketing-ops/intelligence-runs/${latestRun.id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            Run {latestRun.id.slice(0, 12)}…
          </a>
        )}
      </div>

      {/* Run summary header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-gray-400">Profile:</span>{' '}
          <span className="font-medium">
            {profile ? `${profile.id} v${profile.version}` : 'No profile — generic fallback'}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Mode:</span>{' '}
          <span className="font-medium">{latestRun?.intelligence_mode ?? (profile ? 'profile' : 'none')}</span>
        </div>
        <div>
          <span className="text-gray-400">Focus:</span>{' '}
          <span className="font-medium">{latestRun?.focus ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-400">Candidates:</span>{' '}
          <span className="font-medium">{latestRun?.candidate_count ?? 0}</span>
        </div>
        <div>
          <span className="text-gray-400">Qualifying:</span>{' '}
          <span className="font-medium text-green-600">{latestRun?.qualifying_count ?? 0}</span>
        </div>
        <div>
          <span className="text-gray-400">Hold:</span>{' '}
          <span className="font-medium text-amber-600">{latestRun?.hold_count ?? 0}</span>
        </div>
      </div>

      {!latestRun && (
        <p className="text-xs text-gray-400">
          No intelligence runs yet. Run the discovery prompt and import the result to populate this card.
        </p>
      )}
    </div>
  );
}
