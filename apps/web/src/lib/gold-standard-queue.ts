import marketingOpsService, {
  type AddToQueueInput,
  type AddToQueueResult,
  type IntelligenceProfile,
} from '@/services/MarketingOpsService';

// ─── Gold-standard candidate → Prospect Queue ───────────────────────────
//
// Queues a gold-standard discovery candidate (usually one that did NOT
// qualify) as a pain-based prospect. Per SOP the queued prospect gets a
// full business audit before triage — the audit's signals are trusted,
// so the signals derived here are deliberately a coarse pre-screen from
// failed quality gates, just enough to give the queue card something to
// sort on. The business audit supersedes them.

export interface GoldStandardCandidateRef {
  business_name: string;
  city?: string;
  state?: string;
  nap?: { name?: string | null; address?: string | null; phone?: string | null };
  ownership_type?: string | null;
  location_count_estimate?: number | null;
  independence_rationale?: string | null;
  category_notes?: string | null;
  platform_evaluations?: Array<{
    platform: string;
    quality_score?: number | null;
    is_gold_standard?: boolean | null;
    quality_gates_failed?: string[];
    platform_config?: { website?: string | null } | null;
  }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
  bbb: 'BBB',
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

// Failed quality gates → canonical triage signal codes (coarse pre-screen).
// Keyword-matched on gate names; the business audit re-derives with full
// attention, so false negatives here are acceptable — false positives are
// not worth avoiding with a more elaborate mapping.
export function goldStandardPainSignals(candidate: GoldStandardCandidateRef): string[] {
  const signals = new Set<string>();
  const evals = candidate.platform_evaluations ?? [];
  const hasWebsite = evals.some((pe) => !!pe.platform_config?.website);
  if (!hasWebsite) signals.add('WC_MISSING_WEBSITE');
  for (const pe of evals) {
    for (const gate of pe.quality_gates_failed ?? []) {
      const g = gate.toLowerCase();
      if (g.includes('hours')) signals.add('DS_OUTDATED_HOURS');
      if (g.includes('photo') || g.includes('branding')) signals.add('DS_PHOTO_DEFICIT');
      if (g.includes('review')) signals.add('RA_LOW_REVIEW_VOLUME');
      if (g.includes('activity') || g.includes('messaging')) signals.add('VP_STALE_SOCIAL_ACTIVITY');
      if (g.includes('identity') || g.includes('completeness') || g.includes('map pin') || g.includes('map accuracy')) {
        signals.add('DS_MISSING_PROFILE');
      }
      if (g.includes('nap')) signals.add('CP_MISSING_CONTACT_INFO');
    }
  }
  return [...signals];
}

export function buildGoldStandardQueueInput(
  profile: IntelligenceProfile,
  candidate: GoldStandardCandidateRef,
): AddToQueueInput {
  const evals = candidate.platform_evaluations ?? [];
  const goldPlatforms = evals.filter((pe) => pe.is_gold_standard === true).map((pe) => pe.platform);
  const scores = evals.map((pe) => pe.quality_score ?? 0).filter((s) => s > 0);
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const failedGateSummary = evals
    .map((pe) => {
      const failed = pe.quality_gates_failed ?? [];
      return failed.length > 0
        ? `${platformLabel(pe.platform)}: ${failed.join(', ')}`
        : null;
    })
    .filter(Boolean)
    .join(' | ');
  const config = profile.configuration_json as Record<string, any> | undefined;
  const scanDate = config?.scan_metadata?.scan_date;

  return {
    business_name: candidate.business_name,
    title: `${candidate.business_name} — ${profile.category_name}`,
    category: profile.category_name,
    city: candidate.city,
    state: candidate.state,
    source_kind: 'gold_standard_candidate',
    audit_date: scanDate && !Number.isNaN(new Date(scanDate).getTime())
      ? new Date(scanDate).toISOString()
      : undefined,
    priority: goldPlatforms.length === 0 ? 'high' : 'normal',
    business_snapshot: {
      ...candidate,
      detected_signals: goldStandardPainSignals(candidate),
      gold_platforms: goldPlatforms,
      best_score: bestScore || undefined,
      source_profile: {
        id: profile.id,
        version: profile.version,
        category_name: profile.category_name,
      },
    },
    note: [
      `Gold-standard discovery gap (${profile.category_name}, profile ${profile.id} v${profile.version}).`,
      goldPlatforms.length > 0
        ? `Gold standard on ${goldPlatforms.length} platform${goldPlatforms.length !== 1 ? 's' : ''} (${goldPlatforms.map(platformLabel).join(', ')}), failed gates elsewhere.`
        : `Did not qualify on any platform${bestScore ? ` — best score ${bestScore}/10` : ''}.`,
      failedGateSummary ? `Failed gates: ${failedGateSummary}` : '',
      'SOP: run business audit — audit signals supersede this pre-screen.',
    ].filter(Boolean).join(' '),
  };
}

export async function queueGoldStandardCandidate(
  profile: IntelligenceProfile,
  candidate: GoldStandardCandidateRef,
): Promise<AddToQueueResult> {
  return marketingOpsService.addToQueue(buildGoldStandardQueueInput(profile, candidate));
}
