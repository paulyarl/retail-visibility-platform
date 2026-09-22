'use client';

/**
 * SeedReportPreview — renders the seed intelligence report on the unclaimed
 * listing surface (/place/[slug]).
 *
 * Shows the "how we found you" story: sources checked, identity confidence,
 * intelligence signals, and the claim CTA. This is the provenance narrative
 * that leads into the claim action — it explains why the listing exists and
 * what the owner can verify.
 *
 * Data comes from GET /api/public/marketing/seed/:seedId/report/preview
 * (only lint-passed published reports are served).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconShieldCheck,
  IconSearch,
  IconMapPin,
  IconBuilding,
  IconAlertCircle,
  IconCheck,
  IconClock,
} from '@tabler/icons-react';
import { Badge, Card, Group, Text, ThemeIcon } from '@mantine/core';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// ─── Types ────────────────────────────────────────────────────────────────

interface ReportPreviewData {
  report_id: string;
  seed_id: string;
  version: number;
  status: string;
  generated_at: string;
  business_identity: {
    business_name: { value: string; state: string };
    address: { value: string; state: string };
    phone: { value: string | null; state: string };
    city: { value: string; state: string };
    state: { value: string; state: string };
    website: { value: string | null; state: string };
  };
  narrative?: {
    public_narrative: string | null;
    market_summary: string | null;
    metro_context?: string | null;
    notable_areas?: string[];
  } | null;
  source_summary: {
    sources_checked_count: number;
    sources_with_evidence_count: number;
    source_types: Array<{ source_type: string; source_name: string; label?: string; role: string; observation_count: number }>;
    name_variants_count: number;
    address_variants_count: number;
    discovery_attribution?: Array<{ reason_key: string; basis: string | null; label?: string | null }>;
  };
  identity_reconciliation: {
    canonical_candidate: {
      business_name: string;
      address: string;
      city: string;
      state: string;
      phone: string | null;
      confidence: string;
    } | null;
    identity_confidence: string;
  };
  market_classification: {
    category: string | null;
    subcategory: string | null;
    category_fit: string;
    location_status: string;
    category_profile_context?: string | null;
    operational_signals?: string[];
    recommended_categories?: Array<{
      category: string;
      confidence: string;
      subcategory: string | null;
      basis: string | null;
    }>;
  };
  platform_presence?: {
    platforms: Array<{
      platform: string;
      presence: string;
      claimed_status: string | null;
      source_url: string | null;
    }>;
  };
  intelligence_signals: {
    signals: Array<{ code: string; label: string; basis: string }>;
  };
  claim_summary: {
    claim_status: string;
    claim_benefits: string[];
  };
  next_actions: {
    primary_cta: string | null;
    cta_eligible: boolean;
    cta_disabled_reason: string | null;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────

class SeedReportPreviewService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: SeedReportPreviewService;

  private constructor() {
    super('seed-report-preview-service');
  }

  public static getInstance(): SeedReportPreviewService {
    if (!SeedReportPreviewService.instance) {
      SeedReportPreviewService.instance = new SeedReportPreviewService();
    }
    return SeedReportPreviewService.instance;
  }

  async getReportPreview(seedId: string): Promise<ReportPreviewData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/seed/${encodeURIComponent(seedId)}/report/preview`,
        {},
        `report-preview-${seedId}`,
        300_000, // 5-min cache
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      return (result.data?.data ?? result.data) ?? null;
    } catch (error) {
      clientLogger.error('[SeedReportPreviewService] Failed to load report preview:', { detail: error });
      return null;
    }
  }
}

const reportPreviewService = SeedReportPreviewService.getInstance();

// ─── Helpers ─────────────────────────────────────────────────────────────

function confidenceBadge(confidence: string) {
  const map: Record<string, { color: string; label: string }> = {
    high: { color: 'green', label: 'High confidence' },
    medium: { color: 'yellow', label: 'Medium confidence' },
    low: { color: 'red', label: 'Low confidence' },
    unknown: { color: 'gray', label: 'Unknown' },
  };
  const m = map[confidence] ?? map.unknown;
  return <Badge color={m.color} size="sm">{m.label}</Badge>;
}

function locationBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    in_market: { color: 'green', label: 'In market' },
    adjacent: { color: 'yellow', label: 'Adjacent' },
    outside_market: { color: 'gray', label: 'Outside market' },
    unresolved: { color: 'orange', label: 'Unresolved' },
  };
  const m = map[status] ?? map.unresolved;
  return <Badge color={m.color} size="sm">{m.label}</Badge>;
}

function claimStatusBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    unclaimed: { color: 'blue', label: 'Unclaimed' },
    claim_invited: { color: 'violet', label: 'Claim invited' },
    claim_pending: { color: 'orange', label: 'Claim pending' },
    claimed: { color: 'green', label: 'Claimed' },
  };
  const m = map[status] ?? map.unclaimed;
  return <Badge color={m.color} size="sm">{m.label}</Badge>;
}

// ─── Component ───────────────────────────────────────────────────────────

export interface SeedReportPreviewProps {
  seedId: string;
  claimToken?: string | null;
}

export default function SeedReportPreview({ seedId, claimToken }: SeedReportPreviewProps) {
  const [report, setReport] = useState<ReportPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportPreviewService.getReportPreview(seedId).then((data) => {
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setReport(data);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [seedId]);

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" className="animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded mb-4" />
        <div className="h-4 w-full bg-neutral-200 rounded mb-2" />
        <div className="h-4 w-3/4 bg-neutral-200 rounded" />
      </Card>
    );
  }

  if (notFound || !report) {
    return null; // No published report — render nothing (not an error state)
  }

  const claimHref = claimToken ? `/place/claim/${claimToken}` : '#claim-inquiry';

  return (
    <Card withBorder radius="md" p="lg">
      {/* Header */}
      <Group gap="sm" mb="md">
        <ThemeIcon color="blue" size="lg" variant="light">
          <IconSearch size={18} />
        </ThemeIcon>
        <div>
          <Text fw={600} size="lg">How we found this business</Text>
          <Text size="sm" c="dimmed">Report v{report.version} — {new Date(report.generated_at).toLocaleDateString()}</Text>
        </div>
      </Group>

      {/* Tier-C-safe audit narrative (when present) */}
      {report.narrative?.public_narrative && (
        <Text size="sm" mb="md">{report.narrative.public_narrative}</Text>
      )}

      {/* Identity confidence + location */}
      <Group gap="xs" mb="md">
        {confidenceBadge(report.identity_reconciliation.identity_confidence)}
        {locationBadge(report.market_classification.location_status)}
        {claimStatusBadge(report.claim_summary.claim_status)}
      </Group>

      {/* Source summary */}
      <div className="mb-4">
        <Text size="sm" fw={500} mb="xs">Sources checked</Text>
        <Text size="sm" c="dimmed">
          {report.source_summary.sources_checked_count} source{report.source_summary.sources_checked_count !== 1 ? 's' : ''} checked
          ({report.source_summary.sources_with_evidence_count} with evidence)
        </Text>
        {report.source_summary.source_types.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {report.source_summary.source_types.map((s, i) => (
              <Badge key={i} variant="light" size="sm" color="gray">
                {s.label ?? s.source_name} ({s.observation_count})
              </Badge>
            ))}
          </div>
        )}
        {(report.source_summary.name_variants_count > 1 || report.source_summary.address_variants_count > 1) && (
          <Text size="xs" c="dimmed" mt="xs">
            {report.source_summary.name_variants_count > 1 && `${report.source_summary.name_variants_count} name variants`}
            {report.source_summary.name_variants_count > 1 && report.source_summary.address_variants_count > 1 && ' • '}
            {report.source_summary.address_variants_count > 1 && `${report.source_summary.address_variants_count} address variants`}
          </Text>
        )}
        {/* Bronze-lane discovery attribution — why this business surfaced */}
        {(report.source_summary.discovery_attribution ?? []).map((attr, i) => (
          <Text key={i} size="xs" c="dimmed" mt="xs">
            {attr.label ?? attr.basis ?? attr.reason_key.replace(/[_-]+/g, ' ')}
            {attr.label && attr.basis ? ` — ${attr.basis}` : ''}
          </Text>
        ))}
      </div>

      {/* Platform presence — where the audit found profiles */}
      {(report.platform_presence?.platforms ?? []).length > 0 && (
        <div className="mb-4">
          <Text size="sm" fw={500} mb="xs">Where customers may find you</Text>
          <div className="flex flex-wrap gap-1">
            {(report.platform_presence?.platforms ?? []).map((p, i) => (
              <Badge
                key={i}
                variant="light"
                size="sm"
                color={p.presence === 'observed' ? 'blue' : 'gray'}
              >
                <span className="capitalize">{p.platform}</span>
                {p.claimed_status === 'unclaimed' ? ' (unclaimed)' : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Intelligence signals */}
      {report.intelligence_signals.signals.length > 0 && (
        <div className="mb-4">
          <Text size="sm" fw={500} mb="xs">Intelligence signals</Text>
          <div className="space-y-1.5">
            {report.intelligence_signals.signals.map((signal) => (
              <div key={signal.code} className="flex items-start gap-2">
                <ThemeIcon color="blue" size="sm" variant="light" mt={2}>
                  <IconAlertCircle size={14} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={500}>{signal.label}</Text>
                  <Text size="xs" c="dimmed">{signal.basis}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category + shelf portfolio */}
      {report.market_classification.category && (
        <div className="mb-4">
          <Text size="sm" fw={500} mb="xs">Category</Text>
          <Group gap="xs">
            <ThemeIcon color="gray" size="sm" variant="light">
              <IconBuilding size={14} />
            </ThemeIcon>
            <Text size="sm">
              {report.market_classification.category}
              {report.market_classification.subcategory && ` → ${report.market_classification.subcategory}`}
            </Text>
          </Group>
          {(report.market_classification.recommended_categories ?? []).length > 0 && (
            <Text size="xs" c="dimmed" mt="xs">
              Also fits:{' '}
              {(report.market_classification.recommended_categories ?? [])
                .map((c) => c.category)
                .join(', ')}
            </Text>
          )}
        </div>
      )}

      {/* Claim CTA */}
      {report.next_actions.cta_eligible && report.next_actions.primary_cta && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm" fw={500}>Claim this business seed</Text>
              <Text size="xs" c="dimmed">
                Verify your details and connect your preferred profiles
              </Text>
            </div>
            <Link
              href={claimHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold text-sm whitespace-nowrap"
            >
              <IconShieldCheck size={16} /> {report.next_actions.primary_cta}
            </Link>
          </Group>
        </div>
      )}

      {/* CTA disabled reason */}
      {!report.next_actions.cta_eligible && report.next_actions.cta_disabled_reason && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <Text size="xs" c="dimmed">{report.next_actions.cta_disabled_reason}</Text>
        </div>
      )}
    </Card>
  );
}
