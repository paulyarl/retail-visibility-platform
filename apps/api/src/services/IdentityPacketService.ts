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
import IdentityEvidenceService, {
  type IdentityEvidenceRow,
  type OwnerContact,
} from './IdentityEvidenceService';
import {
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
    phone?: string | null;
    website_url?: string | null;
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
    hours: null,
    primary_category: campaign?.category ?? meta.matched_business?.category ?? null,
    snap_ebt: null,
    attributes: input.attributes?.length ? `${input.attributes.length} attribute(s)` : null,
  };

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
    for (const field of m.corroborates) {
      if (!isIdentityFieldKey(field) || !(field in evidence)) continue;
      evidence[field].push({
        name: m.sourceName,
        tier,
        independenceGroup: group,
        agrees: true,
        evidenceState: isIdentityEvidenceState(m.evidenceState) ? m.evidenceState : null,
        url: m.sourceUrl ?? null,
        accessedAt: m.accessedAt ? new Date(m.accessedAt).toISOString() : null,
        manual: true,
      });
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
        phone: true,
        website_url: true,
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

    return assembleIdentityPacket({
      campaignId,
      campaign,
      audit,
      provenance,
      callConfirmed,
      attributes,
      manualEvidence,
      seed,
    });
  }
}

export default new IdentityPacketService();
