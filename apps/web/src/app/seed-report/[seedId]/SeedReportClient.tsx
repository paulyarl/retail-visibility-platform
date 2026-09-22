'use client';

/**
 * SeedReportClient — customer-facing report preview page (/seed-report/{seedId}).
 *
 * This is the page the report-delivery QR redirects to after tracking the
 * scan. It renders the "how we found you" narrative with the claim CTA.
 *
 * Flow:
 *   1. Fetch the latest published report via GET /api/public/marketing/seed/:seedId/report/preview
 *   2. Fetch the claim token for the CTA (via the existing claim-summary endpoint)
 *   3. Render the report sections: identity, sources, signals, claim CTA
 *   4. Handle "no published report" gracefully — show a fallback message
 *
 * The page is intentionally lightweight — it's the first impression a business
 * owner gets after scanning the QR or clicking the link. It should load fast,
 * read clearly on mobile, and lead directly into the claim action.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  IconShieldCheck,
  IconSearch,
  IconBuilding,
  IconAlertCircle,
  IconCheck,
  IconQrcode,
  IconWorld,
  IconTag,
} from '@tabler/icons-react';
import { Badge, Button, Card, Group, Text, ThemeIcon, Alert, Loader, Center } from '@mantine/core';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';
import { generateQrDataUrl } from '@/lib/qr-engine';

// ─── Types ────────────────────────────────────────────────────────────────

interface ReportPreviewData {
  report_id: string;
  seed_id: string;
  version: number;
  status: string;
  generated_at: string;
  claim_token: string | null;
  claim_short_code: string | null;
  business_identity: {
    business_name: { value: string; state: string };
    address: { value: string; state: string };
    phone: { value: string | null; state: string };
    city: { value: string; state: string };
    state: { value: string; state: string };
    website: { value: string | null; state: string };
  };
  narrative: {
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

/** Last-resort display for an internal snake_case key (e.g. a bronze
    reason_key with no catalog label and no basis). */
function humanizeKey(key: string): string {
  const h = key.replace(/[_-]+/g, ' ').trim();
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : key;
}

// ─── Service ─────────────────────────────────────────────────────────────

class SeedReportPublicService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: SeedReportPublicService;

  private constructor() {
    super('seed-report-public-service');
  }

  public static getInstance(): SeedReportPublicService {
    if (!SeedReportPublicService.instance) {
      SeedReportPublicService.instance = new SeedReportPublicService();
    }
    return SeedReportPublicService.instance;
  }

  async getReportPreview(seedId: string): Promise<ReportPreviewData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/seed/${encodeURIComponent(seedId)}/report/preview`,
        {},
        `report-preview-${seedId}`,
        300_000,
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      return (result.data?.data ?? result.data) ?? null;
    } catch (error) {
      clientLogger.error('[SeedReportPublicService] Failed to load report:', { detail: error });
      return null;
    }
  }

}

const reportService = SeedReportPublicService.getInstance();

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

export default function SeedReportClient() {
  const params = useParams();
  const seedId = (params?.seedId as string) || '';

  const [report, setReport] = useState<ReportPreviewData | null>(null);
  const [claimQrDataUrl, setClaimQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!seedId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    reportService.getReportPreview(seedId).then(async (reportData) => {
      if (cancelled) return;
      if (!reportData) {
        setNotFound(true);
      } else {
        setReport(reportData);
        // Generate claim QR — encode the tracked short-code URL so scans
        // record as claim_invite in QR analytics.
        if (reportData.claim_short_code) {
          try {
            const claimQrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${reportData.claim_short_code}`;
            const dataUrl = await generateQrDataUrl({
              data: claimQrUrl,
              exportSize: 256,
              styled: true,
              template: 'default',
            });
            if (!cancelled) setClaimQrDataUrl(dataUrl);
          } catch {
            // QR generation is best-effort — the text CTA still works.
          }
        }
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [seedId]);

  if (loading) {
    return (
      <Center mih="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card withBorder radius="md" p="xl" className="max-w-md w-full text-center">
          <ThemeIcon color="gray" size="xl" variant="light" className="mx-auto mb-4">
            <IconSearch size={24} />
          </ThemeIcon>
          <Text fw={600} size="lg" mb="xs">Report not available</Text>
          <Text size="sm" c="dimmed">
            This report hasn't been published yet or the link is invalid.
          </Text>
        </Card>
      </div>
    );
  }

  const businessName = report.business_identity.business_name.value || 'This business';
  const claimHref = report.claim_token ? `/place/claim/${report.claim_token}` : '#claim-inquiry';
  const isClaimed = report.claim_summary.claim_status === 'claimed';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <Text size="sm" c="dimmed" mb="xs">Free Business Report</Text>
          <Text fw={700} size="xl" className="text-2xl sm:text-3xl">{businessName}</Text>
          <Text size="sm" c="dimmed" mt="xs">
            Report v{report.version} — {new Date(report.generated_at).toLocaleDateString()}
          </Text>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status badges */}
        <Group gap="xs">
          {confidenceBadge(report.identity_reconciliation.identity_confidence)}
          {locationBadge(report.market_classification.location_status)}
          {claimStatusBadge(report.claim_summary.claim_status)}
        </Group>

        {/* Introduction (spec §10.1) */}
        <Card withBorder radius="md" p="lg">
          <Text size="sm" c="dimmed">
            Visibility is part of how customers discover, evaluate, and choose a
            business. They may encounter you through search, maps, directories,
            social platforms, local sources, or category-specific marketplaces —
            and those sources may not all represent your business the same way.
          </Text>
          <Text size="sm" c="dimmed" mt="sm">
            We researched the public signals associated with your business and
            assembled them into a free business seed. This report shows what we
            found, where it came from, what appears consistent, and what still
            needs confirmation. The goal is to make the available intelligence
            visible, start a useful conversation, and give you the opportunity to
            verify and claim the record that represents your business.
          </Text>
        </Card>

        {/* About this business — Tier-C-safe audit narrative + market summary */}
        {(report.narrative?.public_narrative ||
          report.narrative?.market_summary ||
          report.narrative?.metro_context) && (
          <Card withBorder radius="md" p="lg">
            <Group gap="sm" mb="md">
              <ThemeIcon color="blue" size="lg" variant="light">
                <IconBuilding size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">About this business</Text>
            </Group>
            {report.narrative?.public_narrative && (
              <Text size="sm">{report.narrative.public_narrative}</Text>
            )}
            {report.narrative?.market_summary && (
              <Text size="sm" c="dimmed" mt={report.narrative?.public_narrative ? 'sm' : 0}>
                {report.narrative.market_summary}
              </Text>
            )}
            {report.narrative?.metro_context && (
              <Text size="sm" c="dimmed" mt="sm">
                {report.narrative.metro_context}
              </Text>
            )}
            {(report.narrative?.notable_areas ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {(report.narrative?.notable_areas ?? []).map((area, i) => (
                  <Badge key={i} variant="light" size="sm" color="gray">
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Business identity */}
        <Card withBorder radius="md" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon color="blue" size="lg" variant="light">
              <IconBuilding size={18} />
            </ThemeIcon>
            <Text fw={600} size="lg">Business Identity</Text>
          </Group>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Text size="sm" fw={500} className="w-24">Name:</Text>
              <Text size="sm">{report.business_identity.business_name.value}</Text>
            </div>
            <div className="flex items-start gap-2">
              <Text size="sm" fw={500} className="w-24">Address:</Text>
              <Text size="sm">
                {[
                  report.business_identity.address.value,
                  report.business_identity.city.value,
                  report.business_identity.state.value,
                ].filter(Boolean).join(', ')}
              </Text>
            </div>
            {report.business_identity.phone.value && (
              <div className="flex items-start gap-2">
                <Text size="sm" fw={500} className="w-24">Phone:</Text>
                <Text size="sm">{report.business_identity.phone.value}</Text>
              </div>
            )}
            {report.business_identity.website.value && (
              <div className="flex items-start gap-2">
                <Text size="sm" fw={500} className="w-24">Website:</Text>
                <Text size="sm" className="text-blue-600">{report.business_identity.website.value}</Text>
              </div>
            )}
          </div>
        </Card>

        {/* How we found you */}
        <Card withBorder radius="md" p="lg">
          <Group gap="sm" mb="md">
            <ThemeIcon color="blue" size="lg" variant="light">
              <IconSearch size={18} />
            </ThemeIcon>
            <Text fw={600} size="lg">How we found this business</Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            We researched public sources to assemble this business seed.
            {report.source_summary.sources_checked_count} source{report.source_summary.sources_checked_count !== 1 ? 's' : ''} checked,
            {' '}{report.source_summary.sources_with_evidence_count} with evidence.
          </Text>
          {report.source_summary.source_types.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.source_summary.source_types.map((s, i) => (
                <Badge key={i} variant="light" size="sm" color="gray">
                  {s.label ?? s.source_name} ({s.observation_count})
                </Badge>
              ))}
            </div>
          )}
          {(report.source_summary.name_variants_count > 1 || report.source_summary.address_variants_count > 1) && (
            <Text size="xs" c="dimmed" mt="sm">
              {report.source_summary.name_variants_count > 1 && `${report.source_summary.name_variants_count} name variants found`}
              {report.source_summary.name_variants_count > 1 && report.source_summary.address_variants_count > 1 && ' • '}
              {report.source_summary.address_variants_count > 1 && `${report.source_summary.address_variants_count} address variants found`}
            </Text>
          )}
          {/* Discovery attribution — why this business surfaced in our
              research (bronze-lane causal basis, §7.4) */}
          {(report.source_summary.discovery_attribution ?? []).length > 0 && (
            <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 p-3">
              <Text size="xs" fw={600} className="text-blue-800" mb={4}>
                Why this business appeared in our research
              </Text>
              {(report.source_summary.discovery_attribution ?? []).map((attr, i) => (
                <Text key={i} size="xs" className="text-blue-700">
                  {attr.label ?? attr.basis ?? humanizeKey(attr.reason_key)}
                  {attr.label && attr.basis ? ` — ${attr.basis}` : ''}
                </Text>
              ))}
            </div>
          )}
          {/* Report limitation language (spec §15.3) */}
          <Text size="xs" c="dimmed" mt="md">
            This report reflects information available in the sources checked on
            the generation date. &quot;Not found during discovery&quot; means the
            information was not located in those sources — it does not mean the
            information does not exist.
          </Text>
        </Card>

        {/* Category + market context */}
        {report.market_classification.category && (
          <Card withBorder radius="md" p="lg">
            <Group gap="sm" mb="md">
              <ThemeIcon color="gray" size="lg" variant="light">
                <IconTag size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Category & market</Text>
            </Group>
            <Text size="sm" fw={500}>
              {report.market_classification.category}
              {report.market_classification.subcategory && ` → ${report.market_classification.subcategory}`}
            </Text>
            {report.market_classification.category_profile_context && (
              <Text size="sm" c="dimmed" mt="sm">
                {report.market_classification.category_profile_context}
              </Text>
            )}
            {(report.market_classification.operational_signals ?? []).length > 0 && (
              <div className="mt-3">
                <Text size="xs" fw={600} c="dimmed" mb={4}>
                  What customers typically look for in this category
                </Text>
                <ul className="space-y-1">
                  {(report.market_classification.operational_signals ?? []).map((signal, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <IconCheck size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(report.market_classification.recommended_categories ?? []).length > 0 && (
              <div className="mt-3">
                <Text size="xs" fw={600} c="dimmed" mb={4}>
                  Other shelves this business could appear on
                </Text>
                <div className="flex flex-wrap gap-2">
                  {(report.market_classification.recommended_categories ?? []).map((c, i) => (
                    <Badge key={i} variant="light" size="sm" color="blue">
                      {c.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Platform presence — where customers may encounter the business */}
        {(report.platform_presence?.platforms ?? []).length > 0 && (
          <Card withBorder radius="md" p="lg">
            <Group gap="sm" mb="md">
              <ThemeIcon color="blue" size="lg" variant="light">
                <IconWorld size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Where customers may find you</Text>
            </Group>
            <div className="space-y-2">
              {(report.platform_presence?.platforms ?? []).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <Text size="sm" className="capitalize">{p.platform}</Text>
                  <Group gap="xs">
                    {p.claimed_status === 'claimed' && (
                      <Badge variant="light" size="xs" color="green">claimed</Badge>
                    )}
                    {p.claimed_status === 'unclaimed' && (
                      <Badge variant="light" size="xs" color="orange">unclaimed</Badge>
                    )}
                    <Text size="xs" c="dimmed">
                      {p.presence === 'observed'
                        ? 'Found'
                        : p.presence === 'not_found_during_discovery'
                          ? 'Not found during discovery'
                          : 'Not checked'}
                    </Text>
                  </Group>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Intelligence signals */}
        {report.intelligence_signals.signals.length > 0 && (
          <Card withBorder radius="md" p="lg">
            <Group gap="sm" mb="md">
              <ThemeIcon color="blue" size="lg" variant="light">
                <IconAlertCircle size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">What we noticed</Text>
            </Group>
            <div className="space-y-3">
              {report.intelligence_signals.signals.map((signal) => (
                <div key={signal.code} className="flex items-start gap-3">
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
          </Card>
        )}

        {/* Claim CTA + QR */}
        <Card withBorder radius="md" p="lg" className={isClaimed ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
          <Group gap="sm" mb="md">
            <ThemeIcon color={isClaimed ? 'green' : 'blue'} size="lg" variant="light">
              <IconShieldCheck size={18} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              {isClaimed ? 'This business is claimed' : 'Claim this business seed'}
            </Text>
          </Group>

          {isClaimed ? (
            <Text size="sm" c="dimmed">
              This business has been claimed by its owner. The information above reflects
              the verified listing.
            </Text>
          ) : (
            <>
              <Text size="sm" c="dimmed" mb="md">
                Verify your details, correct any errors, and connect your preferred profiles.
                Claiming is free.
              </Text>
              <ul className="mb-4 space-y-1">
                {report.claim_summary.claim_benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <IconCheck size={14} className="text-green-600 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>

              {/* Claim QR — scan to claim on another device */}
              {claimQrDataUrl && (
                <div className="flex flex-col items-center gap-2 mb-4 p-4 bg-white rounded-lg border border-blue-200">
                  <img
                    src={claimQrDataUrl}
                    alt="Claim QR code"
                    className="w-40 h-40 rounded"
                  />
                  <Text size="xs" c="dimmed" className="flex items-center gap-1">
                    <IconQrcode size={14} />
                    Scan to claim on your phone
                  </Text>
                </div>
              )}

              {report.next_actions.cta_eligible && report.next_actions.primary_cta ? (
                <Link href={claimHref}>
                  <Button
                    fullWidth
                    size="lg"
                    leftSection={<IconShieldCheck size={18} />}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {report.next_actions.primary_cta}
                  </Button>
                </Link>
              ) : (
                <Alert color="gray" title="Claim unavailable">
                  {report.next_actions.cta_disabled_reason || 'This report is not yet ready for claiming.'}
                </Alert>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
