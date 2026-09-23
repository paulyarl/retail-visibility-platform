/**
 * IdentityPacketService — assembles the Identity Packet for a business-scope
 * campaign: a source-scored evidence ledger behind the seed decision.
 *
 * The packet answers "how well do we know this business, and from how many
 * independent authoritative sources?" It scores two axes (identity + operational
 * recency), lists hard vetoes and QC signals, and returns a Push/Wait
 * recommendation. The operator decides; the packet is advisory.
 *
 * Split:
 *   - assembleIdentityPacket() is PURE — takes already-fetched rows, returns the
 *     scored packet. Unit-testable with fixtures.
 *   - buildForCampaign() fetches the rows and delegates to the pure assembler.
 *
 * The packet is a DERIVED view. Evidence already lives in the audits,
 * provenance, and outreach log; this service does not create a duplicate store.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { isStubBusinessAnalysisAudit } from '../lib/marketing-audits';
import { resolveCampaignNap } from '../lib/canonical-nap';
import IdentityEvidenceService, {
  type IdentityEvidenceRow,
  type OwnerContact,
} from './IdentityEvidenceService';
import {
  evidenceStateDisputes,
  inferSourceTier,
  isIdentityEvidenceState,
  isIdentityFieldKey,
  isIdentitySourceTier,
  scoreIdentityPacket,
  sourceGroupSlug,
  type IdentityEvidenceState,
  type IdentityFieldEvidence,
  type IdentityFieldKey,
  type IdentityPacketScore,
  type IdentitySourceRef,
  type IdentitySourceTier,
  type IdentityStatus,
  type OperationalStatus,
} from './directory/identityScoring';
import { dimensionForClass, inferAuthorityClass } from './directory/evidenceDimensions';

// Tier inference lives with the rest of the scoring vocabulary (identityScoring)
// so the evidence service can use it without importing this module — the two
// would otherwise form an import cycle. Re-exported here for existing callers.
export { inferSourceTier };

// ─── DTO ─────────────────────────────────────────────────────────────────

export interface IdentityPacketLedgerEntry {
  name: string;
  tier: IdentitySourceTier;
  independenceGroup: string;
  url: string | null;
  accessedAt: string | null;
  fields: IdentityFieldKey[];
  /** True when an operator-entered source contributed to this ledger row. */
  manual: boolean;
}

export interface IdentityPacket {
  campaignId: string;
  businessName: string | null;
  /**
   * Resolved business city/state/zip — campaign structured address first,
   * then the audit's canonical NAP, then audit metadata (matched → parsed
   * combined address → requested); city/state may finally fall back to the
   * campaign's market scope (shared lib/canonical-nap contract). Carried for
   * the Verify record modal prefill — these are not scored fields.
   */
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  /**
   * Raw business_hours captured on the campaign record (operator-verified on
   * a call, or GBP enrichment). Carried so the Verify record modal can
   * prefill the hours editor on re-open — the scored `hours` field holds a
   * display summary, not the day-map.
   */
  businessHours: Record<string, any> | null;
  /**
   * Campaign-record contact + profile lists, carried for the Verify record
   * modal prefill (same role as businessHours). The modal re-submits these
   * verbatim on save and the campaign write REPLACES the columns — a modal
   * that never rendered them would silently drop every stored row.
   */
  email: string | null;
  socialProfiles: Array<{ platform: string; url: string }>;
  directoryProfiles: Array<Record<string, any>>;
  identityStatus: IdentityStatus;
  operationalStatus: OperationalStatus;
  callConfirmed: boolean | null;
  snapSourced: boolean;
  fields: Array<{ field: IdentityFieldKey; value: string | null; sources: IdentitySourceRef[] }>;
  ledger: IdentityPacketLedgerEntry[];
  /** Operator-entered sources visible to this campaign (own + siblings'). */
  manualEvidence: IdentityEvidenceRow[];
  /** Newest captured owner contact, or null when none has been captured. */
  ownerContact: OwnerContact | null;
  score: IdentityPacketScore;
  seed: { id: string; status: string; publicUrl: string | null } | null;
  /**
   * Persisted operator seed decision (mkt_campaigns_list.seed_decision*), or
   * null when none was recorded / the columns do not exist yet. 'wait' means
   * the operator chose not to seed yet — advisory only, Push stays enabled.
   */
  seedDecision: { decision: string; at: string; by: string | null } | null;
  generatedAt: string;
}

// ─── Pure assembly ───────────────────────────────────────────────────────

export interface AssembleInput {
  campaignId: string;
  campaign: {
    business_name?: string | null;
    category?: string | null;
    city?: string | null;
    state?: string | null;
    address_line1?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_zip?: string | null;
    phone?: string | null;
    website_url?: string | null;
    business_hours?: Record<string, any> | null;
    email?: string | null;
    social_profiles?: Array<{ platform: string; url: string }> | null;
    directory_profiles?: Array<Record<string, any>> | null;
  } | null;
  /** Latest non-stub business_analysis audit_data, or null. */
  audit: any | null;
  /** Seed provenance rows (field_key/value/source_name/evidence_state/show_on_public). */
  provenance?: Array<{
    field_key: string;
    value: string | null;
    source_name: string | null;
    source_url?: string | null;
    evidence_state?: string | null;
    accessed_at?: string | Date | null;
  }>;
  /** Live call verdict on operating status from the outreach log. */
  callConfirmed?: boolean | null;
  /** Sourced attribute chips mined from scan audits. */
  attributes?: Array<{ key: string; label: string; sourcePlatform?: string | null; sourceUrl?: string | null; asOf?: string | null }>;
  /**
   * Operator-entered sources (mkt_identity_evidence). Prospect-scoped, so a
   * sibling campaign's captures count here too. Also returned on the packet so
   * the Identity tab can list and retract them.
   */
  manualEvidence?: IdentityEvidenceRow[];
  seed?: { id: string; status: string; publicUrl: string | null } | null;
  /** Persisted operator seed decision (see IdentityPacket.seedDecision). */
  seedDecision?: IdentityPacket['seedDecision'];
  /**
   * Resolved signal_weight(category, platform) keyed by platform key
   * (google, yelp, …), from the category's intelligence profiles (Phase 5).
   * Absent/empty → every source scores unweighted (legacy byte-identity).
   */
  signalWeights?: Record<string, number>;
}

const PLATFORM_SOURCES: Array<{ key: string; name: string; tier: IdentitySourceTier; group: string }> = [
  { key: 'google', name: 'Google Business Profile', tier: 'major_aggregator', group: 'google' },
  { key: 'apple', name: 'Apple Maps', tier: 'major_aggregator', group: 'apple' },
  { key: 'yelp', name: 'Yelp', tier: 'secondary_aggregator', group: 'yelp' },
  { key: 'facebook', name: 'Facebook', tier: 'secondary_aggregator', group: 'facebook' },
  { key: 'bbb', name: 'Better Business Bureau', tier: 'secondary_aggregator', group: 'bbb' },
];

function normalizeValue(field: IdentityFieldKey, v: string | null | undefined): string {
  if (v == null) return '';
  const s = String(v).toLowerCase().trim();
  if (field === 'phone') return s.replace(/\D/g, '');
  return s.replace(/[^a-z0-9]+/g, ' ').trim();
}

function agreesWith(
  field: IdentityFieldKey,
  candidate: string | null | undefined,
  canonical: string | null | undefined,
): boolean {
  const a = normalizeValue(field, candidate);
  const b = normalizeValue(field, canonical);
  if (!a || !b) return false;
  if (field === 'phone') return a.slice(-10) === b.slice(-10);
  return a === b;
}

const slug = sourceGroupSlug;

/**
 * Newest captured owner contact across the evidence rows (rows arrive
 * newest-first). Owner identity is not scored — it is the reusable source for
 * owner outreach, so the packet surfaces the most recent capture and the
 * evidence row that produced it.
 */
export function newestOwnerContact(rows: IdentityEvidenceRow[]): OwnerContact | null {
  for (const r of rows) {
    if (!r.ownerName && !r.ownerPhone && !r.ownerEmail) continue;
    return {
      name: r.ownerName,
      phone: r.ownerPhone,
      email: r.ownerEmail,
      sourceName: r.sourceName,
      evidenceId: r.id,
      capturedAt: r.accessedAt ?? r.createdAt,
    };
  }
  return null;
}

const HOURS_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_ABBR: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const to12h = (t: string): string => {
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(t);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Compact one-line summary of the stored business_hours day-map for the
 * packet's `hours` field — consecutive days with identical hours collapse
 * into a range ("Mon–Fri 9:30 AM–8:30 PM · Sat–Sun Closed"). Returns null
 * when no day entries exist so the field reads as uncaptured, not fabricated.
 */
function summarizeBusinessHours(raw: any): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const days = HOURS_DAYS
    .map((d) => ({ d, h: raw[d] }))
    .filter((e) => e.h && typeof e.h === 'object');
  if (days.length === 0) return null;
  const groups: Array<{ from: string; to: string; label: string }> = [];
  for (const { d, h } of days) {
    const label = h.closed ? 'Closed' : `${to12h(h.open)}–${to12h(h.close)}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.to = d;
    else groups.push({ from: d, to: d, label });
  }
  return groups
    .map((g) => `${g.from === g.to ? DAY_ABBR[g.from] : `${DAY_ABBR[g.from]}–${DAY_ABBR[g.to]}`} ${g.label}`)
    .join(' · ');
}

/**
 * Assemble + score an identity packet from already-fetched rows. Pure.
 */
export function assembleIdentityPacket(input: AssembleInput): IdentityPacket {
  const { campaign, audit } = input;
  const meta = audit?.audit_metadata ?? {};
  const nap = audit?.nap_consistency ?? {};
  const website = audit?.website ?? {};
  const platforms = audit?.platforms ?? {};
  const operational = audit?.operational_status ?? {};

  const identityStatus: IdentityStatus =
    meta.identity_status === 'confirmed' || meta.identity_status === 'mismatched'
      ? meta.identity_status
      : 'ambiguous';
  const operationalStatus: OperationalStatus =
    operational.status === 'active' ||
    operational.status === 'likely_active' ||
    operational.status === 'inactive'
      ? operational.status
      : 'unable_to_verify';

  // Canonical (consensus) values — campaign row wins, then audit canonical NAP.
  const canonical: Record<IdentityFieldKey, string | null> = {
    name: campaign?.business_name ?? nap.canonical_name ?? meta.matched_business?.business_name ?? null,
    address:
      campaign?.address_line1 ??
      nap.canonical_address ??
      meta.matched_business?.address ??
      null,
    phone: campaign?.phone ?? nap.canonical_phone ?? meta.matched_business?.phone ?? null,
    website: campaign?.website_url ?? website.url ?? null,
    // Captured hours live on the campaign record (verification call / GBP
    // enrichment) — summarize them so the packet's hours field answers
    // "were hours captured?" instead of rendering blank.
    hours: summarizeBusinessHours(campaign?.business_hours),
    primary_category: campaign?.category ?? meta.matched_business?.category ?? null,
    snap_ebt: null,
    attributes: input.attributes?.length ? `${input.attributes.length} attribute(s)` : null,
  };

  // Resolved business city/state/zip — not scored fields (IdentityFieldKey
  // has no city/state/zip), but the Verify record modal prefills from them.
  // One shared contract (lib/canonical-nap); market scope is allowed here
  // because this is a prefill hint the operator confirms, not a seed gate.
  const resolvedNap = resolveCampaignNap(campaign, audit, { marketScopeFallback: true });
  const addressCity = resolvedNap.city;
  const addressState = resolvedNap.state;
  const addressZip = resolvedNap.zip;

  const evidence: Record<IdentityFieldKey, IdentitySourceRef[]> = {
    name: [],
    address: [],
    phone: [],
    website: [],
    hours: [],
    primary_category: [],
    snap_ebt: [],
    attributes: [],
  };

  // 1. Platform blocks — per-platform displayed values.
  for (const p of PLATFORM_SOURCES) {
    const block = platforms[p.key];
    if (!block || typeof block !== 'object') continue;
    // profile_url is the source's own link — never a competing *website*
    // value (that would manufacture a false conflict against the owner site).
    const profileUrl = block.profile_url ?? null;
    const map: Array<[IdentityFieldKey, any]> = [
      ['name', block.displayed_name],
      ['address', block.displayed_address],
      ['phone', block.displayed_phone],
      ['website', block.displayed_website],
    ];
    for (const [field, value] of map) {
      if (value == null || String(value).trim() === '') continue;
      evidence[field].push({
        name: p.name,
        tier: p.tier,
        independenceGroup: p.group,
        agrees: agreesWith(field, value, canonical[field]),
        url: profileUrl,
        accessedAt: audit?.created_at ?? null,
      });
    }
  }

  // 2. Owner / first-party website.
  if (website.url) {
    evidence.website.push({
      name: 'Owner website',
      tier: 'first_party',
      independenceGroup: 'owner',
      agrees: true,
      url: website.url,
      accessedAt: audit?.created_at ?? null,
    });
  }

  // 3. Audit identity-corroboration sources — the audit's own identity
  //    confirmation list. Assigned to the required fields (a source that
  //    confirms identity confirms name + address).
  for (const c of Array.isArray(meta.identity_corroboration_sources) ? meta.identity_corroboration_sources : []) {
    const name = typeof c === 'string' ? c : c?.source;
    if (!name) continue;
    const url = typeof c === 'object' ? c?.url ?? null : null;
    const tier = inferSourceTier(name);
    const group = sourceGroupSlug(name) || 'corroboration';
    for (const field of ['name', 'address'] as IdentityFieldKey[]) {
      evidence[field].push({
        name: String(name),
        tier,
        independenceGroup: group,
        agrees: true,
        url,
        accessedAt: audit?.created_at ?? null,
      });
    }
  }

  // 4. Sourced attribute chips (from scan audits).
  for (const a of input.attributes ?? []) {
    evidence.attributes.push({
      name: a.sourcePlatform ?? 'scan',
      tier: inferSourceTier(a.sourcePlatform ?? ''),
      independenceGroup: sourceGroupSlug(a.sourcePlatform ?? 'scan') || 'scan',
      agrees: true,
      url: a.sourceUrl ?? null,
      accessedAt: a.asOf ?? null,
    });
  }

  // 5. Seed provenance rows — authoritative per-field evidence captured at
  //    seed time. Overrides the consensus value when present.
  let snapSourced = canonical.snap_ebt == null;
  for (const p of input.provenance ?? []) {
    const field = p.field_key as IdentityFieldKey;
    if (!(field in evidence)) continue;
    if (p.value != null && String(p.value).trim() !== '') {
      canonical[field] = p.value;
    }
    evidence[field].push({
      name: p.source_name ?? 'provenance',
      tier: inferSourceTier(p.source_name ?? ''),
      independenceGroup: sourceGroupSlug(p.source_name ?? 'provenance') || 'provenance',
      agrees: true,
      evidenceState: (p.evidence_state as IdentityEvidenceState) ?? null,
      url: p.source_url ?? null,
      accessedAt: p.accessed_at ? new Date(p.accessed_at).toISOString() : null,
    });
    if (field === 'snap_ebt') {
      snapSourced = p.evidence_state !== 'probable' && p.evidence_state !== 'not_checked';
    }
  }

  // 6. Operator-entered sources (mkt_identity_evidence). The operator asserts
  //    corroboration, so `agrees` is true by construction — there is no
  //    competing value to compare against. The independence group stays the
  //    natural one for the source name, so a manual "Google Business Profile"
  //    still discounts against the audit's own Google block instead of
  //    double-counting the same platform.
  const manualEvidence = input.manualEvidence ?? [];
  for (const m of manualEvidence) {
    const tier = isIdentitySourceTier(m.tier) ? m.tier : inferSourceTier(m.sourceName);
    const group = m.independenceGroup || sourceGroupSlug(m.sourceName) || 'manual';
    const evidenceState = isIdentityEvidenceState(m.evidenceState) ? m.evidenceState : null;
    // Operator evidence is NOT unconditionally agreeing: an `owner_disputed` /
    // `conflicting` row disputes the canonical (spec §2, operator judgment
    // trust). This replaces the old `agrees: true` hardcode, which made the
    // operator's tool able only to add agreement — never to adjudicate or
    // dispute. An agreeing operator row whose class is an authority for the
    // field now adjudicates the field's conflicts (see scoreField).
    const agrees = !evidenceStateDisputes(evidenceState);
    for (const field of m.corroborates) {
      if (!isIdentityFieldKey(field) || !(field in evidence)) continue;
      evidence[field].push({
        name: m.sourceName,
        tier,
        independenceGroup: group,
        agrees,
        evidenceState,
        url: m.sourceUrl ?? null,
        accessedAt: m.accessedAt ? new Date(m.accessedAt).toISOString() : null,
        manual: true,
      });
    }
  }

  // Annotate every source with its authority class + evidence dimension — the
  // eligibility axis (see directory/evidenceDimensions.ts). Additive metadata:
  // the scorer does not consume it yet (sprint Phase 3), but the packet carries
  // it so the gate and the UI can. Conservative inference — an unrecognized
  // source defaults to directory (→ operational).
  for (const field of Object.keys(evidence) as IdentityFieldKey[]) {
    for (const s of evidence[field]) {
      const cls = inferAuthorityClass(s.name, s.tier);
      s.authorityClass = cls;
      s.dimension = dimensionForClass(cls);
      // Signal weight — platform-keyed sources (audit blocks carry the
      // platform key as their independence group; manual/provenance sources
      // resolve it from the source name) get their resolved weight. Sources
      // with no platform key stay unweighted (→ 1 in the scorer).
      const w =
        input.signalWeights?.[s.independenceGroup] ??
        input.signalWeights?.[sourceGroupSlug(s.name)];
      if (w != null) s.signalWeight = w;
    }
  }

  const fields: IdentityFieldEvidence[] = (Object.keys(evidence) as IdentityFieldKey[]).map((field) => ({
    field,
    value: canonical[field],
    sources: evidence[field],
  }));

  const score = scoreIdentityPacket({
    identityStatus,
    operationalStatus,
    callConfirmed: input.callConfirmed ?? null,
    fields,
    snapSourced,
  });

  // De-duplicated source ledger (one row per source, listing the fields it
  // corroborates) for the UI.
  const ledgerByKey = new Map<string, IdentityPacketLedgerEntry>();
  for (const f of fields) {
    for (const s of f.sources) {
      const key = `${s.independenceGroup}|${s.name}`;
      const existing = ledgerByKey.get(key);
      if (existing) {
        if (!existing.fields.includes(f.field)) existing.fields.push(f.field);
        if (s.manual) existing.manual = true;
      } else {
        ledgerByKey.set(key, {
          name: s.name,
          tier: s.tier,
          independenceGroup: s.independenceGroup,
          url: s.url ?? null,
          accessedAt: s.accessedAt ?? null,
          fields: [f.field],
          manual: s.manual === true,
        });
      }
    }
  }

  return {
    campaignId: input.campaignId,
    businessName: canonical.name,
    addressCity,
    addressState,
    addressZip,
    businessHours: campaign?.business_hours ?? null,
    email: campaign?.email ?? null,
    socialProfiles: Array.isArray(campaign?.social_profiles) ? campaign.social_profiles : [],
    directoryProfiles: Array.isArray(campaign?.directory_profiles) ? campaign.directory_profiles : [],
    identityStatus,
    operationalStatus,
    callConfirmed: input.callConfirmed ?? null,
    snapSourced,
    fields,
    ledger: [...ledgerByKey.values()],
    manualEvidence,
    ownerContact: newestOwnerContact(manualEvidence),
    score,
    seed: input.seed ?? null,
    seedDecision: input.seedDecision ?? null,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Service (DB) ────────────────────────────────────────────────────────

class IdentityPacketService {
  /**
   * Build the identity packet for a business-scope campaign.
   */
  async buildForCampaign(campaignId: string): Promise<IdentityPacket> {
    const campaign = await (prisma as any).mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_name: true,
        category: true,
        city: true,
        state: true,
        address_line1: true,
        address_city: true,
        address_state: true,
        address_zip: true,
        phone: true,
        website_url: true,
        business_hours: true,
        email: true,
        social_profiles: true,
        directory_profiles: true,
      },
    });

    // Latest non-stub business_analysis audit.
    const auditRows = await (prisma as any).mkt_audits_list.findMany({
      where: { campaign_id: campaignId, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    const auditRow = (Array.isArray(auditRows) ? auditRows : []).find(
      (a: any) => !isStubBusinessAnalysisAudit(a),
    );
    const audit = auditRow ? { ...(auditRow.audit_data ?? {}), created_at: auditRow.created_at } : null;

    // Live call verdict on operating status (newest wins).
    let callConfirmed: boolean | null = null;
    try {
      const logs = await (prisma as any).mkt_outreach_log.findMany({
        where: { campaign_id: campaignId },
        orderBy: { created_at: 'desc' },
        take: 25,
        select: { call_details: true },
      });
      const hit = (Array.isArray(logs) ? logs : []).find(
        (l: any) =>
          l?.call_details?.operating_status_confirmed === true ||
          l?.call_details?.operating_status_confirmed === false,
      );
      if (hit) callConfirmed = hit.call_details.operating_status_confirmed;
    } catch (error) {
      logger.warn('IdentityPacket: outreach log lookup failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    // Linked seed + provenance.
    let seed: IdentityPacket['seed'] = null;
    let provenance: AssembleInput['provenance'] = [];
    try {
      const linkRows = await prisma.$queryRaw<any[]>`
        SELECT dps.id, dps.status, dl.slug
        FROM directory_seed_campaign_links dscl
        JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
        JOIN directory_listings_list dl ON dl.id = dps.listing_id
        WHERE dscl.campaign_id = ${campaignId} AND dscl.link_role = 'primary'
        LIMIT 1
      `;
      const link = Array.isArray(linkRows) ? linkRows[0] : null;
      if (link) {
        seed = { id: link.id, status: link.status, publicUrl: link.slug ? `/place/${link.slug}` : null };
        provenance = await (prisma as any).directory_field_provenance.findMany({
          where: { seed_id: link.id },
          select: {
            field_key: true,
            value: true,
            source_name: true,
            source_url: true,
            evidence_state: true,
            accessed_at: true,
          },
        });
      }
    } catch (error) {
      logger.warn('IdentityPacket: seed/provenance lookup failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    // Sourced attribute chips from scan audits.
    let attributes: AssembleInput['attributes'] = [];
    try {
      const { extractAttributesFromAuditData } = await import('./directory/listingAttributes');
      const scanRows = await (prisma as any).mkt_audits_list.findMany({
        where: {
          campaign_id: campaignId,
          platform: { in: ['gold_standard_scan', 'intelligence_discovery', 'city_analysis'] },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { platform: true, audit_data: true },
      });
      const seen = new Set<string>();
      for (const row of Array.isArray(scanRows) ? scanRows : []) {
        for (const a of extractAttributesFromAuditData(String(row.platform), row.audit_data ?? {})) {
          const key = a.key.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          attributes.push({
            key: a.key,
            label: a.label,
            sourcePlatform: a.sourcePlatform ?? null,
            sourceUrl: a.sourceUrl ?? null,
            asOf: a.asOf ?? null,
          });
        }
        if (attributes.length >= 40) break;
      }
    } catch (error) {
      logger.warn('IdentityPacket: attribute mining failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    // Operator-entered sources — prospect-scoped, so a sibling campaign's
    // captures count here too.
    let manualEvidence: IdentityEvidenceRow[] = [];
    try {
      manualEvidence = await IdentityEvidenceService.listForCampaign(campaignId);
    } catch (error) {
      logger.warn('IdentityPacket: manual evidence lookup failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    // Signal weights — signal_weight(category, platform) resolved from the
    // category's intelligence profiles (Phase 5). Non-fatal: an empty map
    // leaves every source unweighted and the scoring byte-identical to the
    // pre-weight model.
    let signalWeights: Record<string, number> = {};
    try {
      if (campaign?.category) {
        const { IntelligenceProfileService } = await import('./intelligence/IntelligenceProfileService');
        const platformKeys = new Set<string>(PLATFORM_SOURCES.map((p) => p.key));
        for (const k of Object.keys(audit?.platforms ?? {})) platformKeys.add(k);
        const resolved = await IntelligenceProfileService.getInstance().resolveSignalWeights({
          category: campaign.category,
          platforms: [...platformKeys],
          city: campaign.city ?? null,
          state: campaign.state ?? null,
        });
        for (const [k, v] of resolved) signalWeights[k] = v.weight;
      }
    } catch (error) {
      logger.warn('IdentityPacket: signal-weight resolution failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    // Persisted seed decision (migration 300). Non-fatal: a DB that has not
    // been migrated yet simply yields no decision.
    let seedDecision: IdentityPacket['seedDecision'] = null;
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT seed_decision, seed_decision_at, seed_decision_by
        FROM mkt_campaigns_list
        WHERE id = ${campaignId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.seed_decision) {
        seedDecision = {
          decision: row.seed_decision,
          at:
            row.seed_decision_at instanceof Date
              ? row.seed_decision_at.toISOString()
              : String(row.seed_decision_at ?? ''),
          by: row.seed_decision_by ?? null,
        };
      }
    } catch (error) {
      logger.warn('IdentityPacket: seed-decision lookup failed (non-fatal)', undefined, {
        campaignId,
        error: (error as Error).message,
      });
    }

    return assembleIdentityPacket({
      campaignId,
      campaign,
      audit,
      provenance,
      callConfirmed,
      attributes,
      manualEvidence,
      seed,
      seedDecision,
      signalWeights,
    });
  }

  /**
   * Persist the operator's seed decision for a campaign ('wait' or 'clear').
   * Advisory only — it never blocks Push; it survives reloads so the Identity
   * tab reflects the last recorded decision.
   */
  async setSeedDecision(
    campaignId: string,
    decision: 'wait' | 'clear',
    by: string | null,
  ): Promise<IdentityPacket['seedDecision']> {
    if (decision === 'clear') {
      await prisma.$executeRaw`
        UPDATE mkt_campaigns_list
        SET seed_decision = NULL, seed_decision_at = NULL, seed_decision_by = NULL
        WHERE id = ${campaignId}
      `;
      return null;
    }
    const at = new Date();
    await prisma.$executeRaw`
      UPDATE mkt_campaigns_list
      SET seed_decision = ${decision}, seed_decision_at = ${at}, seed_decision_by = ${by}
      WHERE id = ${campaignId}
    `;
    return { decision, at: at.toISOString(), by };
  }
}

export default new IdentityPacketService();
