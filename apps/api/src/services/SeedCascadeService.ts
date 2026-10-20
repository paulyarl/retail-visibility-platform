/**
 * SeedCascadeService — per-prospect cascade position + gate summary.
 *
 * Reads the seed's canonical touch ledger, the linked campaigns' outreach
 * logs, gallery events, and tagged QR scans, then derives the four-act
 * position and the act-3 walk-in gate.
 *
 * Act derivation (spec §2.1 / §2.3 / §7):
 *   act 1 — verification: operational + a contact channel + a confirmed/
 *           desk-confirmed pain (approximated from the seed state, touches,
 *           and structured verification_results).
 *   act 2 — awareness: a mail/email touch after the announce.
 *   act 3 — show: a gallery_opened on a linked campaign or a gallery-tagged
 *           QR scan. A confirm-page scan alone is act-2 delivery, not act 3.
 *   act 4 — tell: a visit touch.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §2.1/§2.3/§7.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';

export type CascadeActStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';

export interface CascadeAct {
  act: 1 | 2 | 3 | 4;
  name: string;
  status: CascadeActStatus;
  detail: string;
  lastEventAt: string | null;
}

export interface CascadeTimelineEvent {
  id: string;
  source: 'seed_touch' | 'campaign_log' | 'gallery_event' | 'qr_scan';
  at: string;
  channel: string | null;
  outcome: string | null;
  label: string;
  notes: string | null;
}

export interface SeedCascadeSummary {
  seedId: string;
  businessName: string | null;
  seedStatus: string;
  outreachState: string;
  publishedAt: string | null;
  announceScheduledAt: string | null;
  announceDeliveredAt: string | null;
  announceChannel: string | null;
  acts: CascadeAct[];
  gate: {
    act1Cleared: boolean;
    act3Cleared: boolean;
    gateCleared: boolean;
    reason: string;
    galleryOpenedAt: string | null;
    galleryTaggedScanAt: string | null;
    confirmScanAt: string | null;
    missing: string[];
  };
  linkedCampaigns: Array<{
    id: string;
    displayId: string | null;
    businessName: string | null;
    stage: string | null;
    linkRole: string;
  }>;
  timeline: CascadeTimelineEvent[];
}

interface SeedRow {
  id: string;
  tenant_id: string;
  status: string;
  outreach_state: string | null;
  published_at: Date | null;
  business_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  listing_phone: string | null;
  listing_email: string | null;
  nap_verified_at: Date | null;
  contact_status: string | null;
  category: string;
  city: string;
  state: string;
}

interface TouchRow {
  id: string;
  channel: string;
  outcome: string | null;
  notes: string | null;
  occurred_at: Date;
  metadata: any;
}

interface LogRow {
  id: string;
  campaign_id: string;
  contact_channel: string;
  outcome: string;
  notes: string | null;
  contact_date: Date;
  created_at: Date;
  call_details: any;
  verification_results: any;
}

const VERIFICATION_PAIN_TYPES = new Set([
  'pain_confirmed',
  'fact_confirmed',
  'pain_discovered',
]);

function hasPainResult(results: any): boolean {
  if (!Array.isArray(results)) return false;
  return results.some((r) => r && VERIFICATION_PAIN_TYPES.has(String(r.type)));
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function latestDate(values: Array<Date | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!latest || v > latest) latest = v;
  }
  return latest;
}

export class SeedCascadeService extends BaseService {
  private static instance: SeedCascadeService;

  private constructor() {
    super();
  }

  static getInstance(): SeedCascadeService {
    if (!SeedCascadeService.instance) {
      SeedCascadeService.instance = new SeedCascadeService();
    }
    return SeedCascadeService.instance;
  }

  async getSummary(seedId: string): Promise<SeedCascadeSummary | null> {
    const seedRows = await prisma.$queryRaw<SeedRow[]>`
      SELECT
        dps.id,
        dps.tenant_id,
        dps.status,
        dps.outreach_state,
        dps.published_at,
        dps.nap_verified_at,
        dps.contact_status,
        dps.category,
        dps.city,
        dps.state,
        dps.owner_phone,
        dps.owner_email,
        dl.business_name,
        dl.phone AS listing_phone,
        dl.email AS listing_email
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId}
      LIMIT 1
    `;
    const seed = seedRows[0];
    if (!seed) return null;

    const touches = await prisma.$queryRaw<TouchRow[]>`
      SELECT id, channel, outcome, notes, occurred_at, metadata
      FROM directory_seed_outreach_touches
      WHERE seed_id = ${seedId}
      ORDER BY occurred_at DESC
      LIMIT 100
    `;

    const links = await prisma.$queryRaw<any[]>`
      SELECT dscl.campaign_id, dscl.link_role, mc.display_id, mc.business_name, mc.stage
      FROM directory_seed_campaign_links dscl
      JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
      WHERE dscl.seed_id = ${seedId}
      ORDER BY CASE dscl.link_role WHEN 'primary' THEN 0 ELSE 1 END, dscl.created_at
    `;
    const campaignIds = links.map((l) => l.campaign_id).filter(Boolean);

    const logs = campaignIds.length
      ? await prisma.$queryRaw<LogRow[]>`
          SELECT id, campaign_id, contact_channel, outcome, notes, contact_date,
                 created_at, call_details, verification_results
          FROM mkt_outreach_log
          WHERE campaign_id = ANY(${campaignIds}::text[])
          ORDER BY created_at DESC
          LIMIT 100
        `
      : [];

    const galleryRows = campaignIds.length
      ? await prisma.$queryRaw<any[]>`
          SELECT id, campaign_id, sibling_campaign_id, event_type, screenshot_index,
                 dwell_ms, created_at
          FROM mkt_gallery_events
          WHERE (campaign_id = ANY(${campaignIds}::text[])
                 OR sibling_campaign_id = ANY(${campaignIds}::text[]))
            AND event_type IN ('gallery_opened', 'screenshot_viewed', 'cta_clicked')
          ORDER BY created_at DESC
          LIMIT 100
        `
      : [];

    const scanRows = await prisma.$queryRaw<any[]>`
      SELECT id, surface, product_id, created_at
      FROM qr_scan_events
      WHERE tenant_id = ${seed.tenant_id}
        AND surface LIKE 'cascade%'
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const announceScheduled = touches.find((t) => t.outcome === 'announce_scheduled') ?? null;
    const announceDelivered = touches.find((t) => t.outcome === 'announce_delivered') ?? null;

    const latestPainTouch = touches.find((t) => hasPainResult(t.metadata?.verification_results)) ?? null;
    const latestPainLog = logs.find((l) => hasPainResult(l.verification_results)) ?? null;

    const hasOperational =
      !!seed.nap_verified_at ||
      seed.outreach_state === 'freshness_verified' ||
      touches.some((t) => ['connected', 'form_submitted', 'claimed'].includes(String(t.outcome))) ||
      logs.some(
        (l) =>
          l.outcome === 'reached' ||
          l.call_details?.operating_status_confirmed === true ||
          l.outcome === 'freshness_verified',
      );

    const hasChannel =
      !!(seed.owner_phone || seed.owner_email || seed.listing_phone || seed.listing_email) ||
      touches.some((t) => ['call', 'email', 'sms', 'mail'].includes(t.channel) && !!t.outcome);

    const hasPain = !!(latestPainTouch || latestPainLog);

    const act1Missing: string[] = [];
    if (!hasOperational) act1Missing.push('operational status (C1)');
    if (!hasChannel) act1Missing.push('contact channel (C4)');
    if (!hasPain) act1Missing.push('confirmed/desk-confirmed pain (C3)');
    const act1Cleared = act1Missing.length === 0;

    const announceAt = announceDelivered ? new Date(announceDelivered.occurred_at) : null;
    const awarenessTouches = touches.filter(
      (t) =>
        ['mail', 'email'].includes(t.channel) &&
        (!announceAt || new Date(t.occurred_at) >= announceAt),
    );
    const lastAwareness = awarenessTouches[0] ?? null;
    const act2Done = !!lastAwareness;

    const galleryOpened = galleryRows.find((g) => g.event_type === 'gallery_opened') ?? null;
    const galleryTaggedScan =
      scanRows.find((s) => s.surface === 'cascade_gallery') ?? null;
    const confirmScan = scanRows.find((s) => s.surface === 'cascade_confirm') ?? null;
    const act3Cleared = !!(galleryOpened || galleryTaggedScan);

    const visitTouch = touches.find((t) => t.channel === 'visit') ?? null;
    const act4Done = !!visitTouch;

    const acts: CascadeAct[] = [
      {
        act: 1,
        name: 'Verification',
        status: act1Cleared ? 'done' : act1Missing.length < 3 ? 'in_progress' : 'not_started',
        detail: act1Cleared
          ? 'Operational + channel + pain on record.'
          : `Missing: ${act1Missing.join(', ')}.`,
        lastEventAt: iso(
          latestDate([
            latestPainTouch?.occurred_at ?? null,
            latestPainLog?.created_at ?? null,
            announceDelivered?.occurred_at ?? null,
            announceScheduled?.occurred_at ?? null,
          ]),
        ),
      },
      {
        act: 2,
        name: 'Awareness',
        status: act2Done ? 'done' : announceDelivered ? 'in_progress' : 'not_started',
        detail: act2Done
          ? `Last ${lastAwareness?.channel} touch after the announce.`
          : announceDelivered
            ? 'Announced; no mail/email awareness touch logged yet.'
            : 'Waiting for the announce.',
        lastEventAt: iso(lastAwareness?.occurred_at ?? null),
      },
      {
        act: 3,
        name: 'Show',
        status: act3Cleared ? 'done' : act2Done ? 'in_progress' : 'not_started',
        detail: galleryOpened
          ? 'Gallery opened on a linked campaign.'
          : galleryTaggedScan
            ? 'Gallery-tagged QR scan recorded.'
            : 'No gallery view yet. A confirm-page scan alone does not clear this gate.',
        lastEventAt: iso(
          latestDate([
            galleryOpened?.created_at ?? null,
            galleryTaggedScan?.created_at ?? null,
          ]),
        ),
      },
      {
        act: 4,
        name: 'Tell (walk-in)',
        status: act4Done ? 'done' : act3Cleared ? 'in_progress' : 'blocked',
        detail: act4Done
          ? 'Visit touch logged.'
          : act3Cleared
            ? 'Gate cleared — walk-in can be scheduled.'
            : 'Walk-in waits for the act-3 gate or an owner reply.',
        lastEventAt: iso(visitTouch?.occurred_at ?? null),
      },
    ];

    const timeline: CascadeTimelineEvent[] = [
      ...touches.map((t) => ({
        id: `touch-${t.id}`,
        source: 'seed_touch' as const,
        at: iso(t.occurred_at)!,
        channel: t.channel,
        outcome: t.outcome,
        label: t.outcome
          ? `${t.channel} · ${String(t.outcome).replace(/_/g, ' ')}`
          : `${t.channel} touch`,
        notes: t.notes,
      })),
      ...logs.map((l) => ({
        id: `log-${l.id}`,
        source: 'campaign_log' as const,
        at: iso(l.created_at)!,
        channel: l.contact_channel,
        outcome: l.outcome,
        label: `${l.contact_channel} · ${String(l.outcome).replace(/_/g, ' ')}`,
        notes: l.notes,
      })),
      ...galleryRows.map((g) => ({
        id: `gallery-${g.id}`,
        source: 'gallery_event' as const,
        at: iso(g.created_at)!,
        channel: 'gallery',
        outcome: g.event_type,
        label: `Gallery · ${String(g.event_type).replace(/_/g, ' ')}`,
        notes: g.screenshot_index != null ? `screenshot ${g.screenshot_index}` : null,
      })),
      ...scanRows.map((s) => ({
        id: `scan-${s.id}`,
        source: 'qr_scan' as const,
        at: iso(s.created_at)!,
        channel: 'qr',
        outcome: s.surface,
        label: `QR · ${s.surface}`,
        notes: s.product_id ? `product ${s.product_id}` : null,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const gateReason = act3Cleared
      ? 'Act-3 gate cleared by a gallery view or gallery-tagged scan.'
      : confirmScan
        ? 'A confirm-page scan is recorded; it is act-2 delivery, not the act-3 gate. Waiting for a gallery view.'
        : 'No gallery view or gallery-tagged scan yet.';

    return {
      seedId: seed.id,
      businessName: seed.business_name,
      seedStatus: seed.status,
      outreachState: seed.outreach_state ?? 'not_started',
      publishedAt: iso(seed.published_at),
      announceScheduledAt: iso(announceScheduled?.occurred_at ?? null),
      announceDeliveredAt: iso(announceDelivered?.occurred_at ?? null),
      announceChannel: announceDelivered?.channel ?? announceScheduled?.channel ?? null,
      acts,
      gate: {
        act1Cleared,
        act3Cleared,
        gateCleared: act3Cleared,
        reason: gateReason,
        galleryOpenedAt: iso(galleryOpened?.created_at ?? null),
        galleryTaggedScanAt: iso(galleryTaggedScan?.created_at ?? null),
        confirmScanAt: iso(confirmScan?.created_at ?? null),
        missing: act1Missing,
      },
      linkedCampaigns: links.map((l) => ({
        id: l.campaign_id,
        displayId: l.display_id ?? null,
        businessName: l.business_name ?? null,
        stage: l.stage ?? null,
        linkRole: l.link_role,
      })),
      timeline: timeline.slice(0, 50),
    };
  }
}

export default SeedCascadeService.getInstance();
